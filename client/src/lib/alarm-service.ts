import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

export type AlarmItem = {
  id: number;
  type: string;
  title: string;
  description?: string | null;
  startAt: string | null;
  isDone?: boolean;
};

export type AlarmMode = "call" | "vibrate";

type AlarmCallback = (item: AlarmItem, mode: AlarmMode) => void;
type ReminderTypeFetcher = (itemId: number) => Promise<AlarmMode>;

// Singleton AudioContext unlocked on first user interaction (iOS requirement)
let _unlockedCtx: AudioContext | null = null;

export function unlockAudio() {
  if (_unlockedCtx) return;
  try {
    _unlockedCtx = new AudioContext();
    // Play silent buffer to unlock
    const buf = _unlockedCtx.createBuffer(1, 1, 22050);
    const src = _unlockedCtx.createBufferSource();
    src.buffer = buf;
    src.connect(_unlockedCtx.destination);
    src.start(0);
    _unlockedCtx.resume().catch(() => {});
  } catch {}
}

async function getAudioContext(): Promise<AudioContext | null> {
  try {
    const ctx = _unlockedCtx || new AudioContext();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    return ctx;
  } catch {
    return null;
  }
}

class AlarmService {
  private timers: Map<number, ReturnType<typeof setTimeout>> = new Map();
  private activeCtx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private isPlaying = false;
  private callback: AlarmCallback | null = null;
  private reminderTypeFetcher: ReminderTypeFetcher | null = null;

  setCallback(cb: AlarmCallback) {
    this.callback = cb;
  }

  clearCallback() {
    this.callback = null;
  }

  setReminderTypeFetcher(fetcher: ReminderTypeFetcher) {
    this.reminderTypeFetcher = fetcher;
  }

  scheduleAlarm(item: AlarmItem) {
    if (!item.startAt || item.isDone) return;
    this.cancelAlarm(item.id);

    const triggerTime = new Date(item.startAt).getTime();
    if (!Number.isFinite(triggerTime)) return;

    const delay = triggerTime - Date.now();
    if (delay <= 0 || delay > 2147483647) return;

    const timer = setTimeout(() => {
      this.timers.delete(item.id);
      this.fireAlarm(item);
    }, delay);

    this.timers.set(item.id, timer);
  }

  cancelAlarm(itemId: number) {
    const timer = this.timers.get(itemId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(itemId);
    }
  }

  cancelAll() {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers.clear();
  }

  snoozeAlarm(item: AlarmItem, mode: AlarmMode, minutes = 5) {
    this.stopAll();
    this.scheduleAlarm({
      ...item,
      startAt: new Date(Date.now() + minutes * 60000).toISOString(),
    });
  }

  syncAlarms(items: AlarmItem[]) {
    this.cancelAll();
    for (const item of items) {
      if (item.startAt && !item.isDone && (item.type === "event" || item.type === "reminder")) {
        this.scheduleAlarm(item);
      }
    }
  }

  private async fireAlarm(item: AlarmItem) {
    let mode: AlarmMode = "call";
    if (this.reminderTypeFetcher) {
      try {
        mode = await this.reminderTypeFetcher(item.id);
      } catch {
        mode = "call";
      }
    }

    if (mode === "call") {
      await this.playSound();
    } else {
      this.vibrate();
    }

    if (this.callback) {
      this.callback(item, mode);
    }
  }

  async playSound() {
    this.stopSound();
    try {
      const ctx = await getAudioContext();
      if (!ctx) return;

      this.activeCtx = ctx;
      this.gainNode = ctx.createGain();
      this.gainNode.connect(ctx.destination);
      this.gainNode.gain.value = 1.0;
      this.isPlaying = true;
      this._playPattern(ctx);
    } catch {}
  }

  private _playPattern(ctx: AudioContext) {
    if (!this.isPlaying || !this.gainNode) return;

    const now = ctx.currentTime;

    for (let cycle = 0; cycle < 4; cycle++) {
      const offset = cycle * 1.2;
      for (let beep = 0; beep < 3; beep++) {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.connect(env);
        env.connect(this.gainNode!);
        osc.frequency.value = beep === 2 ? 880 : 660;
        osc.type = "sine";
        const t = now + offset + beep * 0.25;
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(1.0, t + 0.02);
        env.gain.linearRampToValueAtTime(0, t + 0.2);
        osc.start(t);
        osc.stop(t + 0.22);
      }
    }

    if (this.isPlaying) {
      setTimeout(() => this._playPattern(ctx), 5000);
    }
  }

  private isVibrating = false;
  private vibrateTimer: ReturnType<typeof setTimeout> | null = null;

  vibrate() {
    this.isVibrating = true;
    this._vibratePattern();
  }

  private async _vibratePattern() {
    if (!this.isVibrating) return;
    if (Capacitor.isNativePlatform()) {
      for (let i = 0; i < 3 && this.isVibrating; i++) {
        await Haptics.impact({ style: ImpactStyle.Heavy });
        await new Promise((r) => setTimeout(r, 200));
      }
    } else if (navigator.vibrate) {
      navigator.vibrate([300, 200, 300, 200, 300]);
    }
    if (this.isVibrating) {
      this.vibrateTimer = setTimeout(() => this._vibratePattern(), 2000);
    }
  }

  startVibrating() {
    this.isVibrating = true;
    this._vibratePattern();
  }

  stopVibration() {
    this.isVibrating = false;
    if (this.vibrateTimer) {
      clearTimeout(this.vibrateTimer);
      this.vibrateTimer = null;
    }
  }

  stopSound() {
    this.isPlaying = false;
    if (this.activeCtx && this.activeCtx !== _unlockedCtx) {
      try { this.activeCtx.close(); } catch {}
    }
    this.activeCtx = null;
    this.gainNode = null;
  }

  stopAll() {
    this.stopSound();
    this.stopVibration();
  }

  getScheduledCount() {
    return this.timers.size;
  }
}

export const alarmService = new AlarmService();
