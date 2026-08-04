# report-viewer

Cloudflare Workers + R2 上で動く、**非公開のレポートビューア**。
Hermes agent が定期生成した調査レポート（HTML）を、iPhone / Mac から快適に読むためのホスティングです。

> **ライブデモ（認証なし・静的スナップショット）**
> https://0nihajim.github.io/report-viewer/
>
> 本番構成では Cloudflare Access が前段に入り、許可したメールアドレスのみアクセスできます。
> GitHub Pages 版は見た目確認用のため、認証・IP制限はありません。

## なぜ Cloudflare か

| 構成 | 月額 | 認証の作り込み |
|---|---|---|
| **Workers + R2 + Access** | **$0**（ドメイン代のみ） | 設定のみ・コード0行 |
| AWS Amplify Hosting | 転送 $0.15/GB + ストレージ | Basic認証（共有パスワード）のみ |
| CloudFront + S3 + Cognito | ほぼ$0だが構成が重い | Lambda@Edge / OIDC 自作 |

- **R2 はエグレス無料**、Workers 無料枠は 10万 req/日。レポート数千件でも無料枠内。
- **Cloudflare Access が 50ユーザーまで永久無料**。メールワンタイムPIN or Google/GitHub SSO で、
  オリジンに到達する前にエッジで認証を強制できる。

## アーキテクチャ

```
Hermes cron (レポート生成)
   │ POST /api/reports  (HTML + メタデータ)
   ▼
Cloudflare R2  reports/<id>.html
   ▲
Cloudflare Worker  ── ビューア本体
   ├ /          一覧（日付降順・検索フィルタ）
   ├ /r/<id>    レポート表示（サニタイズ + 自前組版）
   └ /api/...   一覧JSON / 投入 / 削除
   ▲
Cloudflare Access（メールOTP / SSO・許可リスト）
   ▲
Safari (iPhone / Mac)  ← ホーム画面に追加して PWA 化
```

### 設計上のポイント

**すべての見た目はビューアが持つ。レポートは構造だけを供給する。**
アーカイブの価値は、30日間に書かれた30本が同じ本の30章として読めることにある。
当初はレポートごとの `<style>` を通していたが、ページごとに世界観が変わって
読み物としての一貫性が壊れたため方針を反転した。

デザインシステムは 2 つの成果物で定義される。

- **`DESIGN.md`** — Google の [design.md](https://github.com/google-labs-code/design.md)
  仕様に沿ったトークン定義。`npx @google/design.md lint` で構造と WCAG コントラストを検証
  （エラー0・警告0を維持）。`tokens.json`（W3C DTCG）と `theme.css`（Tailwind v4）も生成済み。
- **`kiroku-report` スキル** — レポート生成側が読む執筆規約。使えるクラス、
  禁止構造、日本語組版の注意点を定める。

**レポート HTML は必ずサニタイズする。**
`HTMLRewriter` で script / style / iframe / `on*` / `javascript:` を除去し、
`<body>` の中身だけを自前の読書シェルに埋め込みます。

`href` と `src` は規則が異なります。リンクは押されるまで通信しませんが、
`<img src>` は描画時に自動で読み込まれるため、**外部 URL はトラッキングピクセルとして
「Access で保護されたセッションから開いた事実」を漏らします**。
`src` は `data:image/*` と同一オリジンのみ許可します。

**ワイドテーブルは横スクロールに閉じ込める。**
生成された `<table width="1400">` はモバイルレイアウトを破壊するので、
サニタイズ時に `<div class="tw">`（`overflow-x: auto`）で包みます。

**Worker のスクリプト本体は Terraform で管理しない。**
wrangler が TypeScript のバンドルを担当し、Terraform は R2 / カスタムドメイン /
Access のみを持ちます。両方が script body を管理すると apply ごとに差分が出るためです。

## モバイル対応

- `viewport-fit=cover` + `env(safe-area-inset-*)` でノッチ・ホームインジケータを回避
- タップ領域は最小 44px（Apple HIG）
- `prefers-color-scheme` でダークモード追従
- 見出しから目次を自動生成（h2/h3、3つ以上で表示）
- PWA manifest + apple-touch-icon でホーム画面に追加可能
- 日本語フォントスタック（Hiragino / Noto Sans JP）、行間 1.8

## セットアップ

### 1. 依存

```bash
npm install
nix profile install nixpkgs#opentofu   # IaC 用
```

### 2. インフラ（OpenTofu）

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars   # 値を埋める
export CLOUDFLARE_API_TOKEN=...                # 必要権限は下記
tofu init
tofu apply
```

必要な API トークン権限:

| スコープ | 権限 |
|---|---|
| Account | Workers Scripts:Edit, Workers R2 Storage:Edit, Access: Apps and Policies:Edit, Account Settings:Read |
| Zone | Zone:Read, Workers Routes:Edit |

> `cloudflare_workers_custom_domain` は Worker が存在してから作られるため、
> 初回は `wrangler deploy` を先に実行してから `tofu apply` してください。

### 3. デプロイ

```bash
npx wrangler deploy
npx wrangler secret put INGEST_TOKEN   # ローカル/暫定用の投入トークン
```

### 4. レポートの投入

Cloudflare Access のサービストークン経由（本番）:

```bash
curl -X POST https://reports.example.com/api/reports \
  -H "CF-Access-Client-Id: $(tofu -chdir=infra output -raw ingest_client_id)" \
  -H "CF-Access-Client-Secret: $(tofu -chdir=infra output -raw ingest_client_secret)" \
  -H 'content-type: application/json' \
  -d '{
    "title": "調査レポート",
    "date": "2026-08-04",
    "tags": ["evaluation"],
    "summary": "一覧に出る1行要約",
    "html": "<h1>...</h1>"
  }'
```

Bearer トークン経由（ローカル / Access 未設定時）:

```bash
curl -X POST http://localhost:8788/api/reports?tags=evaluation \
  -H 'authorization: Bearer devtoken' \
  -H 'content-type: text/html' \
  --data-binary @report.html
```

`id` を省略すると `<日付>-<タイトル>` から slug を生成します（日本語もそのまま使えます）。

## 開発

```bash
npm run dev                          # wrangler dev (localhost:8788)
bash scripts/typecheck.sh            # tsc --noEmit
bash scripts/smoke.sh                # E2E (60 ケース)
bash scripts/test-consistency.sh eval inference otel   # 全レポートのCSS一致 (39)
bash scripts/test-escaping.sh        # 実体参照・CJK詰め (24)
bash scripts/test-css.sh            # ?css=1 経路の隔離 (33)
bash scripts/lint-report.sh samples/report-eval.html   # 執筆規約チェック
bash scripts/seed-report.sh samples/report-eval.html eval 2026-08-04 "evaluation"
npx -y @google/design.md lint DESIGN.md                # トークン + WCAG
```

### レポートの書き方

生成側は `kiroku-report` スキルに従います。要点のみ:

- `<style>` `<script>` `style=` は書かない（サニタイザが除去する）
- `<h1>` は1つ、見出しはレベルを飛ばさない
- 数値列は `class="num"` で右寄せ、単位はヘッダセルに
- 使えるクラスは `.eyebrow` `.lede` `.figures/.figure` `.callout` `.num` `.source`
- 末尾に必ず `.source`（出典なきレポートは意見にすぎない）

`scripts/lint-report.sh` が禁止構造と構造規約を機械的に検証します。

### GitHub Pages プレビューの生成

Pages は静的配信のみなので、起動中の Worker の出力をクロールして保存します
（テンプレートを再実装せず、本番と同一のレンダリング結果を得るため）。

```bash
npm run dev &
bash scripts/seed-demo.sh
BASE_PATH=/report-viewer bash scripts/export-static.sh   # -> dist/
```

## API

| メソッド | パス | 認証 | 説明 |
|---|---|---|---|
| GET | `/` | Access | 一覧 |
| GET | `/r/<id>` | Access | レポート表示（`?raw=1` で元HTML） |
| GET | `/api/reports` | Access | 一覧 JSON |
| POST/PUT | `/api/reports` | サービストークン or Bearer | 投入 |
| DELETE | `/api/reports/<id>` | サービストークン or Bearer | 削除 |
| GET | `/healthz` | Access | ヘルスチェック |

## ライセンス

MIT
