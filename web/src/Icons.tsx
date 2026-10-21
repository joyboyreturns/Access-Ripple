export default function Icon({ name, size = 20, className }: { name: string; size?: number; className?: string }) {
  const paths: Record<string, string> = {
    arrow: 'M5 12h14m-6-6 6 6-6 6', external: 'M14 4h6v6m0-6L10 14M10 5H5v14h14v-5', plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', close: 'm6 6 12 12M6 18 18 6', search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    globe: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18', map: 'm3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5M9 3v16M15 5v16', list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    shield: 'm12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6l8-3m-4 9 3 3 5-6', check: 'm5 12 4 4L19 6', refresh: 'M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-2l2 3M4 16l2 3a7 7 0 0 0 12-2', download: 'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4',
    sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0', moon: 'M21 14A9 9 0 0 1 10 3a9 9 0 1 0 11 11', play: 'm8 4 12 8-12 8V4', pause: 'M8 4v16M16 4v16', chevron: 'm9 5 7 7-7 7', back: 'M19 12H5m6-6-6 6 6 6', info: 'M12 11v6m0-10h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
    target: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0', keyboard: 'M3 7h18v10H3V7m4 6h10M7 10h.01M11 10h.01M15 10h.01', warning: 'm12 3 10 18H2L12 3m0 6v5m0 3h.01', orbit: 'M21 12c0 3-4 5-9 5s-9-2-9-5 4-5 9-5 9 2 9 5M12 3c3 0 5 4 5 9s-2 9-5 9-5-4-5-9 2-9 5-9',
    spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z', folder: 'M3 7V4h7l2 3h9v13H3V7', code: 'm8 7-5 5 5 5m8-10 5 5-5 5m-3-14-2 18',
  };
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] ?? paths.orbit}/></svg>;
}

export function Mark() { return <svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><circle cx="16" cy="16" r="4" fill="currentColor"/><circle cx="16" cy="16" r="11" stroke="currentColor" strokeWidth="1" opacity=".45"/><circle cx="7" cy="10" r="2.4" fill="currentColor"/><circle cx="25" cy="22" r="2.4" fill="currentColor"/><path d="m9 11 4 3m6 4 4 3" stroke="currentColor" strokeWidth="1.5"/></svg>; }
