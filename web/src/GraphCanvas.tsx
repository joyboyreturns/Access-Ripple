import { useEffect, useMemo, useRef, useState, type PointerEvent, type KeyboardEvent, type CSSProperties } from 'react';
import Icon from './Icons';
import { describe, nodeColor, pageFor, sceneGraph, type GraphFilter, type ViewNode } from './presentation';
import type { SiteGraph } from './types';

interface Props { graph: SiteGraph; filter: GraphFilter; selectedId: string; focus: boolean; onSelect: (node: ViewNode) => void; onFocus: () => void }
const INITIAL = { yaw: 0, pitch: .16, zoom: 1, panX: 0, panY: 0 };
export default function GraphCanvas({ graph, filter, selectedId, focus, onSelect, onFocus }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 900, h: 620 });
  const [view, setView] = useState(INITIAL);
  const [mode, setMode] = useState<'orbit' | 'pan'>('orbit');
  const [hovered, setHovered] = useState('');
  const drag = useRef<{ id: number; x: number; y: number; view: typeof INITIAL } | null>(null);
  useEffect(() => { if (!stage.current) return; const observer = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height })); observer.observe(stage.current); return () => observer.disconnect(); }, []);
  useEffect(() => { setView(INITIAL); }, [graph]);
  const scene = useMemo(() => sceneGraph(graph, filter, focus ? selectedId : undefined), [graph, filter, focus, selectedId]);
  const representativeId = scene.nodes.find(n => n.id === selectedId || n.memberIds?.includes(selectedId))?.id ?? selectedId;
  const related = new Set(scene.edges.filter(e => e.source === representativeId || e.target === representativeId).flatMap(e => [e.source, e.target]));
  const positioned = useMemo(() => {
    const pages = scene.nodes.filter(n => n.kind === 'page');
    const r = Math.min(size.w * .24, size.h * .28, 210);
    const world = new Map<string, { x: number; y: number; z: number }>();
    scene.nodes.filter(n => n.kind === 'site').forEach(n => world.set(n.id, { x: 0, y: 0, z: 0 }));
    pages.forEach((n, i) => { const a = -Math.PI / 2 + i * Math.PI * 2 / pages.length; world.set(n.id, { x: Math.cos(a) * r, y: Math.sin(a) * r, z: (i % 2 ? -1 : 1) * 45 }); });
    const groups = new Map<string, ViewNode[]>();
    scene.nodes.filter(n => n.kind !== 'site' && n.kind !== 'page').forEach(n => { const key = pageFor(n, graph)?.id ?? pages[0]?.id ?? 'root'; groups.set(key, [...(groups.get(key) ?? []), n]); });
    groups.forEach((nodes, key) => { const pi = Math.max(0, pages.findIndex(n => n.id === key)); nodes.forEach((n, i) => { const a = pi * Math.PI * 2 / Math.max(1, pages.length) + i * Math.PI * 2 / nodes.length + .35; const ring = r * (1.35 + (i % 2) * .28); world.set(n.id, { x: Math.cos(a) * ring, y: Math.sin(a) * ring * .8, z: Math.sin(a * 2 + pi) * 70 }); }); });
    return scene.nodes.map(node => { const p = world.get(node.id) ?? { x: 0, y: 0, z: 0 }; const x = p.x * Math.cos(view.yaw) + p.z * Math.sin(view.yaw), z = -p.x * Math.sin(view.yaw) + p.z * Math.cos(view.yaw); const y = p.y * Math.cos(view.pitch) - z * Math.sin(view.pitch), depth = p.y * Math.sin(view.pitch) + z * Math.cos(view.pitch), perspective = 750 / (750 + depth); return { node, x: size.w / 2 + x * perspective * view.zoom + view.panX, y: size.h / 2 + y * perspective * view.zoom + view.panY, z: depth }; });
  }, [scene, graph, size, view]);
  const points = new Map(positioned.map(p => [p.node.id, p]));
  const labels = useMemo(() => {
    const candidates = positioned.filter(p => (size.w > 600 && scene.nodes.length <= 15) || p.node.kind === 'site' || p.node.kind === 'page' || p.node.id === representativeId || p.node.id === hovered);
    const result = new Map<string, { x: number; y: number; w: number }>();
    for (const side of [-1, 1]) { const items = candidates.filter(p => (p.x < size.w / 2 ? -1 : 1) === side).sort((a,b)=>a.y-b.y); let previous=24; items.forEach((p,i)=> { const w=Math.min(196,Math.max(112,describe(p.node).short.slice(0,25).length*6.8+30)); const y=Math.max(24+i*43,Math.min(size.h-48-(items.length-1-i)*43,Math.max(previous,p.y-17))); const x=Math.max(12,Math.min(size.w-w-12,side<0?p.x-w-18:p.x+18)); result.set(p.node.id,{x,y,w});previous=y+43; }); }
    return result;
  }, [positioned, hovered, scene.nodes.length, representativeId, size]);
  function down(e: PointerEvent<SVGSVGElement>) { if ((e.target as Element).closest('[data-node]')) return; drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,view};e.currentTarget.setPointerCapture(e.pointerId); }
  function move(e: PointerEvent<SVGSVGElement>) { const d=drag.current;if(!d||d.id!==e.pointerId)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;setView(mode==='pan'?{...d.view,panX:d.view.panX+dx,panY:d.view.panY+dy}:{...d.view,yaw:d.view.yaw+dx*.008,pitch:Math.max(-.9,Math.min(.9,d.view.pitch+dy*.005))}); }
  function up(e: PointerEvent<SVGSVGElement>) {drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}
  function keyDown(e: KeyboardEvent<SVGSVGElement>) {
    if ((e.target as Element).closest('[data-node]') || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(e.key)) return;
    e.preventDefault();
    const horizontal = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    const vertical = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    setView(v => ({ ...v,
      yaw: v.yaw + (mode === 'orbit' ? horizontal * .15 : 0),
      pitch: Math.max(-.9, Math.min(.9, v.pitch + (mode === 'orbit' ? vertical * .1 : 0))),
      panX: v.panX + (mode === 'pan' ? horizontal * 22 : 0),
      panY: v.panY + (mode === 'pan' ? vertical * 22 : 0),
      zoom: Math.min(1.8, Math.max(.55, v.zoom + (e.key === '+' ? .1 : e.key === '-' ? -.1 : 0))),
    }));
  }
  return <div className="canvas-wrap">
    <div className="canvas-top"><span className="canvas-caption"><i/> LIVE RELATIONSHIPS</span><div className="segmented small"><button className={mode==='orbit'?'active':''} onClick={()=>setMode('orbit')} aria-pressed={mode==='orbit'}>Orbit</button><button className={mode==='pan'?'active':''} onClick={()=>setMode('pan')} aria-pressed={mode==='pan'}>Pan</button></div></div>
    <div className="graph-stage" ref={stage}><div className="canvas-glow" aria-hidden="true"/>
      <svg width="100%" height="100%" viewBox={`0 0 ${size.w} ${size.h}`} className="graph-svg" aria-label={`Interactive website map. Drag to ${mode}. Arrow keys ${mode === 'pan' ? 'pan' : 'rotate'}, plus and minus zoom. Each labeled point opens details.`} role="group" tabIndex={0} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={keyDown}>
        <defs><radialGradient id="sceneHalo"><stop stopColor="#a7dcc6" stopOpacity=".14"/><stop offset="1" stopColor="#a7dcc6" stopOpacity="0"/></radialGradient></defs>
        <g className="scene-rings" pointerEvents="none"><ellipse cx={size.w/2} cy={size.h/2} rx={Math.min(size.w*.35,260)} ry={Math.min(size.h*.32,190)}/><ellipse cx={size.w/2} cy={size.h/2} rx={Math.min(size.w*.43,330)} ry={Math.min(size.h*.42,250)}/><circle cx={size.w/2} cy={size.h/2} r="130" fill="url(#sceneHalo)" stroke="none"/></g>
        {scene.edges.map(e=>{const a=points.get(e.source),b=points.get(e.target);if(!a||!b)return null;return <path key={`${e.source}-${e.target}-${e.kind}`} d={`M${a.x},${a.y} Q${(a.x+b.x)/2+12},${(a.y+b.y)/2-10} ${b.x},${b.y}`} className={`connection-path ${e.source===representativeId||e.target===representativeId?'selected':''} ${e.evidenceLabel!=='observed'?'inferred':''}`} pointerEvents="none"/>;})}
        {[...positioned].sort((a,b)=>b.z-a.z).map(({node,x,y})=>{const selected=selectedId===node.id||Boolean(node.memberIds?.includes(selectedId)),l=labels.get(node.id),short=describe(node).short,count=Number(node.data.groupCount)||1;return <g key={node.id} transform={`translate(${x} ${y})`} data-node={node.id} role="button" tabIndex={0} aria-label={`${short}${count>1?`, ${count} findings`:''}`} className={`map-node ${selected?'selected':''} ${related.has(node.id)?'related':''}`} style={{'--node-color':nodeColor(node)} as CSSProperties} onPointerDown={e=>e.stopPropagation()} onClick={()=>onSelect(node)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();onSelect(node);}}} onMouseEnter={()=>setHovered(node.id)} onMouseLeave={()=>setHovered('')}>
          <title>{describe(node).title}{count>1?` · ${count} affected elements`:''}</title><circle r="18" fill="transparent" className="node-hit"/><circle r={node.kind==='site'?12:node.kind==='page'?9:6.5} className="node-dot"/><circle r={selected?20:13} className="node-halo" pointerEvents="none"/>
          {l&&<><line x1="0" y1="0" x2={l.x-x+(l.x<x?l.w:0)} y2={l.y-y+17} className="label-leader" pointerEvents="none"/><g transform={`translate(${l.x-x} ${l.y-y})`} className="node-card"><rect width={l.w} height="34" rx="8"/><text x="12" y="22">{short.length>25?`${short.slice(0,24)}…`:short}{count>1?` · ${count}`:''}</text></g></>}
        </g>;})}
      </svg><span className="map-coverage">{scene.nodes.length} focus points · full inventory in List</span>
    </div>
    <div className="canvas-bottom"><div className="graph-key"><span><i className="page-dot"/>Page</span><span><i className="issue-dot"/>Accessibility</span><span><i className="error-dot"/>Browser signal</span></div><div className="canvas-actions"><button className={`icon-btn ${focus?'active':''}`} aria-label="Focus selected neighborhood" aria-pressed={focus} onClick={onFocus} title="Focus neighborhood"><Icon name="target" size={18}/></button><button className="icon-btn" onClick={()=>setView(INITIAL)} aria-label="Reset map view"><Icon name="refresh" size={17}/></button><span className="control-separator"/><button className="icon-btn" onClick={()=>setView(v=>({...v,zoom:Math.max(.55,v.zoom-.15)}))} aria-label="Zoom out"><Icon name="minus" size={17}/></button><span className="zoom-readout">{Math.round(view.zoom*100)}%</span><button className="icon-btn" onClick={()=>setView(v=>({...v,zoom:Math.min(1.8,v.zoom+.15)}))} aria-label="Zoom in"><Icon name="plus" size={17}/></button></div></div>
  </div>;
}
