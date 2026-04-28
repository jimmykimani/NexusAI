# ── ECS Cluster ──────────────────────────────────────────────────────
resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-cluster"
}

# ── Security Group for ECS Tasks ─────────────────────────────────────
resource "aws_security_group" "ecs_tasks" {
  name        = "${var.project_name}-tasks-sg"
  vpc_id      = module.vpc.vpc_id

  ingress {
    protocol        = "tcp"
    from_port       = 8000
    to_port         = 8000
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    protocol    = "-1"
    from_port   = 0
    to_port     = 0
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ── IAM Roles ───────────────────────────────────────────────────────
resource "aws_iam_role" "ecs_task_execution_role" {
  name = "${var.project_name}-task-exec-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_role_policy" {
  role       = aws_iam_role.ecs_task_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# ── CloudWatch Logs ─────────────────────────────────────────────────
resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${var.project_name}-app"
  retention_in_days = 7
}

# ── ECS Task Definition ─────────────────────────────────────────────
resource "aws_ecs_task_definition" "app" {
  family                   = "${var.project_name}-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution_role.arn

  container_definitions = jsonencode([{
    name  = "backend"
    image = "${aws_ecr_repository.app.repository_url}:latest"
    portMappings = [{
      containerPort = 8000
      hostPort      = 8000
    }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.app.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }
    environment = [
      { name = "DATABASE_URL", value = "postgresql://nexusadmin:password123!@${aws_db_instance.main.endpoint}/nexusai" },
      { name = "ENVIRONMENT", value = "production" },
      { name = "OPENAI_API_KEY", value = var.openai_api_key },
      { name = "TAVILY_API_KEY", value = var.tavily_api_key },
      { name = "SERPER_API_KEY", value = var.serper_api_key },
      { name = "GROQ_API_KEY", value = var.groq_api_key },
      { name = "OPENROUTER_API_KEY", value = var.openrouter_api_key },
      { name = "ANTHROPIC_API_KEY", value = var.anthropic_api_key },
      { name = "CLERK_SECRET_KEY", value = var.clerk_secret_key }

    ]
  }])
}

# ── ECS Service ─────────────────────────────────────────────────────
resource "aws_ecs_service" "main" {
  name            = "${var.project_name}-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    security_groups  = [aws_security_group.ecs_tasks.id]
    subnets          = module.vpc.private_subnets
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "backend"
    container_port   = 8000
  }
}

