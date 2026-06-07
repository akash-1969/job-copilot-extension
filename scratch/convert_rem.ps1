# PowerShell script to convert all rem units to px in content.css based on a 16px root scale
$filePath = "C:\Users\shriv\.gemini\antigravity\scratch\job-copilot\content\content.css"
if (-Not (Test-Path $filePath)) {
    Write-Error "Could not find file at $filePath"
    exit 1
}

$content = Get-Content -Raw -Path $filePath

# Find all occurrences of rem
$matches = [regex]::Matches($content, '\b([0-9\.]+)rem\b')
$replaced = @{}

foreach ($m in $matches) {
    $valStr = $m.Groups[1].Value
    $val = [double]$valStr
    $pxVal = [math]::Round($val * 16)
    $key = "${valStr}rem"
    $valRepl = "${pxVal}px"
    if (-not $replaced.ContainsKey($key)) {
        $replaced[$key] = $valRepl
    }
}

# Sort keys in descending order of double value to prevent partial replacement overlap (e.g. 1.15rem vs 1.1rem)
$sortedKeys = $replaced.Keys | Sort-Object -Descending { [double]($_ -replace 'rem','') }

foreach ($k in $sortedKeys) {
    $escapedKey = $k.Replace('.', '\.')
    $content = $content -replace "\b$escapedKey\b", $replaced[$k]
}

Set-Content -Path $filePath -Value $content -NoNewline
Write-Host "✓ Successfully converted all rem units to px in content.css."
