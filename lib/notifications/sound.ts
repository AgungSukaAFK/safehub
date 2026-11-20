"use client";

// Suara notifikasi sintetis (Web Audio, tanpa file → jalan offline). Browser memblokir audio sebelum
// ada interaksi user; kegagalan diabaikan.
import type { Tone } from "@/lib/notifications/settings";

let ctx: AudioContext | null = null;

const TONES: Record<Tone, { freq: number; at: number; dur: number; type: OscillatorType }[]> = {
  ding: [{ freq: 880, at: 0, dur: 0.35, type: "sine" }],
  chime: [
    { freq: 784, at: 0, dur: 0.22, type: "sine" },
    { freq: 1047, at: 0.16, dur: 0.35, type: "sine" },
  ],
  pop: [{ freq: 520, at: 0, dur: 0.12, type: "triangle" }],
};

export function playNotificationSound(tone: Tone = "ding", volume = 0.6) {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    for (const n of TONES[tone]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = n.type;
      osc.frequency.value = n.freq;
      gain.gain.setValueAtTime(0.0001, now + n.at);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.25 * volume), now + n.at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.at + n.dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + n.at);
      osc.stop(now + n.at + n.dur + 0.05);
    }
  } catch {
    /* audio tidak tersedia */
  }
}
