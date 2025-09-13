# PowerShell script for GCP authentication setup
# Usage: .\setup-auth.ps1 "path-to-service-account-key.json"

param(
    [Parameter(Mandatory=$true)]
    [string]$ServiceAccountKeyPath
)

# Set service account key path as environment variable
$env:GOOGLE_APPLICATION_CREDENTIALS = $ServiceAccountKeyPath

# Set project ID, region, and index ID
# Replace with actual values
$env:VERTEX_AI_PROJECT_ID = "122015916118"  # 数値形式のプロジェクトID
$env:VERTEX_AI_LOCATION = "asia-northeast1"
$env:VERTEX_AI_INDEX_ID = "7360896096425476096"
$env:VERTEX_AI_ENDPOINT_ID = "1435927001503367168"
$env:VERTEX_AI_DEPLOYED_INDEX_ID = "confluence_embeddings_endp_1757347487752"

Write-Host "Authentication setup completed."
Write-Host "GOOGLE_APPLICATION_CREDENTIALS: $env:GOOGLE_APPLICATION_CREDENTIALS"
Write-Host "VERTEX_AI_PROJECT_ID: $env:VERTEX_AI_PROJECT_ID"
Write-Host "VERTEX_AI_LOCATION: $env:VERTEX_AI_LOCATION"
Write-Host "VERTEX_AI_INDEX_ID: $env:VERTEX_AI_INDEX_ID"

# Test script execution
# Write-Host "Test script running..."
# node lib/test-batch-update.js
