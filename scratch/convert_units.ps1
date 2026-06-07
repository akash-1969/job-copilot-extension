# PowerShell script to convert all rem/em units to px in content.css based on a 16px root scale
$filePath = "C:\Users\shriv\.gemini\antigravity\scratch\job-copilot\content\content.css"
if (-Not (Test-Path $filePath)) {
    Write-Error "Could not find file at $filePath"
    exit 1
}

$content = Get-Content -Raw -Path $filePath

# 1. Convert rem values
$matchesRem = [regex]::Matches($content, '\b([0-9\.]+)rem\b')
$replaced = @{}
foreach ($m in $matchesRem) {
    $valStr = $m.Groups[1].Value
    $val = [double]$valStr
    $pxVal = [math]::Round($val * 16)
    $key = "${valStr}rem"
    $valRepl = "${pxVal}px"
    if (-not $replaced.ContainsKey($key)) {
        $replaced[$key] = $valRepl
    }
}
# Sort keys in descending order of double value to prevent partial replacement overlap
$sortedKeysRem = $replaced.Keys | Sort-Object -Descending { [double]($_ -replace 'rem','') }
foreach ($k in $sortedKeysRem) {
    $escapedKey = $k.Replace('.', '\.')
    $content = $content -replace "\b$escapedKey\b", $replaced[$k]
    Write-Host "Converted rem: $k -> $($replaced[$k])"
}

# 2. Convert em values (excluding letter-spacing)
# Let's split by line and convert em values on lines that do not contain 'letter-spacing'
$lines = $content -split "`r?`n"
$newLines = @()
foreach ($line in $lines) {
    if ($line -like "*letter-spacing*") {
        $newLines += $line
        continue
    }
    # Match em values
    $matchesEm = [regex]::Matches($line, '\b([0-9\.]+)em\b')
    $lineReplaced = @{}
    foreach ($m in $matchesEm) {
        $valStr = $m.Groups[1].Value
        $val = [double]$valStr
        $pxVal = [math]::Round($val * 16)
        $key = "${valStr}em"
        $valRepl = "${pxVal}px"
        if (-not $lineReplaced.ContainsKey($key)) {
            $lineReplaced[$key] = $valRepl
        }
    }
    $sortedKeysEm = $lineReplaced.Keys | Sort-Object -Descending { [double]($_ -replace 'em','') }
    $updatedLine = $line
    foreach ($k in $sortedKeysEm) {
        $escapedKey = $k.Replace('.', '\.')
        $updatedLine = $updatedLine -replace "\b$escapedKey\b", $lineReplaced[$k]
        Write-Host "Converted em: $k -> $($lineReplaced[$k]) in line: $line"
    }
    $newLines += $updatedLine
}

$content = $newLines -join "`r`n"
Set-Content -Path $filePath -Value $content -NoNewline
Write-Host "✓ Successfully converted all units to px in content.css."
