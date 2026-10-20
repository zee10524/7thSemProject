// Cover art motifs (viewBox 0 0 100 100, drawn in currentColor), ported from the prototype.
// They show when a real cover image is missing or still loading. Static markup only.

function star4(x: number, y: number, r: number): string {
  return `M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`;
}

function pineTree(x: number, y: number, h: number, w: number): string {
  return `<path d="M${x} ${y - h}L${x + w / 2} ${y - h * 0.38}H${x + w / 4}L${x + w * 0.6} ${y}H${x - w * 0.6}L${x - w / 4} ${y - h * 0.38}H${x - w / 2}Z"/>`;
}

const MOTIFS: Record<string, () => string> = {
  orbit: () =>
    '<circle cx="50" cy="50" r="16" fill="currentColor"/><ellipse cx="50" cy="50" rx="40" ry="12" fill="none" stroke="currentColor" stroke-width="1.8" transform="rotate(-24 50 50)"/><circle cx="86" cy="34" r="2.6" fill="currentColor"/><g fill="currentColor" opacity=".8"><circle cx="14" cy="16" r="1.3"/><circle cx="30" cy="86" r="1.1"/><circle cx="88" cy="80" r="1.5"/><circle cx="70" cy="10" r="1"/><circle cx="10" cy="60" r="1"/></g>',
  sun: () =>
    '<circle cx="50" cy="50" r="17" fill="currentColor"/><g stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M50 22V10M50 78v12M22 50H10M78 50h12M30.2 30.2l-8.5-8.5M78.3 78.3l-8.5-8.5M69.8 30.2l8.5-8.5M21.7 78.3l8.5-8.5"/></g>',
  meander: () => {
    let d = 'M8 92H92';
    for (let x = 8; x < 84; x += 12) d += `M${x} 92V78H${x + 9}V87H${x + 4}V83H${x + 6}`;
    return `<circle cx="50" cy="40" r="23" fill="currentColor"/><circle cx="50" cy="40" r="30" fill="none" stroke="currentColor" stroke-width="1.1"/><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.6"/>`;
  },
  arches: () =>
    '<g fill="none" stroke="currentColor" stroke-width="2"><path d="M12 92V56a14 14 0 0 1 28 0v36"/><path d="M36 92V46a14 14 0 0 1 28 0v46"/><path d="M60 92V56a14 14 0 0 1 28 0v36"/></g><path d="M78 14a11 11 0 1 0 8 18 9 9 0 0 1-8-18z" fill="currentColor"/><g fill="currentColor"><circle cx="20" cy="18" r="1.2"/><circle cx="40" cy="10" r="1"/><circle cx="58" cy="22" r="1.1"/></g>',
  pixels: () => {
    const rows = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
    const s = 12;
    const ox = 50 - (7 * s) / 2;
    let out = '';
    rows.forEach((r, y) =>
      r.split('').forEach((c, x) => {
        if (c === 'X')
          out += `<rect x="${ox + x * s}" y="${16 + y * s}" width="${s - 1.4}" height="${s - 1.4}"/>`;
      }),
    );
    return `<g fill="currentColor">${out}</g>`;
  },
  eye: () =>
    '<path d="M6 50C22 26 78 26 94 50 78 74 22 74 6 50z" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="50" cy="50" r="13" fill="currentColor"/><circle cx="50" cy="50" r="5.5" fill="var(--c1)"/><path d="M50 14v8M26 20l4 7M74 20l-4 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  atom: () =>
    '<g fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="50" cy="50" rx="40" ry="14"/><ellipse cx="50" cy="50" rx="40" ry="14" transform="rotate(60 50 50)"/><ellipse cx="50" cy="50" rx="40" ry="14" transform="rotate(120 50 50)"/></g><circle cx="50" cy="50" r="7" fill="currentColor"/>',
  pines: () =>
    `<circle cx="76" cy="20" r="8" fill="currentColor"/><g fill="currentColor">${pineTree(24, 92, 56, 26)}${pineTree(50, 92, 72, 30)}${pineTree(76, 92, 46, 22)}</g><path d="M6 92h88" stroke="currentColor" stroke-width="1.6"/>`,
  pyramid: () =>
    '<circle cx="72" cy="24" r="11" fill="currentColor"/><path d="M16 78 50 28l34 50z" fill="currentColor" opacity=".92"/><path d="M50 28 42 78" stroke="var(--c1)" stroke-width="1.4" opacity=".5" fill="none"/><path d="M2 82c18-8 30 6 48-2s32-6 48 0V96H2z" fill="currentColor" opacity=".55"/>',
  fan: () =>
    '<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M50 88 12 44M50 88 26 30M50 88V20M50 88 74 30M50 88 88 44"/><path d="M12 44A46 46 0 0 1 88 44"/><path d="M27 61A30 30 0 0 1 73 61"/></g><circle cx="50" cy="88" r="4" fill="currentColor"/>',
  house: () =>
    '<path d="M18 52 50 24l32 28" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/><path d="M26 48v38h48V48" fill="none" stroke="currentColor" stroke-width="2.4"/><rect x="43" y="62" width="14" height="24" fill="currentColor"/><rect x="31" y="56" width="8" height="8" fill="currentColor" opacity=".7"/><rect x="61" y="56" width="8" height="8" fill="currentColor" opacity=".7"/><path d="M8 88h84" stroke="currentColor" stroke-width="1.6"/>',
  planet: () =>
    '<circle cx="52" cy="50" r="30" fill="currentColor"/><g fill="var(--c1)" opacity=".28"><circle cx="42" cy="40" r="6"/><circle cx="62" cy="58" r="8"/><circle cx="48" cy="64" r="3.5"/></g><g fill="currentColor" opacity=".85"><circle cx="14" cy="18" r="1.4"/><circle cx="84" cy="14" r="1.2"/><circle cx="90" cy="80" r="1.6"/><circle cx="12" cy="78" r="1.1"/></g>',
  waves: () =>
    '<circle cx="70" cy="26" r="11" fill="currentColor"/><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 56q11-10 22 0t22 0 22 0 22 0"/><path d="M6 70q11-10 22 0t22 0 22 0 22 0"/><path d="M6 84q11-10 22 0t22 0 22 0 22 0"/></g>',
  horizon: () =>
    '<path d="M10 62h80" stroke="currentColor" stroke-width="2"/><path d="M30 62a20 20 0 0 1 40 0z" fill="currentColor" opacity=".9"/><g stroke="currentColor" stroke-width="1.4" opacity=".6"><path d="M18 72h64M28 80h44M38 88h24"/></g>',
  windows: () => {
    let out = '';
    for (let i = 0; i < 9; i += 1) {
      const x = 16 + (i % 3) * 24;
      const y = 12 + Math.floor(i / 3) * 28;
      out += `<rect x="${x}" y="${y}" width="18" height="22" rx="1.5" fill="${i === 4 ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"/>`;
    }
    return out;
  },
  stripes: () =>
    '<g fill="none" stroke="currentColor" stroke-width="5"><path d="M10 82A72 72 0 0 1 82 10"/><path d="M10 68A58 58 0 0 1 68 10" opacity=".85"/><path d="M10 54A44 44 0 0 1 54 10" opacity=".7"/><path d="M10 40A30 30 0 0 1 40 10" opacity=".55"/></g><circle cx="76" cy="76" r="12" fill="currentColor"/>',
  halls: () =>
    '<g fill="none" stroke="currentColor" stroke-width="2"><path d="M14 90V46a36 36 0 0 1 72 0v44"/><path d="M26 90V50a24 24 0 0 1 48 0v40"/><path d="M38 90V54a12 12 0 0 1 24 0v36"/></g><path d="M8 90h84" stroke="currentColor" stroke-width="2"/>',
  mug: () =>
    '<path d="M24 42h42v24a18 18 0 0 1-18 18H42a18 18 0 0 1-18-18z" fill="currentColor"/><path d="M66 50h6a10 10 0 0 1 0 20h-8" fill="none" stroke="currentColor" stroke-width="4"/><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M36 32c-4-5 4-8 0-14"/><path d="M48 32c-4-5 4-8 0-14"/><path d="M60 32c-4-5 4-8 0-14"/></g>',
  isle: () =>
    '<circle cx="74" cy="24" r="10" fill="currentColor"/><path d="M14 72Q50 40 86 72Z" fill="currentColor" opacity=".9"/><path d="M40 58l10-12 10 12zM43 58v10h14V58" fill="var(--c1)" opacity=".9"/><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 80q11-8 22 0t22 0 22 0 22 0"/><path d="M6 92q11-8 22 0t22 0 22 0 22 0"/></g>',
  stars: () =>
    `<path d="M62 22a22 22 0 1 0 14 38 18 18 0 0 1-14-38z" fill="currentColor"/><g fill="currentColor"><path d="${star4(24, 26, 7)}"/><path d="${star4(82, 70, 5)}"/><path d="${star4(30, 70, 4)}"/><path d="${star4(88, 24, 3.5)}"/></g><g stroke="currentColor" stroke-width="1.6" opacity=".7"><path d="M6 92h88M14 92V84M30 92V84M70 92V84M86 92V84"/></g>`,
  dome: () =>
    '<path d="M50 6v10M45 11h10" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M50 16C66 30 76 42 76 58a26 26 0 0 1-52 0C24 42 34 30 50 16z" fill="currentColor"/><path d="M28 72h44v6H28zM24 80h52v12H24z" fill="currentColor" opacity=".85"/>',
  tent: () => {
    let out = '';
    for (let i = 0; i < 6; i += 1) {
      const x0 = 12 + i * (76 / 6);
      const x1 = 12 + (i + 1) * (76 / 6);
      out += `<path d="M50 16L${x0.toFixed(1)} 52H${x1.toFixed(1)}Z" fill="currentColor" opacity="${i % 2 ? '.5' : '1'}"/>`;
    }
    return `${out}<path d="M12 52h76v34H12z" fill="currentColor" opacity=".85"/><path d="M41 86 50 62l9 24z" fill="var(--c1)"/><path d="M50 16V6l9 3-9 3" fill="currentColor"/>`;
  },
  laurel: () => {
    let out = '';
    for (let i = 0; i < 14; i += 1) {
      const a = (i / 14) * Math.PI * 2;
      const x = 50 + Math.cos(a) * 32;
      const y = 50 + Math.sin(a) * 32;
      out += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="3.4" ry="8.5" transform="rotate(${((a * 180) / Math.PI + 90).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
    }
    return `<g fill="currentColor">${out}</g><circle cx="50" cy="50" r="14" fill="none" stroke="currentColor" stroke-width="1.6"/>`;
  },
  dunes: () =>
    '<circle cx="68" cy="26" r="11" fill="currentColor"/><circle cx="34" cy="38" r="6" fill="currentColor" opacity=".7"/><path d="M0 70C20 52 36 56 52 66S84 76 100 62V100H0z" fill="currentColor" opacity=".9"/><path d="M0 86C22 74 40 80 60 86S86 92 100 84V100H0z" fill="var(--c1)" opacity=".35"/>',
  road: () =>
    '<path d="M44 34 12 92h76L56 34z" fill="currentColor" opacity=".85"/><path d="M50 36V92" stroke="var(--c1)" stroke-width="2.2" stroke-dasharray="6 5" fill="none"/><path d="M6 34h88" stroke="currentColor" stroke-width="1.6"/><circle cx="50" cy="20" r="6" fill="currentColor" opacity=".6"/>',
  dots: () => {
    let out = '';
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      out += `<circle cx="${(50 + Math.cos(a) * 38).toFixed(1)}" cy="${(50 + Math.sin(a) * 38).toFixed(1)}" r="3.6"/>`;
    }
    return `<g fill="currentColor" opacity=".75">${out}</g><circle cx="50" cy="50" r="22" fill="currentColor"/>`;
  },
  awning: () => {
    let out = '';
    for (let i = 0; i < 6; i += 1) {
      out += `<path d="M${(10 + i * 13.3).toFixed(1)} 24h13.3l-1.6 24h-10.1z" fill="currentColor" opacity="${i % 2 ? '.5' : '1'}"/>`;
    }
    return `${out}<rect x="14" y="52" width="72" height="36" fill="none" stroke="currentColor" stroke-width="2.2"/><rect x="42" y="62" width="16" height="26" fill="currentColor"/>`;
  },
  books: () =>
    '<g fill="currentColor"><rect x="14" y="30" width="12" height="58" rx="1.5"/><rect x="28" y="22" width="14" height="66" rx="1.5" opacity=".8"/><rect x="44" y="34" width="11" height="54" rx="1.5"/><rect x="57" y="26" width="15" height="62" rx="1.5" opacity=".8"/><path d="M76 88 84 32l11 2-8 54z"/></g><path d="M8 90h86" stroke="currentColor" stroke-width="2"/>',
  sprout: () =>
    '<path d="M50 90V46" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M50 52C50 32 32 24 16 28c0 20 14 28 34 24z" fill="currentColor"/><path d="M50 44C50 26 66 16 84 20c0 20-16 28-34 24z" fill="currentColor" opacity=".8"/><path d="M30 90h40" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
  quill: () =>
    '<path d="M80 12C48 16 24 40 20 86c26-8 52-26 60-74z" fill="currentColor"/><path d="M20 86 64 38" stroke="var(--c1)" stroke-width="1.8" opacity=".6" fill="none"/><path d="M10 92h30" stroke="currentColor" stroke-width="1.6"/>',
  rings: () =>
    '<g fill="none" stroke="currentColor" stroke-width="3"><circle cx="38" cy="50" r="24"/><circle cx="62" cy="50" r="24"/></g>',
  towers: () => {
    const specs = [
      [10, 46, 18],
      [30, 28, 20],
      [52, 14, 18],
      [72, 38, 20],
    ] as const;
    let out = '';
    for (const [x, y, w] of specs) {
      out += `<rect x="${x}" y="${y}" width="${w}" height="${90 - y}" fill="currentColor" opacity=".9"/>`;
      for (let yy = y + 6; yy < 82; yy += 9) {
        out += `<rect x="${x + 3}" y="${yy}" width="3.2" height="4" fill="var(--c1)" opacity=".55"/><rect x="${x + w - 7}" y="${yy}" width="3.2" height="4" fill="var(--c1)" opacity=".55"/>`;
      }
    }
    return `${out}<path d="M4 90h92" stroke="currentColor" stroke-width="2"/>`;
  },
};

const cache = new Map<string, string>();

export function motifSvg(name: string): string {
  const key = name in MOTIFS ? name : 'stars';
  let svg = cache.get(key);
  if (!svg) {
    svg = (MOTIFS[key] ?? MOTIFS.stars!)();
    cache.set(key, svg);
  }
  return svg;
}
