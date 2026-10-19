export type EvidenceLabel = 'observed' | 'inferred' | 'untested';
export type ScanStatus = 'queued' | 'running' | 'complete' | 'partial' | 'failed';

export type GraphNodeKind = 'site' | 'page' | 'control' | 'flow' | 'runtime-error' | 'accessibility-finding';
export type GraphEdgeKind = 'contains' | 'links-to' | 'has-control' | 'may-lead-to' | 'has-error' | 'has-finding' | 'failed-at';

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
  kind: GraphEdgeKind;
  source: string;
  target: string;
  evidenceLabel: EvidenceLabel;
  data?: Record<string, unknown>;
}

export interface SiteGraph {
  schemaVersion: '1.0';
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ControlEvidence {
  id: string;
  role: string;
  accessibleName?: string;
  selector?: string;
  href?: string;
  formAction?: string;
  method?: string;
  evidenceLabel: EvidenceLabel;
}

export type InteractionMode = 'safe' | 'include-submits';

export type InteractionOutcome =
  | 'navigated'
  | 'content-changed'
  | 'dialog-opened'
  | 'validation-shown'
  | 'loading'
  | 'no-visible-change'
  | 'blocked'
  | 'failed';

export interface RevealedControlEvidence {
  name: string;
  role: string;
  href?: string;
}

export interface InteractionStep {
  controlId: string;
  label: string;
  action: 'click';
  outcome: InteractionOutcome;
  summary: string;
  destinationUrl?: string;
  windowOpened?: string;
  dialog?: { type: string; message: string };
  revealed?: RevealedControlEvidence[];
  errorIds: string[];
}

export interface InteractionEvidence {
  id: string;
  rootControlId: string;
  mode: InteractionMode;
  steps: InteractionStep[];
  evidenceLabel: 'observed';
}

export type InteractionExclusionReason = 'requires-authorization' | 'consequential-action' | 'budget';

export interface InteractionExclusion {
  controlId: string;
  reason: InteractionExclusionReason;
}

export interface RuntimeErrorEvidence {
  id: string;
  kind: 'page' | 'console' | 'request' | 'http';
  message: string;
  url?: string;
  statusCode?: number;
  evidenceLabel: 'observed';
}

export interface AccessibilityEvidence {
  id: string;
  ruleId: string;
  impact: string;
  status: 'detected' | 'needs-review';
  help: string;
  helpUrl: string;
  targets: string[];
  affectedControlIds?: string[];
  snippet?: string;
  evidenceLabel: 'observed';
}

export interface PageEvidence {
  id: string;
  url: string;
  title?: string;
  status: 'complete' | 'failed' | 'skipped';
  depth: number;
  controls: ControlEvidence[];
  errors: RuntimeErrorEvidence[];
  findings: AccessibilityEvidence[];
  outgoingLinks: string[];
  interactions: InteractionEvidence[];
  interactionExclusions?: InteractionExclusion[];
  errorMessage?: string;
}

export interface ScanLimits {
  maxPages: number;
  maxDepth: number;
  navigationTimeoutMs: number;
  totalTimeoutMs: number;
  maxControlsPerPage: number;
  maxRequestsPerPage?: number;
  maxFindingsPerPage: number;
  maxInteractionsPerPage: number;
  maxInteractionsPerScan: number;
}

export interface ScanProgress {
  completedPages: number;
  totalPageLimit: number;
  currentUrl?: string;
  message: string;
}

export interface ScanResult {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: ScanStatus;
  inputUrl: string;
  canonicalOrigin?: string;
  sample?: 'checkout';
  limits: ScanLimits;
  progress: ScanProgress;
  pages: PageEvidence[];
  graph?: SiteGraph;
  previousScanId?: string;
  interactionPolicy?: { mode: InteractionMode; tested: number; skipped: number };
  error?: { code: string; message: string; retryable: boolean };
}
