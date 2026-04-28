$raw = Get-Content "_source.html" -Raw

# Extract <style>...</style>
$m = [regex]::Match($raw, '(?s)<style>(.*?)</style>')
$style = $m.Groups[1].Value

# Extract <body>...</body>
$m2 = [regex]::Match($raw, '(?s)<body>(.*?)</body>')
$body = $m2.Groups[1].Value

# Extract last <script>...</script> (the inline app script)
$ms = [regex]::Matches($raw, '(?s)<script[^>]*>(.*?)</script>')
$appScript = $ms[$ms.Count - 1].Groups[1].Value

# Strip <script> tags from body so we re-inject scripts via Next.js
$bodyClean = [regex]::Replace($body, '(?s)<script[^>]*>.*?</script>', '')
# Strip the leaflet/css-only embedded link refs already in head; body has none

# Output files
Set-Content -Path "extracted_styles.css" -Value $style -NoNewline -Encoding UTF8
Set-Content -Path "extracted_body.html" -Value $bodyClean -NoNewline -Encoding UTF8
Set-Content -Path "extracted_app.js" -Value $appScript -NoNewline -Encoding UTF8

Write-Host "Style chars: $($style.Length)"
Write-Host "Body chars:  $($bodyClean.Length)"
Write-Host "Script chars: $($appScript.Length)"


