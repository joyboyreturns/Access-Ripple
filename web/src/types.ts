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
  /** Controls the scan never had the budget to consider. */
  controlsNotReached?: number;
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
  /** The control the browser activated, when a view draws a page-to-page step. */
  via?: string;
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
  progress: { completedPages: number; totalPageLimit: number; message: string; currentUrl?: string; remainingMs?: number };
  pages: Array<{ id: string; url: string; title?: string; status: string; findings: unknown[]; controls: unknown[]; screenshot?: { dataUrl: string }; simulatedPatches?: Array<{ summary: string; applied: boolean; reason?: string }> }>;
  error?: { message: string };
  previousScanId?: string;
  canonicalOrigin?: string;
  createdAt?: string;
  /** Present when the scan ran against the built-in local demo site rather than a public address. */
  sample?: 'checkout';
  interactionPolicy?: { mode: InteractionMode; tested: number; skipped: number };
  /** Present when the scan reached an address on the scanner's own computer, with the person's permission. */
  addressScope?: 'public' | 'private';
  coverage?: ScanCoverage;
}

export interface SampleInfo {
  /** True when an accepted change is still applied to the demo shop. */
  patched?: boolean;
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
  /** True when both scans ran against the built-in demo shop rather than a public site. */
  demoShop: boolean;
  /** Findings whose page was not inspected again, so they are unknown rather than resolved. */
  notRechecked: GraphNode[];
  /** What the model predicted before the change, and what the browser recorded after it. */
  predictions?: Array<{ issueId: string; expected: 'absent' | 'present'; reason: string; label?: string; observed?: 'absent' | 'present' | 'not rechecked'; outcome?: 'supported' | 'contradicted' | 'not rechecked'; simulated?: boolean }>;
  /** For the demo shop: a prepared fix, a change applied to its in-memory copy, or nothing recorded between the two scans. */
  repair?: 'prepared-fix' | 'applied-change' | 'no-change';
  /** Pages of the later scan where a change was simulated in the scanner's browser. */
  simulatedPages?: Array<{ url: string; applied: number; notApplied: number }>;
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
  /** The success criterion the failing check maps to. */
  wcagCriterion?: string;
  /** The model's account of what a screen reader or keyboard user meets. */
  assistiveTechImpact?: string;
  /** The change as a unified diff, built by the tool. */
  unifiedDiff?: string;
  model: string;
}
