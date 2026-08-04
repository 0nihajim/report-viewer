##############################################################################
# Lookups
##############################################################################

data "cloudflare_zone" "this" {
  filter = {
    name = var.zone_name
  }
}

##############################################################################
# Storage: R2 bucket for generated report HTML
##############################################################################

resource "cloudflare_r2_bucket" "reports" {
  account_id = var.account_id
  name       = var.bucket_name
  location   = var.r2_location
}

# Separate bucket used by `wrangler dev` so local experiments never touch
# real reports. Matches preview_bucket_name in wrangler.jsonc.
resource "cloudflare_r2_bucket" "reports_preview" {
  account_id = var.account_id
  name       = "${var.bucket_name}-preview"
  location   = var.r2_location
}

# Reports are immutable once written; expire incomplete multipart uploads so
# aborted cron runs don't silently accrue storage.
resource "cloudflare_r2_bucket_lifecycle" "reports" {
  account_id  = var.account_id
  bucket_name = cloudflare_r2_bucket.reports.name

  rules = [{
    id      = "abort-incomplete-multipart"
    enabled = true
    conditions = {
      prefix = ""
    }
    abort_multipart_uploads_transition = {
      condition = {
        type    = "Age"
        max_age = 604800 # 7 days
      }
    }
  }]
}

##############################################################################
# Compute: the Worker (viewer application)
#
# The script body is deployed by wrangler (`npm run deploy`), which knows how to
# bundle TypeScript. Terraform owns the *infrastructure* around it: the custom
# domain and the Access policy. We therefore do NOT manage
# cloudflare_workers_script here — doing so would fight wrangler over the
# script body on every apply.
##############################################################################

# Binds the Worker to the real hostname and provisions the edge certificate.
# Requires the Worker to already exist, hence the depends_on note in README.
resource "cloudflare_workers_custom_domain" "viewer" {
  account_id = var.account_id
  zone_id    = data.cloudflare_zone.this.zone_id
  hostname   = var.hostname
  service    = var.worker_name
}

##############################################################################
# Identity: one-time-PIN over email needs no external IdP.
#
# Cloudflare provides a built-in "One-time PIN" IdP on every Zero Trust
# account, so we do not create an identity provider resource. The Access policy
# below simply allows specific email addresses; users receive a 6-digit code.
#
# To use Google/GitHub SSO instead, uncomment and fill in the block below, then
# add its id to `allowed_idps` on the application.
##############################################################################

# resource "cloudflare_zero_trust_access_identity_provider" "google" {
#   account_id = var.account_id
#   name       = "Google"
#   type       = "google"
#   config = {
#     client_id     = var.google_client_id
#     client_secret = var.google_client_secret
#   }
# }

##############################################################################
# Access: gate the whole hostname behind identity
##############################################################################

# Reusable group listing the humans who may read reports.
resource "cloudflare_zero_trust_access_group" "readers" {
  account_id = var.account_id
  name       = "${var.worker_name}-readers"

  include = concat(
    [for e in var.allowed_emails : { email = { email = e } }],
    [for d in var.allowed_email_domains : { email_domain = { domain = d } }],
  )
}

# Service token lets the report generator (Hermes cron) POST new reports
# without a browser login. Access validates the token pair at the edge.
resource "cloudflare_zero_trust_access_service_token" "ingest" {
  account_id = var.account_id
  name       = "${var.worker_name}-ingest"
  duration   = "8760h" # 1 year; rotate by tainting this resource
}

resource "cloudflare_zero_trust_access_application" "viewer" {
  account_id = var.account_id
  name       = var.site_title
  domain     = var.hostname
  type       = "self_hosted"

  session_duration = var.session_duration

  # Land users straight on the IdP instead of an extra "choose a method" click.
  auto_redirect_to_identity = false

  # App Launcher entry makes the viewer easy to reach from a phone.
  app_launcher_visible = true

  # Allow the Worker to read the service-token client id from request headers,
  # so the ingest path can be authorized non-interactively.
  allow_authenticate_via_warp = false
  http_only_cookie_attribute  = true

  policies = [
    {
      id         = cloudflare_zero_trust_access_policy.readers.id
      precedence = 1
    },
    {
      id         = cloudflare_zero_trust_access_policy.ingest.id
      precedence = 2
    },
  ]
}

# Humans: must prove an allowed email address.
resource "cloudflare_zero_trust_access_policy" "readers" {
  account_id       = var.account_id
  name             = "${var.worker_name}-allow-readers"
  decision         = "allow"
  session_duration = var.session_duration

  include = [{
    group = {
      id = cloudflare_zero_trust_access_group.readers.id
    }
  }]
}

# Machines: the report generator presents the service token.
# `decision = "non_identity"` skips the interactive login flow entirely.
resource "cloudflare_zero_trust_access_policy" "ingest" {
  account_id = var.account_id
  name       = "${var.worker_name}-allow-ingest"
  decision   = "non_identity"

  include = [{
    service_token = {
      token_id = cloudflare_zero_trust_access_service_token.ingest.id
    }
  }]
}
