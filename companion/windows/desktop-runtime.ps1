# Official runtime acquisition for the guided per-user Desktop installer.
# Provider credential stores and browser sessions are never read here.
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
 $partial=$file+'.partial';$status.Text='Downloading '+$asset.name+' ('+[Math]::Round($asset.bytes/1MB,1)+' MB)…'
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
  $status.Text='Preparing '+$name+'…';[Windows.Forms.Application]::DoEvents()
  if($name -eq 'node'){
   Expand-Archive -LiteralPath $archive -DestinationPath $stage -Force
   $source=Join-Path $stage 'node-v24.22.0-win-x64\node.exe'
   if(!(Test-Path -LiteralPath $source) -or (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant() -ne $asset.executableDigest){throw 'Node executable integrity check failed.'}
   Copy-Item -LiteralPath $source -Destination $exe -Force
   Copy-Item -LiteralPath (Join-Path $stage 'node-v24.22.0-win-x64\LICENSE') -Destination (Join-Path $dependencies 'NODE-LICENSE.txt') -Force
  } else {
   & tar.exe -xf $archive -C $stage
   if($LASTEXITCODE -ne 0){throw 'Could not unpack the official Codex runtime.'}
   $source=Join-Path $stage 'package\vendor\x86_64-pc-windows-msvc'
   $binary=Join-Path $source 'bin\codex.exe'
   if(!(Test-Path -LiteralPath $binary) -or (Get-FileHash -LiteralPath $binary -Algorithm SHA256).Hash.ToLowerInvariant() -ne $asset.executableDigest){throw 'Codex executable integrity check failed.'}
   $destination=Join-Path $dependencies 'codex'
   if(Test-Path -LiteralPath $destination){Remove-Item -LiteralPath $destination -Recurse -Force}
   Copy-Item -LiteralPath $source -Destination $destination -Recurse -Force
  }
  return $exe
 } finally {Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue}
}
function Get-DesktopExtensions([string]$localData=$env:LOCALAPPDATA) {
 $found=@();$locations=@{chrome='Google\Chrome\User Data';brave='BraveSoftware\Brave-Browser\User Data';edge='Microsoft\Edge\User Data';chromium='Chromium\User Data'}
 foreach($browserName in $locations.Keys){
  $directory=Join-Path $localData $locations[$browserName]
  if(!(Test-Path -LiteralPath $directory)){continue}
  foreach($profile in @(Get-ChildItem -LiteralPath $directory -Directory -ErrorAction SilentlyContinue | Where-Object {$_.Name -eq 'Default' -or $_.Name -match '^Profile \d+$'})){
   foreach($name in @('Preferences','Secure Preferences')){try{
    $file=Join-Path $profile.FullName $name
    if(!(Test-Path -LiteralPath $file) -or (Get-Item -LiteralPath $file).Length -gt 32MB){continue}
    $preferences=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($file))
    foreach($entry in $preferences.extensions.settings.PSObject.Properties){
     if($entry.Name -match '^[a-p]{32}$' -and $entry.Value.manifest.name -eq 'MyLimits'){
      $found += [PSCustomObject]@{id=$entry.Name;browser=$browserName;profile=$profile.Name;label=($browserName+' · '+$profile.Name)}
     }
    }
   }catch{}}
  }
 }
 return @($found | Sort-Object -Property browser,id -Unique)
}
