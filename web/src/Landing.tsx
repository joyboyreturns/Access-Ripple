import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import Icon, { Mark } from './Icons';

export function Dialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog className="dialog" ref={ref} onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}} aria-labelledby="dialog-title"><div className="dialog-head"><span className="eyebrow">ACCESSRIPPLE</span><button className="icon-btn" onClick={onClose} aria-label="Close dialog"><Icon name="close"/></button></div><h2 id="dialog-title">{title}</h2>{children}</dialog>;
}

export default function Landing({ openStudio, theme, toggleTheme }: { openStudio: () => void; theme: string; toggleTheme: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const reduced = useReducedMotion();
  const [playing, setPlaying] = useState(!reduced);
  const [failed, setFailed] = useState(false);
  const [info, setInfo] = useState<'how'|'approach'|null>(null);
  const [menu, setMenu] = useState(false);
  useEffect(() => { if (reduced) setPlaying(false); }, [reduced]);
  useEffect(() => { if(playing) video.current?.play().catch(()=>setPlaying(false));else video.current?.pause(); }, [playing]);
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setMenu(false);};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
  const appear = (delay: number) => ({ initial: reduced ? false as const : { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: .8, delay, ease: [.16,1,.3,1] as [number,number,number,number] } });
  return <div className="landing">
    <div className="hero-media" aria-hidden="true"><video ref={video} className="hero-video" src="/media/ripple-hero.mp4" muted loop playsInline preload="auto" onError={()=>{setFailed(true);setPlaying(false);}}/><div className="hero-media-fallback"/></div>
    <div className="grain" aria-hidden="true"/>
    <header className="landing-header"><a className="wordmark" href="#" aria-label="AccessRipple home"><Mark/><span>Access<span className="wordmark-soft">Ripple</span><sup>✦</sup></span></a><nav className={menu?'landing-nav open':'landing-nav'} aria-label="Primary"><button className="metal-pill" onClick={()=>{setMenu(false);openStudio();}}>The studio</button><button className="metal-pill" onClick={()=>{setMenu(false);setInfo('how');}}>How it works</button><button className="metal-pill" onClick={()=>{setMenu(false);setInfo('approach');}}>Our approach</button></nav><div className="landing-header-actions"><button className="icon-btn theme-switch" role="switch" aria-checked={theme==='light'} aria-label={`Switch to ${theme==='dark'?'light':'dark'} mode`} onClick={toggleTheme}><Icon name={theme==='dark'?'sun':'moon'}/></button><button className="button button-solid header-cta" onClick={openStudio}>Open studio <Icon name="arrow" size={17}/></button><button className="icon-btn mobile-menu" aria-expanded={menu} aria-label={menu?'Close menu':'Open menu'} onClick={()=>setMenu(!menu)}><Icon name={menu?'close':'list'}/></button></div></header>
    <main className="landing-main" id="main-content"><div className="hero-copy"><motion.div {...appear(.12)} className="hero-badge"><span className="badge-star">✧</span> Website clarity, from the inside out</motion.div><motion.h1 {...appear(.22)}>Understand your website.<br/>See <em>every ripple.</em></motion.h1><motion.p {...appear(.36)} className="hero-lede">Turn website journeys and accessibility barriers into a living map. See what matters. Know where to start.</motion.p><motion.div {...appear(.5)} className="hero-actions"><button className="button button-solid" onClick={openStudio}>Explore your website <Icon name="arrow" size={19}/></button><button className="button button-glass" onClick={()=>setInfo('how')}><Icon name="play" size={16}/> See how it works</button></motion.div><motion.span {...appear(.6)} className="hero-note">A real browser scan. A clearer way forward.</motion.span></div></main>
    <footer className="landing-facts"><motion.div {...appear(.65)}><Icon name="orbit"/><span>Connected website journeys</span></motion.div><motion.div {...appear(.75)}><Icon name="shield"/><span>Real accessibility evidence</span></motion.div><motion.div {...appear(.85)}><Icon name="globe"/><span>A more usable web, for everyone</span></motion.div></footer>
    <button className="video-control" disabled={failed} onClick={()=>setPlaying(!playing)}><Icon name={playing?'pause':'play'} size={14}/><span>{failed?'Animation unavailable':playing?'Pause motion':'Play motion'}</span></button>
    {info&&<Dialog title={info==='how'?'From a URL to a clearer picture.':'Evidence first. People always.'} onClose={()=>setInfo(null)}>{info==='how'?<ol className="how-steps"><li><span>01</span><div><h3>Give us a website.</h3><p>Enter a public URL. The local scanner visits up to five same-site pages in a bounded browser session.</p></div></li><li><span>02</span><div><h3>Follow the connections.</h3><p>Explore pages, controls, possible journeys, and real automated accessibility findings in one map.</p></div></li><li><span>03</span><div><h3>Understand. Improve. Check again.</h3><p>Read the impact and suggested next step, make the change in your own code, then rescan and compare observations.</p></div></li></ol>:<div className="dialog-copy"><p>AccessRipple helps developers notice barriers that can make a website harder to use.</p><p>Automated checks are a starting point. They do not prove complete accessibility. Observed evidence, inferred paths, and untested actions stay clearly labeled.</p><p>The scanner runs on this computer. It reads public pages and never submits payments, messages, or account changes.</p></div>}<button className="button button-solid" onClick={()=>{setInfo(null);openStudio();}}>Open the studio <Icon name="arrow" size={18}/></button></Dialog>}
  </div>;
}
