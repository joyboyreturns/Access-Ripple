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
    id: 'scan',
    title: 'Map the demo shop',
    say: 'AccessRipple turns a website into a map of its pages, journeys, and accessibility barriers. Every point on that map is backed by something a real browser actually recorded.',
    done: (context) => context.hasScan,
  },
  {
    id: 'finding',
    title: 'Open the first barrier',
    say: 'The story names the first barrier to look at and where it was found. Open it, and the rule, the exact element, and the change to make sit together.',
    done: (context) => context.findingOpened > 0,
  },
  {
    id: 'journey',
    title: 'Follow a real journey',
    say: 'Now I follow a button. The numbered route is what the browser actually did, and the pulse travels that exact path. Anything beyond the recorded route stays marked untested.',
    done: (context) => context.journeyTraced > 0,
  },
  {
    id: 'repair',
    title: 'Prove a repair',
    say: 'I fix the missing image, rescan, and the comparison shows three items the browser no longer reports — with nothing new and nothing changed.',
    done: (context) => context.compared > 0,
  },
  {
    id: 'export',
    title: 'Keep the result',
    say: 'And the whole map exports as a linked Obsidian vault, so a team keeps the evidence, not a screenshot. Automated checks start the conversation; people complete it.',
    done: () => false,
  },
];
