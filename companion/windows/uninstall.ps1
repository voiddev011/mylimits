param([switch]$DeleteData)
$ErrorActionPreference='Stop'
$directory=Join-Path $env:LOCALAPPDATA 'MyLimitsCompanion'
. (Join-Path $PSScriptRoot 'desktop-runtime.ps1')
Stop-DesktopOwnedProcesses
foreach($task in @(Get-DesktopTasks)){Unregister-ScheduledTask -TaskName $task.TaskName -Confirm:$false}
$roots=@{chrome='Software\Google\Chrome';chromium='Software\Chromium';brave='Software\BraveSoftware\Brave-Browser';edge='Software\Microsoft\Edge'}
foreach($browser in $roots.Keys){
 $key='Registry::HKEY_CURRENT_USER\'+$roots[$browser]+'\NativeMessagingHosts\com.mylimits.openai'
 if(Test-Path $key){$expected=Join-Path $directory ('manifests\'+$browser+'\com.mylimits.openai.json');$actual=(Get-Item $key).GetValue('');if($actual -eq $expected){Remove-Item $key -Recurse}}
}
if($DeleteData){if(Test-Path $directory){Remove-Item -LiteralPath $directory -Recurse -Force}}
else{
 foreach($name in @('runtime','runtime.previous','manifests','native-host.cmd','bridge-token','owned-processes.json')){$target=Join-Path $directory $name;if(Test-Path $target){Remove-Item -LiteralPath $target -Recurse -Force}}
 foreach($stage in @(Get-ChildItem -LiteralPath $directory -Directory -Filter 'runtime-next-*' -ErrorAction SilentlyContinue)){Remove-Item -LiteralPath $stage.FullName -Recurse -Force}
}
# Keeping profile data does not mean that the provider revoked its authorization.
