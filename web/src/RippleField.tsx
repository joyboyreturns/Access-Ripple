import { useEffect, useRef } from 'react';

/**
 * The landing page's moving background: a twisting ribbon of light made of
 * thousands of drifting grains, drawn on a canvas from a few lines of
 * geometry. It is decorative, it is original to this project, and it needs no
 * media file.
 */
const RIBBON = 20000;
const DUST = 900;

type Grains = { u: Float32Array; v: Float32Array; jx: Float32Array; jy: Float32Array; size: Float32Array; shade: Float32Array };

/** A small, repeatable random source, so the field looks the same on every load. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeGrains(count: number, seed: number, scatter: number): Grains {
  const random = seeded(seed);
  const grains: Grains = { u: new Float32Array(count), v: new Float32Array(count), jx: new Float32Array(count), jy: new Float32Array(count), size: new Float32Array(count), shade: new Float32Array(count) };
  for (let index = 0; index < count; index += 1) {
    // More grains toward the middle of the ribbon, fewer at its sandy edges.
    grains.u[index] = Math.pow(random(), 0.9);
    grains.v[index] = (random() + random() + random() - 1.5) * 0.9;
    const angle = random() * Math.PI * 2;
    const reach = Math.pow(random(), 2.4) * scatter;
    grains.jx[index] = Math.cos(angle) * reach;
    grains.jy[index] = Math.sin(angle) * reach;
    grains.size[index] = 0.8 + random() * 1.4;
    grains.shade[index] = 0.55 + random() * 0.45;
  }
  return grains;
}

export default function RippleField({ playing, reduced }: { playing: boolean; reduced: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const crisp = useRef<HTMLCanvasElement>(null);
  const glow = useRef<HTMLCanvasElement>(null);
  const clock = useRef(3.2);
  const frame = useRef(0);

  useEffect(() => {
    const element = host.current;
    const main = crisp.current;
    const halo = glow.current;
    if (!element || !main || !halo) return;
    const mainContext = main.getContext('2d');
    const haloContext = halo.getContext('2d');
    if (!mainContext || !haloContext) return;

    const ribbon = makeGrains(RIBBON, 11, 0.045);
    const dust = makeGrains(DUST, 29, 0);
    let width = 0;
    let height = 0;
    let ratio = 1;

    const resize = () => {
      const box = element.getBoundingClientRect();
      ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      width = Math.max(1, Math.round(box.width * ratio));
      height = Math.max(1, Math.round(box.height * ratio));
      main.width = width; main.height = height;
      // The halo is drawn small and blurred by CSS, which is far cheaper than blurring grains.
      halo.width = Math.max(1, Math.round(width / 4)); halo.height = Math.max(1, Math.round(height / 4));
    };

    const draw = (time: number) => {
      mainContext.globalCompositeOperation = 'source-over';
      mainContext.clearRect(0, 0, width, height);
      haloContext.clearRect(0, 0, halo.width, halo.height);
      mainContext.globalCompositeOperation = 'lighter';
      haloContext.globalCompositeOperation = 'lighter';
      mainContext.fillStyle = '#fff';
      haloContext.fillStyle = '#fff';

      const span = Math.min(width * 0.64, height * 1.2);
      const centreX = width * 0.5;
      const centreY = height * 0.46;
      const spin = Math.sin(time * 0.11) * 0.18;
      const tilt = 0.2 + Math.sin(time * 0.07) * 0.05;
      const cosY = Math.cos(spin), sinY = Math.sin(spin), cosX = Math.cos(tilt), sinX = Math.sin(tilt);
      const light = { x: 0.28, y: -0.42, z: 0.86 };

      for (let index = 0; index < RIBBON; index += 1) {
        const u = ribbon.u[index]!;
        const v = ribbon.v[index]!;
        const along = u * Math.PI * 2;
        // The spine of the ribbon, drifting slowly.
        const spineX = (u - 0.5) * 1.9;
        const spineY = Math.sin(along * 0.95 + time * 0.42) * 0.12 + Math.sin(along * 1.9 - time * 0.3) * 0.04;
        const spineZ = Math.sin(along * 1.1 - time * 0.36) * 0.22;
        // How far the ribbon has turned over by this point along it.
        const turn = u * Math.PI * 1.55 + Math.sin(time * 0.23 + u * 3.1) * 0.55 + time * 0.2;
        const breadth = 0.06 + 0.2 * Math.sin(Math.PI * u) ** 0.8;
        const crossY = Math.cos(turn) * v * breadth;
        const crossZ = Math.sin(turn) * v * breadth;
        let x = spineX + ribbon.jx[index]!;
        let y = spineY + crossY + ribbon.jy[index]!;
        let z = spineZ + crossZ;
        // Turn the whole shape a little, then tip it toward the viewer.
        const rx = x * cosY + z * sinY;
        const rz = -x * sinY + z * cosY;
        const ry = y * cosX - rz * sinX;
        const rz2 = y * sinX + rz * cosX;
        x = rx; y = ry; z = rz2;
        const perspective = 1.7 / (1.7 + z);
        const px = centreX + x * span * perspective;
        const py = centreY + y * span * perspective;
        if (px < 0 || px > width || py < 0 || py > height) continue;
        // The face of the ribbon catches the light when it turns toward it.
        const nx = 0, ny = -Math.sin(turn), nz = Math.cos(turn);
        const lit = Math.abs(nx * light.x + ny * light.y + nz * light.z);
        const edge = 1 - Math.min(1, Math.abs(v) ** 3 * 0.9);
        const ends = Math.sin(Math.PI * u) ** 0.5;
        const level = (0.1 + 0.9 * lit ** 1.7) * edge * (0.35 + 0.65 * ends) * ribbon.shade[index]!;
        const alpha = Math.min(1, level * 1.3);
        const size = ribbon.size[index]! * ratio * perspective;
        mainContext.globalAlpha = alpha;
        mainContext.fillRect(px, py, size, size);
        if (index % 2 === 0) {
          haloContext.globalAlpha = alpha * 0.22;
          const big = size * 1.3;
          haloContext.fillRect(px / 4, py / 4, big, big);
        }
      }

      haloContext.globalAlpha = 1;
      // Faint dust across the whole frame, drifting and twinkling.
      for (let index = 0; index < DUST; index += 1) {
        const driftX = (dust.u[index]! + time * 0.004 * (0.4 + dust.shade[index]!)) % 1;
        const px = driftX * width;
        const py = (dust.v[index]! * 0.55 + 0.5) * height + Math.sin(time * 0.3 + index) * 3 * ratio;
        const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(time * 0.5 + index * 1.7));
        mainContext.globalAlpha = 0.1 + 0.28 * dust.shade[index]! * twinkle;
        mainContext.fillRect(px, py, dust.size[index]! * ratio * 0.8, dust.size[index]! * ratio * 0.8);
      }
      mainContext.globalAlpha = 1;
    };

    resize();
    const observer = new ResizeObserver(() => { resize(); draw(clock.current); });
    observer.observe(element);
    draw(clock.current);

    let last = performance.now();
    const step = (now: number) => {
      const delta = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!document.hidden) { clock.current += delta; draw(clock.current); }
      frame.current = requestAnimationFrame(step);
    };
    if (playing && !reduced) frame.current = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(frame.current); observer.disconnect(); };
  }, [playing, reduced]);

  return <div className="hero-video" ref={host}><canvas className="ripple-glow" ref={glow}/><canvas className="ripple-grains" ref={crisp}/></div>;
}
