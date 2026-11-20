"use client";

// Pengaturan notifikasi PER PERANGKAT (frontend-guide §13.5), lewat lib/storage.ts.
import { useStoredState } from "@/lib/storage";

export type Tone = "ding" | "chime" | "pop";
export type NotificationSettings = { sound: boolean; volume: number; tone: Tone; browser: boolean };

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = { sound: true, volume: 0.6, tone: "ding", browser: true };
export const TONE_LABELS: Record<Tone, string> = { ding: "Ding", chime: "Chime (dua nada)", pop: "Pop" };
export const NOTIFICATION_SETTINGS_KEY = "notification-settings";

export function useNotificationSettings() {
  const [stored, setStored] = useStoredState<NotificationSettings>(NOTIFICATION_SETTINGS_KEY, DEFAULT_NOTIFICATION_SETTINGS);
  const settings = { ...DEFAULT_NOTIFICATION_SETTINGS, ...stored };
  const update = (patch: Partial<NotificationSettings>) => setStored({ ...settings, ...patch });
  return { settings, update };
}
