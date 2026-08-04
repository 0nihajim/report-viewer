output "viewer_url" {
  description = "Open this on iPhone/Mac. Cloudflare Access will ask for a one-time PIN."
  value       = "https://${var.hostname}/"
}

output "r2_bucket" {
  value       = cloudflare_r2_bucket.reports.name
  description = "R2 bucket reports are read from."
}

output "zone_id" {
  value = data.cloudflare_zone.this.zone_id
}

output "access_app_aud" {
  description = "Access application AUD tag. The Worker verifies this claim in the Cf-Access-Jwt-Assertion token."
  value       = cloudflare_zero_trust_access_application.viewer.aud
}

output "access_team_domain_hint" {
  description = "Your Zero Trust team domain (<team>.cloudflareaccess.com) is needed for JWT verification; read it from the Zero Trust dashboard."
  value       = "Set TEAM_DOMAIN in the Worker to <your-team>.cloudflareaccess.com"
}

output "ingest_client_id" {
  description = "Service token client id for the report generator (CF-Access-Client-Id header)."
  value       = cloudflare_zero_trust_access_service_token.ingest.client_id
  sensitive   = true
}

output "ingest_client_secret" {
  description = "Service token secret for the report generator (CF-Access-Client-Secret header). Retrieve with: tofu output -raw ingest_client_secret"
  value       = cloudflare_zero_trust_access_service_token.ingest.client_secret
  sensitive   = true
}
