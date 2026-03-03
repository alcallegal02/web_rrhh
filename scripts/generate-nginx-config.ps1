# Generate nginx config from template using environment variables
param(
    [string]$EnvFile = ".env.dev",
    [string]$Template = "nginx/nginx.conf.dev.template",
    [string]$Output = "nginx/nginx.conf.dev"
)

if (-not (Test-Path $EnvFile)) {
    Write-Host "Error: Environment file $EnvFile not found" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $Template)) {
    Write-Host "Error: Template file $Template not found" -ForegroundColor Red
    exit 1
}

# Read .env file and set variables
Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        [Environment]::SetEnvironmentVariable($key, $value, "Process")
    }
}

# Read template and replace variables
$content = Get-Content $Template -Raw
$content = $content -replace '\$\{NGINX_FRONTEND_HOST\}', $env:NGINX_FRONTEND_HOST
$content = $content -replace '\$\{NGINX_FRONTEND_PORT\}', $env:NGINX_FRONTEND_PORT
$content = $content -replace '\$\{NGINX_BACKEND_HOST\}', $env:NGINX_BACKEND_HOST
$content = $content -replace '\$\{NGINX_BACKEND_PORT\}', $env:NGINX_BACKEND_PORT

# Write output
Set-Content -Path $Output -Value $content

Write-Host "Generated $Output from $Template using $EnvFile" -ForegroundColor Green

