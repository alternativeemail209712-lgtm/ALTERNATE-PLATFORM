// twistle-symbols.js
// TWISTLE's symbol artwork - 12 hand-drawn "plush toy" characters (heart,
// star, moon, drop, clover, cat, gem, donut, cloud, frog, mushroom, ghost),
// each built once as an SVG <symbol> and reused by reference everywhere a
// board cell needs one. This is TWISTLE's own visual identity and is kept
// verbatim from the original game - only wrapped here as a small shared
// module (TwistleSymbols) so both the host page and the display page can
// use it without duplicating ~250 lines of generative SVG.
//
// Usage:
//   TwistleSymbols.buildSprite();   // call once, inserts the <svg> sprite sheet
//   TwistleSymbols.svg('heart');    // -> a small <svg><use.../></svg> string
//
// ids must match SYMBOL_INFO in server/twistle/twistle-engine.js.
(function (global) {
  'use strict';

  // ---- The symbol set --------------------------------------------------
  // ids must match SYMBOL_INFO in gameEngine.js. Each symbol is drawn once as an
  // SVG <symbol> (see buildSymbolSprite) and every board cell just points at it.
  // Look: chunky "plush toy" - thick extruded base, dark contour, glossy gradient
  // body lit from the top-left, tinted shading, a shine, a ground shadow and a face.
  const INK = '#3a1d4d';
  const SHADOW_TINT = '#2a0d4a';

  const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => {
    const A = hex2rgb(a), B = hex2rgb(b);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
  };
  const fx = (n) => Math.round(n * 100) / 100;

  /** Closed polygon with rounded corners (quadratic curves). */
  function roundPoly(pts, r) {
    const n = pts.length;
    let d = '';
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i + n - 1) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
      const v1 = [p0[0] - p1[0], p0[1] - p1[1]], v2 = [p2[0] - p1[0], p2[1] - p1[1]];
      const l1 = Math.hypot(v1[0], v1[1]), l2 = Math.hypot(v2[0], v2[1]);
      const k = Math.min(r, l1 / 2, l2 / 2);
      const a = [p1[0] + (v1[0] / l1) * k, p1[1] + (v1[1] / l1) * k];
      const b = [p1[0] + (v2[0] / l2) * k, p1[1] + (v2[1] / l2) * k];
      d += `${i ? 'L' : 'M'}${fx(a[0])} ${fx(a[1])}Q${fx(p1[0])} ${fx(p1[1])} ${fx(b[0])} ${fx(b[1])}`;
    }
    return d + 'Z';
  }

  /** Rotate the points of an absolute M/C/Z path around (cx, cy). */
  function rotatePath(cmds, deg, cx, cy) {
    const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
    const rot = ([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c];
    return cmds.map(([op, ...pts]) => op + pts.map((p) => rot(p).map(fx).join(' ')).join(' ')).join('') + 'Z';
  }

  /** A face: blush, eyes, mouth. eyes: 'dot' | 'happy' | 'sleep'. */
  function face(cx, cy, o = {}) {
    const gap = o.gap ?? 13;
    const rx = o.rx ?? 2.8, ry = o.ry ?? 3.6;
    const x1 = cx - gap / 2, x2 = cx + gap / 2;
    const eyeKind = o.eyes || 'dot';
    const eye = (x) => {
      if (eyeKind === 'happy') return `<path d="M${fx(x - 3.2)} ${fx(cy + 1.6)}Q${fx(x)} ${fx(cy - 4)} ${fx(x + 3.2)} ${fx(cy + 1.6)}" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;
      if (eyeKind === 'sleep') return `<path d="M${fx(x - 3.2)} ${fx(cy - 1)}Q${fx(x)} ${fx(cy + 3.6)} ${fx(x + 3.2)} ${fx(cy - 1)}" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;
      return `<ellipse cx="${fx(x)}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${INK}"/><circle cx="${fx(x + 0.95)}" cy="${fx(cy - 1.35)}" r="1.15" fill="#fff"/><circle cx="${fx(x - 0.9)}" cy="${fx(cy + 1.5)}" r=".55" fill="#fff" opacity=".85"/>`;
    };
    const my = cy + (o.mouthDy ?? 6.6);
    let mouth;
    if (o.mouth === 'open') {
      mouth = `<path d="M${fx(cx - 3.4)} ${fx(my - 0.6)}Q${cx} ${fx(my + 6.4)} ${fx(cx + 3.4)} ${fx(my - 0.6)}Z" fill="${INK}" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/><ellipse cx="${cx}" cy="${fx(my + 2.4)}" rx="1.9" ry="1.2" fill="#ff7f9d"/>`;
    } else if (o.mouth === 'o') {
      mouth = `<ellipse cx="${cx}" cy="${fx(my + 0.8)}" rx="1.9" ry="2.3" fill="${INK}"/>`;
    } else if (o.mouth === 'cat') {
      mouth = `<path d="M${fx(cx - 4.4)} ${fx(my)}Q${fx(cx - 2.2)} ${fx(my + 3.2)} ${cx} ${fx(my)}Q${fx(cx + 2.2)} ${fx(my + 3.2)} ${fx(cx + 4.4)} ${fx(my)}" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`;
    } else {
      mouth = `<path d="M${fx(cx - 3)} ${fx(my)}Q${cx} ${fx(my + 3.8)} ${fx(cx + 3)} ${fx(my)}" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`;
    }
    const bx = gap / 2 + (o.blushDx ?? 6.6), by = cy + (o.blushDy ?? 4.4);
    const bc = o.blush || '#ff6f9c';
    const blush = `<ellipse cx="${fx(cx - bx)}" cy="${fx(by)}" rx="3.4" ry="2.1" fill="${bc}" opacity=".62"/><ellipse cx="${fx(cx + bx)}" cy="${fx(by)}" rx="3.4" ry="2.1" fill="${bc}" opacity=".62"/>`;
    const inner = blush + eye(x1) + eye(x2) + mouth;
    return o.rotate ? `<g transform="rotate(${o.rotate} ${cx} ${cy})">${inner}</g>` : inner;
  }

  const shine = (x, y, rx, ry, rot, dot) =>
    `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${x} ${y})" fill="#fff" opacity=".78"/>` +
    (dot ? `<circle cx="${dot[0]}" cy="${dot[1]}" r="${dot[2] || 1.5}" fill="#fff" opacity=".9"/>` : '');

  // --- silhouettes ---
  const HEART = 'M32 54C10 40 5 28 5 19.5C5 11.5 11 6 18.5 6C24 6 29 9 32 14C35 9 40 6 45.5 6C53 6 59 11.5 59 19.5C59 28 54 40 32 54Z';
  const DROP = 'M32 5C44 21 54 32 54 42.5A22 22 0 0 1 10 42.5C10 32 20 21 32 5Z';
  const MOON = 'M56 34.1A24 24 0 1 1 29.9 8A18.7 18.7 0 0 0 56 34.1Z';
  const STAR = roundPoly(
    Array.from({ length: 10 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 13.5 : 26.5;
      return [32 + Math.cos(a) * r, 34.5 + Math.sin(a) * r];
    }), 4.6);
  const GEM = roundPoly([[19, 9], [45, 9], [58, 24], [32, 56], [6, 24]], 4);
  const LEAF = [['M', [32, 32]], ['C', [24, 26], [17, 20], [17, 13]], ['C', [17, 8], [21, 5], [25, 5]], ['C', [28, 5], [31, 7], [32, 10]], ['C', [33, 7], [36, 5], [39, 5]], ['C', [43, 5], [47, 8], [47, 13]], ['C', [47, 20], [40, 26], [32, 32]]];
  const CLOVER = [0, 90, 180, 270].map((a) => rotatePath(LEAF, a, 32, 32));
  const EAR_L = roundPoly([[8, 28], [10, 6], [29, 17]], 3.4);
  const EAR_R = roundPoly([[56, 28], [54, 6], [35, 17]], 3.4);
  const DONUT_RING = 'M32 4A26 26 0 1 1 31.99 4ZM32 23.5A6.5 6.5 0 1 0 32.01 23.5Z';
  const ICING = (() => {
    const cx = 32, cy = 30, pts = [];
    for (let i = 0; i < 56; i++) {
      const a = (i / 56) * Math.PI * 2, r = 22.2 + 1.7 * Math.sin(a * 8);
      pts.push(`${fx(cx + Math.cos(a) * r)} ${fx(cy + Math.sin(a) * r)}`);
    }
    return 'M' + pts.join('L') + 'ZM32 20.5A9.5 9.5 0 1 0 32.01 20.5Z';
  })();

  const MUSH_CAP = 'M5.5 33C5.5 17 17.5 6 32 6C46.5 6 58.5 17 58.5 33C58.5 35.2 56.8 36.5 54.8 36.5H9.2C7.2 36.5 5.5 35.2 5.5 33Z';
  const GHOST = roundPoly([
    ...Array.from({ length: 19 }, (_, i) => { const t = Math.PI + (i * Math.PI) / 18; return [32 + Math.cos(t) * 22, 28 + Math.sin(t) * 22]; }),
    [54, 52], [43, 45], [32, 52], [21, 45], [10, 52],
  ], 4.4);

  // hue/tone/shape live in the engine (contrast rules); color/art live here.
  const SYMBOLS = {
    heart: {
      color: '#ff3f6c', shadow: 25,
      shape: (a) => `<path d="${HEART}" ${a}/>`,
      hl: shine(17.5, 15.5, 6.2, 3.4, -35, [27, 11.5, 1.6]),
      face: face(32, 27, { gap: 17, mouth: 'open', blush: '#ffa9c0', mouthDy: 6 }),
    },
    star: {
      color: '#ffc419', shadow: 22,
      shape: (a) => `<path d="${STAR}" ${a}/>`,
      hl: shine(27.5, 18.5, 2.7, 6.4, 24, [33, 13.2, 1.4]),
      face: face(32, 35, { gap: 12, eyes: 'happy', mouthDy: 6.4, blush: '#ff8f6b' }),
    },
    moon: {
      color: '#8f6bff', shadow: 20,
      shape: (a) => `<path d="${MOON}" ${a}/>`,
      hl: shine(15.5, 27, 2.8, 6.2, 28, [21.5, 18.5, 1.5]),
      face: face(27, 40, { gap: 12.5, eyes: 'sleep', rotate: -12, mouthDy: 6.2, blushDx: 6.4, blushDy: 4, blush: '#ff8fc0' }),
    },
    drop: {
      color: '#2f8bff', shadow: 20,
      shape: (a) => `<path d="${DROP}" ${a}/>`,
      hl: shine(21.5, 38, 3.4, 8, 18, [27, 24.5, 1.7]),
      face: face(32, 43, { gap: 13, mouth: 'o', mouthDy: 6.2, blush: '#ff8fc0' }),
    },
    clover: {
      color: '#2fcf6d', shadow: 24,
      shape: (a) => CLOVER.map((d) => `<path d="${d}" ${a}/>`).join(''),
      decor: `<path d="M32 13V20M32 44V51M13 32H20M44 32H51" fill="none" stroke="${SHADOW_TINT}" stroke-opacity=".22" stroke-width="1.6" stroke-linecap="round"/>`,
      hl: shine(20, 17, 4.6, 2.6, -32, [27, 11.5, 1.4]),
      face: face(32, 31, { gap: 11, mouthDy: 5.8, blush: '#ffb0a8', blushDx: 6.2 }),
    },
    cat: {
      color: '#ff8a2b', shadow: 24,
      shape: (a) => `<path d="${EAR_L}" ${a}/><path d="${EAR_R}" ${a}/><ellipse cx="32" cy="36" rx="24" ry="18.5" ${a}/>`,
      decor:
        `<path d="${roundPoly([[13, 24], [14.4, 12.5], [24, 18.5]], 1.8)}" fill="#ffb3c6"/>` +
        `<path d="${roundPoly([[51, 24], [49.6, 12.5], [40, 18.5]], 1.8)}" fill="#ffb3c6"/>`,
      hl: shine(19, 26.5, 6, 2.9, -18, [28.5, 23.5, 1.4]),
      face:
        face(32, 35.5, { gap: 20, mouth: 'cat', mouthDy: 8.4, blush: '#ff6f8f', blushDx: 5.6, blushDy: 3.6 }) +
        `<path d="M29.6 41.2Q32 39.6 34.4 41.2Q32 44 29.6 41.2Z" fill="#ff6f8f"/>`,
    },
    gem: {
      color: '#17d4cf', shadow: 24,
      shape: (a) => `<path d="${GEM}" ${a}/>`,
      decor:
        `<path d="M22.5 11.4H41.5L45 21.6H19Z" fill="#fff" opacity=".24"/>` +
        `<path d="M32 56L58 24H45L32 40Z" fill="#0b3d7a" opacity=".13"/>` +
        `<path d="M8 24H56M19.5 10.5L24.5 24M44.5 10.5L39.5 24" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.3" stroke-linecap="round"/>`,
      hl: shine(14.5, 20.5, 1.9, 4.2, 42, null),
      face: face(32, 32.5, { gap: 13, mouthDy: 6.2, blush: '#ff8fc0', blushDx: 5.4 }),
    },
    donut: {
      color: '#ff5fb5', shadow: 24, base: '#f0b167',
      shape: (a) => `<path d="${DONUT_RING}" fill-rule="evenodd" clip-rule="evenodd" ${a}/>`,
      icing: true,
      decor:
        `<path d="${ICING}" fill="url(#ic-donut)" fill-rule="evenodd"/>` +
        `<path d="${ICING}" fill="url(#sh)" fill-rule="evenodd" opacity=".7"/>` +
        [[19, 24, 40, '#fff6a8'], [26, 13.5, -25, '#7ee8ff'], [40.5, 13, 30, '#fff'], [47.5, 22.5, -60, '#b6ff9a'], [15.5, 33.5, 70, '#fff'], [49, 36, 20, '#fff6a8']]
          .map(([x, y, r, c]) => `<rect x="${x - 2.7}" y="${y - 1}" width="5.4" height="2.1" rx="1.05" transform="rotate(${r} ${x} ${y})" fill="${c}"/>`).join(''),
      hl: shine(15, 21, 2.4, 5.6, 38, [20.5, 12.5, 1.4]),
      face: face(32, 45.4, { gap: 11, rx: 2.2, ry: 2.9, mouthDy: 4.6, blushDx: 6, blushDy: 3, blush: '#ff2f9a' }),
    },
    cloud: {
      color: '#eef1ff', shadow: 25, base: '#f4f6ff', deep: '#5a55b8',
      shape: (a) => `<circle cx="21" cy="37" r="12" ${a}/><circle cx="34" cy="28" r="16" ${a}/><circle cx="47" cy="37" r="12" ${a}/><rect x="13" y="36" width="42" height="17" rx="8.5" ${a}/>`,
      hl: shine(27, 19.5, 6.4, 3.2, -28, [37, 15.8, 1.5]),
      face: face(34, 39, { gap: 14, mouth: 'o', mouthDy: 5.4, blush: '#ff8fb8', blushDx: 6.4 }),
    },
  };

  Object.assign(SYMBOLS, {
    frog: {
      color: '#6bd83c', shadow: 24, deep: '#1f6a3a',
      shape: (a) => `<ellipse cx="32" cy="37" rx="25.5" ry="17" ${a}/><circle cx="19.5" cy="20" r="10.5" ${a}/><circle cx="44.5" cy="20" r="10.5" ${a}/>`,
      decor:
        `<ellipse cx="32" cy="45.5" rx="14.5" ry="7.5" fill="#fff" opacity=".2"/>` +
        [19.5, 44.5].map((x) => `<circle cx="${x}" cy="20" r="7.2" fill="#fff" stroke="#b9e3a3" stroke-width=".9"/><circle cx="${x + 0.9}" cy="21" r="4.1" fill="${INK}"/><circle cx="${x + 2.3}" cy="19.4" r="1.5" fill="#fff"/><circle cx="${x - 0.6}" cy="22.6" r=".7" fill="#fff" opacity=".85"/>`).join(''),
      hl: shine(11, 36, 2.3, 5, 14, [13.5, 29, 1.3]),
      face:
        `<ellipse cx="14.5" cy="42" rx="3.6" ry="2.2" fill="#ff5f86" opacity=".8"/><ellipse cx="49.5" cy="42" rx="3.6" ry="2.2" fill="#ff5f86" opacity=".8"/>` +
        `<circle cx="29.6" cy="34.2" r=".95" fill="${INK}"/><circle cx="34.4" cy="34.2" r=".95" fill="${INK}"/>` +
        `<path d="M23 40Q32 47.5 41 40" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`,
    },
    mushroom: {
      color: '#ff4b3e', shadow: 22, base: '#fff4de', deep: '#e0905f', shadeOp: 0.42, icing: true,
      shape: (a) => `<path d="${MUSH_CAP}" ${a}/><rect x="19" y="33" width="26" height="22" rx="10" ${a}/>`,
      decor:
        `<path d="M20 36.5H44Q32 44 20 36.5Z" fill="${SHADOW_TINT}" opacity=".24"/>` +
        `<path d="${MUSH_CAP}" fill="url(#ic-mushroom)" stroke="#8e1d3a" stroke-width="3" stroke-linejoin="round"/>` +
        `<path d="${MUSH_CAP}" fill="url(#sh)" opacity=".9"/>` +
        [[18.5, 22, 4.6], [33, 13.5, 3.6], [46, 22.5, 5], [31, 27, 2.8]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity=".96"/>`).join(''),
      hl: shine(15, 15.5, 5.4, 2.5, -40, [25, 10.5, 1.4]),
      face: face(32, 46, { gap: 10.5, rx: 2.2, ry: 2.9, mouthDy: 4.6, blushDx: 3.6, blushDy: 3, blush: '#ff8f9c' }),
    },
    ghost: {
      color: '#dc5ef2', shadow: 23,
      shape: (a) => `<path d="${GHOST}" ${a}/>`,
      hl: shine(20, 17, 5.8, 2.8, -36, [29.5, 11, 1.5]),
      face: face(32, 28, { gap: 14, mouth: 'o', mouthDy: 6.8, blush: '#ff7ac8', blushDx: 6.4 }),
    },
    // Safety net: if the server ever sends a symbol this page has no art for,
    // show this instead of nothing at all.
    _fallback: {
      color: '#9aa3ff', shadow: 22,
      shape: (a) => `<circle cx="32" cy="32" r="23" ${a}/>`,
      hl: shine(20, 20, 6, 3, -35, [29, 13, 1.5]),
      face: face(32, 32, { gap: 13, mouth: 'o', mouthDy: 6 }),
    },
  });

  function buildSymbolSprite() {
    const defs = `
      <linearGradient id="sh" gradientUnits="userSpaceOnUse" x1="0" y1="26" x2="0" y2="58">
        <stop offset="0" stop-color="${SHADOW_TINT}" stop-opacity="0"/><stop offset="1" stop-color="${SHADOW_TINT}" stop-opacity=".34"/>
      </linearGradient>
      <radialGradient id="gs"><stop offset="0" stop-color="#000" stop-opacity=".42"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>`;
    const grad = (id, base, deep) => `
      <radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="20" cy="15" r="56">
        <stop offset="0" stop-color="${mix(base, '#ffffff', 0.58)}"/>
        <stop offset=".42" stop-color="${base}"/>
        <stop offset="1" stop-color="${mix(base, deep || SHADOW_TINT, 0.42)}"/>
      </radialGradient>`;
    const symbols = Object.entries(SYMBOLS).map(([id, s]) => {
      const base = s.base || s.color;
      const rim = mix(base, s.deep || SHADOW_TINT, 0.5);
      const deep = mix(base, s.deep || SHADOW_TINT, 0.68);
      const extra = s.icing ? grad('ic-' + id, s.color) : '';
      return `<symbol id="sym-${id}" viewBox="0 0 64 64" overflow="visible">
        ${grad('gb-' + id, base, s.deep)}${extra}<clipPath id="cp-${id}">${s.shape('')}</clipPath>
        <ellipse cx="32" cy="58.6" rx="${s.shadow}" ry="3.7" fill="url(#gs)"/>
        <g transform="translate(0 3.3)">${s.shape(`fill="${deep}" stroke="${deep}" stroke-width="2.6" stroke-linejoin="round"`)}</g>
        ${s.shape(`fill="${rim}" stroke="${rim}" stroke-width="2.6" stroke-linejoin="round"`)}
        <g clip-path="url(#cp-${id})"><rect width="64" height="64" fill="url(#gb-${id})"/><rect width="64" height="64" fill="url(#sh)" opacity="${s.shadeOp ?? 1}"/></g>
        ${s.decor || ''}${s.hl}${s.face}
      </symbol>`;
    }).join('');
    document.body.insertAdjacentHTML('afterbegin',
      `<svg id="symbolSprite" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true" focusable="false"><defs>${defs}</defs>${symbols}</svg>`);
  }
  buildSymbolSprite();

  const warnedSymbols = new Set();
  function symbolSvg(id) {
    if (!id) return '';
    if (!SYMBOLS[id]) {
      if (!warnedSymbols.has(id)) { warnedSymbols.add(id); console.warn('[Twistle] No artwork for symbol "' + id + '" - showing a placeholder. Is this page out of date?'); }
      id = '_fallback';
    }
    return `<svg viewBox="0 0 64 64" aria-hidden="true"><use href="#sym-${id}"/></svg>`;
  }


  global.TwistleSymbols = { buildSprite: buildSymbolSprite, svg: symbolSvg, ids: Object.keys(SYMBOLS).filter((k) => k !== '_fallback') };
})(window);
