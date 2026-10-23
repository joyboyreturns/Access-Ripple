import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import GraphCanvas from './GraphCanvas';
import SelectMenu from './SelectMenu';
import Landing, { Dialog } from './Landing';
import Icon, { Mark } from './Icons';
import { APPLIED_FIXES_PATCH, APPLIED_FIXES_SUMMARY, ApiError, applyProposal, checkApi, compareScans, createScan, downloadVault, getAiStatus, getProof, getSampleInfo, listScans, proposeFix, readGraph, readScan, resetDemoShop, rescan, setSampleState, simulateProposal, waitForScan, writeBriefing, writeContract, type AiStatus, type Briefing, type RepairContract } from './api';
import { barrierRipple, byPriority, cleanLabel, describe, friendlyScanError, groupIssues, isIssue, kindName, matches, nodeColor, pageFor, reachFacts, remainingSummary, rippleReach, routesToFinding, scanStory, severity, shortcutOf, str, traceJourney, whoItProtects, type GraphFilter, type ViewNode } from './presentation';
import { TOUR, type TourContext } from './tour';
import type { FixProposal, SampleInfo, ScanComparison, ScanResult, ScanSummary, SiteGraph } from './types';

const EMPTY: SiteGraph = { schemaVersion: '1.0', nodes: [], edges: [] };
const FILTERS: { id: GraphFilter; name: string; icon: string }[] = [{id:'overview',name:'Overview',icon:'orbit'},{id:'pages',name:'Pages',icon:'folder'},{id:'issues',name:'Findings',icon:'warning'},{id:'controls',name:'Controls',icon:'target'},{id:'flows',name:'Journeys',icon:'map'}];
type Saved = { scan: ScanResult; graph: SiteGraph };
function storageGet(key: string, session = false) { try{return (session?sessionStorage:localStorage).getItem(key);}catch{return null;} }
function storageSet(key: string, value: string, session = false) { try{(session?sessionStorage:localStorage).setItem(key,value);}catch{/* Storage can be unavailable in private contexts. */} }
function httpUrl(value: string) { try{const u=new URL(value);return /^https?:$/.test(u.protocol)?u.toString():'';}catch{return '';} }
function normalize(value: string) { const trimmed=value.trim();if(!trimmed)throw new Error('Enter a public website address to begin.');const address=/^[a-z][a-z\d+.-]*:/i.test(trimmed)?trimmed:`https://${trimmed}`;const url=httpUrl(address);if(!url)throw new Error('Use a website address beginning with http:// or https://.');return url; }
function hostname(value: string) { try{return new URL(value).hostname;}catch{return value;} }
/** The built-in demo shop runs on loopback, so show its name instead of a raw address. */
function siteName(scan: {inputUrl:string;sample?:string}|undefined) { return scan?.sample ? 'Northstar demo shop' : hostname(scan?.inputUrl??''); }

/** A verdict always carries a shape and a word, never colour alone. */
function VerdictMark({ outcome }: { outcome?: string }) {
  const word=outcome==='supported'?'held':outcome==='contradicted'?'failed':'unknown';
  return <span className="verdict-mark"><Icon name={outcome==='supported'?'check':outcome==='contradicted'?'close':'info'} size={11}/>{word}</span>;
}

type Box = { x: number; y: number; width: number; height: number };
/**
 * A picture of a page with an outline over each element a finding was
 * recorded on. The picture covers the first screen only, so an element below
 * it is said to be there rather than drawn in the wrong place.
 */
function ShotWithBoxes({ src, alt, boxes }: { src: string; alt: string; boxes: Array<{ label: string; box: Box; tone?: string }> }) {
  const [size,setSize]=useState<{w:number;h:number}|null>(null);
  const shown=size?boxes.filter(item=>item.box.y<size.h&&item.box.x<size.w):[];
  const below=size?boxes.length-shown.length:0;
  const described=boxes.length?`${alt} Outlined: ${boxes.map(item=>item.label).join('; ')}.`:alt;
  return <div className="shot-boxes"><div className="shot-frame"><img src={src} alt={described} onLoad={e=>setSize({w:e.currentTarget.naturalWidth,h:e.currentTarget.naturalHeight})}/>{size&&shown.map((item,i)=><span key={i} className={`box-outline ${item.tone??''} ${item.box.x+item.box.width/2>size.w/2?'label-end':''}`} aria-hidden="true" style={{left:`${item.box.x/size.w*100}%`,top:`${item.box.y/size.h*100}%`,width:`${Math.max(1.5,Math.min(item.box.width,size.w-item.box.x)/size.w*100)}%`,height:`${Math.max(2,Math.min(item.box.height,size.h-item.box.y)/size.h*100)}%`}}><b>{item.label}</b></span>)}</div>{below>0&&<small className="box-note">{below} outlined element{below===1?' sits':'s sit'} below the part of the page in this picture.</small>}</div>;
}

/** The outlines for the findings a comparison names on one page. */
function boxesOn(url: string, groups: Array<{ nodes: ScanComparison['resolved']; tone: string }>, graphs: SiteGraph[]) {
  return groups.flatMap(({nodes,tone})=>nodes.filter(node=>{const box=node.data.boundingBox as Box|undefined;if(!box)return false;const page=graphs.map(g=>pageFor(node,g)).find(Boolean);return str(page,'url')===url;}).map(node=>({label:describe(node).short,box:node.data.boundingBox as Box,tone})));
}

/** Every accepted change, as a patch a developer applies or a summary a reviewer reads. */
function ChangeExports() {
  return <div className="change-exports"><a className="button button-glass compact" href={APPLIED_FIXES_PATCH} download><Icon name="download" size={15}/>Accepted changes (.patch)</a><a className="button button-glass compact" href={APPLIED_FIXES_SUMMARY} download><Icon name="code" size={15}/>Pull request summary</a></div>;
}

/** Focus goes back where it was when a dialog that was opened from it goes away. */
function useReturnFocus() {
  useEffect(()=>{const opener=document.activeElement as HTMLElement|null;return()=>{if(opener&&document.contains(opener))opener.focus();};},[]);
}

/**
 * The proof: the same page before and after one change, with the counts.
 * This is the moment a reviewer remembers, so it stands on its own.
 */
function ProofView({ comparison, graph, previousGraph, onClose }: { comparison: ScanComparison; graph: SiteGraph; previousGraph: SiteGraph; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const shot = comparison.pages.find((page) => page.before && page.after) ?? comparison.pages[0];
  useEffect(() => { ref.current?.showModal(); }, []);
  useReturnFocus();
  const simulated = comparison.simulatedPages?.filter((page) => page.applied > 0) ?? [];
  return <dialog className="dialog proof-dialog" ref={ref} onCancel={onClose} aria-labelledby="proof-title">
    <div className="proof-head">
      <div><span className="eyebrow">{comparison.demoShop ? 'CONTROLLED DEMO SHOP · REPAIR DEMONSTRATION' : 'THE SAME PAGE, ACROSS TWO SCANS'}</span><h2 id="proof-title">What the second scan found</h2>
        <div className="proof-tiles">
          <div className="proof-tile resolved"><strong>{comparison.resolved.length}</strong><span>no longer observed</span></div>
          <div className="proof-tile remaining"><strong>{comparison.remaining.length}</strong><span>still observed</span></div>
          <div className="proof-tile fresh"><strong>{comparison.new.length}</strong><span>new</span></div>
          {comparison.notRechecked.length>0&&<div className="proof-tile unknown"><strong>{comparison.notRechecked.length}</strong><span>not rechecked</span></div>}
        </div>
      </div>
      <button className="icon-btn" aria-label="Close the proof" onClick={onClose}><Icon name="close" size={18}/></button>
    </div>
    {simulated.length>0&&<p className="simulated-banner"><Icon name="warning" size={16}/><span><b>SIMULATED PATCH.</b> The second scan applied {simulated.reduce((total,page)=>total+page.applied,0)} change{simulated.reduce((total,page)=>total+page.applied,0)===1?'':'s'} inside the scanner’s own browser. These results describe that simulation, not the live site, which was not changed.</span></p>}
    {shot&&<div className="proof-shots">
      <figure>{shot.before?<ShotWithBoxes src={shot.before} alt="The page before the change." boxes={boxesOn(shot.url,[{nodes:comparison.resolved,tone:'resolved'},{nodes:comparison.remaining,tone:'remaining'}],[previousGraph,graph])}/>:<img src="" alt="The page before the change"/>}<figcaption>Before{boxesOn(shot.url,[{nodes:comparison.resolved,tone:'resolved'},{nodes:comparison.remaining,tone:'remaining'}],[previousGraph,graph]).length>0?' · outlined where each finding was recorded':''}</figcaption></figure>
      <figure><img src={shot.after ?? shot.before ?? ''} alt="The page after the change"/><figcaption>After</figcaption></figure>
    </div>}
    {(comparison.predictions?.length??0)>0&&<div className="proof-predictions"><span className="eyebrow">AI PREDICTED · THE BROWSER RECORDED</span>{comparison.predictions!.map((prediction)=><div className={`verdict ${prediction.outcome}`} key={prediction.issueId}><VerdictMark outcome={prediction.outcome}/><span><strong>{describeId(prediction.issueId, graph, prediction.label, previousGraph)}</strong><small>{prediction.outcome==='supported'?'The prediction held.':prediction.outcome==='contradicted'?'The prediction did not hold.':'Not checked again.'}{prediction.simulated?' Checked on a simulated page.':''}</small></span></div>)}</div>}
    <ul className="proof-resolved">{comparison.resolved.slice(0, 5).map((node) => <li key={node.id}><Icon name="check" size={15}/><span><strong>{describe(node).title}</strong><small>{node.kind === 'accessibility-finding' ? 'accessibility finding' : 'browser signal'}</small></span></li>)}</ul>
    {comparison.notRechecked.length>0&&<p className="proof-rest">Not rechecked: {comparison.notRechecked.length} finding{comparison.notRechecked.length === 1 ? '' : 's'} whose page could not be looked at again. Unknown, not fixed.</p>}
    {comparison.remaining.length>0&&<p className="proof-rest">Still observed: {remainingSummary(comparison.remaining)}</p>}<ChangeExports/><p className="proof-caveat">Rechecked observations — not a claim that the site is now accessible, and not an accessibility certification.</p>
  </dialog>;
}

/**
 * A proposed change for one finding. It is a suggestion grounded in what the
 * browser recorded, never something the tool applied on its own.
 */
function FixProposalCard({ proposal, contract, contractBusy, contractError, graph, busy, canApply, onApply, onRescan, onPredict, onSimulate, simulated }: { proposal: FixProposal; contract: RepairContract | null; contractBusy: boolean; contractError: string; graph: SiteGraph; busy: boolean; canApply: boolean; onApply: () => void; onRescan: () => void; onPredict: () => void; onSimulate: () => void; simulated: boolean }) {
  return <div className="fix-card">
    <div className="fix-head"><Icon name="spark" size={16}/><strong>A proposed change</strong><span className="ai-model">{proposal.model}</span></div>
    <p className="fix-summary">{proposal.summary}</p>
    {proposal.wcagCriterion&&<p className="fix-criterion"><Icon name="shield" size={13}/>WCAG {proposal.wcagCriterion}</p>}
    <div className="fix-diff">
      <div className="fix-line before"><span className="fix-mark">−</span><code>{proposal.before}</code></div>
      <div className="fix-line after"><span className="fix-mark">+</span><code>{proposal.after}</code></div>
    </div>
    {proposal.location&&<p className="fix-location"><Icon name="code" size={14}/><code>{proposal.location.file}:{proposal.location.line}</code></p>}
    <p className="fix-why">{proposal.why}</p>
    {proposal.assistiveTechImpact&&<div className="fix-at"><span className="eyebrow"><Icon name="keyboard" size={13}/> WHAT A SCREEN READER OR KEYBOARD USER MEETS</span><p>{proposal.assistiveTechImpact}</p><small>The model’s account, not a recording.</small></div>}
    {proposal.unifiedDiff&&<details className="fix-patch"><summary><Icon name="code" size={14}/> The change as a patch</summary><pre>{proposal.unifiedDiff}</pre></details>}
    {contract&&<div className="fix-contract"><span className="eyebrow">WHAT THE MODEL SAYS THIS WILL DO</span><ul>{contract.predictions.map((prediction)=><li key={prediction.issueId}><span className={`contract-expect ${prediction.expected}`}><Icon name={prediction.expected==='absent'?'check':'info'} size={11}/>{prediction.expected==='absent'?'will be gone':'will still be there'}</span><span><strong>{describeId(prediction.issueId, graph)}</strong><small>{prediction.reason}</small></span></li>)}</ul><p className="fix-honest">Committed to before the change was applied. The rescan checks it.</p></div>}
    {contractBusy&&<p className="fix-honest"><span className="spinner"/> Asking the model what this change will fix…</p>}
    {contractError&&<p className="ai-error">{contractError}</p>}
    {!contract&&!contractBusy&&<button className="button button-glass compact" disabled={busy} onClick={onPredict}><Icon name="target" size={15}/>{contractError?'Ask again':'Ask what this will fix'}</button>}
    <p className="fix-honest">A suggestion grounded in the recorded markup, not a verified fix. The rescan is the proof.</p>
    {!canApply&&<p className="fix-honest" id="simulate-note">The site is never changed. A simulated change is applied inside the scanner’s own browser on the next rescan, and that page is labelled as a simulation.</p>}
    <div className="fix-actions">
      {canApply&&<button className="button button-solid compact" disabled={busy} onClick={onApply}><Icon name="check" size={15}/>Apply this change to the demo shop</button>}
      {!canApply&&<button className="button button-solid compact" disabled={busy||simulated} aria-describedby="simulate-note" onClick={onSimulate}><Icon name="spark" size={15}/>{simulated?'Simulated on the next rescan':'Simulate on the next rescan'}</button>}
      <button className="button button-glass compact" disabled={busy} onClick={onRescan}>Rescan and compare <Icon name="refresh" size={15}/></button>
    </div>
  </div>;
}

/**
 * A readable name for a recorded finding.
 *
 * The graph in front of the viewer is the newer scan, and a finding the
 * change fixed is no longer in it. So the label the server took from the
 * earlier scan is used when the newer one no longer has the node.
 */
function describeId(id: string, graph: SiteGraph, fallback?: string, previousGraph?: SiteGraph): string {
  const node = graph.nodes.find((item) => item.id === id) ?? previousGraph?.nodes.find((item) => item.id === id);
  if (node) return describe(node).title;
  if (fallback) return fallback;
  return id.startsWith('finding:') || id.startsWith('error:') ? 'A recorded issue' : id;
}

/** One readable paragraph that says what the scan found, so the result is legible at a glance. */
function ScanStory({ scan, graph, onOpen }: { scan: ScanResult; graph: SiteGraph; onOpen: (node: ViewNode) => void }) {
  const story = useMemo(()=>scanStory(scan,graph),[scan,graph]);
  const first=useMemo(()=>{
    const findings=groupIssues(graph.nodes.filter(n=>n.kind==='accessibility-finding'));
    const order=['critical','serious','moderate','minor'];
    return [...findings].sort((a,b)=>order.indexOf(severity(a))-order.indexOf(severity(b)))[0]??null;
  },[graph]);
  return <div className={`scan-story tone-${story.tone}`}><div className="story-head"><span className="eyebrow">WHAT WE FOUND</span><span className="story-tone">{story.tone==='clear'?'Nothing blocking':story.tone==='critical'?'Needs attention':'Worth a look'}</span></div><p className="story-headline">{story.headline}</p><p className="story-detail">{story.detail}</p>{first&&<button className="story-link" onClick={()=>onOpen(first)}>Open “{describe(first).title}” <Icon name="arrow" size={15}/></button>}</div>;
}

/**
 * The optional AI briefing. It only ever appears when a model provider is
 * configured, and every sentence it shows is tied to recorded evidence.
 */
function AiBriefing({ scan, graph, status, onOpen, onReady }: { scan: ScanResult; graph: SiteGraph; status: AiStatus | null; onOpen: (id: string) => void; onReady: (message: string) => void }) {
  const [briefing,setBriefing]=useState<Briefing|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  // A briefing belongs to the scan it was written for. When another scan is
  // opened, the old one goes, so nothing on screen describes the wrong scan.
  useEffect(()=>{setBriefing(null);setError('');},[scan.id]);
  const ask=async()=>{
    setBusy(true);setError('');
    try{setBriefing(await writeBriefing(scan.id));onReady('The model briefing is ready, under the scan story.');}
    catch(cause){setError(cause instanceof Error?cause.message:'The briefing could not be written.');}
    finally{setBusy(false);}
  };
  if(!status?.configured) return <div className="ai-briefing"><div className="ai-head"><Icon name="spark" size={17}/><strong>Ask a model to read this scan</strong></div><p>No model provider is configured on this computer, so the summary above is the only one. Add <code>ACCESSRIPPLE_AI_KEY</code> to a local <code>.env</code> file to enable a model-written briefing. Nothing else changes. The key is used only to call the provider you configured, and is never sent to the browser.</p></div>;
  return <div className="ai-briefing"><div className="ai-head"><Icon name="spark" size={17}/><strong>A model read of this scan</strong>{briefing&&<span className="ai-model">{briefing.model}</span>}</div>{busy&&<p className="ai-loading"><span className="spinner"/> Reading the recorded evidence…</p>}{!busy&&!briefing&&!error&&<p className="ai-detail">A model writes the summary in plain language, using only what the browser recorded. Every sentence links back to the evidence it came from, and it is asked to name what the scan did not check.</p>}{error&&<p className="ai-error">{error}</p>}{briefing&&<><p className="ai-text">{briefing.text}</p><div className="ai-citations">{briefing.citations.map(c=>{const node=graph.nodes.find(n=>n.id===c.id);const label=c.label;return node?<button key={c.id} onClick={()=>onOpen(c.id)} title={c.id}><Icon name="target" size={13}/>{label}</button>:<span key={c.id} className="ai-gap" title="A gap in what this scan covered"><Icon name="shield" size={13}/>{label}</span>;})}</div>{(briefing.gaps?.length??0)>0&&<div className="ai-gaps"><span>WHAT THIS SCAN DID NOT CHECK</span><div>{briefing.gaps!.map(g=><span key={g.id} className="ai-gap"><Icon name="shield" size={13}/>{g.label}</span>)}</div></div>}</>}<div className="ai-actions">{briefing&&<button className="button button-glass compact" disabled={busy} onClick={()=>void ask()}>Write it again</button>}{!briefing&&<button className="button button-solid compact" disabled={busy} onClick={()=>void ask()}>{busy?'Writing…':'Write a briefing'} <Icon name="arrow" size={15}/></button>}</div></div>;
}

const WALK_STEPS = ['Scan the demo shop', 'Open the finding with the widest reach', 'The model proposes a change', 'The model commits to what it will fix', 'Apply the change', 'Rescan and compare', 'Open the proof'];

/** Where the walkthrough is. Each step has a mark and a word, and the panel says when a prepared fix stood in for the model. */
function WalkthroughPanel({ walk, busy, onClose }: { walk: { step: number; note: string; model: boolean; error?: string; seconds?: number }; busy: boolean; onClose: () => void }) {
  return <section className="walkthrough" aria-label="Judge walkthrough"><div className="walkthrough-head"><strong>Judge walkthrough</strong>{walk.seconds!==undefined&&<span className="walkthrough-time">{walk.seconds} s</span>}<button className="icon-btn" aria-label="Close the walkthrough" disabled={busy} onClick={onClose}><Icon name="close" size={16}/></button></div>
    <ol>{WALK_STEPS.map((label,index)=>{const skipped=!walk.model&&(index===2||index===3);const state=walk.error&&index===walk.step?'failed':skipped&&walk.step>=4?'skipped':index<walk.step||walk.step===6?'done':index===walk.step?'current':'waiting';return <li key={label} className={state} aria-current={state==='current'?'step':undefined}><span className="walk-mark">{state==='done'?<Icon name="check" size={12}/>:state==='current'?<span className="spinner"/>:state==='failed'?<Icon name="close" size={12}/>:state==='skipped'?<Icon name="minus" size={12}/>:<span>{index+1}</span>}</span><span>{label}{state==='skipped'?' — skipped':''}</span></li>;})}</ol>
    <p className={walk.error?'ai-error':'walkthrough-note'}>{walk.error??walk.note}</p></section>;
}

export default function App() {
  const [screen,setScreen]=useState(location.hash==='#studio'||location.hash==='#demo'||location.hash==='#walkthrough'||location.hash==='#proof'?'studio':'home');
  const [theme,setTheme]=useState(storageGet('accessripple-theme')==='light'?'light':'dark');
  const [scan,setScan]=useState<ScanResult|null>(null),[graph,setGraph]=useState<SiteGraph>(EMPTY);
  // The graph of the scan before this one. A finding that a change repaired
  // is no longer in the current graph, and its name is still wanted.
  const [previousGraph,setPreviousGraph]=useState<SiteGraph>(EMPTY);
  const [progress,setProgress]=useState<ScanResult|null>(null),[busy,setBusy]=useState(false),[connected,setConnected]=useState<boolean|null>(null);
  const [url,setUrl]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [filter,setFilter]=useState<GraphFilter>('overview'),[view,setView]=useState<'map'|'list'>('map');
  const [journeyId,setJourneyId]=useState<string|null>(null),[rippleId,setRippleId]=useState<string|null>(null);
  const [selected,setSelected]=useState<ViewNode|null>(null),[focus,setFocus]=useState(false),[query,setQuery]=useState(''),[listLimit,setListLimit]=useState(40);
  const [history,setHistory]=useState<Saved[]>([]),[historyOpen,setHistoryOpen]=useState(false),[helpOpen,setHelpOpen]=useState(false),[remoteHistory,setRemoteHistory]=useState<ScanSummary[]>([]);
  const [comparison,setComparison]=useState<ScanComparison|null>(null),[exporting,setExporting]=useState(false),[authorizeSubmit,setAuthorizeSubmit]=useState(false);
  const [allowPrivate,setAllowPrivate]=useState(false);
  const [sample,setSample]=useState<SampleInfo|null>(null),[guideOpen,setGuideOpen]=useState(false),[privateUrl,setPrivateUrl]=useState(false);
  const [tourStep,setTourStep]=useState<number|null>(null);
  const [beats,setBeats]=useState({finding:0,journey:0,compared:0,proposed:0});
  const [aiStatus,setAiStatus]=useState<AiStatus|null>(null);
  const [proofOpen,setProofOpen]=useState(false);
  const [proposal,setProposal]=useState<FixProposal|null>(null),[proposalBusy,setProposalBusy]=useState(false),[proposalError,setProposalError]=useState('');
  const [contract,setContract]=useState<RepairContract|null>(null),[contractBusy,setContractBusy]=useState(false),[contractError,setContractError]=useState('');
  const [simulatedIds,setSimulatedIds]=useState<string[]>([]);
  // One polite live region carries every change a screen reader user would
  // otherwise have to go looking for: progress, readiness, and verdicts.
  const [announcement,setAnnouncement]=useState('');
  const announce=(message:string)=>{setAnnouncement('');window.setTimeout(()=>setAnnouncement(message),40);};
  const [walk,setWalk]=useState<{step:number;note:string;model:boolean;error?:string;seconds?:number}|null>(null);
  const inspectorReturn=useRef('');
  const controller=useRef<AbortController|null>(null),urlInput=useRef<HTMLInputElement>(null),inspector=useRef<HTMLElement>(null),demoStarted=useRef(false);
  const reduced=useReducedMotion();
  useEffect(()=>{const sync=()=>{if(location.hash==='#studio'||location.hash==='#demo'||location.hash==='#walkthrough'||location.hash==='#proof')setScreen('studio');else if(!location.hash||location.hash==='#')setScreen('home');if(location.hash!=='#proof')setProofOpen(false);};window.addEventListener('hashchange',sync);return()=>window.removeEventListener('hashchange',sync);},[]);
  // #proof opens straight onto the newest comparison on this computer, so a
  // fresh window can start on the result.
  useEffect(()=>{
    if(location.hash!=='#proof')return;
    const load=()=>void getProof().then((result)=>{setComparison(result.comparison);setProofOpen(true);}).catch(()=>setNotice('No repair has been compared on this computer yet. Scan the demo shop, repair it, and rescan.'));
    load();
    const id=window.setInterval(load, 4000);
    return()=>window.clearInterval(id);
  },[]);
  useEffect(()=>{window.scrollTo({top:0,behavior:'instant'});},[screen]);
  useEffect(()=>{document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;storageSet('accessripple-theme',theme);},[theme]);
  useEffect(()=>{let active=true;const ping=()=>checkApi().then(v=>{if(active)setConnected(v.status==='ok');}).catch(()=>{if(active)setConnected(false);});void ping();const timer=window.setInterval(ping,20000);return()=>{active=false;clearInterval(timer);};},[]);
  useEffect(()=>{const id=storageGet('accessripple-last-scan',true);const abort=new AbortController();if(id&&location.hash!=='#demo'&&location.hash!=='#walkthrough'){setBusy(true);void (async()=>{try{const current=await readScan(id,abort.signal);const finished=['complete','partial','failed'].includes(current.status)?current:await waitForScan(id,setProgress,abort.signal);if(finished.status==='failed')throw new Error(finished.error?.message||'The last scan did not finish.');const data=await readGraph(id);if(!abort.signal.aborted)accept(finished,data);}catch(cause){if(!abort.signal.aborted){storageSet('accessripple-last-scan','',true);setNotice(cause instanceof Error?friendlyScanError(cause.message):'The previous scan is no longer available.');}}finally{if(!abort.signal.aborted)setBusy(false);}})();}return()=>{abort.abort();controller.current?.abort();};},[]);
  useEffect(()=>{setListLimit(40);},[filter,query]);
  const inspectedPages=progress?.progress.completedPages??0;
  useEffect(()=>{if(busy&&inspectedPages>0)announce(`${inspectedPages} page${inspectedPages===1?'':'s'} inspected.`);},[inspectedPages]);
  useEffect(()=>{
    if(!comparison)return;
    const held=comparison.predictions?.filter(p=>p.outcome==='supported').length??0,failed=comparison.predictions?.filter(p=>p.outcome==='contradicted').length??0,unknown=(comparison.predictions?.length??0)-held-failed;
    announce(`Rescan compared. ${comparison.resolved.length} no longer observed, ${comparison.remaining.length} still observed, ${comparison.new.length} new.${comparison.predictions?.length?` The model's predictions: ${held} held, ${failed} failed, ${unknown} unknown.`:''}${comparison.simulatedPages?.some(page=>page.applied)?' The changed page was a simulation in the scanner’s browser.':''}`);
  },[comparison]);
  // On desktop the inspector scrolls inside itself, so a new selection starts at its title.
  useEffect(()=>{if(inspector.current)inspector.current.scrollTop=0;},[selected?.id]);
  useEffect(()=>{void loadHistory();},[]);
  useEffect(()=>{void getSampleInfo().then(setSample).catch(()=>{/* The demo shop is a convenience; a public address still works without it. */});},[]);
  useEffect(()=>{void getAiStatus().then(setAiStatus).catch(()=>setAiStatus({configured:false,model:'',provider:''}));},[]);
  // The landing page can open the studio straight into a demo-shop scan, so a first
  // look never depends on a public website being reachable.
  useEffect(()=>{
    if(screen!=='studio'||!sample||busy||scan||demoStarted.current)return;
    if(location.hash==='#walkthrough'){demoStarted.current=true;void walkthrough();return;}
    if(location.hash!=='#demo')return;
    demoStarted.current=true;void scanDemo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[screen,sample]);

  async function loadHistory(){try{const {scans}=await listScans();setRemoteHistory(scans);}catch{/* History is a convenience; scans remain usable without it. */}}
  async function openScan(id:string){setHistoryOpen(false);if(busy)return;setBusy(true);setError('');setNotice('');try{const result=await readScan(id);const data=await readGraph(id);accept(result,data);setNotice('Saved scan restored from this computer’s local history.');}catch(cause){setNotice(cause instanceof Error?cause.message:'That saved scan is no longer available.');}finally{setBusy(false);}}

  function accept(result: ScanResult, data: SiteGraph) {
    setJourneyId(null);setRippleId(null);setScan(result);setGraph(data);setProgress(null);setUrl(result.sample?'':result.inputUrl);setFocus(false);setFilter('overview');setQuery('');setProposal(null);setProposalError('');setContract(null);setContractError('');
    const issues=groupIssues(data.nodes.filter(isIssue));setSelected(issues.find(n=>n.kind==='accessibility-finding')??data.nodes[0]??null);setSimulatedIds([]);
    const findings=data.nodes.filter(n=>n.kind==='accessibility-finding'&&n.data.ruleId!=='accessibility-check-incomplete').length;
    announce(`Scan complete. ${findings} accessibility finding${findings===1?'':'s'} on ${data.nodes.filter(n=>n.kind==='page').length} pages.`);
    setHistory(items=>[{scan:result,graph:data},...items.filter(item=>item.scan.id!==result.id)].slice(0,5));storageSet('accessripple-last-scan',result.id,true);
    // A rescan already knows the scan it follows, so the proof is available
    // as soon as the studio opens.
    if(result.previousScanId){
      void compareScans(result.id,result.previousScanId).then(setComparison).catch(()=>setComparison(null));
      void readGraph(result.previousScanId).then(setPreviousGraph).catch(()=>undefined);
    }else {setPreviousGraph(EMPTY);setComparison(null);}
  }
  async function askForProposal(nodeId:string){
    if(!scan)return;
    setProposalBusy(true);setProposalError('');setProposal(null);setContract(null);setContractError('');
    try{const result=await proposeFix(scan.id,nodeId);setProposal(result);setBeats(b=>({...b,proposed:b.proposed+1}));announce('A proposed change is ready in the inspector.');}
    catch(cause){setProposalError(cause instanceof Error?cause.message:'A change could not be proposed.');}
    finally{setProposalBusy(false);}
  }
  async function run(target: {url:string}|{sample:'checkout'}, again=false) {
    if(busy)return;const abort=new AbortController();controller.current?.abort();controller.current=abort;
    setBusy(true);setError('');setNotice('');setProgress(null);setComparison(null);setPrivateUrl(false);
    let previous=again?scan:null;
    let expired=false;
    const start=()=>'sample' in target?createScan({sample:'checkout',authorizeSubmit,allowPrivateNetwork:allowPrivate}):createScan({url:target.url,authorizeSubmit,allowPrivateNetwork:allowPrivate});
    try {
      let started: {scanId:string};
      if(previous){try{started=await rescan(previous.id,{authorizeSubmit,allowPrivateNetwork:allowPrivate});}catch(cause){if(cause instanceof ApiError&&cause.status===404){previous=null;expired=true;started=await start();}else throw cause;}}
      else started=await start();
      storageSet('accessripple-last-scan',started.scanId,true);
      const finished=await waitForScan(started.scanId,setProgress,abort.signal);
      if(finished.status==='failed')throw new Error(finished.error?.message||'The page could not be scanned. Check the address and try again.');
      const data=await readGraph(started.scanId);abort.signal.throwIfAborted();accept(finished,data);
      // Bring the metrics and the map into one frame, the way a viewer should first see a result.
      if(window.innerWidth>=901)window.setTimeout(()=>document.querySelector('.result-summary')?.scrollIntoView({behavior:reduced?'instant':'smooth',block:'start'}),160);
      setNotice(expired?'New scan complete. The earlier scan expired after a scanner restart, so comparison is unavailable.':finished.status==='partial'?'Some pages were unavailable. The map includes the evidence that could be collected.':'Scan complete. Explore a point to understand its impact.');
      if(previous){try{const result=await compareScans(finished.id,previous.id);setComparison(result);setBeats(b=>({...b,compared:b.compared+1}));}catch{setNotice('The new scan is ready. The previous scan is no longer available for comparison.');}}
    }catch(cause){
      if(!abort.signal.aborted){
        const message=cause instanceof Error?cause.message:'The scan could not complete.';
        if(cause instanceof ApiError&&cause.code==='UNSAFE_URL'){setPrivateUrl(true);setError(allowPrivate?'That address is still not allowed. It may be a cloud credentials address, which is never scanned.':'That address points to a private or local network, so the scanner will not open it.');}
        else setError(friendlyScanError(message));
        if(scan&&!message.includes('longer than expected'))storageSet('accessripple-last-scan',scan.id,true);
      }
    }
    finally{if(controller.current===abort){setBusy(false);setProgress(null);}}
  }
  function submit(e:FormEvent) {e.preventDefault();try{void run({url:normalize(url)});}catch(cause){setError(cause instanceof Error?cause.message:'Check the website address.');urlInput.current?.focus();}}
  async function scanDemo(){
    if(!sample)return;
    // Always start the demo shop from its broken state so the recorded result is identical every time.
    // The reset is unconditional: the cached state can be stale if the sample was changed elsewhere.
    try{
      // Any change accepted earlier is dropped as well, or the shop would
      // still be carrying the previous run's repair.
      await resetDemoShop();
      await setSampleState('before');
      setSample({...sample,variant:'before'});
    }catch(cause){setError(cause instanceof Error?cause.message:'The demo shop could not be reset. Try again before starting a reproducible scan.');return;}
    void run({sample:'checkout'});
  }
  async function repairDemo(target?:'before'|'after'){
    if(!sample)return;
    const next=target??(sample.variant==='before'?'after':'before');
    setBusy(true);setError('');
    try{await setSampleState(next);setSample({...sample,variant:next});setNotice(next==='after'?'The demo shop is now repaired. Rescan to see what the browser no longer reports.':'The demo shop is broken again. Rescan to see the barrier return.');}
    catch(cause){setError(cause instanceof Error?cause.message:'The demo shop could not be switched.');}
    finally{setBusy(false);}
  }
  /** Applies the change the model proposed, so the next scan measures that change. */
  /** Asks the model to commit, in advance, to what its change will fix. */
  async function askForContract(){
    if(!proposal||!scan)return;
    setContractBusy(true);setContractError('');
    try{const result=await writeContract(scan.id,proposal.nodeId);setContract(result);announce(`The model committed to ${result.predictions.length} prediction${result.predictions.length===1?'':'s'} before the change.`);}
    catch(cause){setContractError(cause instanceof Error?cause.message:'The model did not make a prediction.');}
    finally{setContractBusy(false);}
  }
  async function acceptProposal(){
    if(!proposal?.location)return;
    setBusy(true);setError('');
    try{
      await applyProposal({file:proposal.location.file,before:proposal.before,after:proposal.after,summary:proposal.summary});
      await setSampleState('before');
      setSample({...sample!,variant:'before'});
      setNotice('Your accepted change was applied to the demo shop. Rescan to see whether it worked.');
    }
    catch(cause){setError(cause instanceof Error?cause.message:'The change could not be applied.');}
    finally{setBusy(false);}
  }
  /** On a live site, the change is recorded for the next rescan to simulate in the scanner's browser. */
  async function simulateOnRescan(){
    if(!proposal||!scan)return;
    setBusy(true);setError('');
    try{await simulateProposal(scan.id,proposal.nodeId);setSimulatedIds(ids=>[...ids,proposal.nodeId]);setNotice('Recorded. The next rescan applies this change inside the scanner’s own browser only — the site is not changed — and labels that page as simulated.');}
    catch(cause){setError(cause instanceof Error?cause.message:'The change could not be recorded for simulation.');}
    finally{setBusy(false);}
  }
  /**
   * The whole argument in one press: scan the demo shop, open the finding with
   * the most recorded journeys through its page, let the model propose a
   * change and commit to its outcome, apply it, rescan, and open the proof.
   * Without a model, or when the model is busy, the demo shop's prepared fix
   * stands in, and the walkthrough says so.
   */
  async function walkthrough(){
    if(!sample||busy)return;
    const started=Date.now(),abort=new AbortController();controller.current?.abort();controller.current=abort;
    const step=(index:number,note:string,model:boolean)=>{setWalk({step:index,note,model});announce(note);};
    setBusy(true);setError('');setNotice('');setComparison(null);setProofOpen(false);
    let model=Boolean(aiStatus?.configured);
    try{
      step(0,'Scanning the demo shop in a real browser.',model);
      await resetDemoShop();await setSampleState('before');setSample({...sample,variant:'before'});
      const first=await createScan({sample:'checkout'});
      const before=await waitForScan(first.scanId,setProgress,abort.signal);
      if(before.status==='failed')throw new Error(before.error?.message||'The demo shop could not be scanned.');
      const beforeGraph=await readGraph(first.scanId);accept(before,beforeGraph);
      const target=groupIssues(beforeGraph.nodes.filter(isIssue)).sort(byPriority(beforeGraph)).find(n=>n.kind==='accessibility-finding');
      if(!target)throw new Error('The demo shop scan recorded no finding to repair.');
      step(1,`Opening “${describe(target).title}”, the finding with the most recorded journeys through its page.`,model);
      setSelected(target);setRippleId(target.id);setJourneyId(null);setView('map');
      if(model){
        try{
          step(2,'Asking the model for the smallest change that fixes it.',model);
          const change=await proposeFix(before.id,target.id);setProposal(change);
          step(3,'Asking the model to commit, in advance, to what the change will fix.',model);
          setContract(await writeContract(before.id,target.id));
          if(!change.location)throw new Error('the change could not be placed in the demo shop’s source');
          step(4,'Applying the accepted change to the demo shop.',model);
          await applyProposal({file:change.location.file,before:change.before,after:change.after,summary:change.summary});
        }catch(cause){
          model=false;
          step(4,`The model step did not finish (${cause instanceof Error?cause.message:'no answer'}), so the demo shop’s prepared fix is applied instead.`,model);
          await resetDemoShop();await setSampleState('after');setSample({...sample,variant:'after'});
        }
      }else{
        step(4,'No model is configured, so the demo shop’s prepared fix is applied instead.',model);
        await setSampleState('after');setSample({...sample,variant:'after'});
      }
      step(5,'Rescanning the same pages and comparing.',model);
      const again=await rescan(before.id);
      const after=await waitForScan(again.scanId,setProgress,abort.signal);
      if(after.status==='failed')throw new Error(after.error?.message||'The rescan did not finish.');
      const afterGraph=await readGraph(again.scanId);accept(after,afterGraph);setPreviousGraph(beforeGraph);
      const result=await compareScans(after.id,before.id);setComparison(result);setBeats(b=>({...b,compared:b.compared+1}));
      const seconds=Math.round((Date.now()-started)/1000);
      setWalk({step:6,note:`Done in ${seconds} seconds. ${result.resolved.length} no longer observed, ${result.new.length} new.`,model,seconds});
      setProofOpen(true);
    }catch(cause){
      if(!abort.signal.aborted)setWalk(current=>({...(current??{step:0,note:'',model}),error:cause instanceof Error?friendlyScanError(cause.message):'The walkthrough stopped.'}));
    }finally{if(controller.current===abort){setBusy(false);setProgress(null);}}
  }
  async function breakDemo(){
    setBusy(true);setError('');
    try{await resetDemoShop();await setSampleState('before');setSample({...sample!,variant:'before'});setProposal(null);setNotice('The demo shop is broken again. Rescan to see the barrier return.');}
    catch(cause){setError(cause instanceof Error?cause.message:'The demo shop could not be reset.');}
    finally{setBusy(false);}
  }
  async function exportScan(){if(!scan)return;setExporting(true);try{await downloadVault(scan.id);setNotice('Your linked Obsidian vault has been downloaded.');}catch(cause){setError(cause instanceof Error?cause.message:'Export failed. Please retry.');}finally{setExporting(false);}}
  function startTour(){
    // Start at the first step the viewer has not already reached, so the tour
    // never sits on a step that is already behind them.
    const index=TOUR.findIndex(step=>!step.done(tourContext));
    setTourStep(index<0?0:index);
  }
  async function showProof(){
    if(comparison){setProofOpen(true);return;}
    try{const result=await getProof();setComparison(result.comparison);setProofOpen(true);}
    catch{setNotice('No repair has been compared on this computer yet. Scan the demo shop, repair it, and rescan.');}
  }
  function select(node:ViewNode,options?:{keyboard?:boolean}){
    // Opened from the keyboard, the details take focus, and Escape gives it back to the map.
    if(options?.keyboard){inspectorReturn.current=node.id;window.setTimeout(()=>inspector.current?.querySelector<HTMLElement>('#inspector-title')?.focus(),60);}
    setSelected(node);if(node.kind==='control'||node.kind==='flow'){setJourneyId(node.id);setRippleId(null);setView('map');setFocus(false);setBeats(b=>({...b,journey:b.journey+1}));}if(window.innerWidth<900)window.setTimeout(()=>inspector.current?.scrollIntoView({behavior:reduced?'instant':'smooth',block:'start'}),80);}
  function changeFilter(next:GraphFilter){setJourneyId(null);setRippleId(null);setFilter(next);setFocus(false);setQuery('');}
  function studio(){if(location.hash!=='#demo'&&location.hash!=='#walkthrough')location.hash='studio';setScreen('studio');}
  const counts=useMemo(()=>{
    // A page whose checks could not run is not a finding, so it is counted
    // apart. Otherwise the metric and the story would disagree.
    const all=graph.nodes.filter(n=>n.kind==='accessibility-finding');
    return {pages:graph.nodes.filter(n=>n.kind==='page').length,controls:graph.nodes.filter(n=>n.kind==='control').length,findings:all.filter(n=>n.data.ruleId!=='accessibility-check-incomplete').length,unchecked:all.filter(n=>n.data.ruleId==='accessibility-check-incomplete').length,signals:graph.nodes.filter(n=>n.kind==='runtime-error').length,flows:graph.nodes.filter(n=>n.kind==='flow').length,testedFlows:graph.nodes.filter(n=>n.kind==='flow'&&n.data.tested===true).length};
  },[graph]);
  const issues=useMemo(()=>groupIssues(graph.nodes.filter(isIssue)).sort(byPriority(graph)),[graph]);
  const listNodes=useMemo(()=>graph.nodes.filter(n=>(filter==='overview'||matches(n,filter))&&`${describe(n).title} ${n.label} ${kindName(n)} ${str(n,'ruleId')}`.toLowerCase().includes(query.toLowerCase())),[graph,filter,query]);
  const journey=useMemo(()=>journeyId?traceJourney(graph,journeyId):null,[graph,journeyId]);
  const ripple=useMemo(()=>rippleId?barrierRipple(graph,rippleId):null,[graph,rippleId]);
  const selectedRipple=useMemo(()=>selected?.kind==='accessibility-finding'?barrierRipple(graph,selected.id):null,[graph,selected]);
  function showRipple(id:string){setJourneyId(null);setRippleId(current=>current===id?null:id);setView('map');setFocus(false);if(window.innerWidth<900)window.setTimeout(()=>document.querySelector('.canvas-wrap')?.scrollIntoView({behavior:reduced?'instant':'smooth',block:'start'}),80);}
  const routes=useMemo(()=>selected?routesToFinding(graph,selected.id):[],[graph,selected]);
  const tourContext=useMemo<TourContext>(()=>({hasScan:!!scan,findingOpened:beats.finding,journeyTraced:beats.journey,changeProposed:beats.proposed,compared:!!comparison}),[scan,beats,comparison]);
  // Each step moves the interface to the place the narration is talking about.
  const tourPrepare=useMemo<Record<string,()=>void>>(()=>{
    const reveal=(selector:string)=>()=>document.querySelector(selector)?.scrollIntoView({behavior:reduced?'instant':'smooth',block:'center'});
    return {
      proof: ()=>{setProofOpen(true);},
      argument: ()=>{setProofOpen(false);window.scrollTo({top:0,behavior:'instant'});},
      scan: ()=>{setProofOpen(false);setUrl('');urlInput.current?.focus();},
      finding: ()=>{setFilter('issues');setView('list');reveal('.scan-story')();},
      journey: ()=>{setJourneyId(null);setFilter('controls');setFocus(false);setQuery('');setView('list');},
      proposal: reveal('.fix-propose'),
      verify: reveal('.repair-lab'),
      limits: reveal('.coverage-details'),
    };
  },[reduced]);
  const tour=useRef<{index:number;wasDone:boolean}|null>(null);
  useEffect(()=>{
    if(tourStep===null){tour.current=null;return;}
    const step=TOUR[tourStep];
    if(!step)return;
    if(tour.current?.index!==tourStep){tour.current={index:tourStep,wasDone:step.done(tourContext)};tourPrepare[step.id]?.();return;}
    if(tour.current.wasDone||!step.done(tourContext))return;
    const timer=window.setTimeout(()=>setTourStep(current=>current===tourStep?Math.min(current+1,TOUR.length-1):current),1400);
    return()=>window.clearTimeout(timer);
  },[tourStep,tourContext,tourPrepare]);
  const copy=selected?describe(selected):null,page=selected?pageFor(selected,graph):undefined;
  const selectedUrl=httpUrl(str(selected??undefined,'url')||str(selected??undefined,'destinationUrl')||str(selected??undefined,'href')||str(selected??undefined,'formAction')||str(page,'url'));
  const members=new Set(selected?.memberIds??(selected?[selected.id]:[]));
  const neighborIds=new Set(graph.edges.filter(e=>members.has(e.source)||members.has(e.target)).flatMap(e=>[e.source,e.target]).filter(id=>!members.has(id)));
  const neighbors=graph.nodes.filter(n=>neighborIds.has(n.id));
  const countFor=(id:GraphFilter)=>id==='overview'?graph.nodes.length:id==='pages'?counts.pages:id==='issues'?counts.findings+counts.signals:id==='controls'?counts.controls:counts.flows;
  // One row per site, newest first, so a list of repeated scans stays readable.
  const groupedRemote=useMemo(()=>{
    const groups=new Map<string,{latest:ScanSummary;count:number}>();
    for(const item of remoteHistory){
      if(item.status==='queued'||item.status==='running')continue;
      if(history.some(local=>local.scan.id===item.id))continue;
      const key=item.sample?'sample':item.inputUrl;
      const existing=groups.get(key);
      if(existing)existing.count+=1;
      else groups.set(key,{latest:item,count:1});
    }
    return [...groups.values()];
  },[remoteHistory,history]);

  return <div className="app" data-theme={theme}><a className="skip-link" href="#main-content">Skip to main content</a><div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</div>{screen==='home'?<Landing openStudio={studio} theme={theme} toggleTheme={()=>setTheme(v=>v==='dark'?'light':'dark')}/>:<div className={`studio ${tourStep!==null?'touring':''} ${scan?'has-scan':''}`}>
    <header className="studio-header"><a className="wordmark" href="#" aria-label="AccessRipple home"><Mark/><span>Access<span className="wordmark-soft">Ripple</span></span></a><span className="studio-label">/ <span>THE STUDIO</span></span><div className="studio-header-right"><span className={`connection-status ${connected?'online':''}`}><i/>{connected?'Local scanner ready':connected===false?'Scanner offline':'Connecting…'}</span><button className="icon-btn" onClick={()=>setHelpOpen(true)} aria-label="How scanning works"><Icon name="info"/></button><button className="icon-btn guide-button" onClick={startTour} aria-label="Start the guided tour"><Icon name="play" size={17}/></button><button className="button button-glass compact proof-button" onClick={()=>void showProof()}><Icon name="check" size={16}/><span>Show the proof</span></button><button className="icon-btn theme-switch" role="switch" aria-checked={theme==='light'} aria-label={`Switch to ${theme==='dark'?'light':'dark'} mode`} onClick={()=>setTheme(v=>v==='dark'?'light':'dark')}><Icon name={theme==='dark'?'sun':'moon'}/></button><button className="button button-glass compact" onClick={()=>{void loadHistory();setHistoryOpen(true);}}><Icon name="folder" size={17}/><span>Recent scans</span></button></div></header>
    <main id="main-content" className="studio-main">
      <div className="studio-intro"><div><span className="eyebrow"><i/> WEBSITE JOURNEY INTELLIGENCE</span><h1>A little clarity. <em>A bigger ripple.</em></h1><p>Explore the connections. Understand the barriers. Find your next improvement.</p></div><span className="local-label"><Icon name="shield" size={17}/> On your computer. In your control.</span></div>
      <form className="scan-bar" onSubmit={submit}><div className="scan-input-wrap"><Icon name="globe"/><label className="sr-only" htmlFor="website-url">Website URL</label><input id="website-url" ref={urlInput} placeholder="Enter a website URL, e.g. www.google.com" value={url} onChange={e=>setUrl(e.target.value)} autoComplete="url" inputMode="url" aria-describedby="scan-limits" disabled={busy}/></div><button className="button button-solid" disabled={busy||connected!==true} type="submit">{busy?<span className="spinner"/>:<Icon name="orbit" size={19}/>}<span>{busy?'Mapping website…':'Map this website'}</span>{!busy&&<Icon name="arrow" size={18}/>}</button>{sample&&<button className="button button-glass demo-button" type="button" disabled={busy||connected!==true} onClick={()=>void scanDemo()}><Icon name="play" size={16}/><span>Scan the demo shop</span></button>}{sample&&<button className="button button-glass demo-button walkthrough-button" type="button" disabled={busy||connected!==true} onClick={()=>void walkthrough()}><Icon name="spark" size={16}/><span>Judge walkthrough</span></button>}</form>
      <div className="scan-context"><span id="scan-limits">{allowPrivate?'An address on your own computer · Up to 5 pages · Safe controls are activated once in a controlled browser':'Public pages only · Up to 5 pages · Safe controls are activated once in a controlled browser'}</span><label className="interaction-consent" htmlFor="authorize-submits"><input id="authorize-submits" type="checkbox" checked={authorizeSubmit} onChange={e=>setAuthorizeSubmit(e.target.checked)} disabled={busy}/><span>Test form and submit controls too<small>Requests that would send data stay blocked</small></span></label><label className="interaction-consent" htmlFor="allow-private"><input id="allow-private" type="checkbox" checked={allowPrivate} onChange={e=>setAllowPrivate(e.target.checked)} disabled={busy}/><span>Scan an address on my own computer<small>Local and private addresses, on any port</small></span></label><span>Only reading requests are sent <Icon name="shield" size={14}/></span></div>
      {error&&<div className="alert error" role="alert"><Icon name="warning" size={19}/><span>{error}</span><button className="icon-btn" aria-label="Dismiss error" onClick={()=>setError('')}><Icon name="close" size={17}/></button></div>}
      {privateUrl&&sample&&<div className="alert" role="status"><Icon name="globe" size={18}/><span>{allowPrivate?'That address is still refused even with permission. Some addresses hand out cloud credentials and are never scanned.':'That address is on your own computer. Tick “Scan an address on my own computer” above to open it, or scan the built-in demo shop instead — it needs no network and always returns the same result.'}</span><button className="button button-glass compact" disabled={busy} onClick={()=>void scanDemo()}>Scan the demo shop <Icon name="arrow" size={15}/></button></div>}
      {notice&&<div className="alert" role="status"><Icon name="check" size={18}/><span>{notice}</span><button className="icon-btn" aria-label="Dismiss notice" onClick={()=>setNotice('')}><Icon name="close" size={17}/></button></div>}
      {busy&&<div className="scan-progress" role="status" aria-live="polite"><div className="scan-progress-orbit"><Icon name="orbit" size={28}/></div><div><strong>{progress?.status==='running'?'Following the connections…':'Preparing the browser…'}</strong><span>{progress?.progress.currentUrl?hostname(progress.progress.currentUrl):'Opening a bounded browser session'}</span></div><div className="progress-status"><span>{progress?.progress.completedPages??0} pages inspected{typeof progress?.progress.remainingMs==='number'?` · ${Math.max(1,Math.ceil(progress.progress.remainingMs/1000))}s left`:''}</span><div className="progress-track"><i style={{width:`${Math.max(8,Math.min(94,((progress?.progress.completedPages??0)+.5)/5*100))}%`}}/></div></div></div>}
      {scan&&<div className="result-summary"><div className="result-site"><span className="site-symbol"><Icon name="globe" size={22}/></span><div><span className="eyebrow">{scan.status==='partial'?'PARTIAL SCAN':'SCAN COMPLETE'}{scan.sample?' · BUILT-IN DEMO SHOP':scan.addressScope==='private'?' · ADDRESS ON THIS COMPUTER':' · PUBLIC SITE'}</span><h2>{scan.sample?(sample?.name??'Northstar demo shop'):hostname(scan.inputUrl)}</h2></div></div><div className="summary-metrics"><button onClick={()=>changeFilter('pages')}><strong>{scan.coverage?.pagesInspected??scan.pages.filter(p=>p.status==='inspected').length}</strong><span>pages inspected</span></button><button onClick={()=>changeFilter('controls')}><strong>{counts.controls}</strong><span>visible controls</span></button><button className="finding-metric" onClick={()=>changeFilter('issues')}><strong>{counts.findings}</strong><span>accessibility findings</span></button><button onClick={()=>changeFilter('flows')}><strong>{counts.testedFlows}</strong><span>actions tested</span></button></div><div className="result-actions"><button className="icon-btn" title="Rescan and compare" aria-label="Rescan and compare" disabled={busy} onClick={()=>void run(scan.sample?{sample:'checkout'}:{url:scan.inputUrl},true)}><Icon name="refresh"/></button><button className="button button-glass compact" disabled={busy||exporting} onClick={()=>void exportScan()}><Icon name="download" size={17}/>{exporting?'Preparing…':'Export vault'}</button></div></div>}
      {comparison&&<div className="comparison" role="status"><Icon name="refresh"/><strong>What changed</strong>{comparison.simulatedPages?.some(page=>page.applied)&&<span className="simulated-chip"><Icon name="warning" size={12}/>SIMULATED PATCH · the site was not changed</span>}<span><b>{comparison.resolved.length}</b> no longer observed</span><span><b>{comparison.remaining.length}</b> still observed</span><span><b>{comparison.new.length}</b> new</span>{comparison.notRechecked.length>0&&<span><b>{comparison.notRechecked.length}</b> not rechecked</span>}<small>Findings and browser signals the browser no longer recorded — not a claim that the site is now accessible.{comparison.notRechecked.length>0?' A page that could not be checked again is listed as not rechecked, never as fixed.':''}</small>{comparison.pages.some(page=>page.before&&page.after)&&<button className="button button-glass compact" onClick={()=>setProofOpen(true)}><Icon name="target" size={15}/>See the page before and after</button>}{!comparison.demoShop&&<ChangeExports/>}{(comparison.predictions?.length??0)>0&&<div className="prediction-verdicts"><span className="eyebrow">THE MODEL COMMITTED TO THIS, AND THE BROWSER CHECKED IT</span>{comparison.predictions!.map((prediction)=><div className={`verdict ${prediction.outcome}`} key={prediction.issueId}><VerdictMark outcome={prediction.outcome}/><span><strong>{describeId(prediction.issueId, graph, prediction.label, previousGraph)}</strong><small>{prediction.outcome==='supported'?`The model said it would be ${prediction.expected==='absent'?'gone':'still there'}. It was.`:prediction.outcome==='contradicted'?`The model said it would be ${prediction.expected==='absent'?'gone':'still there'}. It was not.`:'That page was not checked again, so the prediction is unknown.'}</small></span></div>)}</div>}</div>}
      <nav className="mobile-filters" aria-label="Explore categories">{FILTERS.map(item=><button key={item.id} className={filter===item.id?'active':''} aria-pressed={filter===item.id} onClick={()=>changeFilter(item.id)}><Icon name={item.icon} size={16}/>{item.name}</button>)}</nav>
      <section className="workspace" aria-label="Website journey workspace">
        <aside className="workspace-sidebar"><div className="sidebar-title">EXPLORE THE WEBSITE</div><nav aria-label="Map categories">{FILTERS.map(item=><button key={item.id} className={`category-button ${filter===item.id?'active':''}`} aria-pressed={filter===item.id} onClick={()=>changeFilter(item.id)}><Icon name={item.icon} size={18}/><span>{item.name}</span><b>{countFor(item.id)}</b></button>)}</nav><div className="sidebar-divider"/><div className="sidebar-title">SCANNED PAGES</div>{graph.nodes.filter(n=>n.kind==='page').map(node=><button className={`page-button ${selected?.id===node.id?'active':''}`} key={node.id} onClick={()=>{changeFilter('overview');select(node);}}><span className="tiny-dot page-dot"/><span>{node.label}</span><Icon name="chevron" size={14}/></button>)}{!scan&&<p className="sidebar-empty">Your pages will appear after a scan.</p>}</aside>
        <div className="workspace-center"><div className="workspace-toolbar"><div><h2>{FILTERS.find(f=>f.id===filter)?.name==='Overview'?'The bigger picture':FILTERS.find(f=>f.id===filter)?.name}</h2><p>{scan?'Choose Controls, then select a button to trace its journey.':'A new perspective starts with a website.'}</p></div><div className="segmented"><button className={view==='map'?'active':''} onClick={()=>setView('map')} aria-pressed={view==='map'}><Icon name="orbit" size={17}/>Map</button><button className={view==='list'?'active':''} onClick={()=>setView('list')} aria-pressed={view==='list'}><Icon name="list" size={17}/>List</button></div></div>
          {counts.controls>0&&<SelectMenu id="journey-control" label="Follow a button or link" placeholder="Choose an action to see its path…" options={graph.nodes.filter(n=>n.kind==='control').map(n=>({value:n.id,label:cleanLabel(n.label),context:pageFor(n,graph)?.label||'Page'}))} value={journey?.control.id??''} onChange={value=>{if(!value){setJourneyId(null);return;}const node=graph.nodes.find(n=>n.id===value);if(node)select(node);}}/>}
          {!graph.nodes.length?<div className="studio-empty"><div className="empty-orbit" aria-hidden="true"><span/><span/><span/><i/></div><span className="eyebrow">YOUR WEBSITE, SEEN DIFFERENTLY</span><h2>See how it all <em>connects.</em></h2><p>Paste a public URL above. We’ll turn its pages, journeys, and accessibility findings into an explorable map.</p><button className="button button-glass" onClick={()=>urlInput.current?.focus()}>Start with a website <Icon name="arrow" size={18}/></button><button className="button button-glass" onClick={startTour}><Icon name="play" size={16}/> Start the guided tour</button><span className="empty-note">No placeholder results. Only your scan.</span></div>:view==='map'?<GraphCanvas journey={journey} ripple={journey?null:ripple} onExitJourney={()=>{setJourneyId(null);setRippleId(null);}} graph={graph} filter={filter} selectedId={selected?.id??''} onSelect={select} focus={focus} onFocus={()=>setFocus(!focus)}/>:<div className="inventory"><div className="inventory-search"><Icon name="search" size={18}/><input aria-label="Search recorded elements" placeholder="Find a page, control, or issue…" value={query} onChange={e=>setQuery(e.target.value)}/><span>{listNodes.length} results</span></div><div className="inventory-rows">{listNodes.slice(0,listLimit).map(node=><button className={`inventory-row ${selected?.id===node.id?'active':''}`} key={node.id} onClick={()=>select(node)}><span className="row-node-dot" style={{background:nodeColor(node)}}/><span><strong>{describe(node).title}</strong><small>{kindName(node)} · {pageFor(node,graph)?.label||hostname(scan?.inputUrl??'')}</small></span><span className={`evidence-chip ${node.evidenceLabel}`}>{node.evidenceLabel==='untested'?'Not tested':node.evidenceLabel}</span><Icon name="chevron" size={16}/></button>)}{!listNodes.length&&<p className="no-results">No matching elements. Try another phrase or category.</p>}</div>{listNodes.length>listLimit&&<button className="load-more" onClick={()=>setListLimit(n=>n+40)}>Show next {Math.min(40,listNodes.length-listLimit)} elements</button>}</div>}
        </div>
        <aside className="inspector" ref={inspector} aria-label="Selected point details" onKeyDown={e=>{if(e.key!=='Escape'||!inspectorReturn.current)return;const point=document.querySelector<SVGGElement>(`[data-node="${CSS.escape(inspectorReturn.current)}"]`);if(point){e.stopPropagation();point.focus();}}}><div className="inspector-top"><span className="eyebrow">A CLOSER LOOK</span><Icon name="target" size={18}/></div>{selected&&copy?<motion.div key={selected.id} className="inspector-content" initial={reduced?false:{opacity:0,y:5}} animate={{opacity:1,y:0}} transition={{duration:.18}}><span className={`node-kind kind-${selected.kind}`}><i style={{background:nodeColor(selected)}}/>{kindName(selected)}</span><h2 id="inspector-title" tabIndex={-1}>{copy.title}</h2><div className="detail-tags"><span className={`evidence-chip ${selected.evidenceLabel}`}><Icon name={selected.evidenceLabel==='observed'?'check':selected.evidenceLabel==='inferred'?'orbit':'info'} size={11}/>{selected.evidenceLabel==='untested'?'Not tested':selected.evidenceLabel}</span>{selected.kind==='accessibility-finding'&&<span className="severity-chip"><Icon name={selected.status==='needs-review'?'info':'warning'} size={11}/>{selected.status==='needs-review'?'Needs review':severity(selected)}</span>}{selected.kind==='control'&&shortcutOf(selected.label)&&<span className="shortcut-chip"><Icon name="keyboard" size={13}/>Shortcut: {shortcutOf(selected.label)}</span>}</div><div className="human-explanation"><span>WHY IT MATTERS</span><p>{copy.meaning}</p></div>{isIssue(selected)&&<div className="fix-guidance"><span><Icon name="spark" size={16}/> WHAT TO TRY</span><p>{copy.fix}</p><small>Make changes in your site’s source, then rescan.</small></div>}{selected.kind==='accessibility-finding'&&Boolean(selected.data.boundingBox)&&scan?.pages.find(p=>p.id===selected.pageId)?.screenshot&&<div className="where-it-is"><span className="eyebrow">WHERE IT IS ON THE PAGE</span><ShotWithBoxes src={scan.pages.find(p=>p.id===selected.pageId)!.screenshot!.dataUrl} alt={`The page ${page?.label??''} as the browser rendered it.`} boxes={[{label:describe(selected).short,box:selected.data.boundingBox as Box}]}/></div>}{reachFacts(selected)&&<p className="reach-line"><Icon name="orbit" size={14}/><span>{reachFacts(selected)!.text}. Counted from recorded journeys only.</span></p>}{selected.kind==='accessibility-finding'&&selectedRipple&&<div className="ripple-card"><span className="eyebrow">ITS RIPPLE</span><p>{selectedRipple.arriving+selectedRipple.leaving?<><strong>{selectedRipple.arriving+selectedRipple.leaving}</strong> recorded action{selectedRipple.arriving+selectedRipple.leaving===1?'':'s'} arrive at or leave the page this was found on.</>:'No recorded action leads into or out of the page this was found on.'}</p>{whoItProtects(selected)&&<p className="ripple-protects"><Icon name="shield" size={14}/><span>This check protects <b>{whoItProtects(selected).replace(/^People/,'people')}</b>.</span></p>}<button className="button button-glass compact" aria-pressed={ripple?.finding.id===selected.id} onClick={()=>showRipple(selected.id)}><Icon name="orbit" size={15}/>{ripple?.finding.id===selected.id?'Back to the whole map':'See its ripple on the map'}</button></div>}{selected.kind==='accessibility-finding'&&<div className="routes-to"><span className="eyebrow">ROUTES TO THIS POINT</span>{routes.length>0?<ul>{routes.slice(0, 4).map((route) => <li key={route.flow.id}><button onClick={()=>{select(route.control);}}><span className={`route-badge ${route.observed?'observed':'inferred'}`}>{route.observed?'observed':'not tested'}</span><span><strong>{cleanLabel(route.control.label)}</strong><small>on {route.page.label}</small></span><Icon name="chevron" size={14}/></button></li>)}</ul>:<p className="route-empty">No recorded control leads to this page, so no route to it was observed.</p>}</div>}{selected.kind==='accessibility-finding'&&<div className="what-next"><span className="eyebrow">WHAT NEXT</span><ol><li>Pick a finding on a route someone actually takes</li><li>Open its evidence and confirm it</li><li>Change it in your own code</li><li>Rescan and compare</li></ol></div>}{selected.kind==='accessibility-finding'&&<div className="fix-propose">{proposal&&proposal.nodeId===selected.id?<FixProposalCard proposal={proposal} contract={contract} contractBusy={contractBusy} contractError={contractError} graph={graph} busy={busy||proposalBusy} canApply={Boolean(scan?.sample)} simulated={simulatedIds.includes(proposal.nodeId)} onSimulate={()=>void simulateOnRescan()} onApply={()=>void acceptProposal()} onRescan={()=>void run(scan?.sample?{sample:'checkout'}:{url:scan?.inputUrl??''},true)} onPredict={()=>void askForContract()}/>:<>{proposalBusy&&<p className="fix-honest"><span className="spinner"/> Reading the recorded markup…</p>}{proposalError&&<p className="ai-error">{proposalError}</p>}{!proposalBusy&&<button className="button button-glass compact" onClick={()=>void askForProposal(selected.id)} disabled={!aiStatus?.configured}><Icon name="spark" size={15}/>{proposalError?'Try again':'Propose a change'}</button>}{!aiStatus?.configured&&<small className="fix-honest">A model has to be configured before it can propose a change.</small>}</>}</div>}{Number(selected.data.groupCount)>1&&<div className="group-summary"><strong>{Number(selected.data.groupCount)} related findings</strong><p>Grouped by the same check on this page. Open Findings in List to inspect each one.</p><button onClick={()=>{setFilter('issues');setView('list');}}>See individual findings <Icon name="arrow" size={15}/></button></div>}{selectedUrl&&<a className="detail-page-link" href={selectedUrl} target="_blank" rel="noreferrer"><Icon name="globe" size={17}/><span>{page?.label||hostname(selectedUrl)}<small>{new URL(selectedUrl).pathname}</small></span><Icon name="external" size={15}/></a>}
          {journey&&<section className="journey-details" aria-label="Selected button journey"><h3>Follow this action</h3><ol>{journey.steps.map((step,i)=><li key={step.node.id}><button onClick={()=>setSelected(step.node)} aria-current={selected.id===step.node.id?'step':undefined}><b>{i+1}</b><span><strong>{describe(step.node).short}</strong><small>{step.caption}</small></span></button></li>)}</ol><p>{journey.summary}</p><h3>{journey.findings.length?(journey.observed?'What was recorded along this route':'What may get in the way'):'What still needs testing'}</h3>{journey.findings.map(f=><button className="journey-finding" key={f.node.id} onClick={()=>setSelected(f.node)}><Icon name="warning" size={17}/><span>{describe(f.node).short}<small>{f.caption}</small></span><Icon name="chevron" size={14}/></button>)}{!journey.findings.length&&<p>{journey.observed?'Every step above is an observed outcome. Actions beyond this recorded route were not tested. Confirming them manually completes the picture.':'No button activation was recorded. Check keyboard activation, loading, and the final result manually before treating this route as tested.'}</p>}</section>}
          {neighbors.length>0&&<div className="neighbor-section"><h3>Connected to this point</h3>{neighbors.slice(0,5).map(n=><button key={n.id} onClick={()=>select(n)}><span className="tiny-dot" style={{background:nodeColor(n)}}/><span>{describe(n).short}</span><Icon name="chevron" size={14}/></button>)}{neighbors.length>5&&<button onClick={()=>{setView('list');setFilter('overview');}}>Explore all {neighbors.length} connections <Icon name="arrow" size={14}/></button>}</div>}
          <details className="developer-evidence"><summary><Icon name="code" size={16}/> Developer evidence</summary><dl>{['ruleId','role','selector','kind','statusCode'].map(key=>str(selected,key)&&<div key={key}><dt>{({ruleId:'Check',role:'Role',selector:'Element',kind:'Event type',statusCode:'HTTP status'} as Record<string,string>)[key]}</dt><dd>{str(selected,key)}</dd></div>)}</dl>{Array.isArray(selected.data.targets)&&<div className="evidence-targets">{selected.data.targets.slice(0,12).map((target,i)=><code key={`${i}-${target}`}>{String(target)}</code>)}</div>}{str(selected,'snippet')&&<pre>{str(selected,'snippet')}</pre>}{selected.kind==='runtime-error'&&<pre>{selected.label}</pre>}{httpUrl(str(selected,'helpUrl'))&&<a href={httpUrl(str(selected,'helpUrl'))} target="_blank" rel="noreferrer">Read check guidance <Icon name="external" size={14}/></a>}</details>
        </motion.div>:<div className="inspector-empty"><Icon name="target" size={36}/><h3>Small details.<br/>Meaningful impact.</h3><p>Select a point to understand what was found, who it may affect, and what to try next.</p></div>}<div className="inspector-foot"><Icon name="shield" size={15}/><span>Evidence, with context.</span></div></aside>
      </section>
      {scan&&<ScanStory scan={scan} graph={graph} onOpen={node=>{setSelected(node);setFilter('issues');setBeats(b=>({...b,finding:b.finding+1}));}}/>}
      {scan&&<AiBriefing scan={scan} graph={graph} status={aiStatus} onReady={announce} onOpen={id=>{const node=graph.nodes.find(n=>n.id===id);if(node)select(node);}}/>}
      {scan?.sample&&sample&&<div className="repair-lab" role="region" aria-label="Demo shop repair lab"><div className="repair-head"><Icon name="spark" size={18}/><div><strong>Prove a repair</strong><span>{sample.variant==='before'?sample.brokenNote:sample.fixedNote}</span></div></div><div className="repair-actions"><span className={`repair-state ${sample.variant}`}>{sample.variant==='before'?'Broken state':'Repaired state'}</span>{proposal?.location?<button className="button button-glass compact" disabled={busy} onClick={()=>void acceptProposal()}><Icon name="check" size={15}/>Apply your accepted change</button>:sample.variant==='before'?<button className="button button-glass compact" disabled={busy} onClick={()=>void repairDemo()}><Icon name="spark" size={15}/>Repair the demo shop</button>:null}{(sample.variant==='after'||sample.patched)?<button className="button button-glass compact" disabled={busy} onClick={()=>void breakDemo()}><Icon name="refresh" size={15}/>Put the fault back</button>:null}<button className="button button-solid compact" disabled={busy} onClick={()=>void run({sample:'checkout'},true)}><Icon name="refresh" size={16}/>Rescan and compare</button></div></div>}
      {scan&&scan.interactionPolicy&&<div className="interaction-report" role="status"><Icon name="target" size={18}/><strong>{scan.interactionPolicy.tested} action{scan.interactionPolicy.tested===1?'':'s'} activated once in a disposable browser</strong><span>{scan.interactionPolicy.mode==='include-submits'?'Form controls were included with your permission. ':'Form and submit controls were not activated. '}{scan.interactionPolicy.skipped>0?`${scan.interactionPolicy.skipped} control${scan.interactionPolicy.skipped===1?'':'s'} stayed untested (permission, safety, or scan budget).`:''}</span></div>}
      {scan&&scan.coverage&&<details className="coverage-details"><summary><Icon name="shield" size={16}/> What this scan covered — and what it left out</summary><ul><li><b>{scan.coverage.pagesInspected}</b> page{scan.coverage.pagesInspected===1?'':'s'} inspected{scan.coverage.pagesBlocked>0?`, ${scan.coverage.pagesBlocked} blocked by the safety policy`:''}{scan.coverage.pagesFailed>0?`, ${scan.coverage.pagesFailed} could not be inspected`:''}.</li>{scan.coverage.destinationsNotReached>0&&<li><b>{scan.coverage.destinationsNotReached}</b> destination{scan.coverage.destinationsNotReached===1?' was':'s were'} found but not reached{scan.coverage.stoppedBy==='page-limit'?' because the five-page limit was reached':scan.coverage.stoppedBy==='time-limit'?' because the time limit was reached':''}.</li>}{scan.coverage.destinationsBeyondDepth>0&&<li><b>{scan.coverage.destinationsBeyondDepth}</b> link{scan.coverage.destinationsBeyondDepth===1?'':'s'} sat deeper than the two-link limit and were not followed.</li>}<li><b>{scan.coverage.interactionsTested}</b> control{scan.coverage.interactionsTested===1?' was':'s were'} activated once · <b>{scan.coverage.interactionsSkipped}</b> stayed untested for a stated reason{scan.coverage.controlsNotReached?` · <b>${scan.coverage.controlsNotReached}</b> more were never considered, because the budget ran out`:''}.</li><li>Data-changing requests and other websites were always blocked — only reading requests were sent.</li>{counts.unchecked>0&&<li><b>{counts.unchecked}</b> page{counts.unchecked===1?'':'s'} could not be checked at all, so {counts.unchecked===1?'it is':'they are'} unchecked rather than clear.</li>}</ul></details>}
      {scan&&issues.length>0&&<section className="priority-section"><div><span className="eyebrow">A GOOD PLACE TO START</span><h2>Make the next ripple count.</h2><p>Ordered by severity, then by how many recorded actions pass through the page, then by how many elements are affected. Browser signals are diagnostics, not confirmed broken journeys.</p></div><div className="priority-grid">{issues.slice(0,3).map(node=><button key={node.id} onClick={()=>{setSelected(node);setFilter('overview');inspector.current?.scrollIntoView({behavior:reduced?'instant':'smooth',block:'start'});}}><span className="priority-icon" style={{color:nodeColor(node)}}><Icon name={node.kind==='runtime-error'?'info':'warning'} size={21}/></span><span><small>{node.kind==='runtime-error'?'BROWSER SIGNAL':`${severity(node).toUpperCase()} · ${Number(node.data.groupCount)||1} ELEMENT${Number(node.data.groupCount)>1?'S':''} · ${rippleReach(graph,node.id)} RECORDED ACTION${rippleReach(graph,node.id)===1?'':'S'} THROUGH ITS PAGE`}</small><strong>{describe(node).title}</strong></span><Icon name="arrow" size={18}/></button>)}</div></section>}
      <footer className="studio-footer"><span>AccessRipple <i>·</i> Clarity creates possibility.</span><span>{scan?`${scan.pages.length} pages attempted · ${counts.testedFlows} actions tested · ${counts.signals} browser signals`:'Built for a more usable web.'}<i>·</i><button onClick={()=>setHelpOpen(true)}>Know the scan’s limits <Icon name="external" size={13}/></button></span></footer>
    </main>
    {historyOpen&&<Dialog title="Your recent scans." onClose={()=>setHistoryOpen(false)}><p className="dialog-description">Saved on this computer and kept when the scanner restarts. Export a vault to keep a portable copy.</p><div className="history-list">{history.map(item=><button key={item.scan.id} onClick={()=>{accept(item.scan,item.graph);setComparison(null);setHistoryOpen(false);}}><Icon name="globe"/><span><strong>{siteName(item.scan)}</strong><small>{item.scan.pages.length} pages · this visit · {item.scan.status}</small></span><Icon name="arrow" size={18}/></button>)}{groupedRemote.map(group=><button key={group.latest.id} onClick={()=>void openScan(group.latest.id)}><Icon name={group.latest.sample?'globe':'folder'}/><span><strong>{group.latest.sample?'Northstar demo shop':hostname(group.latest.inputUrl)}</strong><small>{group.latest.pages} pages · {group.latest.actionsTested} action{group.latest.actionsTested===1?'':'s'} tested{group.count>1?` · ${group.count} scans`:''}{group.latest.sample?' · built-in demo shop':' · saved on this computer'}</small></span><Icon name="arrow" size={18}/></button>)}{!history.length&&!groupedRemote.length&&<p>No scans yet. Map your first website to begin.</p>}</div></Dialog>}
    {proofOpen&&comparison&&<ProofView comparison={comparison} graph={graph} previousGraph={previousGraph} onClose={()=>setProofOpen(false)}/>}
    {walk&&<WalkthroughPanel walk={walk} busy={busy} onClose={()=>setWalk(null)}/>}
    {tourStep!==null&&TOUR[tourStep]&&<div className="tour-bar" role="status" aria-live="polite"><div className="tour-copy"><span className="tour-step">Step {tourStep+1} of {TOUR.length} · {TOUR[tourStep]!.title}</span><p>{TOUR[tourStep]!.say}</p></div><div className="tour-actions"><button className="tour-script" onClick={()=>setGuideOpen(true)}>Full script</button><button className="icon-btn" aria-label="Previous step" disabled={tourStep===0} onClick={()=>setTourStep(Math.max(0,tourStep-1))}><Icon name="back" size={17}/></button><button className="button button-solid compact" disabled={tourStep>=TOUR.length-1} onClick={()=>setTourStep(Math.min(TOUR.length-1,tourStep+1))}>Next <Icon name="arrow" size={15}/></button><button className="icon-btn" aria-label="End the guided tour" onClick={()=>setTourStep(null)}><Icon name="close" size={17}/></button></div></div>}
    {guideOpen&&<Dialog title="Your three-minute demo, step by step." onClose={()=>setGuideOpen(false)}><p className="dialog-description">Follow these four beats in order. The demo shop runs entirely on this computer, so the result is the same every time you record.</p><ol className="guide-steps"><li><span>01</span><div><h3>Map the demo shop</h3><p>Press <b>Scan the demo shop</b>. A real browser opens four pages, activates safe controls once each, and records what happened. It takes about ten seconds and needs no internet.</p></div></li><li><span>02</span><div><h3>Read the story</h3><p>The paragraph under the metrics explains the result in one sentence. Point out that the finding, the page, and the evidence are all linked.</p></div></li><li><span>03</span><div><h3>Follow a journey</h3><p>Open <b>Controls</b>, choose <b>Add to cart</b>, and walk the numbered route. Each step says it was observed in a disposable browser, and steps beyond it stay untested.</p></div></li><li><span>04</span><div><h3>Prove a repair</h3><p>In <b>Prove a repair</b>, press <b>Repair the demo shop</b>, then <b>Rescan and compare</b>. Three items stop being observed — the missing image description and its two failed requests — with nothing new.</p></div></li></ol><p className="guide-foot">Say plainly that automated checks start the conversation and human testing completes it.</p></Dialog>}
    {helpOpen&&<Dialog title="A clearer map, with honest limits." onClose={()=>setHelpOpen(false)}><div className="dialog-copy"><p>AccessRipple visits up to five public same-site pages and runs automated accessibility checks in a real browser.</p><p>It also activates a bounded set of safe controls once each in disposable browser pages and records what actually happened: navigation, content changes, dialogs, validation, loading, or failure. <b>Observed</b> means a recorded outcome. <b>Inferred</b> means a possible destination came from page structure. <b>Not tested</b> means the action was not activated.</p><p>Form and submit controls are only activated when you allow it before a scan. Requests that would send or change data are always blocked and recorded first, and consequential actions such as delete, send, or pay are never activated. No payment is processed and no website is changed.</p><p>Automated checks cover a useful subset of barriers; they do not certify accessibility. Scans are saved on this computer and stay available across scanner restarts from <b>Recent scans</b>. Every result explains its coverage: pages inspected, destinations not reached, and controls left untested, each with a reason.</p></div></Dialog>}
  </div>}</div>;
}
