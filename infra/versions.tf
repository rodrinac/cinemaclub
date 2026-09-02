terraform {
  required_version = ">= 1.6.0"

  backend "s3" {
    # bucket, key, region, and dynamodb_table are supplied via -backend-config
    # flags at `terraform init` time (see .github/workflows/deploy-aws-proxy.yml
    # and infra/backend.hcl.example) so this stays environment-agnostic.
  }

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
