// Generate Windows commands as arguments/literals, never interpolate into cmd.exe.
export const registryRoots = {
  chrome: 'HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts',
  chromium: 'HKCU\\Software\\Chromium\\NativeMessagingHosts',
  edge: 'HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts',
  brave: 'HKCU\\Software\\BraveSoftware\\Brave-Browser\\NativeMessagingHosts',
};
export const psLiteral = value => "'" + value.replaceAll("'", "''") + "'";
export const encodedPowerShell = source => Buffer.from(source, 'utf16le').toString('base64');
export function batchLauncher(node, host) {
  const quote = value => {
    if (/["\r\n]/.test(value)) throw new Error('Unsupported path in Windows native launcher.');
    return '"' + value.replaceAll('%', '%%') + '"';
  };
  return `@echo off\r\nsetlocal DisableDelayedExpansion\r\n${quote(node)} ${quote(host)}\r\n`;
}
export function taskScript(node, daemon, codex, directory) {
  const command = `& ${[node, daemon, codex].map(psLiteral).join(' ')}; exit $LASTEXITCODE`;
  const args = '-NoProfile -NonInteractive -WindowStyle Hidden -EncodedCommand ' + encodedPowerShell(command);
  return `$ErrorActionPreference = 'Stop'
$name = 'MyLimitsCompanion'
$existing = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
if ($existing) { Stop-ScheduledTask -TaskName $name -ErrorAction Stop }
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ${psLiteral(args)} -WorkingDirectory ${psLiteral(directory)}
$trigger = New-ScheduledTaskTrigger -AtLogOn -User ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name)
$principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $name`;
}
