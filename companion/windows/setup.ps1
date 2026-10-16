# Current-user GUI. Reads only extension metadata through discovery.mjs; never cookies.
param([switch]$NoShow)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
$form = New-Object Windows.Forms.Form
$form.Text = 'MyLimits optional companion — unsigned preview'
$form.Size = New-Object Drawing.Size(650,470)
$form.StartPosition = 'CenterScreen'
function Label($text,$y) {$l=New-Object Windows.Forms.Label;$l.Text=$text;$l.Location=New-Object Drawing.Point(20,$y);$l.Size=New-Object Drawing.Size(590,42);$form.Controls.Add($l)}
Label 'Optional advanced feature. The extension works without it. Requires Node 24+ and the official Codex CLI. No browser cookies are copied.' 16
$node = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
if (!$node) {$node = Join-Path $env:ProgramFiles 'nodejs\node.exe';if (!(Test-Path $node)) {$node=$null}}
Label 'Choose an installed MyLimits extension (Chrome / Brave / Edge / Chromium):' 68
$choices = New-Object Windows.Forms.ComboBox
$choices.Location=New-Object Drawing.Point(20,108);$choices.Size=New-Object Drawing.Size(590,28);$choices.DropDownStyle='DropDownList';$form.Controls.Add($choices)
function Read-Candidates([string]$json) {
 foreach($entry in (ConvertFrom-Json -InputObject $json)) {
  if($entry -and $entry.label -is [string] -and $entry.id -match '^[a-p]{32}$' -and $entry.browser -in @('chrome','brave','edge','chromium')) {Write-Output $entry}
 }
}
$candidates=@()
if ($node) {try {$raw=& $node (Join-Path $root 'discovery.mjs');$candidates=@(Read-Candidates ($raw -join ''))}catch{}}
foreach($c in $candidates){[void]$choices.Items.Add($c.label)}
if($choices.Items.Count -gt 0){$choices.SelectedIndex=0}
Label 'If detection misses an unpacked profile, select a browser and paste its ID from the Extensions page below. Leave blank to use detection.' 148
$browser=New-Object Windows.Forms.ComboBox;$browser.Location=New-Object Drawing.Point(20,195);$browser.Size=New-Object Drawing.Size(130,28);$browser.DropDownStyle='DropDownList';[void]$browser.Items.AddRange(@('chrome','brave','edge','chromium'));$browser.SelectedIndex=0;$form.Controls.Add($browser)
$id=New-Object Windows.Forms.TextBox;$id.Location=New-Object Drawing.Point(160,195);$id.Size=New-Object Drawing.Size(450,28);$form.Controls.Add($id)
$status=New-Object Windows.Forms.Label;$status.Location=New-Object Drawing.Point(20,235);$status.Size=New-Object Drawing.Size(590,68);$status.Text='Uses a per-user native host and sign-in task. OpenAI authorization happens later, from the extension.';$form.Controls.Add($status)
$install=New-Object Windows.Forms.Button;$install.Text='Register and start';$install.Location=New-Object Drawing.Point(20,315);$install.Size=New-Object Drawing.Size(180,36);$form.Controls.Add($install)
$install.Add_Click({
 try{
  if(!$node){throw 'Install Node.js 24+ from nodejs.org, then reopen setup.'}
  $version=& $node -p 'Number(process.versions.node.split(".")[0])';if([int]$version -lt 24){throw 'Node.js 24+ is required. Update it, then reopen setup.'}
  $selected=$choices.SelectedIndex;$extension=$id.Text.Trim();$target=[string]$browser.SelectedItem
  if(!$extension){if($selected -lt 0){throw 'No extension detected. Load MyLimits first, then reopen setup.'};$extension=$candidates[$selected].id;$target=$candidates[$selected].browser}
  if($extension -notmatch '^[a-p]{32}$'){throw 'The extension ID must contain exactly 32 letters a–p.'}
  $install.Enabled=$false;$status.Text='Registering the host and per-user sign-in task…';$form.Refresh()
  $result=& $node (Join-Path $root 'install.mjs') --extension-id $extension --browser $target 2>&1
  if($LASTEXITCODE -ne 0){throw 'Setup failed. Check Node 24+ and the official Codex CLI installation.'}
  $status.Text=($result -join "`r`n")
 }catch{$status.Text=$_.Exception.Message}finally{$install.Enabled=$true}
})
$help=New-Object Windows.Forms.Button;$help.Text='Prerequisites / help';$help.Location=New-Object Drawing.Point(215,315);$help.Size=New-Object Drawing.Size(180,36);$form.Controls.Add($help)
$help.Add_Click({Start-Process 'https://github.com/voiddev011/mylimits/blob/v2/phase-2/docs/OPENAI-COMPANION.md'})
$close=New-Object Windows.Forms.Button;$close.Text='Close';$close.Location=New-Object Drawing.Point(410,315);$close.Size=New-Object Drawing.Size(180,36);$form.Controls.Add($close);$close.Add_Click({$form.Close()})
Label 'Disconnect accounts in MyLimits before uninstalling to request provider logout. Uninstall alone cannot confirm remote revocation. Never run setup as Administrator.' 365
if(!$NoShow){[void]$form.ShowDialog()}
