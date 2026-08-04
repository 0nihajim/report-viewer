export interface Env {
  REPORTS: R2Bucket;
  SITE_TITLE: string;
  /** Bearer token required by the ingest endpoints. Set via `wrangler secret put INGEST_TOKEN`. */
  INGEST_TOKEN?: string;
}

/** Metadata stored alongside each report object in R2 custom metadata. */
export interface ReportMeta {
  /** Stable slug used in the URL: /r/<id> */
  id: string;
  title: string;
  /** ISO-8601 date string (report date, not upload date). */
  date: string;
  tags: string[];
  /** Optional one-line summary shown in the list view. */
  summary?: string;
  /** Byte size of the stored HTML. */
  size: number;
  /** R2 object upload timestamp, ISO-8601. */
  uploaded: string;
}

/** Identity injected by Cloudflare Access, if present. */
export interface AccessIdentity {
  email: string | null;
}
