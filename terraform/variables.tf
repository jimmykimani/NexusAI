variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "nexusai"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "production"
}

variable "openai_api_key" {
  type      = string
  sensitive = true
}

variable "tavily_api_key" {
  type      = string
  sensitive = true
}

variable "serper_api_key" {
  type      = string
  sensitive = true
}

variable "groq_api_key" {
  type      = string
  sensitive = true
  default   = ""
}

variable "openrouter_api_key" {
  type      = string
  sensitive = true
  default   = ""
}

variable "anthropic_api_key" {
  type      = string
  sensitive = true
  default   = ""
}

variable "clerk_secret_key" {
  type      = string
  sensitive = true
  default   = ""
}

