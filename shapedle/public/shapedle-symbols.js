// shapedle-symbols.js
// SHAPEDLE's symbol artwork. The server only sends a SLOT number (0-25) per letter position; this
// file turns a slot into a picture for whichever pack the host picked, so the look can be changed
// at any moment (even mid-round) without touching the round itself.
//
// Packs (every pack has 26 symbols, so a word with any number of distinct letters always works):
//   cute     - hand-drawn kawaii shapes with little faces (13 shapes x 2 colors)
//   plush    - TWISTLE's 12 plush toys (+ cute shapes for the rest)
//   classic  - flat colored shapes like the original SHAPE-O game
//   animals / sweets / nature - emoji packs
//   flags (42 drawn country flags - drawn, not emoji, because Windows cannot show flag emoji),
//   professions / sports / transport - emoji packs
//   viewers  - the audience's TikTok profile pictures (not a pack of its own: the server picks which ones)
//
// Usage: ShapedleSymbols.html(packId, slot)        -> markup for one symbol of a pack (fills its box)
//        ShapedleSymbols.htmlById(id, viewers)     -> markup for a symbol id sent by the server:
//                                                     "flags:12" or "viewers:<tiktok name>" (viewers = state.symbolViewers)
//        ShapedleSymbols.PACKS                     -> [{ id, name, hint, size }] for the host's picker
// (update 29) The number of symbols per pack must match SET_SIZES in server/shared/symbol-options-store.js.
(function (global) {
  'use strict';

  const fx = (n) => Math.round(n * 100) / 100;

  // ---- shapes (64 x 64 box) -------------------------------------------------------------
  function starPts(cx, cy, ro, ri) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? ro : ri;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push([fx(cx + r * Math.cos(a)), fx(cy + r * Math.sin(a))]);
    }
    return pts;
  }
  function hexPts(cx, cy, r) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 3;
      pts.push([fx(cx + r * Math.cos(a)), fx(cy + r * Math.sin(a))]);
    }
    return pts;
  }
  const poly = (pts) => pts.map((p) => p.join(',')).join(' ');

  // Each shape: kind 'poly' (rounded polygon), 'path' (smooth path) or 'multi' (union of circles).
  // face = [x, y] where the little face sits (null = no face).
  const SHAPES = [
    { id: 'circle',   kind: 'multi', circles: [[32, 33, 22]], face: [32, 35] },
    { id: 'square',   kind: 'path',  d: 'M20 11H44Q53 11 53 20V44Q53 53 44 53H20Q11 53 11 44V20Q11 11 20 11Z', face: [32, 34] },
    { id: 'star',     kind: 'poly',  pts: starPts(32, 34, 25, 12), face: [32, 37] },
    { id: 'heart',    kind: 'path',  d: 'M32 54C10 38 6 27 6 20C6 12 12 8 19 8C25 8 30 12 32 17C34 12 39 8 45 8C52 8 58 12 58 20C58 27 54 38 32 54Z', face: [32, 28] },
    { id: 'triangle', kind: 'poly',  pts: [[32, 12], [54, 51], [10, 51]], face: [32, 40] },
    { id: 'diamond',  kind: 'poly',  pts: [[32, 7], [55, 32], [32, 57], [9, 32]], face: [32, 33] },
    { id: 'hexagon',  kind: 'poly',  pts: hexPts(32, 33, 23), face: [32, 34] },
    { id: 'drop',     kind: 'path',  d: 'M32 6C32 6 12 28 12 41C12 52 21 58 32 58C43 58 52 52 52 41C52 28 32 6 32 6Z', face: [32, 43] },
    { id: 'moon',     kind: 'path',  d: 'M41 8C25 10 12 22 12 36C12 50 24 58 38 56C46 55 52 51 56 46C42 48 32 40 32 30C32 22 35 14 41 8Z', face: [25, 38] },
    { id: 'cloud',    kind: 'multi', circles: [[20, 38, 12], [33, 28, 15], [46, 38, 11], [32, 41, 12]], face: [32, 38] },
    { id: 'flower',   kind: 'multi', circles: [[32, 16, 11], [48, 28, 11], [42, 47, 11], [22, 47, 11], [16, 28, 11], [32, 34, 13]], face: [32, 35] },
    { id: 'bolt',     kind: 'poly',  pts: [[37, 6], [14, 36], [28, 36], [24, 58], [50, 26], [35, 26]], face: [31, 38] },
    { id: 'house',    kind: 'poly',  pts: [[32, 8], [57, 30], [57, 55], [7, 55], [7, 30]], face: [32, 41] }
  ];

  // [fill, outline]
  const PALETTE = [
    ['#FF7EB6', '#B8336F'], // pink
    ['#6EC1FF', '#2A6DAA'], // sky
    ['#FFD54A', '#B8860B'], // sunny
    ['#5EDC9A', '#1F8A55'], // mint
    ['#B28DFF', '#6A3FC0'], // grape
    ['#FFA24D', '#B8560E'], // orange
    ['#FF6B6B', '#A82A2A'], // coral
    ['#3FD0D4', '#13808A'], // teal
    ['#B9E64F', '#6E8E12'], // lime
    ['#E4A0FF', '#9A38C4']  // orchid
  ];
  // flat, saturated colors in the spirit of the original game
  const FLAT = ['#87CEEB', '#7B3FA0', '#1F78C1', '#E31A1C', '#B2DF8A', '#FF8FB8', '#FFB347', '#2CA02C', '#E6C229', '#17BECF'];

  const INK = '#3a1d4d';

  function faceSvg(x, y, big) {
    const s = big ? 1 : 0.9;
    const gap = 7 * s;
    return (
      `<ellipse cx="${fx(x - gap)}" cy="${y}" rx="${fx(1.9 * s)}" ry="${fx(2.5 * s)}" fill="${INK}"/>` +
      `<ellipse cx="${fx(x + gap)}" cy="${y}" rx="${fx(1.9 * s)}" ry="${fx(2.5 * s)}" fill="${INK}"/>` +
      `<circle cx="${fx(x - gap - 1.2)}" cy="${fx(y - 1)}" r="0.7" fill="#fff"/><circle cx="${fx(x + gap - 1.2)}" cy="${fx(y - 1)}" r="0.7" fill="#fff"/>` +
      `<path d="M${fx(x - 3)} ${fx(y + 4.6)}Q${x} ${fx(y + 8)} ${fx(x + 3)} ${fx(y + 4.6)}" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>` +
      `<ellipse cx="${fx(x - gap - 3.4)}" cy="${fx(y + 4.2)}" rx="3" ry="1.9" fill="#ff5a8a" opacity=".45"/>` +
      `<ellipse cx="${fx(x + gap + 3.4)}" cy="${fx(y + 4.2)}" rx="3" ry="1.9" fill="#ff5a8a" opacity=".45"/>`
    );
  }

  /** One shape as a full <svg>. style 'cute' = outline + shine + face, 'flat' = plain filled shape. */
  function shapeSvg(shape, fill, line, style) {
    const cute = style === 'cute';
    let body = '';
    if (shape.kind === 'poly') {
      const pts = poly(shape.pts);
      if (cute) {
        body =
          `<polygon points="${pts}" fill="${line}" stroke="${line}" stroke-width="11" stroke-linejoin="round"/>` +
          `<polygon points="${pts}" fill="${fill}" stroke="${fill}" stroke-width="6" stroke-linejoin="round"/>`;
      } else {
        body = `<polygon points="${pts}" fill="${fill}" stroke="${fill}" stroke-width="5" stroke-linejoin="round"/>`;
      }
    } else if (shape.kind === 'path') {
      body = cute
        ? `<path d="${shape.d}" fill="${fill}" stroke="${line}" stroke-width="3.6" stroke-linejoin="round"/>`
        : `<path d="${shape.d}" fill="${fill}"/>`;
    } else {
      if (cute) body += shape.circles.map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r + 2.2}" fill="${line}"/>`).join('');
      body += shape.circles.map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`).join('');
    }
    let extra = '';
    if (cute) {
      extra += `<ellipse cx="22" cy="19" rx="6" ry="3.2" fill="#fff" opacity=".5" transform="rotate(-28 22 19)"/>`;
      if (shape.face) extra += faceSvg(shape.face[0], shape.face[1], true);
    }
    return `<svg viewBox="0 0 64 64" aria-hidden="true">${body}${extra}</svg>`;
  }

  // 26 distinct (shape, color) combinations: slot i and slot i+13 share a shape but never a color.
  function cuteSlot(i) {
    const shape = SHAPES[i % 13];
    const c = PALETTE[(i * 3 + Math.floor(i / 13) * 5) % PALETTE.length];
    return shapeSvg(shape, c[0], c[1], 'cute');
  }
  function classicSlot(i) {
    const shape = SHAPES[(i * 5) % 13];
    const fill = FLAT[(i * 7 + Math.floor(i / 13) * 3) % FLAT.length];
    return shapeSvg(shape, fill, null, 'flat');
  }

  // ---- plush (TWISTLE) -----------------------------------------------------------------
  let spriteReady = false;
  function plushSlot(i) {
    const T = global.TwistleSymbols;
    if (T && T.ids && i < T.ids.length) {
      if (!spriteReady) { try { T.buildSprite(); } catch (e) { /* already built */ } spriteReady = true; }
      return T.svg(T.ids[i]);
    }
    return cuteSlot(i); // the plush set has 12 toys; the rest of the slots borrow the cute shapes
  }

  // ---- emoji packs (26 each) -----------------------------------------------------------
  const EMOJI = {
    animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐤', '🦄', '🐝', '🦋', '🐌', '🐞', '🐢', '🐙', '🐳'],
    sweets: ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍒', '🍑', '🥝', '🍍', '🥕', '🌽', '🍄', '🍞', '🧀', '🍔', '🍕', '🍩', '🍪', '🍰', '🍫', '🍬', '🍭', '🍦', '🧁'],
    professions: ['👩‍⚕️', '👨‍🍳', '👨‍🌾', '👨‍✈️', '👩‍🚀', '👨‍🚒', '👮', '👷', '👩‍🏫', '👨‍🎓', '👩‍🔬', '👨‍💻', '👩‍🎨', '👨‍🎤', '👩‍🔧', '👨‍⚖️', '💂', '🕵️', '👨‍🏭', '👩‍💼', '🤵', '🎅', '🧙', '🦸', '🤹', '🏇'],
    sports: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🏒', '🥊', '🥋', '⛳', '🏹', '🎣', '🏊', '🚴', '🏋️', '⛷️', '🏂', '🤿', '🛹', '🏏', '🥅', '🎯'],
    transport: ['🚗', '🚕', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚚', '🚜', '🛵', '🏍️', '🚲', '🛴', '🚂', '🚆', '✈️', '🚁', '🚀', '🛸', '⛵', '🚤', '🛳️', '🚢', '🛶', '🎈'],
    nature: ['⭐', '🌙', '☀️', '🌈', '☁️', '❄️', '🔥', '💧', '🌸', '🌻', '🌷', '🍀', '🌵', '🌴', '🍁', '🌍', '🪐', '🚀', '🛸', '☄️', '🌊', '⚡', '🎈', '🎁', '🔔', '🎵']
  };
  const emojiSlot = (pack) => (i) => `<span class="symEmoji">${EMOJI[pack][i % 26]}</span>`;


  // ---- flags (42 drawn flags, 60 x 40 each) --------------------------------------------
  const stripesH = (cols, w) => {
    const tot = (w || cols.map(() => 1)).reduce((a, b) => a + b, 0);
    let y = 0;
    return cols.map((c, i) => {
      const h = (40 * (w ? w[i] : 1)) / tot;
      const r = `<rect x="0" y="${fx(y)}" width="60" height="${fx(h + 0.3)}" fill="${c}"/>`;
      y += h;
      return r;
    }).join('');
  };
  const stripesV = (cols) => cols.map((c, i) => `<rect x="${fx((60 / cols.length) * i)}" y="0" width="${fx(60 / cols.length + 0.3)}" height="40" fill="${c}"/>`).join('');
  const rect = (x, y, w, h, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
  const circ = (x, y, r, c) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
  const star = (cx, cy, ro, ri, c) => `<polygon points="${poly(starPts(cx, cy, ro, ri))}" fill="${c}"/>`;
  const trigram = (cx, cy, rot) =>
    `<g transform="rotate(${rot} ${cx} ${cy})">` +
    [0, 1, 2].map((i) => rect(fx(cx - 4), fx(cy - 2.6 + i * 2.6), 8, 1.4, '#111')).join('') + '</g>';
  const nordic = (bg, outer, inner, x) => {
    const w = inner ? 9 : 6;
    let o = rect(0, 0, 60, 40, bg);
    o += rect(x, 0, w, 40, outer) + rect(0, fx(20 - w / 2), 60, w, outer);
    if (inner) o += rect(fx(x + 2.5), 0, 4, 40, inner) + rect(0, 18, 60, 4, inner);
    return o;
  };

  const FLAGS = [
    () => stripesV(['#0055A4', '#FFFFFF', '#EF4135']),                                  // France
    () => stripesV(['#009246', '#FFFFFF', '#CE2B37']),                                  // Italy
    () => stripesV(['#169B62', '#FFFFFF', '#FF883E']),                                  // Ireland
    () => stripesV(['#000000', '#FDDA24', '#EF3340']),                                  // Belgium
    () => stripesH(['#000000', '#DD0000', '#FFCE00']),                                  // Germany
    () => stripesH(['#AE1C28', '#FFFFFF', '#21468B']),                                  // Netherlands
    () => stripesH(['#FFFFFF', '#0039A6', '#D52B1E']),                                  // Russia
    () => stripesH(['#0057B7', '#FFD700']),                                             // Ukraine
    () => stripesH(['#FFFFFF', '#DC143C']),                                             // Poland
    () => stripesH(['#E70011', '#FFFFFF']),                                             // Indonesia
    () => stripesH(['#CE2939', '#FFFFFF', '#477050']),                                  // Hungary
    () => stripesH(['#ED2939', '#FFFFFF', '#ED2939']),                                  // Austria
    () => stripesH(['#AA151B', '#F1BF00', '#AA151B'], [1, 2, 1]),                       // Spain
    () => stripesH(['#FCD116', '#003893', '#CE1126'], [2, 1, 1]),                       // Colombia
    () => stripesV(['#008751', '#FFFFFF', '#008751']),                                  // Nigeria
    () => stripesV(['#D91023', '#FFFFFF', '#D91023']),                                  // Peru
    () => stripesV(['#002B7F', '#FCD116', '#CE1126']),                                  // Romania
    () => stripesH(['#FDB913', '#006A44', '#C1272D']),                                  // Lithuania
    () => stripesH(['#0072CE', '#000000', '#FFFFFF']),                                  // Estonia
    () => stripesH(['#A51931', '#F4F5F8', '#2D2A4A', '#F4F5F8', '#A51931'], [1, 1, 2, 1, 1]), // Thailand
    () => rect(0, 0, 60, 40, '#FFFFFF') + circ(30, 20, 12, '#BC002D'),                  // Japan
    () => rect(0, 0, 60, 40, '#DA291C') + rect(26, 8, 8, 24, '#FFFFFF') + rect(14, 16, 32, 8, '#FFFFFF'), // Switzerland
    () => nordic('#006AA7', '#FECC00', null, 16),                                       // Sweden
    () => nordic('#BA0C2F', '#FFFFFF', '#00205B', 14),                                  // Norway
    () => nordic('#C8102E', '#FFFFFF', null, 16),                                       // Denmark
    () => nordic('#FFFFFF', '#003580', null, 16),                                       // Finland
    () => nordic('#02529C', '#FFFFFF', '#DC1E35', 14),                                  // Iceland
    () => {                                                                             // Greece
      const cols = [];
      for (let i = 0; i < 9; i++) cols.push(i % 2 === 0 ? '#0D5EAF' : '#FFFFFF');
      return stripesH(cols) + rect(0, 0, 22.3, 22.3, '#0D5EAF') + rect(9.2, 0, 4, 22.3, '#FFFFFF') + rect(0, 9.2, 22.3, 4, '#FFFFFF');
    },
    () => {                                                                             // USA
      const cols = [];
      for (let i = 0; i < 13; i++) cols.push(i % 2 === 0 ? '#B22234' : '#FFFFFF');
      let o = stripesH(cols) + rect(0, 0, 25, 21.5, '#3C3B6E');
      for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) o += circ(fx(3.2 + c * 4.6), fx(3.2 + r * 4.9), 1.15, '#FFFFFF');
      return o;
    },
    () =>                                                                               // United Kingdom
      rect(0, 0, 60, 40, '#012169') +
      '<path d="M0 0L60 40M60 0L0 40" stroke="#FFFFFF" stroke-width="8"/>' +
      '<path d="M0 0L60 40M60 0L0 40" stroke="#C8102E" stroke-width="3"/>' +
      rect(24, 0, 12, 40, '#FFFFFF') + rect(0, 14, 60, 12, '#FFFFFF') +
      rect(26, 0, 8, 40, '#C8102E') + rect(0, 16, 60, 8, '#C8102E'),
    () =>                                                                               // Canada
      rect(0, 0, 60, 40, '#FFFFFF') + rect(0, 0, 15, 40, '#D52B1E') + rect(45, 0, 15, 40, '#D52B1E') +
      '<polygon points="30,6 33,13 38,11 36,19 42,17 39,23 43,26 31,27 31,34 29,34 29,27 17,26 21,23 18,17 24,19 22,11 27,13" fill="#D52B1E"/>',
    () =>                                                                               // Brazil
      rect(0, 0, 60, 40, '#009C3B') + '<polygon points="30,4 55,20 30,36 5,20" fill="#FFDF00"/>' + circ(30, 20, 9, '#002776') +
      '<path d="M21.5 18.2Q30 15 38.5 21.8" stroke="#FFFFFF" stroke-width="1.6" fill="none"/>',
    () => rect(0, 0, 60, 40, '#DE2910') + star(10, 10, 6.4, 2.6, '#FFDE00') +           // China
      [[20, 4], [24, 8.5], [24, 14], [20, 18.5]].map(([x, y]) => star(x, y, 2, 0.8, '#FFDE00')).join(''),
    () => stripesH(['#FF9933', '#FFFFFF', '#138808']) +                                 // India
      '<circle cx="30" cy="20" r="5" fill="none" stroke="#000080" stroke-width="1.2"/>' + circ(30, 20, 1, '#000080'),
    () => rect(0, 0, 60, 40, '#E30A17') + circ(21, 20, 10, '#FFFFFF') + circ(24, 20, 8, '#E30A17') + star(33.5, 20, 4.6, 1.9, '#FFFFFF'), // Turkey
    () => {                                                                             // Malaysia
      const cols = [];
      for (let i = 0; i < 14; i++) cols.push(i % 2 === 0 ? '#CC0001' : '#FFFFFF');
      return stripesH(cols) + rect(0, 0, 30, 22.9, '#010066') + circ(10.5, 11.4, 7, '#FFCC00') + circ(12.6, 11.4, 5.7, '#010066') + star(19.8, 11.4, 4.4, 1.9, '#FFCC00');
    },
    () => stripesH(['#EF3340', '#FFFFFF']) + circ(11, 10, 7, '#FFFFFF') + circ(13.6, 10, 6, '#EF3340') + // Singapore
      [[19.5, 6], [24, 9.5], [22.5, 15], [16.5, 15], [15, 9.5]].map(([x, y]) => circ(x, y, 1.3, '#FFFFFF')).join(''),
    () =>                                                                               // South Korea
      rect(0, 0, 60, 40, '#FFFFFF') +
      '<path d="M20 20A10 10 0 0 1 40 20Z" fill="#CD2E3A"/><path d="M20 20A10 10 0 0 0 40 20Z" fill="#0047A0"/>' +
      circ(25, 20, 5, '#0047A0') + circ(35, 20, 5, '#CD2E3A') +
      trigram(8, 8, -36) + trigram(52, 8, 36) + trigram(8, 32, 36) + trigram(52, 32, -36),
    () => rect(0, 0, 60, 40, '#FFFFFF') + rect(0, 4, 60, 5, '#0038B8') + rect(0, 31, 60, 5, '#0038B8') + // Israel
      '<polygon points="30,11 38.7,26 21.3,26" fill="none" stroke="#0038B8" stroke-width="1.6"/>' +
      '<polygon points="30,29 21.3,14 38.7,14" fill="none" stroke="#0038B8" stroke-width="1.6"/>',
    () => rect(0, 0, 60, 40, '#FFFFFF') + rect(0, 0, 60, 13.4, '#00732F') + rect(0, 26.6, 60, 13.4, '#000000') + rect(0, 0, 15, 40, '#FF0000'), // UAE
    () => stripesV(['#006847', '#FFFFFF', '#CE1126']) + circ(30, 20, 4.2, '#8B5A2B'),   // Mexico
    () => stripesH(['#74ACDF', '#FFFFFF', '#74ACDF']) + circ(30, 20, 4, '#F6B40E')      // Argentina
  ];

  const FLAG_NAMES = ['France', 'Italy', 'Ireland', 'Belgium', 'Germany', 'Netherlands', 'Russia', 'Ukraine', 'Poland', 'Indonesia',
    'Hungary', 'Austria', 'Spain', 'Colombia', 'Nigeria', 'Peru', 'Romania', 'Lithuania', 'Estonia', 'Thailand', 'Japan',
    'Switzerland', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Iceland', 'Greece', 'USA', 'UK', 'Canada', 'Brazil', 'China',
    'India', 'Turkey', 'Malaysia', 'Singapore', 'South Korea', 'Israel', 'UAE', 'Mexico', 'Argentina'];

  function flagSlot(i) {
    const draw = FLAGS[i % FLAGS.length];
    return (
      '<svg viewBox="0 0 64 64" aria-hidden="true">' +
      '<svg x="3" y="13" width="58" height="38.7" viewBox="0 0 60 40" style="overflow:hidden">' + draw() + '</svg>' +
      '<rect x="3" y="13" width="58" height="38.7" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="1.2"/>' +
      '<path d="M3 13H61" stroke="rgba(255,255,255,.35)" stroke-width="1"/>' +
      '</svg>'
    );
  }

  const PACKS = [
    { id: 'cute', name: 'Cute Faces', hint: 'Kawaii shapes with little faces', slot: cuteSlot },
    { id: 'plush', name: 'Plush Toys', hint: "TWISTLE's squishy toys", slot: plushSlot },
    { id: 'classic', name: 'Classic Shapes', hint: 'Flat shapes, like the original SHAPE-O', slot: classicSlot },
    { id: 'animals', name: 'Animals', hint: 'Cute animal friends', slot: emojiSlot('animals') },
    { id: 'sweets', name: 'Sweets & Fruit', hint: 'Yummy treats', slot: emojiSlot('sweets') },
    { id: 'nature', name: 'Sky & Garden', hint: 'Stars, flowers and rainbows', slot: emojiSlot('nature') },
    { id: 'flags', name: 'Flags of Countries', hint: '42 flags from around the world', slot: flagSlot, size: FLAGS.length },
    { id: 'professions', name: 'Professions', hint: 'Doctors, chefs, pilots, astronauts...', slot: emojiSlot('professions') },
    { id: 'sports', name: 'Sports', hint: 'Balls, medals and games', slot: emojiSlot('sports') },
    { id: 'transport', name: 'Transport', hint: 'Cars, trains, planes and boats', slot: emojiSlot('transport') }
  ];
  const BY_ID = {};
  PACKS.forEach((p) => { BY_ID[p.id] = p; });

  function html(packId, slot) {
    const pack = BY_ID[packId] || BY_ID.cute;
    const size = pack.size || 26;
    const i = ((Number(slot) % size) + size) % size;
    return pack.slot(i);
  }

  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /**
   * Markup for a symbol id from the server: "flags:12" / "cute:3" / "viewers:<tiktok name>".
   * `viewers` is the server's id -> { n, url } map for the audience pictures of this round.
   * An audience picture is a round <img>; if its picture is missing a colored initial circle stands in.
   */
  function htmlById(id, viewers) {
    const text = String(id || '');
    const cut = text.indexOf(':');
    const set = cut > 0 ? text.slice(0, cut) : text;
    const rest = cut > 0 ? text.slice(cut + 1) : '0';
    if (set === 'viewers') {
      const v = viewers && viewers[text];
      const name = (v && v.n) || rest;
      if (v && v.url) {
        return '<img class="symAvatar" src="' + esc(v.url) + '" alt="" draggable="false" data-n="' + esc(name) + '">';
      }
      return '<span class="symAvatar symAvatarFallback">' + esc(String(name).charAt(0).toUpperCase() || '?') + '</span>';
    }
    return html(set, Number(rest));
  }

  global.ShapedleSymbols = {
    PACKS: PACKS.map((p) => ({ id: p.id, name: p.name, hint: p.hint, size: p.size || 26 })),
    FLAG_NAMES,
    html,
    htmlById
  };
})(window);
