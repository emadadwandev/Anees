resource "oci_kms_vault" "main" {
  compartment_id = var.compartment_id
  display_name   = "${var.project_name}-${var.environment}-vault"
  vault_type     = "DEFAULT"

  freeform_tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

resource "oci_kms_key" "master" {
  compartment_id      = var.compartment_id
  display_name        = "${var.project_name}-${var.environment}-master-key"
  management_endpoint = oci_kms_vault.main.management_endpoint

  key_shape {
    algorithm = "AES"
    length    = 32
  }
}

# Secret placeholders — values injected via CI/CD pipeline
locals {
  secret_names = [
    "DATABASE_URL",
    "REDIS_URL",
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
    "LIVEKIT_API_KEY",
    "LIVEKIT_API_SECRET",
    "FCM_SERVICE_ACCOUNT_JSON",
    "APNS_KEY",
    "MQTT_PASSWORD",
  ]
}

output "vault_id" {
  value = oci_kms_vault.main.id
}

output "vault_management_endpoint" {
  value = oci_kms_vault.main.management_endpoint
}

output "master_key_id" {
  value = oci_kms_key.master.id
}
