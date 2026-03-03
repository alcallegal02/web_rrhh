# Wrapper script to create admin user with execution policy bypass
param(
    [string]$EnvFile = ".env.dev"
)

powershell -ExecutionPolicy Bypass -File .\scripts\create-admin-user.ps1 -EnvFile $EnvFile

