// ============================================================================
// MILESTONE STAGES  (update 40)
// Every stage ladder in one place. Before update 40 there were 21 individual-like stages, 12 room-like stages
// and 12 room-share stages. Now there are many more, and viewers can also climb ladders for shares and gift coins.
//
// "major" lists are the ORIGINAL stages. Records always save EVERY stage; the host can choose in Records settings
// whether the on-screen alert appears for every stage ("all", default) or only for the original major stages.
// ============================================================================

export const LADDERS = {
  // a single viewer's likes this session
  like: [
    50, 100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 900, 1000, 1250, 1500, 1750, 2000, 2500, 3000, 3500, 4000,
    4500, 5000, 6000, 7000, 7500, 8000, 9000, 10000, 12500, 15000, 17500, 20000, 25000, 30000, 40000, 50000, 60000,
    75000, 100000, 125000, 150000, 200000, 250000, 300000, 400000, 500000, 750000, 1000000, 1500000, 2000000, 5000000,
  ],
  // a single viewer's shares this session
  share: [3, 5, 10, 15, 25, 50, 75, 100, 250, 500],
  // a single viewer's gift coins this session
  gift: [
    100, 250, 500, 1000, 2500, 5000, 7500, 10000, 15000, 25000, 50000, 75000, 100000, 250000, 500000, 1000000,
  ],
  // the whole room's likes this session
  roomLike: [
    100, 250, 500, 1000, 2500, 5000, 7500, 10000, 15000, 25000, 35000, 50000, 75000, 100000, 150000, 250000, 500000,
    750000, 1000000, 2000000, 3000000, 5000000, 7500000, 10000000, 25000000, 50000000, 100000000,
  ],
  // the whole room's shares this session
  roomShare: [5, 10, 15, 25, 50, 75, 100, 150, 250, 500, 750, 1000, 1500, 2500, 5000, 7500, 10000, 25000, 50000, 100000],
  // the whole room's gift coins this session
  roomGift: [
    500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000, 2500000, 5000000, 10000000,
  ],
};

// The stages that existed before update 40 (used by "only major stages" alert mode).
export const MAJOR = {
  like: new Set([100, 300, 500, 700, 1000, 2000, 3000, 4000, 5000, 10000, 20000, 30000, 40000, 50000, 75000, 100000, 150000, 200000, 250000, 500000, 1000000]),
  share: new Set([10, 25, 50, 100]),
  gift: new Set([1000, 5000, 10000, 50000, 100000]),
  roomLike: new Set([1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000, 2000000, 5000000, 10000000]),
  roomShare: new Set([10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000]),
  roomGift: new Set([1000, 10000, 100000, 1000000]),
};

// Tier names climb with the position inside a ladder, so every ladder feels like levelling up.
const TIERS = [
  { name: "Bronze", icon: "🥉", from: "#f0b27a", to: "#8c5a2b" },
  { name: "Silver", icon: "🥈", from: "#e5e7eb", to: "#7b8794" },
  { name: "Gold", icon: "🥇", from: "#ffe27a", to: "#c98a0c" },
  { name: "Platinum", icon: "🏅", from: "#a7f3d0", to: "#0f9b6c" },
  { name: "Diamond", icon: "💎", from: "#8fe3ff", to: "#0e7fa8" },
  { name: "Legend", icon: "👑", from: "#ff9ecb", to: "#8b5cf6" },
  { name: "Mythic", icon: "🏆", from: "#ffd76a", to: "#e0245e" },
];

/** Where a value sits in its ladder: { stage (1-based), stages, tier } */
export function stageInfo(ladderKey, value) {
  const list = LADDERS[ladderKey] || [];
  const i = Math.max(0, list.indexOf(value));
  const frac = list.length > 1 ? i / (list.length - 1) : 1;
  const tier = TIERS[Math.min(TIERS.length - 1, Math.floor(frac * TIERS.length))];
  return { stage: i + 1, stages: list.length, tier: tier.name, icon: tier.icon, from: tier.from, to: tier.to };
}

export function isMajor(ladderKey, value) {
  return MAJOR[ladderKey] ? MAJOR[ladderKey].has(value) : true;
}
