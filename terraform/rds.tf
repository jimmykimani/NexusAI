# ── Security Group for RDS ──────────────────────────────────────────
resource "aws_security_group" "rds" {
  name        = "${var.project_name}-rds-sg"
  description = "Allow inbound traffic from ECS only"
  vpc_id      = module.vpc.vpc_id

  ingress {
    protocol        = "tcp"
    from_port       = 5432
    to_port         = 5432
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  egress {
    protocol    = "-1"
    from_port   = 0
    to_port     = 0
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ── DB Subnet Group ────────────────────────────────────────────────
resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-db-subnet-group"
  subnet_ids = module.vpc.private_subnets
}

# ── RDS Instance ───────────────────────────────────────────────────
resource "aws_db_instance" "main" {
  identifier           = "${var.project_name}-db"
  allocated_storage    = 20
  storage_type         = "gp3"
  engine               = "postgres"
  engine_version       = "15.10"
  instance_class       = "db.t4g.micro"
  db_name              = "nexusai"
  username             = "nexusadmin"
  password             = "password123!" # Ideally use Secrets Manager
  parameter_group_name = "default.postgres15"
  skip_final_snapshot  = true
  
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
}
