"use client";

/**
 * Countdown sounds for the projector, made with the Web Audio API so there
 * are no audio files to load. Browsers only allow sound after the page has
 * been clicked or tapped, so `unlockSounds` runs on the first click.
 */

let ctx: AudioContext | null = null;
let muted = readMuted();

const MUTE_KEY = "pq-sound-muted";

function readMuted(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  try {
    window.localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {
    // Private mode: the setting just won't be remembered.
  }
}

export function unlockSounds() {
  if (typeof window === "undefined") return;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  ctx ??= new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
}

function tone(freq: number, { at = 0, length = 0.08, volume = 0.25, type = "sine" as OscillatorType } = {}) {
  if (muted || !ctx || ctx.state !== "running") return;
  const start = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + length + 0.02);
}

/** One second passing on the question clock; sharper in the last seconds. */
export function playTick(urgent: boolean) {
  if (urgent) tone(1320, { length: 0.09, volume: 0.35, type: "square" });
  else tone(880, { length: 0.05, volume: 0.15 });
}

/** Time's up. */
export function playBuzzer() {
  tone(196, { length: 0.6, volume: 0.35, type: "sawtooth" });
  tone(147, { at: 0.05, length: 0.6, volume: 0.25, type: "sawtooth" });
}

// ── drum roll for the podium ────────────────────────────────────────────────

let noise: AudioBuffer | null = null;

function noiseBuffer(ac: AudioContext): AudioBuffer {
  if (noise && noise.sampleRate === ac.sampleRate) return noise;
  noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return noise;
}

/** One snare-like hit: a burst of filtered noise plus a short low "body". */
function snare(ac: AudioContext, out: AudioNode, at: number, volume: number) {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac);
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1900;
  filter.Q.value = 0.7;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
  src.connect(filter).connect(gain).connect(out);
  src.start(at, Math.random() * 0.5, 0.12);

  const body = ac.createOscillator();
  const bodyGain = ac.createGain();
  body.type = "triangle";
  body.frequency.setValueAtTime(190, at);
  body.frequency.exponentialRampToValueAtTime(110, at + 0.06);
  bodyGain.gain.setValueAtTime(0.0001, at);
  bodyGain.gain.exponentialRampToValueAtTime(volume * 0.5, at + 0.003);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
  body.connect(bodyGain).connect(out);
  body.start(at);
  body.stop(at + 0.1);
}

/**
 * A drum roll that swells for `seconds`, with louder hits at `accents`
 * (seconds from now), ending in a cymbal crash and a short fanfare.
 * Returns a function that silences it (e.g. when the screen changes).
 */
export function playDrumRoll(seconds: number, accents: number[] = []): () => void {
  if (muted || !ctx || ctx.state !== "running") return () => {};
  const ac = ctx;
  const master = ac.createGain();
  master.gain.value = 0.9;
  master.connect(ac.destination);
  const start = ac.currentTime + 0.05;

  // The roll: a hit every 45 ms, swelling from soft to loud.
  const step = 0.045;
  for (let t = 0; t < seconds; t += step) {
    const swell = 0.06 + 0.3 * (t / seconds) ** 1.5;
    snare(ac, master, start + t + (Math.random() - 0.5) * 0.006, swell);
  }
  for (const a of accents) if (a < seconds) snare(ac, master, start + a, 0.6);

  // Crash: long bright noise.
  const end = start + seconds;
  const crash = ac.createBufferSource();
  crash.buffer = noiseBuffer(ac);
  const high = ac.createBiquadFilter();
  high.type = "highpass";
  high.frequency.value = 5000;
  const crashGain = ac.createGain();
  crashGain.gain.setValueAtTime(0.0001, end);
  crashGain.gain.exponentialRampToValueAtTime(0.5, end + 0.01);
  crashGain.gain.exponentialRampToValueAtTime(0.0001, end + 1.8);
  crash.connect(high).connect(crashGain).connect(master);
  crash.loop = true;
  crash.start(end);
  crash.stop(end + 1.9);
  snare(ac, master, end, 0.7);

  // Fanfare: a quick rising C-major arpeggio, then the chord.
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => {
    const at = end + 0.05 + i * 0.09;
    const hold = i === notes.length - 1 ? 1.2 : 0.9 - i * 0.09;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = "triangle";
    osc.frequency.value = f;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.22, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + hold);
    osc.connect(g).connect(master);
    osc.start(at);
    osc.stop(at + hold + 0.05);
  });

  return () => {
    master.gain.cancelScheduledValues(ac.currentTime);
    master.gain.setValueAtTime(0, ac.currentTime);
    setTimeout(() => master.disconnect(), 50);
  };
}

/** A second passing on the "next question in…" countdown. */
export function playCountdownBeep(last: boolean) {
  tone(last ? 1047 : 660, { length: last ? 0.25 : 0.1, volume: 0.3, type: "triangle" });
}
