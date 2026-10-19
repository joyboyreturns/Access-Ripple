import JSZip from 'jszip';
import type { GraphNode, ScanResult } from '../graph/schema.js';

function safeName(value: string): string {
  return value.normalize('NFKD').replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/[ _]+/g, '-').slice(0, 60) || 'note';
}
function md(value: unknown): string {
  return String(value ?? '').replace(/[<>]/g, '').replace(/\r/g, '').slice(0, 500);
}
function frontmatter(node: GraphNode): string {
  return `---\naccessripple_id: "${node.id}"\nkind: "${node.kind}"\nstatus: "${node.status ?? 'unknown'}"\nevidence: "${node.evidenceLabel}"\n---\n`;
}

export async function createObsidianZip(scan: ScanResult): Promise<Buffer> {
  if (!scan.graph) throw new Error('A graph is not available for this scan yet.');
  const zip = new JSZip();
  const root = zip.folder('AccessRipple Vault')!;
  const paths = new Map<string, string>();
  const used = new Set<string>();
  for (const node of scan.graph.nodes) {
    let base = safeName(node.label);
    let name = `${base}.md`;
    let suffix = 2;
    while (used.has(name.toLowerCase())) name = `${base}-${suffix++}.md`;
    used.add(name.toLowerCase());
    paths.set(node.id, name);
  }
  const edgeIndex = new Map<string, typeof scan.graph.edges>();
  for (const edge of scan.graph.edges) {
    const items = edgeIndex.get(edge.source) ?? [];
    items.push(edge);
    edgeIndex.set(edge.source, items);
  }
  const startLines = [
    '# AccessRipple scan', '',
    `- Scan ID: \`${scan.id}\``,
    `- Status: **${scan.status}**`,
    `- Started: ${scan.createdAt}`,
    `- Pages inspected: ${scan.pages.filter((page) => page.status === 'complete').length} of ${scan.pages.length}`, '',
    '## Graph notes',
  ];
  for (const node of scan.graph.nodes.filter((item) => item.kind === 'site' || item.kind === 'page')) {
    const path = paths.get(node.id);
    if (path) startLines.push(`- [[${path.replace(/\.md$/, '')}|${md(node.label)}]]`);
  }
  root.file('AccessRipple Start.md', `${startLines.join('\n')}\n`);

  for (const node of scan.graph.nodes) {
    const details = Object.entries(node.data).filter(([, value]) => value !== undefined && value !== null && typeof value !== 'object').map(([key, value]) => `- **${md(key)}:** ${md(value)}`);
    const links = (edgeIndex.get(node.id) ?? []).map((edge) => {
      const target = paths.get(edge.target);
      if (!target) return '';
      return `- **${md(edge.kind)}** (${edge.evidenceLabel}): [[${target.replace(/\.md$/, '')}|${md(scan.graph!.nodes.find((item) => item.id === edge.target)?.label ?? target)}]]`;
    }).filter(Boolean);
    root.file(paths.get(node.id)!, `${frontmatter(node)}\n# ${md(node.label)}\n\n- Type: ${node.kind}\n- Evidence: ${node.evidenceLabel}\n${details.join('\n')}\n\n## Connected evidence\n${links.length ? links.join('\n') : '- No outgoing connections.'}\n`);
  }
  root.file('graph.json', JSON.stringify(scan.graph, null, 2));
  root.file('scan-summary.json', JSON.stringify({ id: scan.id, createdAt: scan.createdAt, status: scan.status, inputUrl: scan.inputUrl, limits: scan.limits, progress: scan.progress, pages: scan.pages.map(({ id, url, title, status, depth, errorMessage }) => ({ id, url, title, status, depth, errorMessage })) }, null, 2));
  const output = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  if (output.length > 15 * 1024 * 1024) throw new Error('The export is larger than the 15 MB limit.');
  return output;
}
