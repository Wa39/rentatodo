output "api_url" {
  value = "http://${aws_eip.api.public_ip}:${var.app_port}"
}

output "ec2_instance_id" {
  value = aws_instance.api.id
}

output "ecr_repository_url" {
  value = aws_ecr_repository.api.repository_url
}

output "rds_endpoint" {
  value     = aws_db_instance.main.address
  sensitive = true
}
