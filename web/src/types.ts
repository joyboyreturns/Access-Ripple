export type EvidenceLabel = 'observed' | 'inferred' | 'untested';
export type GraphNodeKind = 'site' | 'page' | 'control' | 'flow' | 'runtime-error' | 'accessibility-finding';

export interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  label: string;
  status?: 'clear' | 'detected' | 'needs-review' | 'error' | 'untested';
  evidenceLabel: EvidenceLabel;
  pageId?: string;
  data: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  kind: string;
  source: string;
  target: string;
  evidenceLabel: EvidenceLabel;
}

export interface SiteGraph {
  schemaVersion: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ScanResult {
  id: string;
  status: 'queued' | 'running' | 'complete' | 'partial' | 'failed';
  inputUrl: string;
  progress: { completedPages: number; totalPageLimit: number; message: string; currentUrl?: string };
  pages: Array<{ id: string; url: string; title?: string; status: string; findings: unknown[]; controls: unknown[] }>;
  error?: { message: string };
  previousScanId?: string;
  canonicalOrigin?: string;
  createdAt?: string;
}

export interface ScanComparison {
  previousScanId: string;
  currentScanId: string;
  resolved: GraphNode[];
  remaining: GraphNode[];
  new: GraphNode[];
  changed: Array<{ before: GraphNode; after: GraphNode }>;
}
