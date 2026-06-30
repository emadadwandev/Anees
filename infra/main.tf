terraform {
  required_version = ">= 1.7"

  required_providers {
    oci = {
      source  = "oracle/oci"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    # OCI Object Storage S3-compatible backend
    # Configure via terraform init -backend-config=environments/staging/backend.tfvars
    skip_region_validation      = true
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    force_path_style            = true
  }
}

provider "oci" {
  tenancy_ocid     = var.tenancy_ocid
  user_ocid        = var.user_ocid
  fingerprint      = var.fingerprint
  private_key_path = var.private_key_path
  region           = var.region
}

module "networking" {
  source = "./modules/networking"

  compartment_id = var.compartment_id
  project_name   = var.project_name
  environment    = var.environment
}

module "compute" {
  source = "./modules/compute"

  compartment_id      = var.compartment_id
  project_name        = var.project_name
  environment         = var.environment
  subnet_id           = module.networking.app_subnet_id
  ssh_public_key_path = var.ssh_public_key_path
  shape               = var.compute_shape
  ocpus               = var.compute_ocpus
  memory_in_gbs       = var.compute_memory_gb
}

module "storage" {
  source = "./modules/storage"

  compartment_id = var.compartment_id
  project_name   = var.project_name
  environment    = var.environment
  namespace      = var.oci_namespace
}

module "vault" {
  source = "./modules/vault"

  compartment_id = var.compartment_id
  project_name   = var.project_name
  environment    = var.environment
}

output "instance_public_ip" {
  value = module.compute.public_ip
}

output "tf_state_bucket" {
  value = module.storage.tf_state_bucket_name
}
