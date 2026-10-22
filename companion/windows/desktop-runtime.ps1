# Official runtime acquisition for the guided per-user Desktop installer.
# Provider credential stores and browser sessions are never read here.
function Get-DesktopTasks {
 $identity=[Security.Principal.WindowsIdentity]::GetCurrent()
 foreach($name in @(('MyLimitsCompanion-'+$identity.User.Value),'MyLimitsCompanion')){
  $task=Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
  if($task -and ($task.Principal.UserId -eq $identity.Name -or $task.Principal.UserId -eq $identity.User.Value)){$task}
 }
}
function Stop-DesktopOwnedProcesses {
 $dataRoot=Join-Path $env:LOCALAPPDATA 'MyLimitsCompanion'
 $identity=[Security.Principal.WindowsIdentity]::GetCurrent()
 foreach($task in @(Get-DesktopTasks)){Stop-ScheduledTask -TaskName $task.TaskName -ErrorAction Stop}
 $all=@(Get-CimInstance Win32_Process -ErrorAction Stop)
 $owned=New-Object 'System.Collections.Generic.HashSet[int]'
 $records=Join-Path $dataRoot 'owned-processes.json'
 if(Test-Path -LiteralPath $records){
  if((Get-Item -LiteralPath $records).Length -gt 65536){throw 'Desktop recovery metadata is invalid. Account files were kept.'}
  $state=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($records))
  if($state.version -ne 1 -or @($state.processes).Count -gt 100){throw 'Desktop recovery metadata is invalid. Account files were kept.'}
  foreach($record in $state.processes){
   if($record.pid -lt 1 -or ![IO.Path]::IsPathRooted($record.executable) -or $record.startedAt -lt 0){throw 'Desktop recovery metadata is invalid. Account files were kept.'}
   $match=@($all | Where-Object {$_.ProcessId -eq $record.pid})
   if(!$match.Count){continue}
   $process=$match[0];$started=([DateTimeOffset]$process.CreationDate).ToUnixTimeMilliseconds()
   # PID reuse cannot authorize terminating a later unrelated process.
   if([Math]::Abs($started-[double]$record.startedAt) -gt 5000){continue}
   if([IO.Path]::GetFileName($process.ExecutablePath) -ne [IO.Path]::GetFileName($record.executable)){continue}
   $owner=Invoke-CimMethod -InputObject $process -MethodName GetOwnerSid -ErrorAction Stop
   if($owner.ReturnValue -ne 0){throw 'Could not confirm Desktop process ownership. Account files were kept.'}
   if($owner.Sid -eq $identity.User.Value -and $process.ProcessId -ne $PID){[void]$owned.Add([int]$process.ProcessId)}
  }
 }
 foreach($process in $all){
  $command=[string]$process.CommandLine
  $isRuntime=$process.Name -eq 'node.exe' -and $command.IndexOf((Join-Path $dataRoot 'runtime'),[StringComparison]::OrdinalIgnoreCase) -ge 0
  $isBrowser=$process.Name -in @('chrome.exe','brave.exe','msedge.exe') -and $command.IndexOf('--user-data-dir=',[StringComparison]::OrdinalIgnoreCase) -ge 0 -and $command.IndexOf((Join-Path $dataRoot 'accounts'),[StringComparison]::OrdinalIgnoreCase) -ge 0
  if(($isRuntime -or $isBrowser) -and $process.ProcessId -ne $PID){$owner=Invoke-CimMethod -InputObject $process -MethodName GetOwnerSid -ErrorAction Stop;if($owner.ReturnValue -eq 0 -and $owner.Sid -eq $identity.User.Value){[void]$owned.Add([int]$process.ProcessId)}}
 }
 $changed=$true
 while($changed){$changed=$false;foreach($process in $all){if($owned.Contains([int]$process.ParentProcessId) -and !$owned.Contains([int]$process.ProcessId) -and $process.ProcessId -ne $PID){
  $owner=Invoke-CimMethod -InputObject $process -MethodName GetOwnerSid -ErrorAction Stop
  if($owner.ReturnValue -eq 0 -and $owner.Sid -eq $identity.User.Value -and $owned.Add([int]$process.ProcessId)){$changed=$true}
 }}}
 foreach($processId in @($owned)){
  $snapshot=@($all | Where-Object {$_.ProcessId -eq $processId})[0]
  $current=Get-Process -Id $processId -ErrorAction SilentlyContinue
  if($current -and [Math]::Abs(($current.StartTime.ToUniversalTime()-$snapshot.CreationDate.ToUniversalTime()).TotalMilliseconds) -lt 100){Stop-Process -InputObject $current -Force -ErrorAction Stop}
 }
 foreach($processId in @($owned)){
  $process=Get-Process -Id $processId -ErrorAction SilentlyContinue
  if($process -and !$process.WaitForExit(5000)){throw 'Desktop processes have not stopped. Account files were kept.'}
 }
 if(Test-Path -LiteralPath $records){[IO.File]::WriteAllText($records,'{"version":1,"processes":[]}',(New-Object Text.UTF8Encoding($false)))}
}
function Publish-DesktopFile([string]$source,[string]$destination) {
 $temporary=$destination+'.new-'+[Guid]::NewGuid().ToString('N');Copy-Item -LiteralPath $source -Destination $temporary
 $backup=$destination+'.previous-'+[Guid]::NewGuid().ToString('N');$existed=Test-Path -LiteralPath $destination
 if($existed){[IO.File]::Replace($temporary,$destination,$backup)}else{[IO.File]::Move($temporary,$destination)}
 $script:runtimeChanges+=@{destination=$destination;backup=$backup;existed=$existed}
}
function Publish-DesktopDirectory([string]$source,[string]$destination) {
 $backup=$destination+'.previous-'+[Guid]::NewGuid().ToString('N');$existed=Test-Path -LiteralPath $destination
 if($existed){Move-Item -LiteralPath $destination -Destination $backup}
 $script:runtimeChanges+=@{destination=$destination;backup=$backup;existed=$existed}
 Move-Item -LiteralPath $source -Destination $destination
}
function Complete-DesktopRuntimeChanges {
 foreach($change in $script:runtimeChanges){if($change.existed -and (Test-Path -LiteralPath $change.backup)){Remove-Item -LiteralPath $change.backup -Recurse -Force}}
 $script:runtimeChanges=@()
}
function Undo-DesktopRuntimeChanges {
 for($index=$script:runtimeChanges.Count-1;$index -ge 0;$index--){
  $change=$script:runtimeChanges[$index]
  if(Test-Path -LiteralPath $change.destination){Remove-Item -LiteralPath $change.destination -Recurse -Force}
  if($change.existed){Move-Item -LiteralPath $change.backup -Destination $change.destination}
 }
 $script:runtimeChanges=@()
}
function Repair-DesktopInterruptedUpdate {
 $dataRoot=Join-Path $env:LOCALAPPDATA 'MyLimitsCompanion'
 $backup=Join-Path $dataRoot 'runtime.previous'
 if(Test-Path -LiteralPath $backup){
  $active=Join-Path $dataRoot 'runtime'
  if(Test-Path -LiteralPath $active){Remove-Item -LiteralPath $active -Recurse -Force}
  Move-Item -LiteralPath $backup -Destination $active
 }
 # Staging contains program files only, never account profiles.
 foreach($stage in @(Get-ChildItem -LiteralPath $dataRoot -Directory -Filter 'runtime-next-*' -ErrorAction SilentlyContinue)){Remove-Item -LiteralPath $stage.FullName -Recurse -Force}
}
function Test-DesktopArchive($asset,[string]$file) {
 if(!(Test-Path -LiteralPath $file -PathType Leaf)){return $false}
 if((Get-Item -LiteralPath $file).Length -ne [long]$asset.bytes){return $false}
 return (Get-FileHash -LiteralPath $file -Algorithm $asset.algorithm).Hash.ToLowerInvariant() -eq $asset.digest
}
function Get-DesktopArchive($asset) {
 $uri=[Uri]$asset.url
 if($uri.Scheme -ne 'https' -or $uri.UserInfo -or $uri.Host -notin @('nodejs.org','registry.npmjs.org')){throw 'Unsupported runtime download source.'}
 $cache=Join-Path $root 'download-cache';New-Item -ItemType Directory -Force $cache | Out-Null
 $file=Join-Path $cache $asset.name
 if(Test-DesktopArchive $asset $file){return $file}
 $partial=$file+'.partial';$status.Text='Downloading '+$asset.name+' ('+[Math]::Round($asset.bytes/1MB,1)+' MB)...'
 $progress.Value=0;$client=New-Object Net.WebClient
 try {
  [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
  $task=$client.DownloadFileTaskAsync($uri,$partial)
  while(!$task.IsCompleted){
   [Windows.Forms.Application]::DoEvents()
   if($script:cancelSetup){$client.CancelAsync();throw 'Setup cancelled. Your existing accounts were kept.'}
   if(Test-Path -LiteralPath $partial){$progress.Value=[Math]::Min(99,[int]((Get-Item -LiteralPath $partial).Length*100/[long]$asset.bytes))}
   Start-Sleep -Milliseconds 50
  }
  $task.GetAwaiter().GetResult()
  if(!(Test-DesktopArchive $asset $partial)){throw 'Runtime integrity check failed. Nothing was activated. Retry setup.'}
  Move-Item -LiteralPath $partial -Destination $file -Force;$progress.Value=100
  $script:verifiedDownloadBytes+=[long]$asset.bytes
  return $file
 } finally {$client.Dispose();if(Test-Path -LiteralPath $partial){Remove-Item -LiteralPath $partial -Force}}
}
function Install-DesktopRuntime([string]$name,$asset) {
 $dependencies=Join-Path $root 'dependencies';New-Item -ItemType Directory -Force $dependencies | Out-Null
 $exe=if($name -eq 'node'){Join-Path $dependencies 'node.exe'}else{Join-Path $dependencies 'codex\bin\codex.exe'}
 if((Test-Path -LiteralPath $exe) -and (Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash.ToLowerInvariant() -eq $asset.executableDigest){return $exe}
 $archive=Get-DesktopArchive $asset
 $stage=Join-Path $root ('runtime-stage-'+[Guid]::NewGuid().ToString('N'));New-Item -ItemType Directory $stage | Out-Null
 try {
  $status.Text='Preparing '+$name+'...';[Windows.Forms.Application]::DoEvents()
  if($name -eq 'node'){
   Expand-Archive -LiteralPath $archive -DestinationPath $stage -Force
   $source=Join-Path $stage 'node-v24.22.0-win-x64\node.exe'
   if(!(Test-Path -LiteralPath $source) -or (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant() -ne $asset.executableDigest){throw 'Node executable integrity check failed.'}
   Publish-DesktopFile $source $exe
   Copy-Item -LiteralPath (Join-Path $stage 'node-v24.22.0-win-x64\LICENSE') -Destination (Join-Path $dependencies 'NODE-LICENSE.txt') -Force
  } else {
   & tar.exe -xf $archive -C $stage
   if($LASTEXITCODE -ne 0){throw 'Could not unpack the official Codex runtime.'}
   $source=Join-Path $stage 'package\vendor\x86_64-pc-windows-msvc'
   $binary=Join-Path $source 'bin\codex.exe'
   if(!(Test-Path -LiteralPath $binary) -or (Get-FileHash -LiteralPath $binary -Algorithm SHA256).Hash.ToLowerInvariant() -ne $asset.executableDigest){throw 'Codex executable integrity check failed.'}
   $destination=Join-Path $dependencies 'codex'
   Publish-DesktopDirectory $source $destination
  }
  return $exe
 } finally {Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue}
}
function Read-DesktopJson([string]$file,[long]$limit=33554432) {
 if(!(Test-Path -LiteralPath $file -PathType Leaf) -or (Get-Item -LiteralPath $file).Length -gt $limit){return $null}
 # Chromium preferences can have case-distinct or empty dictionary keys.
 # Windows PowerShell 5 ConvertFrom-Json rejects those and used to discard the
 # entire profile silently. Keep dictionaries; expose extension metadata only.
 if(!$script:desktopJsonReader){
  Add-Type -AssemblyName System.Web.Extensions
  $script:desktopJsonReader=New-Object System.Web.Script.Serialization.JavaScriptSerializer
  $script:desktopJsonReader.MaxJsonLength=33554432;$script:desktopJsonReader.RecursionLimit=200
 }
 return $script:desktopJsonReader.DeserializeObject([IO.File]::ReadAllText($file))
}
function Get-DesktopProfileExtensions([string]$profile,[string]$browserName) {
 $found=@()
 foreach($name in @('Preferences','Secure Preferences')){try{
  $preferences=Read-DesktopJson (Join-Path $profile $name)
  if($preferences -isnot [System.Collections.IDictionary]){continue}
  $extensions=$preferences['extensions'];if($extensions -isnot [System.Collections.IDictionary]){continue}
  $settings=$extensions['settings'];if($settings -isnot [System.Collections.IDictionary]){continue}
  foreach($id in $settings.Keys){
   if($id -notmatch '^[a-p]{32}$'){continue}
   $entry=$settings[$id];if($entry -isnot [System.Collections.IDictionary]){continue}
   $extensionName=$null
   if($entry['manifest'] -is [System.Collections.IDictionary]){$extensionName=$entry['manifest']['name']}
   # Unpacked extensions can store only a folder path, with no inline manifest.
   if(!$extensionName -and $entry['path'] -is [string]){try{
    $directory=$entry['path'];$extensionRoot=Join-Path $profile 'Extensions'
    if(![IO.Path]::IsPathRooted($directory)){
     $directory=[IO.Path]::GetFullPath((Join-Path $extensionRoot $directory))
     if(!$directory.StartsWith(([IO.Path]::GetFullPath($extensionRoot)+[IO.Path]::DirectorySeparatorChar),[StringComparison]::OrdinalIgnoreCase)){continue}
    }
    # Read only a local manifest; never trigger UNC/network credential access.
    if($directory.StartsWith('\\') -or $directory -notmatch '^[a-zA-Z]:[\\/]'){continue}
    $manifest=Read-DesktopJson (Join-Path $directory 'manifest.json') 524288
    if($manifest -is [System.Collections.IDictionary]){$extensionName=$manifest['name']}
   }catch{}}
   if($extensionName -eq 'MyLimits'){
    $profileName=Split-Path $profile -Leaf
    $found += [PSCustomObject]@{id=$id;browser=$browserName;profile=$profileName;userDataDirectory=(Split-Path $profile -Parent);label=($browserName+' / '+$profileName)}
   }
  }
 }catch{}}
 return $found
}
function Get-DesktopExtensions([string]$localData=$env:LOCALAPPDATA,[string]$selectedProfile,[string]$selectedBrowser='brave') {
 $found=@();$locations=@{chrome='Google\Chrome\User Data';brave='BraveSoftware\Brave-Browser\User Data';edge='Microsoft\Edge\User Data';chromium='Chromium\User Data'}
 foreach($browserName in $locations.Keys){
  $directory=Join-Path $localData $locations[$browserName]
  if(!(Test-Path -LiteralPath $directory)){continue}
  foreach($profile in @(Get-ChildItem -LiteralPath $directory -Directory -ErrorAction SilentlyContinue | Where-Object {$_.Name -eq 'Default' -or $_.Name -match '^Profile \d+$'})){
   $found+=@(Get-DesktopProfileExtensions $profile.FullName $browserName)
  }
 }
 if($selectedProfile -and $locations.ContainsKey($selectedBrowser) -and (Test-Path -LiteralPath $selectedProfile -PathType Container)){$found+=@(Get-DesktopProfileExtensions $selectedProfile $selectedBrowser)}
 return @($found | Sort-Object -Property browser,id -Unique)
}
function Get-DesktopDirectoryBytes([string]$directory) {
 if(!(Test-Path -LiteralPath $directory)){return [long]0}
 $sum=(Get-ChildItem -LiteralPath $directory -File -Recurse -ErrorAction Stop | Measure-Object -Property Length -Sum).Sum
 if($null -eq $sum){return [long]0};return [long]$sum
}
