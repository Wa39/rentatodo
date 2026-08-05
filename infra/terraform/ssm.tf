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
