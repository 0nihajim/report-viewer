variable "account_id" {
  type        = string
  description = "Cloudflare account ID (Dashboard → Workers & Pages → right sidebar)."
}

variable "zone_name" {
  type        = string
  description = "Apex domain already onboarded to Cloudflare, e.g. \"example.com\"."
}

variable "hostname" {
  type        = string
  description = "Full hostname the viewer is served on, e.g. \"reports.example.com\"."
}

variable "worker_name" {
  type        = string
  default     = "report-viewer"
  description = "Workers script name. Must match `name` in wrangler.jsonc."
}

variable "bucket_name" {
  type        = string
  default     = "reports"
  description = "R2 bucket holding report HTML. Must match wrangler.jsonc r2_buckets.bucket_name."
}

variable "site_title" {
  type        = string
  default     = "Research Reports"
  description = "Title shown in the viewer header and PWA manifest."
}

variable "allowed_emails" {
  type        = list(string)
  description = "Email addresses allowed through Cloudflare Access. These are the ONLY humans who can read the reports."

  validation {
    condition     = length(var.allowed_emails) > 0
    error_message = "allowed_emails must not be empty, otherwise nobody can reach the viewer."
  }
}

variable "allowed_email_domains" {
  type        = list(string)
  default     = []
  description = "Optional email domains to allow wholesale, e.g. [\"mycompany.com\"]. Leave empty to allow only allowed_emails."
}

variable "session_duration" {
  type        = string
  default     = "168h"
  description = "How long an Access session stays valid before re-auth. 168h = 7 days, convenient on iPhone."
}

variable "r2_location" {
  type        = string
  default     = "APAC"
  description = "R2 location hint. APAC keeps report writes/reads close to Japan."
}
