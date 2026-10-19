import { describe, groupIssues, sceneGraph } from '../../web/src/presentation.js';
import type { GraphNode, SiteGraph } from '../../web/src/types.js';
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
    expect(describe(node).meaning).toContain('does not by itself prove');
    expect(describe(finding('f')).fix).toContain('underline');
  });
});
