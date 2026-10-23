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
  /** Why a blocked outcome happened: a data-changing request, a navigation off the tested website, or an unsafe URL. */
  blockKind?: 'data-request' | 'external-navigation' | 'unsafe-url';
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
  /** The check's own tags, such as "wcag111", which name the success criterion. */
  tags?: string[];
  /** Where the failing element sat on the page, in page coordinates, when it was visible. */
  boundingBox?: { x: number; y: number; width: number; height: number };
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
  /** A small picture of the rendered page, kept only for pages that have something to show. */
  screenshot?: { dataUrl: string };
  /**
   * Changes the scanner applied inside its own browser before checking this
   * page. When any applied, this page is a simulation of the change, not the
   * live site, and must be labelled as one.
   */
  simulatedPatches?: SimulatedPatchOutcome[];
}

/** One change the scanner tried to simulate on a page, and whether the recorded markup was still there to change. */
export interface SimulatedPatchOutcome {
  id: string;
  nodeId: string;
  summary: string;
  selector: string;
  before: string;
  after: string;
  applied: boolean;
  /** Why a change was not applied: the element was gone, or its markup no longer matched. */
  reason?: string;
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
  /** How many page pictures a scan keeps. */
  maxScreenshots?: number;
}

export interface ScanProgress {
  completedPages: number;
  totalPageLimit: number;
  currentUrl?: string;
  message: string;
  /** How long the scan has left before it stops, so the wait is bounded on screen. */
  remainingMs?: number;
}

/** Plain-language account of what the scan covered and what it left out, with reasons. */
export interface ScanCoverage {
  pagesInspected: number;
  pagesBlocked: number;
  pagesFailed: number;
  destinationsNotReached: number;
  destinationsBeyondDepth: number;
  stoppedBy: 'page-limit' | 'time-limit' | null;
  interactionsTested: number;
  interactionsSkipped: number;
  /** Controls the scan never had the budget to consider, beyond the ones it deliberately skipped. */
  controlsNotReached?: number;
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
  /** Whether this scan reached a public address, or one on the scanner's own computer. */
  addressScope?: 'public' | 'private';
  /** Changes simulated in the scanner's browser on this scan. A rescan carries them forward. */
  simulatedPatches?: Array<{ id: string; scanId: string; pageUrl: string; ruleId: string; nodeId: string; selector: string; before: string; after: string; summary: string; appliedAt: string }>;
  /** For the demo shop: which fixture state this scan read, so a comparison can say whether a prepared fix or an applied change separates two scans. */
  fixtureState?: { variant: 'before' | 'after'; appliedChanges: number };
  coverage?: ScanCoverage;
  error?: { code: string; message: string; retryable: boolean };
}
