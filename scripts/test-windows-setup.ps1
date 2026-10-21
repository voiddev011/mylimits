$ErrorActionPreference='Stop'
# Parse every maintained script with the real Windows PowerShell parser, no install side effects.
foreach($name in @('setup.ps1','uninstall.ps1','compile-claude-browser.ps1')) {
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
$form.Dispose()
Write-Output 'Windows scripts parsed; setup controls initialized. Live install remains separate.'
