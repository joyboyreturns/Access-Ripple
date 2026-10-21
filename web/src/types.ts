export type EvidenceLabel = 'observed' | 'inferred' | 'untested';
export type GraphNodeKind = 'site' | 'page' | 'control' | 'flow' | 'runtime-error' | 'accessibility-finding';
export type InteractionMode = 'safe' | 'include-submits';
export type InteractionOutcome = 'navigated' | 'content-changed' | 'dialog-opened' | 'validation-shown' | 'loading' | 'no-visible-change' | 'blocked' | 'failed';

export interface ScanCoverage {
  pagesInspected: number;
  pagesBlocked: number;
  pagesFailed: number;
  destinationsNotReached: number;
  destinationsBeyondDepth: number;
  stoppedBy: 'page-limit' | 'time-limit' | null;
  interactionsTested: number;
  interactionsSkipped: number;
}

export interface ScanSummary {
  id: string;
  inputUrl: string;
  status: string;
  createdAt: string;
  sample?: string;
  previousScanId?: string;
  pages: number;
  actionsTested: number;
}

export interface InteractionStepView {
  controlId: string;
  label: string;
  action: 'click';
  outcome: InteractionOutcome;
  summary: string;
  destinationUrl?: string;
  windowOpened?: string;
  dialog?: { type: string; message: string };
  revealed?: Array<{ name: string; role: string; href?: string }>;
  blockKind?: 'data-request' | 'external-navigation' | 'unsafe-url';
  errorIds: string[];
}

export interface InteractionEvidenceView {
  id: string;
  rootControlId: string;
  mode: InteractionMode;
  steps: InteractionStepView[];
  evidenceLabel: 'observed';
}

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
  /** Present when the scan ran against the built-in local demo site rather than a public address. */
  sample?: 'checkout';
  interactionPolicy?: { mode: InteractionMode; tested: number; skipped: number };
  coverage?: ScanCoverage;
}

export interface SampleInfo {
  id: 'checkout';
  name: string;
  tagline: string;
  url: string;
  variant: 'before' | 'after';
  brokenNote: string;
  fixedNote: string;
}

export interface ScanComparison {
  previousScanId: string;
  currentScanId: string;
  resolved: GraphNode[];
  remaining: GraphNode[];
  new: GraphNode[];
  changed: Array<{ before: GraphNode; after: GraphNode }>;
  /** The same page before and after, so a repair can be shown and not only counted. */
  pages: Array<{ url: string; title?: string; before?: string; after?: string }>;
}

/** A concrete change a model proposes for one finding, grounded in the recorded markup. */
export interface FixProposal {
  nodeId: string;
  ruleId: string;
  summary: string;
  before: string;
  after: string;
  why: string;
  location?: { file: string; line: number };
  model: string;
}
