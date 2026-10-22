param([switch]$NoShow)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$root=Split-Path $PSScriptRoot -Parent
. (Join-Path $PSScriptRoot 'desktop-runtime.ps1')
$script:installing=$false;$script:cancelSetup=$false;$script:readyToOpen=$false;$script:runtimeChanges=@();$script:verifiedDownloadBytes=[long]0
$form=New-Object Windows.Forms.Form
$form.Text='MyLimits Desktop - unsigned preview'
$form.Size=New-Object Drawing.Size(660,530);$form.StartPosition='CenterScreen'
$form.Font=New-Object Drawing.Font('Segoe UI',10)
function Label($text,$y){$l=New-Object Windows.Forms.Label;$l.Text=$text;$l.Location=New-Object Drawing.Point(20,$y);$l.Size=New-Object Drawing.Size(605,44);$form.Controls.Add($l)}
function Read-Candidates([string]$json){foreach($entry in (ConvertFrom-Json -InputObject $json)){if($entry -and $entry.label -is [string] -and $entry.id -match '^[a-p]{32}$' -and $entry.browser -in @('chrome','brave','edge','chromium')){Write-Output $entry}}}
Label 'Connect independent AI accounts from your extension. One setup; no Node/npm or terminal commands. Your website logins stay separate.' 18
$openai=New-Object Windows.Forms.CheckBox;$openai.Text='OpenAI / Codex';$openai.Checked=$true;$openai.Location=New-Object Drawing.Point(20,76);$openai.Size=New-Object Drawing.Size(260,28);$form.Controls.Add($openai)
$claude=New-Object Windows.Forms.CheckBox;$claude.Text='Claude (official Claude Code)';$claude.Location=New-Object Drawing.Point(300,76);$claude.Size=New-Object Drawing.Size(300,28);$form.Controls.Add($claude)
Label 'First setup downloads Node (36 MB) and, if selected, Codex (160 MB). Compatible private runtimes are reused. Claude setup may download more through its official installer.' 116
$candidates=@(Get-DesktopExtensions)
$detected=if($candidates.Count){'Found MyLimits: '+(($candidates | ForEach-Object {$_.label}) -join ', ')}else{'Install or load the MyLimits extension first, then choose Retry detection.'}
Label $detected 174
$status=New-Object Windows.Forms.Label;$status.Text='This preview needs real-account acceptance. Provider sign-in starts from + in the extension after setup.';$status.Location=New-Object Drawing.Point(20,232);$status.Size=New-Object Drawing.Size(605,64);$form.Controls.Add($status)
$progress=New-Object Windows.Forms.ProgressBar;$progress.Location=New-Object Drawing.Point(20,307);$progress.Size=New-Object Drawing.Size(605,20);$form.Controls.Add($progress)
$install=New-Object Windows.Forms.Button;$install.Text='Set up Desktop';$install.Location=New-Object Drawing.Point(20,344);$install.Size=New-Object Drawing.Size(180,36);$form.Controls.Add($install)
$retry=New-Object Windows.Forms.Button;$retry.Text='Retry detection';$retry.Location=New-Object Drawing.Point(215,344);$retry.Size=New-Object Drawing.Size(180,36);$form.Controls.Add($retry)
$close=New-Object Windows.Forms.Button;$close.Text='Close';$close.Location=New-Object Drawing.Point(410,344);$close.Size=New-Object Drawing.Size(180,36);$form.Controls.Add($close)
$retry.Add_Click({$script:candidates=@(Get-DesktopExtensions);$status.Text=if($candidates.Count){'Found '+$candidates.Count+' MyLimits browser installation(s). Ready to set up.'}else{'MyLimits was not found. Load the extension, then retry. No extension ID copying is needed.'}})
$close.Add_Click({if($script:installing){$script:cancelSetup=$true;$status.Text='Cancelling the current download...'}else{
 if($script:readyToOpen -and $candidates.Count){
  $candidate=$candidates[0];$parts=@{chrome='Google\Chrome\Application\chrome.exe';brave='BraveSoftware\Brave-Browser\Application\brave.exe';edge='Microsoft\Edge\Application\msedge.exe';chromium='Chromium\Application\chrome.exe'}
  foreach($prefix in @($env:PROGRAMFILES,${env:PROGRAMFILES(X86)},$env:LOCALAPPDATA)){if(!$prefix){continue};$exe=Join-Path $prefix $parts[$candidate.browser];if(Test-Path -LiteralPath $exe){Start-Process -FilePath $exe -ArgumentList @(('"--profile-directory='+$candidate.profile+'"'),('chrome-extension://'+$candidate.id+'/dashboard.html#add'));break}}
 }
 $form.Close()
}})
$form.Add_FormClosing({param($sender,$eventArgs)if($script:installing){$eventArgs.Cancel=$true;$script:cancelSetup=$true}})
$install.Add_Click({
 $script:installing=$true;$script:cancelSetup=$false;$install.Enabled=$false;$retry.Enabled=$false;$openai.Enabled=$false;$claude.Enabled=$false
 $previousTasks=@();$stopped=$false
 try{
  $script:candidates=@(Get-DesktopExtensions)
  if(!$candidates.Count){throw 'MyLimits was not detected. Load the extension in Chrome or Brave, then retry.'}
  if(!$openai.Checked -and !$claude.Checked){throw 'Select at least one provider.'}
  $status.Text='Stopping MyLimits processes safely; account profiles will be kept.';[Windows.Forms.Application]::DoEvents()
  $previousTasks=@(Get-DesktopTasks);Stop-DesktopOwnedProcesses;$stopped=$true;Repair-DesktopInterruptedUpdate
  $manifest=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText((Join-Path $root 'desktop-dependencies.json')))
  $node=Install-DesktopRuntime 'node' $manifest.node
  $codex=$null;if($openai.Checked){$codex=Install-DesktopRuntime 'codex' $manifest.codex}
  if($claude.Checked){
   $official=Join-Path $env:USERPROFILE '.local\bin\claude.exe';$wingetLink=Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Links\claude.exe'
   if(!(Test-Path -LiteralPath $official) -and !(Test-Path -LiteralPath $wingetLink) -and !(Get-Command claude.exe -ErrorAction SilentlyContinue)){
    $status.Text='Installing official Claude Code. Review provider/Windows prompts; credentials stay with Claude Code.';[Windows.Forms.Application]::DoEvents()
    $providerInstaller=Start-Process 'winget.exe' -ArgumentList @('install','--id','Anthropic.ClaudeCode','--exact','--source','winget') -PassThru
    while(!$providerInstaller.HasExited){[Windows.Forms.Application]::DoEvents();Start-Sleep -Milliseconds 100}
    if($providerInstaller.ExitCode -ne 0){throw 'Official Claude Code installation did not finish. Retry setup or use the official setup guide.'}
   }
  }
  if($script:cancelSetup){throw 'Setup cancelled. Your existing accounts were kept.'}
  $status.Text='Linking Desktop to your MyLimits browser installations...';[Windows.Forms.Application]::DoEvents()
  $registrationFile=Join-Path $root 'registrations.json'
  [IO.File]::WriteAllText($registrationFile,(ConvertTo-Json -InputObject @($candidates | ForEach-Object {[PSCustomObject]@{id=$_.id;browser=$_.browser}})),(New-Object Text.UTF8Encoding($false)))
  $options=@((Join-Path $root 'install.mjs'),'--registrations-file',$registrationFile)
  if($codex){$options+=@('--codex',$codex)}else{$options+='--without-openai'}
  try{$result=& $node @options 2>&1;if($LASTEXITCODE -ne 0){throw 'Desktop registration or startup did not finish. Retry setup; existing account profiles are kept.'}}
  finally{Remove-Item -LiteralPath $registrationFile -Force -ErrorAction SilentlyContinue}
  $ready=$false
  for($attempt=0;$attempt -lt 5;$attempt++){
   $health=& $node (Join-Path $root 'desktop-health.mjs') 2>$null
   if($LASTEXITCODE -eq 0){$state=ConvertFrom-Json -InputObject ($health -join '');if($state.ready){$ready=$true;break}}
   [Windows.Forms.Application]::DoEvents();Start-Sleep -Milliseconds 300
  }
  if(!$ready){throw 'Desktop startup was not confirmed. Retry setup before connecting an account.'}
  Complete-DesktopRuntimeChanges
  foreach($oldTask in $previousTasks){if($oldTask.TaskName -eq 'MyLimitsCompanion'){Unregister-ScheduledTask -TaskName $oldTask.TaskName -Confirm:$false}}
  $cache=Join-Path $root 'download-cache';if(Test-Path -LiteralPath $cache){Remove-Item -LiteralPath $cache -Recurse -Force}
  $dataRoot=Join-Path $env:LOCALAPPDATA 'MyLimitsCompanion'
  $sizes=[PSCustomObject]@{version='3.4.0';verifiedArchiveDownloadsBytes=$script:verifiedDownloadBytes;claudeAdditionalDownloadsBytes=$null;setupInstalledBytes=(Get-DesktopDirectoryBytes $root);serviceInstalledBytes=(Get-DesktopDirectoryBytes $dataRoot);cacheBytes=(Get-DesktopDirectoryBytes $cache);measuredAt=[DateTime]::UtcNow.ToString('o')}
  [IO.File]::WriteAllText((Join-Path $dataRoot 'desktop-install-sizes.json'),(ConvertTo-Json $sizes),(New-Object Text.UTF8Encoding($false)))
  $status.Text='Desktop is ready. Open MyLimits > + > Connect another account > Connect Desktop. Confirm the reported account after official sign-in.';$progress.Value=100;$script:readyToOpen=$true;$close.Text='Open MyLimits'
 }catch{
  $message=$_.Exception.Message
  if($stopped){try{
   Stop-DesktopOwnedProcesses;Undo-DesktopRuntimeChanges;Repair-DesktopInterruptedUpdate
   foreach($oldTask in $previousTasks){Start-ScheduledTask -TaskName $oldTask.TaskName -ErrorAction SilentlyContinue}
  }catch{$message+=' Repair could not finish. Account data was kept; retry Desktop setup before connecting.'}}
  $status.Text=$message
 }
 finally{$script:installing=$false;$install.Enabled=$true;$retry.Enabled=$true;$openai.Enabled=$true;$claude.Enabled=$true}
})
$help=New-Object Windows.Forms.LinkLabel;$help.Text='Setup and account testing instructions';$help.Location=New-Object Drawing.Point(20,400);$help.Size=New-Object Drawing.Size(600,26);$form.Controls.Add($help)
$help.Add_LinkClicked({Start-Process 'https://github.com/voiddev011/mylimits/blob/feature/desktop-independent-accounts/docs/INSTALL.md'})
Label 'No subscription is included. Credentials stay in official per-account profiles. This is an unsigned development build; signing and store publication are separate.' 436
if(!$NoShow){
 $mutex=New-Object Threading.Mutex($false,('Local\MyLimitsDesktopSetup-'+[Security.Principal.WindowsIdentity]::GetCurrent().User.Value))
 $acquired=$false
 try{try{$acquired=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$acquired=$true}
  if(!$acquired){[void][Windows.Forms.MessageBox]::Show('MyLimits Desktop setup is already open.');return}
  [void]$form.ShowDialog()
 }finally{if($acquired){$mutex.ReleaseMutex()};$mutex.Dispose()}
}
