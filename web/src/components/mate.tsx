import { memo, useEffect, useState } from 'react';

/** "Mate": maskot pixel StudyMate. Warna tubuh berevolusi mengikuti level, ekspresi mengikuti aktivitas. */
export type Mood = 'idle' | 'happy' | 'focus';

const HEAD = ['...KKKKKK...', '..KLLBBBBK..', '.KLLBBBBBBK.', '.KLBBBBBBBK.'];
const FEET = ['..KKBBBBKK..', '...KK..KK...'];
const FACES: Record<string, string[]> = {
  idle: ['KBBBEBBEBBBK', 'KBBBEBBEBBBK', 'KBCCBBBBCCBK', 'KBBBBMMBBBBK', '.KBBBBBBBBK.'],
  blink: ['KBBBBBBBBBBK', 'KBBEEBBEEBBK', 'KBCCBBBBCCBK', 'KBBBBMMBBBBK', '.KBBBBBBBBK.'],
  happy: ['KBBBEBBEBBBK', 'KBBBBBBBBBBK', 'KBCCBBBBCCBK', 'KBBBMMMMBBBK', '.KBBMMMMBBK.'],
  focus: ['KBBBBBBBBBBK', 'KBBEEBBEEBBK', 'KBBBBBBBBBBK', 'KBBBBBMBBBBK', '.KBBBBBBBBK.'],
};
const TIERS = [
  { B: '#3988D7', L: '#8CC4F5' },
  { B: '#3FA86B', L: '#9BE3B4' },
  { B: '#8A5CCF', L: '#CDB0F5' },
  { B: '#F2B63D', L: '#FFE28A' },
];
const FIXED = { K: '#10213F', E: '#10213F', C: '#F29CB0', M: '#7A1F3D' };

function rects(rows: string[], pal: Record<string, string>) {
  const out: JSX.Element[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let w = 1;
      while (x + w < row.length && row[x + w] === ch) w++;
      if (ch !== '.') out.push(<rect key={`${x}-${y}`} x={x} y={y} width={w} height={1} fill={pal[ch]} />);
      x += w;
    }
  });
  return out;
}

export const Mate = memo(function Mate({ level = 1, mood = 'idle', size = 96, bob = true }: { level?: number; mood?: Mood; size?: number; bob?: boolean }) {
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    if (mood !== 'idle') return;
    const t = setInterval(() => { setBlink(true); setTimeout(() => setBlink(false), 160); }, 3200);
    return () => clearInterval(t);
  }, [mood]);
  const face = mood === 'idle' && blink ? 'blink' : mood;
  const tier = TIERS[Math.min(TIERS.length - 1, Math.floor((level - 1) / 2))];
  const rows = [...HEAD, ...FACES[face], ...FEET];
  return (
    <svg viewBox="0 0 12 11" width={size} height={(size * 11) / 12} shapeRendering="crispEdges" className={bob ? 'bob' : undefined} role="img" aria-label="Mate, maskot StudyMate">
      {rects(rows, { ...FIXED, ...tier })}
    </svg>
  );
});
