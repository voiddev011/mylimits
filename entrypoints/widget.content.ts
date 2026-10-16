import { browser } from 'wxt/browser';
import { providerForUrl } from '../src/providers/catalog';
import { WidgetViewSchema,type WidgetView } from '../src/core/widget';
import { age,countdown } from '../src/ui/format';
export default defineContentScript({registration:'runtime',runAt:'document_idle',allFrames:false,main(ctx){
 const provider=providerForUrl(location.href);if(!provider||window.top!==window)return;
 const global=globalThis as typeof globalThis&{__mylimitsWidgetStop?:()=>void};if(global.__mylimitsWidgetStop)return;
 let stopped=false,busy=false;const host=document.createElement('div');host.id='mylimits-usage-widget';
 // Only public display values live here. Shadow styles prevent page CSS reaching controls.
 const shadow=host.attachShadow({mode:'open'});const style=document.createElement('style');style.textContent=`:host{color-scheme:dark}*{box-sizing:border-box}section{font:13px/1.4 system-ui,sans-serif;background:#17251f;color:#edf5ef;border:1px solid #87c7aa;border-radius:12px;padding:12px;box-shadow:0 4px 24px #0005;overflow:auto;max-height:min(360px,80vh)}header{display:flex;gap:8px;align-items:center}strong{flex:1;overflow-wrap:anywhere}button{font:inherit;background:#234234;color:#edf5ef;border:1px solid #87c7aa;border-radius:6px;padding:5px 8px;cursor:pointer}button:focus-visible,select:focus-visible{outline:3px solid #fff;outline-offset:2px}p{margin:6px 0;overflow-wrap:anywhere}.dated{color:#d4c9a3}small{display:block;font-size:11px;color:#c4d9cd}select{background:#234234;color:#edf5ef;font:inherit;border:1px solid #87c7aa;padding:4px;width:100%}footer{display:flex;gap:6px;margin-top:8px}footer button{flex:1}`;shadow.append(style);
 const mount=()=>{if(!stopped&&!host.isConnected)document.documentElement.append(host)};
 const observer=new MutationObserver(mount);observer.observe(document.documentElement,{childList:true});
 async function action(event:Event,value:'collapse'|'expand'|'hide'|'open',position?:'bottom-right'|'bottom-left'|'top-right'|'top-left'){
  if(!event.isTrusted||stopped)return;try{await browser.runtime.sendMessage({type:'widget-action',provider,action:value,position});if(value!=='open')await refresh()}catch{stop()}
 }
 function button(label:string,value:'collapse'|'expand'|'hide'|'open'){const b=document.createElement('button');b.textContent=label;b.addEventListener('click',e=>void action(e,value));return b}
 function render(view:Extract<WidgetView,{enabled:true}>){
  const rules:Record<string,string>={all:'initial',display:'block',position:'fixed','z-index':'2147483647',width:view.collapsed?'180px':'min(280px, calc(100vw - 24px))',height:'auto',margin:'0',padding:'0',border:'0',opacity:'1',visibility:'visible',transform:'none','pointer-events':'auto',contain:'layout style',isolation:'isolate',top:view.position.startsWith('top')?'12px':'auto',bottom:view.position.startsWith('bottom')?'12px':'auto',left:view.position.endsWith('left')?'12px':'auto',right:view.position.endsWith('right')?'12px':'auto'};
  host.removeAttribute('style');for(const [k,v]of Object.entries(rules))host.style.setProperty(k,v,'important');
  shadow.querySelector('section')?.remove();const box=document.createElement('section');box.setAttribute('aria-label','MyLimits usage widget');const header=document.createElement('header'),title=document.createElement('strong');title.textContent=view.collapsed?'MyLimits':view.name;header.append(title,button(view.collapsed?'Expand':'Collapse',view.collapsed?'expand':'collapse'));box.append(header);
  if(!view.collapsed){const status=document.createElement('p');status.textContent=view.status;box.append(status);for(const meter of view.meters){const p=document.createElement('p');p.textContent=`${meter.label}: ${meter.value}`;if(!meter.fresh)p.className='dated';const detail=document.createElement('small');detail.textContent=`${meter.fresh?'Reading':'Last reading'} ${meter.observedAt===null?'unavailable':age(meter.observedAt,Date.now())} · ${countdown(meter.resetsAt,Date.now())}`;p.append(detail);box.append(p)}const position=document.createElement('select');position.setAttribute('aria-label','Widget position');for(const value of ['bottom-right','bottom-left','top-right','top-left'] as const){const option=document.createElement('option');option.value=value;option.textContent=value.replace('-',' ');position.append(option)}position.value=view.position;position.addEventListener('change',e=>void action(e,'expand',position.value as typeof view.position));box.append(position);const footer=document.createElement('footer');footer.append(button('Dashboard','open'),button('Hide','hide'));box.append(footer)}
  shadow.append(box);mount();
 }
 async function refresh(){if(stopped||busy)return;busy=true;try{const response=await browser.runtime.sendMessage({type:'widget-state',provider});if(!response?.ok)throw Error();const view=WidgetViewSchema.parse(response.data);if(!view.enabled){stop();return}render(view)}catch{stop()}finally{busy=false}}
 function message(raw:unknown,sender:{id?:string;tab?:unknown}){if(sender.id!==browser.runtime.id||sender.tab)return;const type=(raw as {type?:unknown})?.type;if(type==='mylimits-widget-stop')stop();if(type==='mylimits-widget-refresh')void refresh()}
 function stop(){if(stopped)return;stopped=true;clearInterval(timer);observer.disconnect();browser.runtime.onMessage.removeListener(message);host.remove();delete global.__mylimitsWidgetStop}
 const timer=setInterval(()=>void refresh(),60000);global.__mylimitsWidgetStop=stop;browser.runtime.onMessage.addListener(message);ctx.onInvalidated(stop);void refresh();
}});
