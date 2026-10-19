import { describe as describeNode, groupIssues, sceneGraph, traceJourney } from '../../web/src/presentation.js';
import type { GraphNode, InteractionStepView, SiteGraph } from '../../web/src/types.js';
import { describe as suite, it, expect } from 'vitest';

const finding = (id:string,pageId='p1',target='#one'):GraphNode => ({id,kind:'accessibility-finding',label:'Links must be distinguishable',pageId,evidenceLabel:'observed',data:{ruleId:'link-in-text-block',targets:[target]}});
const site:GraphNode={id:'site',kind:'site',label:'example.com',data:{},evidenceLabel:'observed'};
const page:GraphNode={id:'p1',kind:'page',label:'Home',data:{url:'https://example.com/'},evidenceLabel:'observed'};

suite('human-readable graph presentation',()=>{
  it('groups repeated findings without losing evidence or changing the source graph',()=>{
    const nodes=[finding('f1'),finding('f2','p1','#two'),finding('f3','p2','#three')];
    const grouped=groupIssues(nodes);
    expect(grouped).toHaveLength(2);
    expect(grouped[0]!.memberIds).toEqual(['f1','f2']);
    expect(grouped[0]!.data.targets).toEqual(['#one','#two']);
    expect(grouped[0]!.data.groupCount).toBe(2);
    expect(nodes[0]!.data).not.toHaveProperty('groupCount');
  });
  it('does not merge unrelated findings when a rule identifier is missing',()=>{
    const one={...finding('f1'),label:'Missing label',data:{}};
    const two={...finding('f2'),label:'Missing description',data:{}};
    expect(groupIssues([one,two])).toHaveLength(2);
  });
  it('keeps grouped graph connections valid, including when an individual member is focused',()=>{
    const graph:SiteGraph={schemaVersion:'1.0',nodes:[site,page,finding('f1'),finding('f2')],edges:[{id:'e1',kind:'contains',source:'site',target:'p1',evidenceLabel:'observed'},{id:'e2',kind:'has-finding',source:'p1',target:'f1',evidenceLabel:'observed'},{id:'e3',kind:'has-finding',source:'p1',target:'f2',evidenceLabel:'observed'}]};
    const scene=sceneGraph(graph,'overview','f2');
    const ids=new Set(scene.nodes.map(n=>n.id));
    expect(scene.nodes.find(n=>n.id==='f1')?.memberIds).toContain('f2');
    expect(scene.edges.some(e=>e.source==='p1'&&e.target==='f1')).toBe(true);
    expect(scene.edges.every(e=>ids.has(e.source)&&ids.has(e.target))).toBe(true);
  });
  it('does not present a browser security diagnostic as proof of a broken journey',()=>{
    const node:GraphNode={id:'e',kind:'runtime-error',label:'net::ERR_BLOCKED_BY_ORB',data:{kind:'request'},evidenceLabel:'observed'};
    expect(describeNode(node).meaning).toContain('does not by itself prove');
    expect(describeNode(finding('f')).fix).toContain('underline');
  });
});

suite('selected control journeys',()=>{
  const control:GraphNode={id:'c',kind:'control',label:'Checkout',pageId:'p1',data:{selector:'#checkout'},evidenceLabel:'observed'};
  const flow:GraphNode={id:'flow',kind:'flow',label:'May lead to /checkout',data:{sourceControlId:'c',destinationUrl:'https://example.com/checkout',outcome:'not-tested'},evidenceLabel:'inferred'};
  const destination:GraphNode={...page,id:'p2',label:'Checkout',data:{url:'https://example.com/checkout'}};
  function graph(extra:GraphNode[]=[],withDestination=true):SiteGraph{return {schemaVersion:'1.0',nodes:[site,page,control,flow,...(withDestination?[destination]:[]),...extra],edges:[
    {id:'a',kind:'has-control',source:'p1',target:'c',evidenceLabel:'observed'},
    {id:'b',kind:'may-lead-to',source:'c',target:'flow',evidenceLabel:'inferred'},
    ...(withDestination?[{id:'d',kind:'links-to',source:'flow',target:'p2',evidenceLabel:'inferred' as const}]:[]),
    ...extra.map(n=>({id:n.id,kind:'has-finding',source:n.pageId==='p2'?'p2':'p1',target:n.id,evidenceLabel:'observed' as const}))]};}
  it('follows page to button to destination, including from a flow selection',()=>{
    const result=traceJourney(graph(),'flow')!;
    expect(result.steps.map(s=>s.node.id)).toEqual(['p1','c','flow','p2']);
    expect(result.summary).toContain('click itself is untested');
    expect(result.observed).toBe(false);
    expect(result.edges.find(e=>e.id==='b')?.evidenceLabel).toBe('inferred');
  });
  it('includes destination observations and exact control matches, not unrelated page findings',()=>{
    const g=graph([finding('unrelated'),finding('exact','p1','#checkout'),finding('destination','p2')]);
    g.edges.push({id:'ctrl-exact',kind:'has-finding',source:'c',target:'exact',evidenceLabel:'observed'});
    const result=traceJourney(g,'c')!;
    expect(result.findings.map(f=>f.node.id)).toEqual(['exact','destination']);
    expect(result.findings.find(f=>f.node.id==='exact')?.caption).toContain('on this control');
    expect(result.findings.find(f=>f.node.id==='destination')?.caption).toContain('not proof');
    expect(result.summary).toContain('do not prove the click fails');
  });
  it('states when the destination was not scanned without inventing failures',()=>{
    const result=traceJourney(graph([],false),'c')!;
    expect(result.steps).toHaveLength(3);
    expect(result.summary).toContain('outcome is unknown');
    expect(result.findings).toEqual([]);
  });
  it('explains controls without destinations and rejects non-controls',()=>{
    const g=graph();g.nodes=g.nodes.filter(n=>n.id!=='flow');g.edges=g.edges.filter(e=>e.id!=='b'&&e.id!=='d');
    expect(traceJourney(g,'c')?.summary).toContain('script-driven behavior');
    expect(traceJourney(g,'p1')).toBeNull();
  });
});

suite('observed journeys',()=>{
  const control:GraphNode={id:'c',kind:'control',label:'Continue to payment',pageId:'p1',data:{selector:'#pay'},evidenceLabel:'observed'};
  const destination:GraphNode={...page,id:'p2',label:'Payment',data:{url:'https://example.com/payment'}};
  function observedGraph(extra:GraphNode[]=[],errorIds:string[]=['err']):SiteGraph{
    const steps:InteractionStepView[]=[{controlId:'c',label:'Continue to payment',action:'click',outcome:'navigated',summary:'Navigated to /payment.',destinationUrl:'https://example.com/payment',errorIds}];
    const flow:GraphNode={id:'flow',kind:'flow',label:'Leads to /payment',evidenceLabel:'observed',data:{sourceControlId:'c',outcome:'navigated',destinationUrl:'https://example.com/payment',tested:true,errorIds,steps,summary:'Activated “Continue to payment” navigated to /payment'},pageId:'p1'};
    const error:GraphNode={id:'err',kind:'runtime-error',label:'simulated payment gateway timeout',pageId:'p2',data:{kind:'console'},evidenceLabel:'observed'};
    return {schemaVersion:'1.0',nodes:[site,page,control,flow,destination,error,...extra],edges:[
      {id:'a',kind:'has-control',source:'p1',target:'c',evidenceLabel:'observed'},
      {id:'b',kind:'may-lead-to',source:'c',target:'flow',evidenceLabel:'observed'},
      {id:'d',kind:'links-to',source:'flow',target:'p2',evidenceLabel:'observed'},
      {id:'f',kind:'failed-at',source:'flow',target:'err',evidenceLabel:'observed'},
      {id:'g',kind:'has-error',source:'p2',target:'err',evidenceLabel:'observed'},
      ...extra.map(n=>({id:`x-${n.id}`,kind:'has-error',source:n.pageId==='p1'?'p1':'p2',target:n.id,evidenceLabel:'observed' as const}))]};
  }
  it('presents an activated action and attributes errors recorded while it ran',()=>{
    const result=traceJourney(observedGraph(),'c')!;
    expect(result.observed).toBe(true);
    expect(result.steps.map(s=>s.node.id)).toEqual(['p1','c','flow','p2']);
    expect(result.steps[1]!.caption).toContain('activated');
    expect(result.steps[2]!.caption).toContain('Observed navigation');
    const attributed=result.findings.find(f=>f.node.id==='err');
    expect(attributed?.caption).toContain('while this action ran');
    expect(result.summary).toContain('activated once');
  });
  it('does not blame the action for unrelated warnings on its own start page',()=>{
    const unrelated:GraphNode={id:'noise',kind:'runtime-error',label:'unrelated console warning',pageId:'p1',data:{kind:'console'},evidenceLabel:'observed'};
    const result=traceJourney(observedGraph([unrelated]),'c')!;
    expect(result.findings.some(f=>f.node.id==='noise')).toBe(false);
  });
  it('chains observed navigation across independently inspected pages',()=>{
    const nextControl:GraphNode={id:'c2',kind:'control',label:'Proceed to checkout',pageId:'p2',data:{},evidenceLabel:'observed'};
    const nextPage:GraphNode={...page,id:'p3',label:'Checkout',data:{url:'https://example.com/checkout'}};
    const nextSteps:InteractionStepView[]=[{controlId:'c2',label:'Proceed to checkout',action:'click',outcome:'navigated',summary:'Navigated to /checkout.',destinationUrl:'https://example.com/checkout',errorIds:[]}];
    const nextFlow:GraphNode={id:'flow2',kind:'flow',label:'Leads to /checkout',evidenceLabel:'observed',data:{sourceControlId:'c2',outcome:'navigated',destinationUrl:'https://example.com/checkout',tested:true,errorIds:[],steps:nextSteps},pageId:'p2'};
    const graph=observedGraph();graph.nodes.push(nextControl,nextFlow,nextPage);graph.edges.push(
      {id:'h',kind:'has-control',source:'p2',target:'c2',evidenceLabel:'observed'},
      {id:'i',kind:'may-lead-to',source:'c2',target:'flow2',evidenceLabel:'observed'},
      {id:'j',kind:'links-to',source:'flow2',target:'p3',evidenceLabel:'observed'});
    const result=traceJourney(graph,'c')!;
    expect(result.steps.map(s=>s.node.id)).toEqual(['p1','c','flow','p2','c2','flow2','p3']);
    expect(result.summary).toContain('continued through 1 more');
  });
});
