$ErrorActionPreference='Stop'
# Parse every maintained script with the real Windows PowerShell parser, no install side effects.
foreach($name in @('setup.ps1','desktop-setup.ps1','desktop-runtime.ps1','uninstall.ps1','compile-claude-browser.ps1')) {
 $tokens=$null;$errors=$null
 [void][System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PWD ('companion\windows\'+$name)),[ref]$tokens,[ref]$errors)
 if($errors.Count){throw ($errors | Out-String)}
}
# Build the actual GUI controls without showing it or registering a native host.
. (Join-Path $PWD 'companion\windows\setup.ps1') -NoShow
if(!$form -or $form.Text -notlike 'MyLimits*'){throw 'Setup form did not initialize'}
if(@(Read-Candidates '[]').Count -ne 0){throw 'Empty discovery must not create a null candidate'}
$fixture='[{"id":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","browser":"chrome","profile":"Default","label":"Chrome fixture"},{"id":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","browser":"edge","profile":"Default","label":"Edge fixture"}]'
if(@(Read-Candidates $fixture).Count -ne 2){throw 'Multiple candidates must remain distinct'}
$fixtureRoot=Join-Path $env:TEMP ('mylimits-desktop-setup-test-'+[Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path (Join-Path $fixtureRoot 'Google\Chrome\User Data\Default') -Force | Out-Null
try{
 $metadata=Join-Path $fixtureRoot 'Google\Chrome\User Data\Default\Preferences'
 [IO.File]::WriteAllText($metadata,'{"extensions":{"settings":{"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa":{"manifest":{"name":"MyLimits"}},"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb":{"manifest":{"name":"Other"}}}},"cookies":"NEVER_COPY"}')
 $detected=@(Get-DesktopExtensions $fixtureRoot)
 if($detected.Count -ne 1 -or $detected[0].id -ne 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'){throw 'Automatic extension detection failed'}
 if((ConvertTo-Json $detected) -match 'NEVER_COPY'){throw 'Detection exposed unrelated data'}
 $assetFile=Join-Path $fixtureRoot 'asset';[IO.File]::WriteAllText($assetFile,'fixture')
 $asset=[PSCustomObject]@{bytes=7;algorithm='SHA256';digest=(Get-FileHash -LiteralPath $assetFile -Algorithm SHA256).Hash.ToLowerInvariant()}
 if(!(Test-DesktopArchive $asset $assetFile)){throw 'Correct runtime integrity was rejected'}
 $asset.digest='0'*64
 if(Test-DesktopArchive $asset $assetFile){throw 'Corrupt runtime integrity was accepted'}
 $script:runtimeChanges=@()
 $oldFile=Join-Path $fixtureRoot 'active.exe';$newFile=Join-Path $fixtureRoot 'next.exe'
 [IO.File]::WriteAllText($oldFile,'old');[IO.File]::WriteAllText($newFile,'new')
 Publish-DesktopFile $newFile $oldFile
 if([IO.File]::ReadAllText($oldFile) -ne 'new'){throw 'File activation failed'}
 Undo-DesktopRuntimeChanges
 if([IO.File]::ReadAllText($oldFile) -ne 'old'){throw 'File rollback failed'}
 $oldDirectory=Join-Path $fixtureRoot 'old-dir';$newDirectory=Join-Path $fixtureRoot 'new-dir'
 New-Item -ItemType Directory $oldDirectory,$newDirectory | Out-Null
 [IO.File]::WriteAllText((Join-Path $oldDirectory 'version'),'old');[IO.File]::WriteAllText((Join-Path $newDirectory 'version'),'new')
 Publish-DesktopDirectory $newDirectory $oldDirectory
 Undo-DesktopRuntimeChanges
 if([IO.File]::ReadAllText((Join-Path $oldDirectory 'version')) -ne 'old'){throw 'Directory rollback failed'}
 Publish-DesktopFile $newFile $oldFile;Complete-DesktopRuntimeChanges
 if($script:runtimeChanges.Count -ne 0 -or [IO.File]::ReadAllText($oldFile) -ne 'new'){throw 'Commit failed'}
 if((Get-DesktopDirectoryBytes $oldDirectory) -ne 3){throw 'Installed byte measurement failed'}
 # Actual Windows shutdown, isolated test data and no real scheduled-task calls.
 function Get-DesktopTasks { return }
 $priorLocalData=$env:LOCALAPPDATA;$ownedChild=$null;$unrelatedChild=$null
 try{
  $env:LOCALAPPDATA=$fixtureRoot
  $processRoot=Join-Path $fixtureRoot 'MyLimitsCompanion';New-Item -ItemType Directory $processRoot | Out-Null
  $scriptFile=Join-Path $fixtureRoot 'wait.mjs';[IO.File]::WriteAllText($scriptFile,'setInterval(()=>{},1000);')
  $node=(Get-Command node.exe).Source
  $ownedChild=Start-Process -FilePath $node -ArgumentList ('"'+$scriptFile+'"') -PassThru -WindowStyle Hidden
  $unrelatedChild=Start-Process -FilePath $node -ArgumentList ('"'+$scriptFile+'"') -PassThru -WindowStyle Hidden
  $record=[PSCustomObject]@{version=1;processes=@([PSCustomObject]@{pid=$ownedChild.Id;executable=$node;startedAt=([DateTimeOffset]$ownedChild.StartTime).ToUnixTimeMilliseconds()})}
  [IO.File]::WriteAllText((Join-Path $processRoot 'owned-processes.json'),(ConvertTo-Json -Depth 4 $record))
  Stop-DesktopOwnedProcesses
  if(!$ownedChild.WaitForExit(5000)){throw 'Owned Windows process did not exit'}
  $unrelatedChild.Refresh();if($unrelatedChild.HasExited){throw 'Unrelated Windows process was terminated'}
  $empty=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText((Join-Path $processRoot 'owned-processes.json')))
  if(@($empty.processes).Count -ne 0){throw 'Confirmed shutdown did not clear recovery metadata'}
 }finally{
  $env:LOCALAPPDATA=$priorLocalData
  foreach($child in @($ownedChild,$unrelatedChild)){if($child){$child.Refresh();if(!$child.HasExited){$child.Kill();[void]$child.WaitForExit(5000)}}}
 }
}finally{Remove-Item -LiteralPath $fixtureRoot -Recurse -Force}
$form.Dispose()
Write-Output 'Windows scripts parsed; setup controls initialized. Live install remains separate.'
