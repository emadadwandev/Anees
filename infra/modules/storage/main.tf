resource "oci_objectstorage_bucket" "tf_state" {
  compartment_id = var.compartment_id
  namespace      = var.namespace
  name           = "${var.project_name}-${var.environment}-tf-state"
  access_type    = "NoPublicAccess"
  versioning     = "Enabled"

  freeform_tags = {
    Project     = var.project_name
    Environment = var.environment
    Purpose     = "terraform-state"
  }
}

resource "oci_objectstorage_bucket" "exports" {
  compartment_id = var.compartment_id
  namespace      = var.namespace
  name           = "${var.project_name}-${var.environment}-exports"
  access_type    = "NoPublicAccess"

  lifecycle_rule {
    name    = "expire-old-exports"
    enabled = true
    action  = "DELETE"
    target  = "objects"
    object_name_filter { inclusion_prefixes = ["reports/"] }
    time_amount = 90
    time_unit   = "DAYS"
  }

  freeform_tags = {
    Project     = var.project_name
    Environment = var.environment
    Purpose     = "telemetry-exports"
  }
}

output "tf_state_bucket_name" {
  value = oci_objectstorage_bucket.tf_state.name
}

output "exports_bucket_name" {
  value = oci_objectstorage_bucket.exports.name
}
