$path = 'dashboard.html'
$c = Get-Content -Raw $path
$c = $c.Replace('id="statSession"', 'id="statTotalStaff"')
$c = $c.Replace('<p class="text-[11px] uppercase tracking-wide text-text-soft font-semibold">This Session</p>', '<p class="text-[11px] uppercase tracking-wide text-text-soft font-semibold">Total Staff</p>')
$c = $c.Replace('<p class="text-[11px] text-text-soft mt-0.5">2025/2026</p>', '<p class="text-[11px] text-text-soft mt-0.5">Active staff members</p>')
[System.IO.File]::WriteAllText((Resolve-Path $path), $c)
Write-Host "Done"
