param(
  [string]$ScriptName = "izhimpro-agent-ready",
  [string]$RoutePattern = "izhimpro.ru/*",
  [string]$ScriptPath = "cloudflare-agent-ready-worker.js",
  [string]$AccountId = "5668780e694c1e900803011d06e0551b",
  [string]$ZoneId = "98f4a55b6b5cc82c4659df9ec4e14676"
)

$cfg = Get-Content ".secrets/cloudflare-api-token.json" -Raw | ConvertFrom-Json
$token = $cfg.token
if (-not $token) {
  throw "Cloudflare API token not found in .secrets/cloudflare-api-token.json"
}

if (-not (Test-Path $ScriptPath)) {
  throw "Worker script not found: $ScriptPath"
}

$headers = @{ Authorization = "Bearer $token" }
$workerCode = Get-Content $ScriptPath -Raw

$uploadHeaders = $headers.Clone()
$uploadHeaders["Content-Type"] = "application/javascript"

$uploadUri = "https://api.cloudflare.com/client/v4/accounts/$AccountId/workers/scripts/$ScriptName"
$uploadResult = Invoke-RestMethod -Method Put -Uri $uploadUri -Headers $uploadHeaders -Body $workerCode
if (-not $uploadResult.success) {
  throw ($uploadResult | ConvertTo-Json -Depth 8)
}

$routesUri = "https://api.cloudflare.com/client/v4/zones/$ZoneId/workers/routes"
$routesResult = Invoke-RestMethod -Method Get -Uri $routesUri -Headers $headers
if (-not $routesResult.success) {
  throw ($routesResult | ConvertTo-Json -Depth 8)
}

$currentRoute = $routesResult.result | Where-Object { $_.pattern -eq $RoutePattern }
if ($currentRoute) {
  $body = @{ pattern = $RoutePattern; script = $ScriptName } | ConvertTo-Json
  $updateResult = Invoke-RestMethod -Method Put -Uri "$routesUri/$($currentRoute.id)" -Headers ($headers + @{ "Content-Type" = "application/json" }) -Body $body
  if (-not $updateResult.success) {
    throw ($updateResult | ConvertTo-Json -Depth 8)
  }
  $routeInfo = $updateResult.result
} else {
  $body = @{ pattern = $RoutePattern; script = $ScriptName } | ConvertTo-Json
  $createResult = Invoke-RestMethod -Method Post -Uri $routesUri -Headers ($headers + @{ "Content-Type" = "application/json" }) -Body $body
  if (-not $createResult.success) {
    throw ($createResult | ConvertTo-Json -Depth 8)
  }
  $routeInfo = $createResult.result
}

[pscustomobject]@{
  ScriptName = $ScriptName
  RoutePattern = $RoutePattern
  RouteId = $routeInfo.id
  ScriptModifiedOn = $uploadResult.result.modified_on
} | Format-List
