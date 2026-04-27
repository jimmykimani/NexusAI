#!/bin/bash
# Syncs .env keys to terraform.tfvars

ENV_FILE=".env"
TF_VARS="terraform/terraform.tfvars"

echo "# Generated from .env" > $TF_VARS

extract_key() {
    local key=$1
    local tf_key=$2
    local value=$(grep "^$key=" $ENV_FILE | cut -d'=' -f2-)
    if [ -n "$value" ]; then
        echo "$tf_key = \"$value\"" >> $TF_VARS
    fi
}

extract_key "OPENAI_API_KEY" "openai_api_key"
extract_key "TAVILY_API_KEY" "tavily_api_key"
extract_key "SERPER_API_KEY" "serper_api_key"
extract_key "GROQ_API_KEY" "groq_api_key"

echo "✅ Success: terraform/terraform.tfvars generated."
