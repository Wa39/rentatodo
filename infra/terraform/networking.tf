# infra/terraform/networking.tf

resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "${var.project}-vpc" }
}

# Public subnet — EC2 lives here, needs internet access to reach ECR and SSM.
resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.0.0/24"
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = false  # using Elastic IP instead

  tags = { Name = "${var.project}-public" }
}

# Two private subnets in different AZs — RDS subnet group requires at least two.
resource "aws_subnet" "private_a" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = "${var.aws_region}a"

  tags = { Name = "${var.project}-private-a" }
}

resource "aws_subnet" "private_b" {
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = "${var.aws_region}b"

  tags = { Name = "${var.project}-private-b" }
}

# Internet Gateway — gives the public subnet outbound internet access
# so EC2 can reach ECR and SSM endpoints.
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = { Name = "${var.project}-igw" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "${var.project}-public-rt" }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# EC2 security group — allow inbound on app port; all outbound (ECR, SSM, RDS).
resource "aws_security_group" "ec2" {
  name        = "${var.project}-ec2"
  description = "API server: inbound on app port, all outbound."
  vpc_id      = aws_vpc.main.id

  # HTTP only (no TLS) — plain-text traffic is an accepted risk for this educational project.
  # To add HTTPS: provision an ALB with ACM certificate (~$18/month extra).
  ingress {
    description = "API"
    from_port   = var.app_port
    to_port     = var.app_port
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project}-ec2" }
}

# RDS security group — inbound PostgreSQL from EC2 only.
resource "aws_security_group" "rds" {
  name        = "${var.project}-rds"
  description = "Allows PostgreSQL access from the EC2 instance only."
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project}-rds" }
}
