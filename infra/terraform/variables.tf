variable "aws_region" {
  description = "AWS region for all resources."
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Project name prefix applied to all resource names and tags."
  type        = string
  default     = "rentatodo"
}

variable "db_name" {
  description = "Name of the PostgreSQL database."
  type        = string
  default     = "rentatodo"
}

variable "db_username" {
  description = "Master username for the RDS instance."
  type        = string
  default     = "rentatodo"
}

variable "github_repo" {
  description = "GitHub repository in 'owner/name' format — scopes the OIDC trust to this repo's main branch."
  type        = string
  # Set in terraform.tfvars: github_repo = "Wa39/rentatodo"
}

variable "cors_origins" {
  description = "Comma-separated CORS origins the API allows. Update after first apply with the EC2 public IP."
  type        = string
  default     = "*"
}

variable "app_port" {
  description = "Port uvicorn listens on inside the container."
  type        = number
  default     = 8000
}
