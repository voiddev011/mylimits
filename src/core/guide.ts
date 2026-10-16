import type { HistoryInsights } from './insights';
import { accountName,isFresh,remainingPercent,type Account,type Settings,type Meter,type ProviderId } from './model';
export const GUIDE_UPDATED='2026-10-16';
export const TASKS=['coding','writing','research','extraction','reasoning'] as const;
export type Task=typeof TASKS[number];export type Preference='balanced'|'speed'|'quality'|'usage';
// Broad product capabilities, not benchmarks, model entitlements or quota multipliers.
export const GUIDE_SOURCES=[
 {label:'Codex coding scope',url:'https://github.com/openai/codex'},
 {label:'Cursor coding scope',url:'https://cursor.com/docs'},
 {label:'Clear prompting',url:'https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices'},
 {label:'Perplexity search',url:'https://www.perplexity.ai/help-center/en/articles/10352903-what-is-pro-search'},
];
const metadata:Partial<Record<ProviderId,{tasks:readonly Task[];basis:string}>>={
 claude:{tasks:TASKS,basis:'General text assistant; confirm that your selected model and tools support this task.'},
 chatgpt:{tasks:['coding'],basis:'The tracked Work / Codex pool is for coding, not ordinary ChatGPT chat.'},
 cursor:{tasks:['coding'],basis:'The tracked included/model pools belong to the Cursor coding product.'},
 perplexity:{tasks:['research'],basis:'Search/research modes have separate allowances; choose the matching mode.'},
};
export interface GuideOption {id:string;name:string;basis:string;readings:{label:string;left:string}[];resetAt:number|null;notes:string[];}
export interface GuideResult {options:GuideOption[];excluded:{id:string;name:string;reason:string}[];mode:string;tips:string[];updated:string;}
function relevant(a:Account,m:Meter,task:Task){
 if(m.evidence!=='reported'||m.scope==='local'||m.scope==='api')return false;
 if(a.provider==='chatgpt')return task==='coding'&&m.scope==='work-codex';
 if(a.provider==='perplexity')return task==='research'&&['perplexity:remaining_pro','perplexity:remaining_research'].includes(m.id);
 return m.scope==='subscription'||m.scope==='chat';
}
export function guide(accounts:Account[],settings:Settings,task:Task,preference:Preference,now:number,excludedIds:string[]=[],history?:HistoryInsights):GuideResult{
 const result:GuideResult={options:[],excluded:[],mode:preference==='speed'?'Start with the provider’s fast/default mode for a bounded draft.':preference==='quality'?'Use a reasoning or planning mode if available; define a quality check first.':preference==='usage'?'Start with a short draft and only the necessary context; escalate if it fails your check.':'Use the default mode for a first pass; add reasoning for a task with difficult constraints.',tips:['State the goal, constraints and expected output format together.','Attach only relevant sections and describe what each file contributes.','Ask for the amount of detail you need; concise output does not imply a fixed token saving.','Reuse a checked recap when switching tools. Verify the answer before treating it as fact.'],updated:GUIDE_UPDATED};
 for(const a of accounts){const exclude=(reason:string)=>result.excluded.push({id:a.id,name:accountName(a),reason});const meta=metadata[a.provider];
  if(excludedIds.includes(a.id)){exclude('Excluded by you for this task.');continue}
  if(!meta){exclude('No reviewed task metadata for this product yet.');continue}
  if(!meta.tasks.includes(task)){exclude('The tracked product or quota does not match this task.');continue}
  const meters=a.meters.filter(m=>relevant(a,m,task));if(!meters.length){exclude('No applicable reported quota; local activity and spend are not capacity.');continue}
  if(meters.some(m=>!isFresh(a,m,now,settings.refreshMinutes))){exclude('An applicable reading is stale, inactive or awaiting a reset check.');continue}
  if(meters.some(m=>remainingPercent(m)===0||m.remaining===0)){exclude('An applicable allowance has no reported headroom.');continue}
  const known=meters.filter(m=>remainingPercent(m)!==null||m.remaining!==undefined&&m.remaining!==null);if(!known.length){exclude('Remaining capacity is unknown.');continue}
  const notes=['Different products’ percentages are not equivalent; these are eligible options, not a performance ranking.','Model access and the task’s actual consumption must be confirmed in the provider.'];
  if(known.some(m=>(remainingPercent(m)??100)<=settings.warningRemaining))notes.push('A relevant allowance is low. Consider a shorter first pass or wait for a confirmed reset.');
  for(const series of history?.series??[]){if(series.accountId===a.id&&series.pacing.kind==='range'&&known.some(m=>m.id===series.meterId&&m.connectionId===series.connectionId&&(m.windowId??(m.resetsAt?String(m.resetsAt):null))===series.window)&&now>=series.latest.time&&now-series.latest.time<=Math.max(15,settings.refreshMinutes*3)*60000)notes.push(`History estimate for ${series.label}: roughly ${series.pacing.lowHours.toFixed(1)}–${series.pacing.highHours.toFixed(1)} hours of headroom at a similar pace. Reset may arrive sooner; this is not a cutoff prediction.`);}
  const resetAt=Math.min(...meters.map(m=>m.resetsAt??Infinity));if(Number.isFinite(resetAt)&&resetAt-now<3600000)notes.push('A reported reset is due within an hour; it still needs a fresh reading to confirm.');
  result.options.push({id:a.id,name:accountName(a),basis:meta.basis,readings:known.map(m=>({label:m.label,left:remainingPercent(m)!==null?`${Math.round(remainingPercent(m)!)}% left`:`${m.remaining} ${m.unit} left`})),resetAt:Number.isFinite(resetAt)?resetAt:null,notes});
 }return result;
}
export function analyzePrompt(text:string){
 const trimmed=text.trim(),words=trimmed?trimmed.split(/\s+/u).length:0;const tips:string[]=[];
 if(!trimmed)tips.push('Paste text you want to review. Nothing is read from your conversations.');
 if(trimmed&&!/\b(goal|task|please|build|write|extract|research|explain|summarize)\b/i.test(trimmed))tips.push('Make the requested action explicit.');
 if(trimmed&&!/\b(format|json|table|bullets|words|sentences|schema)\b/i.test(trimmed))tips.push('Specify the output format or length if it matters.');
 if(words>600)tips.push('Check whether every section is needed for this task.');
 return {characters:text.length,words,lines:text?text.split(/\r?\n/).length:0,tips}; // No invented tokenizer or percentage-saving claim.
}
export const templates:Record<Task,string>={coding:'Task: [change]\nRelevant files/context: [only what is needed]\nConstraints: [requirements]\nVerify: [expected behavior and checks]\nOutput: [patch and short explanation]',writing:'Write [document] for [audience].\nGoal: [outcome]\nFacts to preserve: [facts]\nTone/length: [requirements]\nOutput: [format]',research:'Research [question] within [scope/time period].\nPrioritize primary sources. Separate evidence from inference.\nOutput: [short comparison with source links and remaining uncertainty]',extraction:'Extract [fields] from the supplied material.\nUse null for missing information; do not guess.\nOutput: [schema/table]\nMaterial: [relevant text]',reasoning:'Decide [question].\nKnown facts: [facts]\nConstraints: [constraints]\nCompare [options] and explain tradeoffs, uncertainty and how to check the result.'};
export function handoffPreview(goal:string,decisions:string,next:string,excerpt:string){
 return [`Goal\n${goal.trim()}`,`Decisions / checked facts\n${decisions.trim()}`,`Next task\n${next.trim()}`,`Selected excerpt (user supplied)\n${excerpt.trim()}`].join('\n\n');
}
