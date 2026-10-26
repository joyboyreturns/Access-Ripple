/**
 * The guided tour doubles as the recording script and as on-screen captions.
 * Each step carries the sentence to say out loud, so a silent recording still
 * tells the reviewer what is happening and why it matters.
 */
export type TourContext = {
  hasScan: boolean;
  /** Counts how many times the viewer opened a finding. */
  findingOpened: number;
  /** Counts how many times the viewer traced a journey. */
  journeyTraced: number;
  /** Counts how many times a change was proposed. */
  changeProposed: number;
  /** Counts how many times a rescan produced a comparison. */
  compared: boolean;
};

export type TourStep = {
  id: string;
  title: string;
  say: string;
  /** True once the viewer has reached the state this step describes. */
  done: (context: TourContext) => boolean;
};

export const TOUR: TourStep[] = [
  {
    id: 'argument',
    title: 'The problem, in one line',
    say: 'A list tells you what failed. I also need to know how someone reaches it. AccessRipple connects the finding to the journey a control actually took.',
    done: () => false,
  },
  {
    id: 'scan',
    title: 'A real scan, in ten seconds',
    say: 'A real browser, on this computer. It opens pages, clicks safe controls once each in disposable pages, and records what actually happened.',
    done: (context) => context.hasScan,
  },
  {
    id: 'finding',
    title: 'The barrier, and the route to it',
    say: 'Here is the barrier, who the check protects, and its ripple: every recorded action that leads a visitor to this page and on from it. That is how I choose what to investigate.',
    done: (context) => context.findingOpened > 0,
  },
  {
    id: 'journey',
    title: 'Follow one journey',
    say: 'These are the observations the browser recorded. Each one really happened. How they join into one route is the tool\'s reading of them, and anything untested stays marked.',
    done: (context) => context.journeyTraced > 0,
  },
  {
    id: 'proposal',
    title: 'Let the model propose a change',
    say: 'AI proposes a change, using the markup the browser actually recorded. Then it commits, in writing, to what the change will fix. A prediction, not a proof.',
    done: (context) => context.changeProposed > 0,
  },
  {
    id: 'verify',
    title: 'Verify it with a rescan',
    say: 'The rescan is the proof, not the proposal. The finding it targeted is no longer observed. The failures it did not touch are still there — and the prediction held.',
    done: (context) => context.compared,
  },
  {
    id: 'limits',
    title: 'Say what is still missing',
    say: 'Automated checks cover part of the picture. Keyboard, screen reader, and human testing finish it. Everything here ran on this computer.',
    done: () => false,
  },
];
