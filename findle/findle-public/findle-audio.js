// audio.js
// Tiny synthesized sound effects using the Web Audio API — no sound
// files to upload or host. Call FindleAudio.unlock() once on any
// button tap (browsers require a user gesture before audio can play),
// then playFind/playCombo/playComplete fire automatically off socket
// events with no further interaction needed.

const FindleAudio = (() => {
  let ctx = null;

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(freq, startOffset, duration, type, gainLevel) {
    const c = ensureCtx();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type || "sine";
    osc.frequency.value = freq;
    const t0 = c.currentTime + startOffset;
    gain.gain.setValueAtTime(gainLevel || 0.15, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  function unlock() { ensureCtx(); }

  function playFind(comboCount) {
    const lift = Math.min(comboCount || 1, 4) * 55;
    const base = 500 + lift;
    tone(base, 0, 0.11, "triangle", 0.16);
    tone(base * 1.5, 0.06, 0.13, "triangle", 0.12);
  }

  function playCombo() {
    tone(720, 0, 0.07, "square", 0.08);
    tone(960, 0.05, 0.09, "square", 0.08);
  }

  function playComplete() {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.09, 0.18, "triangle", 0.14));
  }

  return { unlock, playFind, playCombo, playComplete };
})();
