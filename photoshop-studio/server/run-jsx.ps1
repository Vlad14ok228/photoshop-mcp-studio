<#
Runs an ExtendScript (JSX) file inside the running Photoshop through COM DoJavaScript and prints the
script's result to stdout. On failure prints the COM error to stderr and exits 1.
#>
param([Parameter(Mandatory)][string]$JsxPath)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
try {
    $code = [System.IO.File]::ReadAllText($JsxPath, [System.Text.Encoding]::UTF8)
    $ps = New-Object -ComObject Photoshop.Application
    $result = $ps.DoJavaScript($code)
    [Console]::Out.Write([string]$result)
} catch {
    [Console]::Error.Write($_.Exception.Message)
    exit 1
}
