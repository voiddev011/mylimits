import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { psLiteral, encodedPowerShell } from './windows.mjs';
import { claudeProbeArguments } from './proof/claude.mjs';
import { ProbeError } from './proof/errors.mjs';

// First-party onboarding stays in the provider's own terminal. No automated
// trust/terms acceptance and no arbitrary model prompt is sent by MyLimits.
export function quoteWindowsArgument(value) {
  return '"' + value.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/g, '$1$1') + '"';
}
export function windowsClaudeSetup(executable, args) {
  const argumentsText = args.map(quoteWindowsArgument).join(' ');
  return `$ErrorActionPreference='Stop'; $p=Start-Process -FilePath ${psLiteral(executable)} -ArgumentList ${psLiteral(argumentsText)} -PassThru -Wait; exit $p.ExitCode`;
}
export async function launchClaudeSetup(context, { spawnProcess = spawn, timeout = 300_000 } = {}) {
  const args = claudeProbeArguments();
  let file, argv;
  if (process.platform === 'win32') {
    file = 'powershell.exe'; argv = ['-NoProfile','-NonInteractive','-EncodedCommand',encodedPowerShell(windowsClaudeSetup(context.executable,args))];
  } else {
    file = '/usr/bin/xterm';
    try { await access(file); } catch { throw new ProbeError('missing-setup-terminal','Install xterm for first-party Claude onboarding on Linux, or use Windows helper setup.'); }
    argv = ['-T','Claude Code · account setup','-e',context.executable,...args];
  }
  const child = spawnProcess(file,argv,{env:context.env,cwd:context.workspace,windowsHide:true,stdio:'ignore'});
  await new Promise((resolve,reject)=>{
    let done=false, timer, stopTimer, interruption;
    const finish=error=>{if(done)return;done=true;clearTimeout(timer);clearTimeout(stopTimer);context.signal?.removeEventListener('abort',abort);error?reject(error):resolve();};
    const abort=()=>{
      // Only this owned setup process tree is stopped; never another user's CLI.
      if(process.platform==='win32'&&child.pid) {
        const killer=spawn('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});killer.on('error',()=>{});
      } else child.kill();
      interruption=new ProbeError('setup-interrupted','Setup closed or timed out; finish provider setup before checking.');
      stopTimer=setTimeout(()=>finish(new ProbeError('terminal-stop-unconfirmed','Provider setup shutdown was not confirmed. Restart the helper.')),5000);
    };
    timer=setTimeout(abort,timeout);context.signal?.addEventListener('abort',abort,{once:true});
    child.once('error',()=>finish(new ProbeError('needs-setup','Could not open first-party setup. Update the helper.')));
    child.once('exit',code=>finish(interruption??(code===0?null:new ProbeError('needs-setup','Finish official setup, then close its window and retry.'))));
    if(context.signal?.aborted)abort();
  });
}
