Unicode True
!include "MUI2.nsh"
Name "MyLimits Optional Companion (unsigned preview)"
OutFile "${OUTPUT}"
InstallDir "$LOCALAPPDATA\MyLimitsCompanionSetup"
RequestExecutionLevel user
SetCompressor /SOLID zlib
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_TEXT "Open companion setup"
!define MUI_FINISHPAGE_RUN_FUNCTION "LaunchSetup"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"
Section "Companion setup"
 SetShellVarContext current
 SetOutPath "$INSTDIR"
 File /r "${STAGING}\*"
 WriteUninstaller "$INSTDIR\Uninstall.exe"
 CreateDirectory "$SMPROGRAMS\MyLimits Companion"
 CreateShortCut "$SMPROGRAMS\MyLimits Companion\Setup.lnk" "$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" '-NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\windows\setup.ps1"'
 CreateShortCut "$SMPROGRAMS\MyLimits Companion\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\MyLimitsCompanion" "DisplayName" "MyLimits Optional Companion (unsigned preview)"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\MyLimitsCompanion" "UninstallString" '$\"$INSTDIR\Uninstall.exe$\"'
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\MyLimitsCompanion" "InstallLocation" "$INSTDIR"
SectionEnd
Function LaunchSetup
 Exec '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\windows\setup.ps1"'
FunctionEnd
Section "Uninstall"
 MessageBox MB_YESNOCANCEL|MB_ICONQUESTION "Delete local account profiles and sign-in browser data as well? Disconnect accounts in MyLimits first to request remote logout. Yes deletes local profiles; No retains them. Remote revocation is not confirmed by uninstall." IDYES deleteData IDNO keepData
 Goto cancel
 deleteData:
  ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\windows\uninstall.ps1" -DeleteData' $0
  Goto cleanup
 keepData:
  ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\windows\uninstall.ps1"' $0
 cleanup:
  StrCmp $0 0 +3
   MessageBox MB_OK|MB_ICONSTOP "Cleanup failed. Setup files have been kept so you can retry."
   Abort
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\MyLimitsCompanion"
  Delete "$SMPROGRAMS\MyLimits Companion\Setup.lnk"
  Delete "$SMPROGRAMS\MyLimits Companion\Uninstall.lnk"
  RMDir "$SMPROGRAMS\MyLimits Companion"
  !include "${STAGING}\uninstall-files.nsh"
  Delete "$INSTDIR\windows\setup.ps1"
  Delete "$INSTDIR\windows\uninstall.ps1"
  RMDir "$INSTDIR\windows"
  RMDir /r "$INSTDIR\dependencies"
  RMDir /r "$INSTDIR\proof"
  Delete "$INSTDIR\Install.cmd"
  Delete "$INSTDIR\uninstall-files.nsh"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
  Goto done
 cancel:
  Abort
 done:
SectionEnd
