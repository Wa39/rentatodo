# Latest Amazon Linux 2023 AMI — has Docker available via dnf.
data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023*-kernel-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_instance" "api" {
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = "t3.micro"  # free tier: 750 h/month for 12 months
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.ec2.id]
  iam_instance_profile          = aws_iam_instance_profile.api.name
  associate_public_ip_address   = true  # needed at boot: EIP attaches after launch, too late for dnf

  # Install Docker on first boot. The deploy workflow handles the first container run.
  user_data = <<-EOF
    #!/bin/bash
    set -e
    dnf update -y
    dnf install -y docker
    systemctl enable docker
    systemctl start docker
    usermod -aG docker ec2-user
  EOF

  tags = { Name = "${var.project}-api" }
}

# Elastic IP — stable public IP that survives instance stop/start.
# Free when attached to a running instance.
resource "aws_eip" "api" {
  instance = aws_instance.api.id
  domain   = "vpc"

  tags = { Name = "${var.project}-api" }
}
