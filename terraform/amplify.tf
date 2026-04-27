# ── Amplify App (Frontend) ──────────────────────────────────────────
resource "aws_amplify_app" "frontend" {
  name       = "${var.project_name}-frontend"
  repository = "https://github.com/jimmykimani/NexusAI"
  
  # Basic build settings for a Vite project
  build_spec = <<-EOT
    version: 1
    frontend:
      phases:
        preBuild:
          commands:
            - cd frontend
            - npm install
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: frontend/dist
        files:
          - '**/*'
      cache:
        paths:
          - frontend/node_modules/**/*
  EOT

  # Enable branch auto-pull
  enable_auto_branch_creation = true
  
  # Custom rules for React SPA routing
  custom_rule {
    source = "</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|ttf|map|json)$)([^.]+$)/>"
    status = "200"
    target = "/index.html"
  }
}

resource "aws_amplify_branch" "master" {
  app_id      = aws_amplify_app.frontend.id
  branch_name = "master" # Change to main if that is your branch
}

output "amplify_app_id" {
  value = aws_amplify_app.frontend.id
}
