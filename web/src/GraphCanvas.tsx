import { useEffect, useMemo, useRef, useState, type PointerEvent, type KeyboardEvent, type CSSProperties } from 'react';
import Icon from './Icons';
import { cleanLabel, describe, nodeColor, pageFor, sceneGraph, type Journey, type GraphFilter, type ViewNode } from './presentation';
import type { SiteGraph } from './types';

interface Props { journey: Journey | null; onExitJourney: () => void; graph: SiteGraph; filter: GraphFilter; selectedId: string; focus: boolean; onSelect: (node: ViewNode) => void; onFocus: () => void }
const INITIAL = { yaw: 0, pitch: .16, zoom: 1, panX: 0, panY: 0 };
export default function GraphCanvas({ journey, onExitJourney, graph, filter, selectedId, focus, onSelect, onFocus }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 900, h: 620 });
  const [view, setView] = useState(INITIAL);
  const [mode, setMode] = useState<'orbit' | 'pan'>('orbit');
  const [hovered, setHovered] = useState('');
  const drag = useRef<{ id: number; x: number; y: number; view: typeof INITIAL } | null>(null);
  useEffect(() => { if (!stage.current) return; const observer = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height })); observer.observe(stage.current); return () => observer.disconnect(); }, []);
  useEffect(() => { setView(INITIAL); }, [graph, journey?.control.id]);
  const scene = useMemo(() => journey ? {nodes: [...journey.steps.map(s=>s.node), ...journey.findings.slice(0,3).map(f=>f.node)] as ViewNode[], edges: journey.edges} : sceneGraph(graph, filter, focus ? selectedId : undefined), [journey, graph, filter, focus, selectedId]);
  const representativeId = scene.nodes.find(n => n.id === selectedId || n.memberIds?.includes(selectedId))?.id ?? selectedId;
  const related = new Set(scene.edges.filter(e => e.source === representativeId || e.target === representativeId).flatMap(e => [e.source, e.target]));
  const positioned = useMemo(() => {
    if (journey) {
      const vertical=size.w<620, count=journey.steps.length, zigzag=count>5;
      const spread=vertical?Math.min(64,size.w*.09):Math.min(56,size.h*.09);
      return scene.nodes.map((node) => {
        const index=journey.steps.findIndex(s=>s.node.id===node.id), branch=journey.findings.findIndex(f=>f.node.id===node.id);
        // Long routes zigzag so each numbered step stays readable instead of collapsing into one row.
        const zig=zigzag&&index>=0?(index%2?-1:1)*spread:0;
        const x=vertical?(index>=0?size.w*.27+zig:size.w*.76):(index>=0?60+(size.w-120)*index/Math.max(1,count-1):90+(size.w-180)*(branch+.5)/Math.max(1,Math.min(3,journey.findings.length)));
        const y=vertical?(index>=0?90+(size.h-210)*index/Math.max(1,count-1):90+(size.h-210)*(branch+.5)/Math.max(1,Math.min(3,journey.findings.length))):(index>=0?size.h*.32+zig:size.h*.72);
        return {node,x:size.w/2+(x-size.w/2)*view.zoom+view.panX,y:size.h/2+(y-size.h/2)*view.zoom+view.panY,z:0};
      });
    }
    const pages = scene.nodes.filter(n => n.kind === 'page');
    const r = Math.min(size.w * .24, size.h * .28, 210);
    const world = new Map<string, { x: number; y: number; z: number }>();
    scene.nodes.filter(n => n.kind === 'site').forEach(n => world.set(n.id, { x: 0, y: 0, z: 0 }));
    pages.forEach((n, i) => { const a = -Math.PI / 2 + i * Math.PI * 2 / pages.length; world.set(n.id, { x: Math.cos(a) * r, y: Math.sin(a) * r, z: (i % 2 ? -1 : 1) * 45 }); });
    const groups = new Map<string, ViewNode[]>();
    scene.nodes.filter(n => n.kind !== 'site' && n.kind !== 'page').forEach(n => { const key = pageFor(n, graph)?.id ?? pages[0]?.id ?? 'root'; groups.set(key, [...(groups.get(key) ?? []), n]); });
    groups.forEach((nodes, key) => { const pi = Math.max(0, pages.findIndex(n => n.id === key)); nodes.forEach((n, i) => { const a = pi * Math.PI * 2 / Math.max(1, pages.length) + i * Math.PI * 2 / nodes.length + .35; const ring = r * (1.35 + (i % 2) * .28); world.set(n.id, { x: Math.cos(a) * ring, y: Math.sin(a) * ring * .8, z: Math.sin(a * 2 + pi) * 70 }); }); });
    return scene.nodes.map(node => { const p = world.get(node.id) ?? { x: 0, y: 0, z: 0 }; const x = p.x * Math.cos(view.yaw) + p.z * Math.sin(view.yaw), z = -p.x * Math.sin(view.yaw) + p.z * Math.cos(view.yaw); const y = p.y * Math.cos(view.pitch) - z * Math.sin(view.pitch), depth = p.y * Math.sin(view.pitch) + z * Math.cos(view.pitch), perspective = 750 / (750 + depth); return { node, x: size.w / 2 + x * perspective * view.zoom + view.panX, y: size.h / 2 + y * perspective * view.zoom + view.panY, z: depth }; });
  }, [scene, graph, size, view, journey]);
  const points = new Map(positioned.map(p => [p.node.id, p]));
  const journeyPath = useMemo(() => {
    if (!journey) return '';
    const chain = journey.steps.map(step => points.get(step.node.id)).filter((point): point is NonNullable<typeof point> => Boolean(point));
    return chain.length > 1 ? `M${chain.map(point => `${Math.round(point.x)},${Math.round(point.y)}`).join(' L')}` : '';
  }, [journey, positioned]);
  const labels = useMemo(() => {
    if(journey){const shown=new Set([representativeId,hovered,journey.control.id]);return new Map(positioned.filter(p=>shown.has(p.node.id)).map(p=>{const index=journey.steps.findIndex(s=>s.node.id===p.node.id),alternate=journey.steps.length>5,below=!alternate||index<0||index%2===0;const y=Math.max(6,Math.min(size.h-42,below?p.y+23:p.y-51));return [p.node.id,{x:Math.max(8,Math.min(size.w-204,p.x-98)),y,w:196}];}));}
    const candidates = positioned.filter(p => (size.w > 600 && scene.nodes.length <= 15) || p.node.kind === 'site' || p.node.kind === 'page' || p.node.id === representativeId || p.node.id === hovered);
    const result = new Map<string, { x: number; y: number; w: number }>();
    for (const side of [-1, 1]) { const items = candidates.filter(p => (p.x < size.w / 2 ? -1 : 1) === side).sort((a,b)=>a.y-b.y); let previous=24; items.forEach((p,i)=> { const w=Math.min(196,Math.max(112,describe(p.node).short.slice(0,25).length*6.8+30)); const y=Math.max(24+i*43,Math.min(size.h-48-(items.length-1-i)*43,Math.max(previous,p.y-17))); const x=Math.max(12,Math.min(size.w-w-12,side<0?p.x-w-18:p.x+18)); result.set(p.node.id,{x,y,w});previous=y+43; }); }
    return result;
  }, [positioned, hovered, scene.nodes.length, representativeId, size, journey]);
  function down(e: PointerEvent<SVGSVGElement>) { if ((e.target as Element).closest('[data-node]')) return; drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,view};e.currentTarget.setPointerCapture(e.pointerId); }
  function move(e: PointerEvent<SVGSVGElement>) { const d=drag.current;if(!d||d.id!==e.pointerId)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;setView(mode==='pan'||journey?{...d.view,panX:d.view.panX+dx,panY:d.view.panY+dy}:{...d.view,yaw:d.view.yaw+dx*.008,pitch:Math.max(-.9,Math.min(.9,d.view.pitch+dy*.005))}); }
  function up(e: PointerEvent<SVGSVGElement>) {drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}
  function keyDown(e: KeyboardEvent<SVGSVGElement>) {
    if ((e.target as Element).closest('[data-node]') || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(e.key)) return;
    e.preventDefault();
    const horizontal = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    const vertical = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    setView(v => ({ ...v,
      yaw: v.yaw + (mode === 'orbit' && !journey ? horizontal * .15 : 0),
      pitch: Math.max(-.9, Math.min(.9, v.pitch + (mode === 'orbit' && !journey ? vertical * .1 : 0))),
      panX: v.panX + (mode === 'pan' || journey ? horizontal * 22 : 0),
      panY: v.panY + (mode === 'pan' || journey ? vertical * 22 : 0),
      zoom: Math.min(1.8, Math.max(.55, v.zoom + (e.key === '+' ? .1 : e.key === '-' ? -.1 : 0))),
    }));
  }
  return <div className={`canvas-wrap ${journey?'journey-active':''}`}>
    <div className="canvas-top"><span className="canvas-caption"><i/> {journey?'SELECTED ACTION · FOLLOW THE ARROWS':'LIVE RELATIONSHIPS'}</span><div className="segmented small">{journey?<button onClick={onExitJourney}>Back to map</button>:<><button className={mode==='orbit'?'active':''} onClick={()=>setMode('orbit')} aria-pressed={mode==='orbit'}>Orbit</button><button className={mode==='pan'?'active':''} onClick={()=>setMode('pan')} aria-pressed={mode==='pan'}>Pan</button></>}</div></div>
    <div className="graph-stage" ref={stage}><div className="canvas-glow" aria-hidden="true"/>
      <svg width="100%" height="100%" viewBox={`0 0 ${size.w} ${size.h}`} className="graph-svg" aria-label={`Interactive website map. Drag to ${journey?'pan':mode}. Arrow keys ${journey||mode === 'pan' ? 'pan' : 'rotate'}, plus and minus zoom. Each labeled point opens details.`} role="group" tabIndex={0} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={keyDown}>
        <defs><marker id="journey-arrow" markerWidth="8" markerHeight="8" refX="19" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L8,4 L0,8" fill="currentColor"/></marker><radialGradient id="sceneHalo"><stop stopColor="#a7dcc6" stopOpacity=".14"/><stop offset="1" stopColor="#a7dcc6" stopOpacity="0"/></radialGradient></defs>
        <g className="scene-rings" pointerEvents="none"><ellipse cx={size.w/2} cy={size.h/2} rx={Math.min(size.w*.35,260)} ry={Math.min(size.h*.32,190)}/><ellipse cx={size.w/2} cy={size.h/2} rx={Math.min(size.w*.43,330)} ry={Math.min(size.h*.42,250)}/><circle cx={size.w/2} cy={size.h/2} r="130" fill="url(#sceneHalo)" stroke="none"/></g>
        {scene.edges.map(e=>{const a=points.get(e.source),b=points.get(e.target);if(!a||!b)return null;return <path key={`${e.source}-${e.target}-${e.kind}`} d={`M${a.x},${a.y} Q${(a.x+b.x)/2+12},${(a.y+b.y)/2-10} ${b.x},${b.y}`} className={`connection-path ${journey||e.source===representativeId||e.target===representativeId?'selected':''} ${e.evidenceLabel!=='observed'?'inferred':''}`} markerEnd={journey?'url(#journey-arrow)':undefined} pointerEvents="none"><title>{e.evidenceLabel==='observed'?'Recorded relationship':'Possible connection · action not activated'}</title></path>;})}
        {journey&&journeyPath&&<g className="journey-traversal" pointerEvents="none" aria-hidden="true"><circle r="5" className="traversal-dot"><animateMotion dur={`${Math.min(14, Math.max(4, journey.steps.length*.9))}s`} repeatCount="indefinite" path={journeyPath}/></circle></g>}
        {[...positioned].sort((a,b)=>b.z-a.z).map(({node,x,y})=>{const selected=selectedId===node.id||Boolean(node.memberIds?.includes(selectedId)),l=labels.get(node.id),short=describe(node).short,count=Number(node.data.groupCount)||1,stepIndex=journey?journey.steps.findIndex(s=>s.node.id===node.id):-1;const full=`${stepIndex>=0?`STEP ${stepIndex+1} · `:''}${short}`,limit=journey?24:25,shown=full.length>limit?`${full.slice(0,limit-1)}…`:full,ariaLabel=`${shown}${count>1?` · ${count} findings`:''}`;return <g key={node.id} transform={`translate(${x} ${y})`} data-node={node.id} role="button" tabIndex={0} aria-label={ariaLabel} className={`map-node ${selected?'selected':''} ${related.has(node.id)?'related':''}`} style={{'--node-color':nodeColor(node)} as CSSProperties} onPointerDown={e=>e.stopPropagation()} onClick={()=>onSelect(node)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();onSelect(node);}}} onMouseEnter={()=>setHovered(node.id)} onMouseLeave={()=>setHovered('')}>
          {stepIndex>=0&&!l&&<text className="journey-step-number" textAnchor="middle" y={journey!.steps.length>5&&stepIndex%2===1?34:-24}>STEP {stepIndex+1}</text>}<rect x={Math.min(-22,l?l.x-x:-22)} y="-40" width={Math.max(44,l?l.x-x+l.w:22)-Math.min(-22,l?l.x-x:-22)} height={l?Math.max(84,l.y-y+36):84} fill="transparent" className="node-hit-area"/><title>{describe(node).title}{count>1?` · ${count} affected elements`:''}</title><circle r="18" fill="transparent" className="node-hit"/><circle r={node.kind==='site'?12:node.kind==='page'?9:6.5} className="node-dot"/><circle r={selected?20:13} className="node-halo" pointerEvents="none"/>
          {l&&<><line x1="0" y1="0" x2={l.x-x+(l.x<x?l.w:0)} y2={l.y-y+17} className="label-leader" pointerEvents="none"/><g transform={`translate(${l.x-x} ${l.y-y})`} className="node-card"><rect width={l.w} height="34" rx="8"/><text x="12" y="22">{shown}{count>1?` · ${count}`:''}</text></g></>}
        </g>;})}
      </svg><span className="map-coverage">{journey?`A travelling pulse follows the recorded route · hover a step to read its label · dashed = action not tested${journey.findings.length>3?' · all observations in details':''}`:`${scene.nodes.length} focus points · full inventory in List`}</span>
    </div>
    {journey&&<div className="journey-summary" role="status"><strong>{cleanLabel(journey.control.label)}</strong><span>{journey.summary}</span></div>}
    <div className="canvas-bottom"><div className="graph-key"><span><i className="page-dot"/>Page</span><span><i className="issue-dot"/>Accessibility</span><span><i className="error-dot"/>Browser signal</span></div><div className="canvas-actions"><button className={`icon-btn ${focus?'active':''}`} aria-label="Focus selected neighborhood" aria-pressed={focus} onClick={onFocus} title="Focus neighborhood"><Icon name="target" size={18}/></button><button className="icon-btn" onClick={()=>setView(INITIAL)} aria-label="Reset map view"><Icon name="refresh" size={17}/></button><span className="control-separator"/><button className="icon-btn" onClick={()=>setView(v=>({...v,zoom:Math.max(.55,v.zoom-.15)}))} aria-label="Zoom out"><Icon name="minus" size={17}/></button><span className="zoom-readout">{Math.round(view.zoom*100)}%</span><button className="icon-btn" onClick={()=>setView(v=>({...v,zoom:Math.min(1.8,v.zoom+.15)}))} aria-label="Zoom in"><Icon name="plus" size={17}/></button></div></div>
  </div>;
}
