param(
  [string]$Url = "https://izhimpro.ru/"
)

function Get-HttpResult {
  param(
    [string]$TargetUrl,
    [hashtable]$Headers = @{}
  )

  try {
    $response = Invoke-WebRequest -Uri $TargetUrl -Headers $Headers -MaximumRedirection 5 -ErrorAction Stop
    return [PSCustomObject]@{
      StatusCode = [int]$response.StatusCode
      Headers = $response.Headers
    }
  } catch {
    $webResponse = $_.Exception.Response
    if ($null -ne $webResponse) {
      return [PSCustomObject]@{
        StatusCode = [int]$webResponse.StatusCode
        Headers = $webResponse.Headers
      }
    }

    throw
  }
}

$markdownResponse = Get-HttpResult -TargetUrl $Url -Headers @{ Accept = "text/markdown" }
$defaultResponse = Get-HttpResult -TargetUrl $Url

$baseUri = [Uri]$Url
$markdownUrl =
  if ($baseUri.AbsolutePath.EndsWith("/")) {
    "$($baseUri.Scheme)://$($baseUri.Host)$($baseUri.AbsolutePath)index.md"
  } elseif ([IO.Path]::GetExtension($baseUri.AbsolutePath) -eq ".html") {
    ($Url -replace "\.html$", ".md")
  } else {
    "$Url/index.md"
  }

$sidecarResponse = Get-HttpResult -TargetUrl $markdownUrl

[PSCustomObject]@{
  Url = $Url
  AcceptMarkdownStatus = $markdownResponse.StatusCode
  AcceptMarkdownContentType = $markdownResponse.Headers["Content-Type"]
  MarkdownTokens = $markdownResponse.Headers["x-markdown-tokens"]
  OriginalTokens = $markdownResponse.Headers["x-original-tokens"]
  DefaultStatus = $defaultResponse.StatusCode
  DefaultContentType = $defaultResponse.Headers["Content-Type"]
  SidecarMarkdownUrl = $markdownUrl
  SidecarStatus = $sidecarResponse.StatusCode
  SidecarContentType = $sidecarResponse.Headers["Content-Type"]
} | Format-List
