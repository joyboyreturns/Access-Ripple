
/**
 * The guided tour doubles as the recording script and as on-screen captions.
 * Each step carries the sentence to say out loud, so a silent recording still
 * tells the reviewer what is happening and why it matters.
 */
export type TourContext = {
  hasScan: boolean;
  /** Counts how many times the viewer opened the first barrier. */
  findingOpened: number;
  /** Counts how many times the viewer traced a journey. */
  journeyTraced: number;
  /** Counts how many times a change was proposed. */
  changeProposed: number;
  /** Counts how many times a rescan produced a comparison. */
  compared: number;
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
    id: 'proof',
    title: 'The proof, first',
    say: 'We changed one image on a checkout page. AccessRipple checked what the browser actually stopped reporting. Three things are no longer observed, and nothing new appeared.',
    done: (context) => context.compared > 0,
  },
  {
    id: 'scan',
    title: 'A real scan, in ten seconds',
    say: 'This is a real browser session on this computer. It opened four pages, activated nine safe controls once each in disposable pages, and recorded what actually happened.',
    done: (context) => context.hasScan,
  },
  {
    id: 'finding',
    title: 'Open the first barrier',
    say: 'A finding tells you a check failed. This is the control it belongs to, the element it ran on, and what a person misses because of it.',
    done: (context) => context.findingOpened > 0,
  },
  {
    id: 'journey',
    title: 'Follow a real journey',
    say: 'Now I follow a button. The numbered route is what the browser actually did, and the pulse travels that exact path. Anything beyond the recorded route stays marked untested.',
    done: (context) => context.journeyTraced > 0,
  },
  {
    id: 'proposal',
    title: 'Let the model propose a change',
    say: 'A model proposes the smallest change that fixes the rule, grounded in the markup the browser recorded. It is a grounded proposal, not a verified fix.',
    done: (context) => context.changeProposed > 0,
  },
  {
    id: 'repair',
    title: 'Prove the repair',
    say: 'I rescan the same site. The proposal was not the proof, the rescan was: three things the browser no longer reports, with nothing new.',
    done: (context) => context.compared > 0,
  },
  {
    id: 'limits',
    title: 'Say what is still missing',
    say: 'Automated checks cover a useful subset of barriers. Keyboard, screen-reader, and human testing complete the picture, and everything here ran on this computer.',
    done: () => false,
  },
];
