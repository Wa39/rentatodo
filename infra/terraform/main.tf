terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  backend "s3" {
    bucket       = "rentatodo-tfstate-770018310906"
    key          = "rentatodo/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true          # state contains RDS password + JWT key — must be encrypted at rest
    use_lockfile = true  # S3 native locking — requires Terraform >= 1.10
  }
}

provider "aws" {
  region = var.aws_region
}

provider "random" {}
