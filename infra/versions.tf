terraform {
  required_version = ">= 1.6.0"

  required_providers {
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.7"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
  }
}

provider "aws" {
  region                      = var.aws_region
  skip_credentials_validation = var.skip_aws_provider_validation
  skip_metadata_api_check     = var.skip_aws_provider_validation
  skip_requesting_account_id  = var.skip_aws_provider_validation
}
