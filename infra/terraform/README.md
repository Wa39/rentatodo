# RentaTodo — AWS Infrastructure (Free Tier)

Terraform provisions: EC2 t2.micro (API container) · RDS db.t3.micro PostgreSQL 16 (private) ·
ECR repository · SSM Parameter Store (DATABASE_URL + JWT_SECRET) · IAM roles · VPC.

**Cost:** $0/month while AWS account is within the 12-month free tier.

## Prerequisites

- Terraform >= 1.10
- AWS CLI configured (`aws configure`) with AdministratorAccess
- Docker (for the initial image push)
- S3 state bucket already created (see Bootstrap)

## Bootstrap (one-time — run before `terraform init`)

```bash
aws s3api create-bucket --bucket rentatodo-tfstate-770018310906 --region us-east-1
aws s3api put-bucket-versioning \
  --bucket rentatodo-tfstate-770018310906 \
  --versioning-configuration Status=Enabled
```

## Variables

Copy `terraform.tfvars.example` → `terraform.tfvars`:

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `github_repo` | yes | — | `"Wa39/rentatodo"` |
| `cors_origins` | no | `"*"` | Update after first apply with EC2 Elastic IP |

## First apply (two phases — ECR must exist before the first image push)

```bash
cd infra/terraform
terraform init

# Phase 1: create ECR only
terraform apply -target=aws_ecr_repository.api

# Phase 2: build and push initial image
ACCOUNT=770018310906
REGION=us-east-1
aws ecr get-login-password --region $REGION | \
  docker login --username AWS --password-stdin $ACCOUNT.dkr.ecr.$REGION.amazonaws.com
cd ../../apps/api
docker build -t $ACCOUNT.dkr.ecr.$REGION.amazonaws.com/rentatodo-api:latest .
docker push $ACCOUNT.dkr.ecr.$REGION.amazonaws.com/rentatodo-api:latest

# Phase 3: apply everything else (EC2, RDS, SSM, IAM, VPC)
cd ../infra/terraform
terraform apply
```

After apply:
```bash
terraform output api_url          # → http://<elastic-ip>:8000
terraform output ec2_instance_id  # → i-xxxxxxxxx
```

Test the API:
```bash
curl $(terraform output -raw api_url)/health
# → {"status": "ok"}
```

## Subsequent deploys

Push to `main` — GitHub Actions builds the image, pushes to ECR, and triggers
the EC2 container restart via SSM Send Command. No manual step needed.

## Next steps (out of scope for this project)

- HTTPS: add ALB + ACM certificate (adds ~$18/month)
- Custom domain: Route 53 hosted zone ($0.50/month)
- Multi-AZ RDS for higher availability
- Separate staging environment
