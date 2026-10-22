import { useEffect, useMemo, useRef, useState, type PointerEvent, type KeyboardEvent, type CSSProperties } from 'react';
import Icon from './Icons';
import { cleanLabel, describe, pageFor, withoutSharedAffix, type Journey, type GraphFilter, type Ripple, type ViewNode } from './presentation';
import type { GraphEdge, SiteGraph } from './types';
import { buildExplorerScene, explainEdge, explorerFacets, explorerNodeColor as nodeColor } from './graph-explorer';

interface Props { journey: Journey | null; ripple: Ripple | null; onExitJourney: () => void; graph: SiteGraph; filter: GraphFilter; selectedId: string; focus: boolean; onSelect: (node: ViewNode) => void; onFocus: () => void }
const INITIAL = { yaw: 0, pitch: .16, zoom: 1, panX: 0, panY: 0 };
/** Where the ripple's centre and its two rings sit for a given stage size. */
const rippleGeometry = (size: { w: number; h: number }) => {
  // A phone is tall and narrow, so its rings are drawn tall as well.
  const narrow = size.w < 620, r1 = Math.min(size.w * (narrow ? .3 : .36), size.h * .42, 260);
  return { cx: size.w / 2, cy: size.h * (narrow ? .5 : .42), r1, r2: Math.min(size.w * .47, size.h * .5, r1 * 1.7), squash: narrow ? 1.35 : .82, narrow };
};
export default function GraphCanvas({ journey, ripple, onExitJourney, graph, filter, selectedId, focus, onSelect, onFocus }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 900, h: 620 });
  const [view, setView] = useState(INITIAL);
  const [mode, setMode] = useState<'orbit' | 'pan'>('orbit');
  const [hovered, setHovered] = useState('');
  const [query, setQuery] = useState(''), [pageId, setPageId] = useState('all');
  const [impact, setImpact] = useState('all'), [category, setCategory] = useState('all');
  const [expanded, setExpanded] = useState<string[]>([]);
  const [edge, setEdge] = useState<GraphEdge | null>(null);
  const edgePanel = useRef<HTMLElement>(null), edgeTrigger = useRef<SVGGElement | null>(null);
  const [offsets, setOffsets] = useState<Record<string, {x:number;y:number}>>({});
  const nodeDrag = useRef<{id:number;nodeId:string;x:number;y:number;origin:{x:number;y:number};moved:boolean} | null>(null);
  const suppressClick = useRef(false);
  // A journey and a ripple are both guided views: dragging pans, and the map's
  // own filters step aside.
  const guided = Boolean(journey || ripple);
  const facets = useMemo(() => explorerFacets(graph), [graph]);
  const refined = query !== '' || pageId !== 'all' || impact !== 'all' || category !== 'all';
  function clearFilters() { setQuery(''); setPageId('all'); setImpact('all'); setCategory('all'); }
  function closeEdge() { setEdge(null); edgeTrigger.current?.focus(); }
  useEffect(() => { if (edge) edgePanel.current?.focus(); }, [edge]);
  useEffect(() => { clearFilters(); setExpanded([]); setOffsets({}); setEdge(null); }, [graph, filter]);
  useEffect(() => { setEdge(null); setOffsets({}); }, [journey?.control.id, ripple?.finding.id]);
  const drag = useRef<{ id: number; x: number; y: number; view: typeof INITIAL } | null>(null);
  useEffect(() => { if (!stage.current) return; const observer = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height })); observer.observe(stage.current); return () => observer.disconnect(); }, []);
  useEffect(() => { setView(INITIAL); }, [graph, journey?.control.id, ripple?.finding.id]);
  const scene = useMemo(() => ripple ? {nodes: [ripple.page, ...ripple.rings.map(r=>r.page), ripple.finding] as ViewNode[], edges: [...ripple.hops.map(h=>({id:`ripple:${h.flow.id}`, kind:'links-to', source:h.from.id, target:h.to.id, evidenceLabel:'observed' as const, via:cleanLabel(h.control.label)})), {id:'ripple:finding', kind:'has-finding', source:ripple.page.id, target:ripple.finding.id, evidenceLabel:'observed' as const}], hiddenCount: 0, matchedCount: ripple.rings.length + 2, groupedCount: 0} : journey ? {nodes: [...journey.steps.map(s=>s.node), ...journey.findings.slice(0,3).map(f=>f.node)] as ViewNode[], edges: journey.edges, hiddenCount: 0, matchedCount: journey.steps.length + journey.findings.length, groupedCount: 0} : buildExplorerScene(graph, {kind:filter, severity:impact, category, pageId, query, focusId:focus ? selectedId : undefined, selectedId, expandedGroupIds:expanded}), [ripple, journey, graph, filter, focus, selectedId, impact, category, pageId, query, expanded]);
  // Pages of one site usually share its name. Inside the ripple every page is
  // on the same site, so the shared part is dropped and the page name is left.
  const rippleNames = useMemo(() => { const pages = ripple ? [ripple.page, ...ripple.rings.map(r => r.page)] : []; return new Map(pages.map((page, _i, all) => [page.id, withoutSharedAffix(page.label, all.map(other => other.label))])); }, [ripple]);
  const edgeCopy = edge ? explainEdge(edge, { ...graph, nodes: [...new Map([...graph.nodes, ...scene.nodes].map(node => [node.id, node])).values()] }) : null;
  const representativeId = scene.nodes.find(n => n.id === selectedId || n.memberIds?.includes(selectedId))?.id ?? selectedId;
  const related = new Set(scene.edges.filter(e => e.source === representativeId || e.target === representativeId).flatMap(e => [e.source, e.target]));
  const projected = useMemo(() => {
    if (ripple) {
      // The barrier's page sits in the middle, the finding just under it, and
      // the pages around it on rings: one recorded action away, then two.
      const {cx,cy,r1,r2,squash}=rippleGeometry(size);
      // A few neighbours share the upper arc, so the finding has the space
      // under its page; a crowded ring uses most of the circle.
      const near=ripple.rings.filter(r=>r.distance===1), span=[0,0,Math.PI*.7,Math.PI,Math.PI*1.15][near.length]??Math.PI*1.6;
      const angle=new Map<string,number>();
      near.forEach((r,i)=>angle.set(r.page.id,-Math.PI/2+(near.length===1?0:-span/2+span*i/(near.length-1))));
      const world=new Map<string,{x:number;y:number}>([[ripple.page.id,{x:cx,y:cy}],[ripple.finding.id,{x:cx,y:cy+Math.min(120,r1*.62)}]]);
      near.forEach(r=>{const a=angle.get(r.page.id)!;world.set(r.page.id,{x:cx+Math.cos(a)*r1,y:cy+Math.sin(a)*r1*squash});});
      const far=ripple.rings.filter(r=>r.distance===2);
      far.forEach((r,i)=>{const hop=ripple.hops.find(h=>h.distance===2&&(h.from.id===r.page.id||h.to.id===r.page.id));const parent=hop?(hop.from.id===r.page.id?hop.to.id:hop.from.id):'';const siblings=far.filter(f=>ripple.hops.some(h=>h.distance===2&&(h.from.id===f.page.id||h.to.id===f.page.id)&&(h.from.id===parent||h.to.id===parent)));const k=siblings.findIndex(f=>f.page.id===r.page.id);const base=angle.get(parent)??(-Math.PI/2+i*.5),lift=siblings.length===1&&Math.abs(Math.cos(base))>.3?(Math.cos(base)<0?.45:-.45):0,a=base+lift+(k-(siblings.length-1)/2)*.42;world.set(r.page.id,{x:cx+Math.cos(a)*r2,y:cy+Math.sin(a)*r2*squash});});
      return scene.nodes.map(node=>{const p=world.get(node.id)??{x:cx,y:cy};return {node,x:size.w/2+(p.x-size.w/2)*view.zoom+view.panX,y:size.h/2+(p.y-size.h/2)*view.zoom+view.panY,z:0};});
    }
    if (journey) {
      const vertical=size.w<620, count=journey.steps.length;
      // The horizontal space each step gets decides how the route is drawn.
      // When there is room, the steps follow one shallow arc, which reads as a
      // path across the screen. Only a cramped route is staggered, and then
      // only enough to keep the numbered badges apart.
      const gap=vertical?0:Math.max(1,(size.w-140)/Math.max(1,count-1));
      const roomy=!vertical&&gap>=58;
      const spread=vertical?Math.min(64,size.w*.09):roomy?0:Math.min(38,size.h*.07);
      return scene.nodes.map((node) => {
        const index=journey.steps.findIndex(s=>s.node.id===node.id), branch=journey.findings.findIndex(f=>f.node.id===node.id);
        const zig=spread>0&&index>=0?(index%2?-1:1)*spread:0;
        const x=vertical?(index>=0?size.w*.27+zig:size.w*.76):(index>=0?70+(size.w-140)*index/Math.max(1,count-1):90+(size.w-180)*(branch+.5)/Math.max(1,Math.min(3,journey.findings.length)));
        const arc=roomy&&index>=0?Math.sin((index/Math.max(1,count-1))*Math.PI)*26:0;
        const y=vertical?(index>=0?90+(size.h-210)*index/Math.max(1,count-1):90+(size.h-210)*(branch+.5)/Math.max(1,Math.min(3,journey.findings.length))):(index>=0?size.h*.30+arc+zig:size.h*.72);
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
  }, [scene, graph, size, view, journey, ripple]);
  const positioned = useMemo(() => projected.map(p => ({...p, x:p.x+(offsets[p.node.id]?.x??0), y:p.y+(offsets[p.node.id]?.y??0)})), [projected, offsets]);
  const points = new Map(positioned.map(p => [p.node.id, p]));
  const journeyPath = useMemo(() => {
    if (!journey) return '';
    const chain = journey.steps.map(step => points.get(step.node.id)).filter((point): point is NonNullable<typeof point> => Boolean(point));
    // The same curve the connection is drawn with, so the pulse travels the
    // route on screen rather than a straight line between the points.
    let path = '';
    chain.forEach((point, index) => {
      const x = Math.round(point.x);
      const y = Math.round(point.y);
      if (index === 0) { path = `M${x},${y}`; return; }
      const previous = chain[index - 1]!;
      path += ` Q${Math.round((previous.x + point.x) / 2 + 12)},${Math.round((previous.y + point.y) / 2 - 10)} ${x},${y}`;
    });
    return chain.length > 1 ? path : '';
  }, [journey, positioned]);
  const labels = useMemo(() => {
    if(ripple){
      // Labels point away from the centre, so the space between the rings is
      // left to the arrows and the names of the actions on them.
      const c=positioned.find(p=>p.node.id===ripple.page.id),{narrow}=rippleGeometry(size);
      return new Map(positioned.map(p=>{const w=Math.min(236,Math.max(narrow?84:110,(rippleNames.get(p.node.id)??describe(p.node).short).slice(0,narrow?19:28).length*(narrow?6.5:7.3)+(narrow?20:26))),dx=c?p.x-c.x:0,dy=c?p.y-c.y:1,side=!narrow&&p.node.id!==ripple.page.id&&p.node.id!==ripple.finding.id&&Math.abs(dx)>Math.abs(dy)*.6;
        // The barrier's page is labelled above itself, because the arrows
        // that leave it and the finding under it both run below.
        const x=side?(dx<0?p.x-w-18:p.x+18):p.x-w/2,y=side?p.y-17:p.node.id===ripple.page.id||dy<0?p.y-54:p.y+20;
        return [p.node.id,{x:Math.max(8,Math.min(size.w-w-8,x)),y:Math.max(6,Math.min(size.h-42,y)),w}];}));
    }
    if(journey){const shown=new Set([representativeId,hovered,journey.control.id]);return new Map(positioned.filter(p=>shown.has(p.node.id)).map(p=>{const index=journey.steps.findIndex(s=>s.node.id===p.node.id),alternate=journey.steps.length>5,below=!alternate||index<0||index%2===0;const y=Math.max(6,Math.min(size.h-42,below?p.y+23:p.y-51));
      // Journey labels are set larger, so the card is sized to the text it holds rather than a fixed width.
      const chars=Math.min(24,`${index>=0?`STEP ${index+1} · `:''}${describe(p.node).short}`.length),w=Math.min(260,Math.max(140,chars*9.1+30));return [p.node.id,{x:Math.max(8,Math.min(size.w-w-8,p.x-w/2)),y,w}];}));}
    const candidates = positioned.filter(p => (size.w > 600 && scene.nodes.length <= 15) || p.node.kind === 'site' || p.node.kind === 'page' || p.node.id === representativeId || p.node.id === hovered);
    const result = new Map<string, { x: number; y: number; w: number }>();
    // The site sits in the middle, so its label goes underneath rather than
    // beside it, where it would cover a neighbouring point.
    const centre = positioned.find(p => p.node.kind === 'site');
    if (centre) {
      const w = Math.min(196, Math.max(112, describe(centre.node).short.slice(0, 25).length * 6.8 + 30));
      result.set(centre.node.id, { x: Math.max(12, Math.min(size.w - w - 12, centre.x - w / 2)), y: Math.max(24, Math.min(size.h - 50, centre.y + 30)), w });
    }
    for (const side of [-1, 1]) { const items = candidates.filter(p => p.node.kind !== 'site' && (p.x < size.w / 2 ? -1 : 1) === side).sort((a,b)=>a.y-b.y); let previous=24; items.forEach((p,i)=> { const w=Math.min(196,Math.max(112,describe(p.node).short.slice(0,25).length*6.8+30)); const y=Math.max(24+i*43,Math.min(size.h-48-(items.length-1-i)*43,Math.max(previous,p.y-17))); const x=Math.max(12,Math.min(size.w-w-12,side<0?p.x-w-18:p.x+18)); result.set(p.node.id,{x,y,w});previous=y+43; }); }
    return result;
  }, [positioned, hovered, scene.nodes.length, representativeId, size, journey, ripple, rippleNames]);
  function down(e: PointerEvent<SVGSVGElement>) { if ((e.target as Element).closest('[data-node], [data-edge]')) return; drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,view};e.currentTarget.setPointerCapture(e.pointerId); }
  function move(e: PointerEvent<SVGSVGElement>) { const d=drag.current;if(!d||d.id!==e.pointerId)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;setView(mode==='pan'||guided?{...d.view,panX:d.view.panX+dx,panY:d.view.panY+dy}:{...d.view,yaw:d.view.yaw+dx*.008,pitch:Math.max(-.9,Math.min(.9,d.view.pitch+dy*.005))}); }
  function up(e: PointerEvent<SVGSVGElement>) {drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}
  function keyDown(e: KeyboardEvent<SVGSVGElement>) {
    if ((e.target as Element).closest('[data-node], [data-edge]') || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','0'].includes(e.key)) return;
    e.preventDefault();
    if (e.key === '0') { fitView(); return; }
    const horizontal = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    const vertical = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    setView(v => ({ ...v,
      yaw: v.yaw + (mode === 'orbit' && !guided ? horizontal * .15 : 0),
      pitch: Math.max(-.9, Math.min(.9, v.pitch + (mode === 'orbit' && !guided ? vertical * .1 : 0))),
      panX: v.panX + (mode === 'pan' || guided ? horizontal * 22 : 0),
      panY: v.panY + (mode === 'pan' || guided ? vertical * 22 : 0),
      zoom: Math.min(2.5, Math.max(.35, v.zoom + (e.key === '+' || e.key === '=' ? .1 : e.key === '-' ? -.1 : 0))),
    }));
  }
  function fitView() {
    if (!positioned.length) return;
    const xs=projected.map(p=>p.x), ys=projected.map(p=>p.y);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const factor=Math.min((size.w-170)/Math.max(100,maxX-minX),(size.h-150)/Math.max(100,maxY-minY));
    const zoom=Math.max(.35,Math.min(2.5,view.zoom*factor)), ratio=zoom/view.zoom;
    setView(v=>({...v,zoom,panX:(v.panX-((minX+maxX)/2-size.w/2))*ratio,panY:(v.panY-((minY+maxY)/2-size.h/2))*ratio}));
    setOffsets({});
  }
  function startNode(e:PointerEvent<SVGGElement>, nodeId:string) {
    e.stopPropagation(); suppressClick.current=false;
    nodeDrag.current={id:e.pointerId,nodeId,x:e.clientX,y:e.clientY,origin:offsets[nodeId]??{x:0,y:0},moved:false};
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function moveNode(e:PointerEvent<SVGGElement>) {
    const d=nodeDrag.current;if(!d||d.id!==e.pointerId)return;
    const x=e.clientX-d.x,y=e.clientY-d.y;if(Math.hypot(x,y)>4)d.moved=true;
    if(d.moved)setOffsets(current=>({...current,[d.nodeId]:{x:d.origin.x+x,y:d.origin.y+y}}));
  }
  function endNode(e:PointerEvent<SVGGElement>) {
    suppressClick.current=nodeDrag.current?.moved??false;nodeDrag.current=null;
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  }
  const selectedGroup=scene.nodes.find(n=>n.id===representativeId&&Number(n.data.groupCount)>1);
  return <div className={`canvas-wrap ${guided?'journey-active':''} ${ripple?'ripple-active':''}`}>
    {!guided&&<div className="map-refinements" role="search" aria-label="Filter the map">
      <label className="map-search"><Icon name="search" size={16}/><span className="sr-only">Search map nodes</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find a page, issue, or element…"/></label>
      <details className="map-filter-options"><summary>Refine map{refined?' · active':''}</summary><div className="map-filter-fields">
        <label>Page<select aria-label="Filter map by page" value={pageId} onChange={e=>setPageId(e.target.value)}><option value="all">All pages</option>{facets.pages.map(p=><option key={p.id} value={p.id}>{cleanLabel(p.label)}</option>)}</select></label>
        <label>Severity<select aria-label="Filter map by severity" value={impact} onChange={e=>setImpact(e.target.value)}><option value="all">All severities</option>{facets.severities.map(value=><option key={value} value={value}>{value==='diagnostic'?'Browser signals':value==='info'?'Unrated':value[0]!.toUpperCase()+value.slice(1)}</option>)}</select></label>
        <label>Check<select aria-label="Filter map by check" value={category} onChange={e=>setCategory(e.target.value)}><option value="all">All checks</option>{facets.categories.map(value=><option key={value.id} value={value.id}>{value.label}</option>)}</select></label>
      </div></details>
      {refined&&<button className="map-clear" onClick={clearFilters}>Clear filters</button>}
    </div>}
    <div className="canvas-top"><span className="canvas-caption"><i/> {ripple?'BARRIER RIPPLE · RECORDED ACTIONS AROUND THIS PAGE':journey?'SELECTED ACTION · FOLLOW THE ARROWS':'LIVE RELATIONSHIPS'}</span><div className="segmented small">{guided?<button onClick={onExitJourney}>Back to map</button>:<><button className={mode==='orbit'?'active':''} onClick={()=>setMode('orbit')} aria-pressed={mode==='orbit'}>Orbit</button><button className={mode==='pan'?'active':''} onClick={()=>setMode('pan')} aria-pressed={mode==='pan'}>Pan</button></>}</div></div>
    <div className="graph-stage" ref={stage}><div className="canvas-glow" aria-hidden="true"/>
      <svg width="100%" height="100%" viewBox={`0 0 ${size.w} ${size.h}`} className="graph-svg" aria-label={`Interactive website map. Drag to ${guided?'pan':mode}. Arrow keys ${guided||mode === 'pan' ? 'pan' : 'rotate'}, plus and minus zoom, zero fits the map. Drag a point to reposition it. Points and connections open evidence.`} role="group" tabIndex={0} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={keyDown} onWheel={e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();setView(v=>({...v,zoom:Math.max(.35,Math.min(2.5,v.zoom*Math.exp(-e.deltaY*.003)))}));}}>
        <defs><marker id="journey-arrow" markerWidth="8" markerHeight="8" refX="19" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L8,4 L0,8" fill="currentColor"/></marker><radialGradient id="sceneHalo"><stop stopColor="#a7dcc6" stopOpacity=".14"/><stop offset="1" stopColor="#a7dcc6" stopOpacity="0"/></radialGradient></defs>
        <g className="scene-rings" pointerEvents="none"><ellipse cx={size.w/2} cy={size.h/2} rx={Math.min(size.w*.35,260)} ry={Math.min(size.h*.32,190)}/><ellipse cx={size.w/2} cy={size.h/2} rx={Math.min(size.w*.43,330)} ry={Math.min(size.h*.42,250)}/><circle cx={size.w/2} cy={size.h/2} r="130" fill="url(#sceneHalo)" stroke="none"/></g>
        {ripple&&points.get(ripple.page.id)&&(()=>{const c=points.get(ripple.page.id)!,{squash}=rippleGeometry(size),r1=rippleGeometry(size).r1*view.zoom,r2=rippleGeometry(size).r2*view.zoom;return <g className="ripple-waves" pointerEvents="none" aria-hidden="true"><ellipse cx={c.x} cy={c.y} rx={r1} ry={r1*squash} className="ripple-ring"/>{ripple.rings.some(r=>r.distance===2)&&<ellipse cx={c.x} cy={c.y} rx={r2} ry={r2*squash} className="ripple-ring outer"/>}{[0,1,2].map(i=><ellipse key={i} cx={c.x} cy={c.y} rx={r1} ry={r1*squash} className="ripple-wave" style={{animationDelay:`${i*1.4}s`}}/>)}</g>;})()}
        {scene.edges.map(e=>{const a=points.get(e.source),b=points.get(e.target);if(!a||!b)return null;const observed=e.evidenceLabel==='observed',via=e.via;
          // In the ripple, an action and its way back bow to opposite sides,
          // so the two directions never draw over each other.
          const length=Math.hypot(b.x-a.x,b.y-a.y)||1,bow=ripple?26:0,cx=ripple?(a.x+b.x)/2+(b.y-a.y)/length*bow:(a.x+b.x)/2+12,cy=ripple?(a.y+b.y)/2-(b.x-a.x)/length*bow:(a.y+b.y)/2-10;
          const d=`M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}`,label=`${describe(a.node).short} → ${describe(b.node).short}: ${via?`“${via}” · `:''}${e.kind.replaceAll('-',' ')} · ${e.evidenceLabel}`;return <g key={e.id} data-edge={e.id} role="button" tabIndex={0} aria-label={label} className={`map-edge ${edge?.id===e.id?'active':''}`} onPointerDown={event=>event.stopPropagation()} onClick={event=>{edgeTrigger.current=event.currentTarget;setEdge(e);}} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();edgeTrigger.current=event.currentTarget;setEdge(e);}}}>
          <path d={d} className="edge-hit"/><path d={d} className={`connection-path ${observed?'observed':''} ${journey||e.source===representativeId||e.target===representativeId?'selected':''} ${observed?'':'inferred'}`} markerEnd={guided?'url(#journey-arrow)':undefined} pointerEvents="none"/>{ripple&&via&&!rippleGeometry(size).narrow&&(()=>{
            // The label sits nearer the page that is not the barrier's, so the
            // labels of every arrow meeting in the middle stay apart.
            const t=e.source===ripple.page.id?.62:.38,u=1-t,nx=(b.y-a.y)/length,ny=-(b.x-a.x)/length,x=u*u*a.x+2*u*t*cx+t*t*b.x+nx*8,y=u*u*a.y+2*u*t*cy+t*t*b.y+ny*8;
            return <text x={x} y={y+(ny<-.5?-4:ny>.5?12:4)} textAnchor={nx>.5?'start':nx<-.5?'end':'middle'} className="ripple-edge-label" pointerEvents="none">{via.length>24?`${via.slice(0,23)}…`:via}</text>;})()}<title>{label}</title>
        </g>;})}
        {ripple&&<g className="journey-traversal" pointerEvents="none" aria-hidden="true">{scene.edges.filter(e=>e.target===ripple.page.id).map((e,i)=>{const a=points.get(e.source),b=points.get(e.target);if(!a||!b)return null;const length=Math.hypot(b.x-a.x,b.y-a.y)||1,cx=(a.x+b.x)/2+(b.y-a.y)/length*26,cy=(a.y+b.y)/2-(b.x-a.x)/length*26;return <circle key={e.id} r="4.5" className="traversal-dot"><animateMotion dur="3.2s" begin={`${i*.6}s`} repeatCount="indefinite" path={`M${Math.round(a.x)},${Math.round(a.y)} Q${Math.round(cx)},${Math.round(cy)} ${Math.round(b.x)},${Math.round(b.y)}`}/></circle>;})}</g>}
        {journey&&journeyPath&&<g className="journey-traversal" pointerEvents="none" aria-hidden="true"><circle r="5" className="traversal-dot"><animateMotion dur={`${Math.min(14, Math.max(4, journey.steps.length*.9))}s`} repeatCount="indefinite" path={journeyPath}/></circle></g>}
        {[...positioned].sort((a,b)=>b.z-a.z).map(({node,x,y})=>{const selected=selectedId===node.id||Boolean(node.memberIds?.includes(selectedId)),l=labels.get(node.id),short=describe(node).short,count=Number(node.data.groupCount)||1,stepIndex=journey?journey.steps.findIndex(s=>s.node.id===node.id):-1;const full=`${stepIndex>=0?`STEP ${stepIndex+1} · `:''}${rippleNames.get(node.id)??short}`,limit=ripple?(size.w<620?19:28):journey?24:25,shown=full.length>limit?`${full.slice(0,limit-1)}…`:full,ariaLabel=`${shown}${count>1?` · ${count} findings`:''}`;const unchecked=node.status==='untested'||node.status==='needs-review'||node.data.ruleId==='accessibility-check-incomplete';const radius=node.kind==='site'?12:node.kind==='page'?9:6.5;return <g key={node.id} transform={`translate(${x} ${y})`} data-node={node.id} role="button" tabIndex={0} aria-label={`${ariaLabel} · ${unchecked?'unverified':node.kind==='accessibility-finding'?String(node.data.impact||'unrated'):node.evidenceLabel}`} className={`map-node ${ripple?.page.id===node.id?'ripple-center':''} ${unchecked?'unverified':''} ${selected?'selected':''} ${related.has(node.id)?'related':''}`} style={{'--node-color':nodeColor(node)} as CSSProperties} onPointerDown={e=>startNode(e,node.id)} onPointerMove={moveNode} onPointerUp={endNode} onPointerCancel={endNode} onClick={()=>{if(!suppressClick.current)onSelect(node);suppressClick.current=false;}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();onSelect(node);}}} onMouseEnter={()=>setHovered(node.id)} onMouseLeave={()=>setHovered('')}>
          {stepIndex>=0&&!l&&<g className="journey-step-badge" transform="translate(-13 -13)"><circle r="11"/><text textAnchor="middle" dy="4">{stepIndex+1}</text></g>}<rect x={Math.min(-22,l?l.x-x:-22)} y="-40" width={Math.max(44,l?l.x-x+l.w:22)-Math.min(-22,l?l.x-x:-22)} height={l?Math.max(84,l.y-y+36):84} fill="transparent" className="node-hit-area"/><title>{describe(node).title} · {unchecked?'Unverified — not a clean result':node.evidenceLabel}{count>1?` · ${count} affected elements`:''}</title><circle r={radius*3.2} className="node-bloom" fill={nodeColor(node)} pointerEvents="none"/><circle r="18" fill="transparent" className="node-hit"/><circle r={radius} className="node-dot"/><circle r={selected?20:13} className="node-halo" pointerEvents="none"/><circle r={radius+6} className="node-pulse" pointerEvents="none"/>
          {l&&<><line x1="0" y1="0" x2={l.x-x+(l.x<x?l.w:0)} y2={l.y-y+17} className="label-leader" pointerEvents="none"/><g transform={`translate(${l.x-x} ${l.y-y})`} className="node-card"><rect width={l.w} height="34" rx="8"/><text x="12" y="22">{shown}{count>1?` · ${count}`:''}</text></g></>}
        </g>;})}
      </svg>{!guided&&refined&&scene.matchedCount===0&&<div className="map-no-results" role="status"><strong>No matching points</strong><span>Try a different page, severity, check, or search.</span><button className="button button-glass compact" onClick={clearFilters}>Clear filters</button></div>}<span className="map-coverage" aria-live="polite">{ripple?'Rings: pages one and two recorded actions away · every arrow was activated once in a disposable browser · open an arrow for its evidence':journey?`A travelling pulse follows the recorded route · hover a step to read its label · dashed = a possible connection, not activated${journey.findings.length>3?' · all observations in details':''}`:`${scene.nodes.length} focus points${scene.hiddenCount?` · ${scene.hiddenCount} more in List`:''}${refined?` · ${scene.matchedCount} matching elements`:''} · open a connection for evidence`}</span>
    </div>
    {edge&&edgeCopy&&<section className="edge-inspector" ref={edgePanel} tabIndex={-1} aria-label="Relationship details" onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();closeEdge();}}}>
      <div className="edge-inspector-head"><span className={`evidence-chip ${edgeCopy.evidence}`}>{edgeCopy.evidence==='untested'?'Not tested':edgeCopy.evidence}</span><button className="icon-btn" aria-label="Close relationship details" onClick={closeEdge}><Icon name="close" size={16}/></button></div>
      <h3>{edgeCopy.title}</h3><p>{edgeCopy.explanation}</p><div className="edge-endpoints">{[edgeCopy.source,edgeCopy.target].map((node,i)=>node&&<button key={`${i}-${node.id}`} onClick={()=>{onSelect(node);setEdge(null);}}>{i===0?'From':'To'}: {describe(node).short}<Icon name="arrow" size={14}/></button>)}</div>
    </section>}
    {!guided&&(selectedGroup||expanded.length>0)&&<div className="map-group-controls">{selectedGroup&&<button onClick={()=>setExpanded(ids=>[...ids,selectedGroup.id])}>Expand {Number(selectedGroup.data.groupCount)} findings on this page <Icon name="plus" size={14}/></button>}{expanded.length>0&&<button onClick={()=>setExpanded([])}>Collapse finding groups <Icon name="minus" size={14}/></button>}</div>}
    {ripple&&!journey&&<div className="journey-summary ripple-summary" role="status"><strong>The ripple of “{describe(ripple.finding).title}”</strong><span>{ripple.summary}</span></div>}
    {journey&&<div className="journey-summary" role="status"><strong>{cleanLabel(journey.control.label)}</strong><span>{journey.summary}</span></div>}
    <div className="canvas-bottom"><div className="graph-key"><span><i className="page-dot"/>Page</span><span><i className="critical-dot"/>Critical / serious</span><span><i className="issue-dot"/>Moderate / minor</span><span><i className="unverified-dot"/>Unverified</span><span><i className="error-dot"/>Browser signal</span></div><div className="canvas-actions"><button className={`icon-btn ${focus?'active':''}`} aria-label="Focus selected neighborhood" aria-pressed={focus} onClick={onFocus} title="Focus neighborhood"><Icon name="target" size={18}/></button><button className="icon-btn" onClick={fitView} aria-label="Fit map to screen" title="Fit map to screen (0)"><Icon name="map" size={17}/></button><button className="icon-btn" onClick={()=>{setView(INITIAL);setOffsets({});}} aria-label="Reset map view"><Icon name="refresh" size={17}/></button><span className="control-separator"/><button className="icon-btn" onClick={()=>setView(v=>({...v,zoom:Math.max(.35,v.zoom-.15)}))} aria-label="Zoom out"><Icon name="minus" size={17}/></button><span className="zoom-readout">{Math.round(view.zoom*100)}%</span><button className="icon-btn" onClick={()=>setView(v=>({...v,zoom:Math.min(2.5,v.zoom+.15)}))} aria-label="Zoom in"><Icon name="plus" size={17}/></button></div></div>
  </div>;
}
