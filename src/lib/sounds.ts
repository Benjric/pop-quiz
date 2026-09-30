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

/** A second passing on the "next question in…" countdown. */
export function playCountdownBeep(last: boolean) {
  tone(last ? 1047 : 660, { length: last ? 0.25 : 0.1, volume: 0.3, type: "triangle" });
}
