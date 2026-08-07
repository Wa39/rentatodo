# infra/terraform/ssm.tf
# SSM Parameter Store standard parameters are free.
# SecureString uses the default AWS-managed KMS key (aws/ssm) — also free.

resource "random_password" "jwt" {
  length  = 64
  special = false  # alphanumeric is sufficient for a JWT signing key
}

resource "aws_ssm_parameter" "database_url" {
  name  = "/${var.project}/database_url"
  type  = "SecureString"
  value = "postgresql+psycopg://${var.db_username}:${random_password.db.result}@${aws_db_instance.main.address}:${aws_db_instance.main.port}/${var.db_name}"

  tags = { Name = "${var.project}-database-url" }
}

resource "aws_ssm_parameter" "jwt_secret" {
  name  = "/${var.project}/jwt_secret"
  type  = "SecureString"
  value = random_password.jwt.result

  tags = { Name = "${var.project}-jwt-secret" }
}

# Plain string — not a secret. Initial value "*" allows all origins during
# initial setup. Update to the real public URL (EC2 IP or custom domain) once
# the EC2 Elastic IP is known: run `terraform apply` with a new tfvars entry
# or update the parameter directly in the AWS Console / CLI.
resource "aws_ssm_parameter" "cors_origins" {
  name  = "/${var.project}/cors_origins"
  type  = "String"
  value = var.cors_origins

  tags = { Name = "${var.project}-cors-origins" }
}
