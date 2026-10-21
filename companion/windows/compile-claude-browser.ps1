param([Parameter(Mandatory=$true)][string]$Source,[Parameter(Mandatory=$true)][string]$Output)
$ErrorActionPreference='Stop'
# Compile an owned launcher using Windows' built-in .NET compiler; no downloaded
# compiler or user credentials. Run once during current-user helper setup.
if(Test-Path -LiteralPath $Output){Remove-Item -LiteralPath $Output -Force}
Add-Type -TypeDefinition ([IO.File]::ReadAllText($Source)) -Language CSharp -OutputAssembly $Output -OutputType ConsoleApplication
if(!(Test-Path -LiteralPath $Output)){throw 'Could not create the Claude browser launcher.'}
