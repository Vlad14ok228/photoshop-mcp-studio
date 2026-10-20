<#
Closes Adobe Photoshop hint popups (e.g. the "Generative Fill" tooltip) that make every scripting call
fail with "General Photoshop error occurred". Safe by design: it only clicks the empty part of
Photoshop's own menu bar (centre of the window, top edge), which does nothing.
Exit codes: 0 = clicked, 2 = Photoshop not running / no window, 3 = window minimized.
#>
$ErrorActionPreference = 'Stop'
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName Microsoft.VisualBasic
Add-Type -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
[DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
[DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
[DllImport("user32.dll")] public static extern void mouse_event(int f, int x, int y, int d, int e);
[StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
'@ -Name Win -Namespace PS

$p = Get-Process Photoshop -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $p) { Write-Output "Photoshop window not found"; exit 2 }
if ([PS.Win]::IsIconic($p.MainWindowHandle)) { Write-Output "Photoshop is minimized"; exit 3 }
[Microsoft.VisualBasic.Interaction]::AppActivate($p.Id); Start-Sleep -Milliseconds 400
$r = New-Object PS.Win+RECT
[void][PS.Win]::GetWindowRect($p.MainWindowHandle, [ref]$r)
$x = [int](($r.L + $r.R) / 2); $y = $r.T + 12
[void][PS.Win]::SetCursorPos($x, $y); Start-Sleep -Milliseconds 200
[PS.Win]::mouse_event(2, 0, 0, 0, 0); [PS.Win]::mouse_event(4, 0, 0, 0, 0)
Start-Sleep -Milliseconds 800
Write-Output "Clicked menu-bar blank area at ($x,$y)"
