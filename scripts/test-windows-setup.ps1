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
}finally{Remove-Item -LiteralPath $fixtureRoot -Recurse -Force}
$form.Dispose()
Write-Output 'Windows scripts parsed; setup controls initialized. Live install remains separate.'
