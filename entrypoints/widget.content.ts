import { browser } from 'wxt/browser';
import { providerForUrl } from '../src/providers/catalog';
import { WidgetViewSchema,type WidgetView } from '../src/core/widget';
export default defineContentScript({registration:'runtime',runAt:'document_idle',allFrames:false,main(ctx){
 const provider=providerForUrl(location.href);if(!provider||window.top!==window)return;
 const global=globalThis as typeof globalThis&{__mylimitsWidgetStop?:()=>void};if(global.__mylimitsWidgetStop)return;
 let stopped=false,busy=false,opened=false,current:Extract<WidgetView,{enabled:true}>|null=null;
 const host=document.createElement('div');host.id='mylimits-usage-widget';
 const shadow=host.attachShadow({mode:'open'});const style=document.createElement('style');
 style.textContent=`:host{color-scheme:dark}*{box-sizing:border-box}.launcher{width:40px;height:40px;border-radius:50%;padding:9px;box-shadow:0 3px 16px #0004;display:grid;place-items:center}button,select{font:14px/1.4 system-ui,sans-serif;background:#213d2d;color:#edf5ef;border:1px solid #addfbb;cursor:pointer}button:focus-visible,select:focus-visible{outline:3px solid white;outline-offset:3px}button{padding:8px 10px;border-radius:8px;min-height:36px}svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2}section{font:16px/1.5 system-ui,sans-serif;width:min(264px,calc(100vw - 32px));padding:18px;background:#19231d;color:#edf5ef;border:1px solid #addfbb;border-radius:14px;box-shadow:0 4px 24px #0004;margin:8px 0;max-height:65vh;overflow:auto}header{display:flex;align-items:center;justify-content:space-between;gap:12px}h2{font-size:20px;margin:12px 0 16px;font-weight:600}label{font-size:14px;display:grid;gap:6px}select{width:100%;padding:8px;border-radius:6px}footer{margin-top:12px}.wrap{display:flex;flex-direction:column;align-items:flex-end}.left{align-items:flex-start}.top{flex-direction:column-reverse}`;
 shadow.append(style);
 const mount=()=>{if(!stopped&&!host.isConnected)document.documentElement.append(host)};
 const observer=new MutationObserver(mount);observer.observe(document.documentElement,{childList:true});
 function close(focus=false){opened=false;if(current)render(current);if(focus)shadow.querySelector<HTMLButtonElement>('.launcher')?.focus()}
 function outside(event:Event){if(opened&&!event.composedPath().includes(host))close()}
 function escape(event:KeyboardEvent){if(event.key==='Escape'&&opened){event.stopPropagation();close(true)}}
 document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',escape,true);
 async function action(event:Event,value:'hide'|'position',position?:'bottom-right'|'bottom-left'|'top-right'|'top-left'){
  if(!event.isTrusted||stopped)return;try{await browser.runtime.sendMessage({type:'widget-action',provider,action:value,position});await refresh()}catch{stop()}
 }
 function render(view:Extract<WidgetView,{enabled:true}>){
  current=view;
  const rules:Record<string,string>={all:'initial',display:'block',position:'fixed','z-index':'2147483647',width:'max-content',height:'auto',margin:'0',padding:'0',border:'0',opacity:'1',visibility:'visible',transform:'none','pointer-events':'auto',contain:'layout style',isolation:'isolate',top:view.position.startsWith('top')?'16px':'auto',bottom:view.position.startsWith('bottom')?'16px':'auto',left:view.position.endsWith('left')?'16px':'auto',right:view.position.endsWith('right')?'16px':'auto'};
  host.removeAttribute('style');for(const [k,v]of Object.entries(rules))host.style.setProperty(k,v,'important');
  const focused=(shadow.activeElement as HTMLElement|null)?.dataset.control;
  shadow.querySelector('.wrap')?.remove();const wrap=document.createElement('div');wrap.className=`wrap ${view.position.endsWith('left')?'left':''} ${view.position.startsWith('top')?'top':''}`;
  const launcher=document.createElement('button');launcher.className='launcher';launcher.dataset.control='launcher';launcher.setAttribute('aria-label','MyLimits preview');launcher.setAttribute('aria-expanded',String(opened));launcher.setAttribute('aria-controls','mylimits-preview-panel');
  launcher.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18a10 10 0 1 1 16 0M12 13l5-5"/></svg>';
  launcher.addEventListener('click',e=>{if(!e.isTrusted)return;opened=!opened;render(view);if(opened)shadow.querySelector<HTMLButtonElement>('[data-control="close"]')?.focus()});wrap.append(launcher);
  if(opened){const panel=document.createElement('section');panel.id='mylimits-preview-panel';panel.setAttribute('role','region');panel.setAttribute('aria-label','MyLimits preview panel');const header=document.createElement('header'),title=document.createElement('strong'),closeButton=document.createElement('button');title.textContent='MyLimits';closeButton.textContent='×';closeButton.dataset.control='close';closeButton.setAttribute('aria-label','Close preview');closeButton.addEventListener('click',()=>close(true));header.append(title,closeButton);const message=document.createElement('h2');message.textContent='Coming soon';const label=document.createElement('label');label.textContent='Position';const position=document.createElement('select');position.dataset.control='position';position.setAttribute('aria-label','Preview position');for(const value of ['bottom-right','bottom-left','top-right','top-left'] as const){const option=document.createElement('option');option.value=value;option.textContent=value.replace('-',' ');position.append(option)}position.value=view.position;position.addEventListener('change',e=>void action(e,'position',position.value as typeof view.position));label.append(position);const footer=document.createElement('footer'),hide=document.createElement('button');hide.textContent='Hide on this site';hide.dataset.control='hide';hide.addEventListener('click',e=>void action(e,'hide'));footer.append(hide);panel.append(header,message,label,footer);wrap.append(panel)}
  shadow.append(wrap);mount();if(focused)shadow.querySelector<HTMLElement>(`[data-control="${focused}"]`)?.focus();
 }
 async function refresh(){if(stopped||busy)return;busy=true;try{const response=await browser.runtime.sendMessage({type:'widget-state',provider});if(!response?.ok)throw Error();const view=WidgetViewSchema.parse(response.data);if(!view.enabled){stop();return}render(view)}catch{stop()}finally{busy=false}}
 function message(raw:unknown,sender:{id?:string;tab?:unknown}){if(sender.id!==browser.runtime.id||sender.tab)return;const type=(raw as {type?:unknown})?.type;if(type==='mylimits-widget-stop')stop();if(type==='mylimits-widget-refresh')void refresh()}
 function stop(){if(stopped)return;stopped=true;observer.disconnect();document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',escape,true);browser.runtime.onMessage.removeListener(message);host.remove();delete global.__mylimitsWidgetStop}
 global.__mylimitsWidgetStop=stop;browser.runtime.onMessage.addListener(message);ctx.onInvalidated(stop);void refresh();
}});
