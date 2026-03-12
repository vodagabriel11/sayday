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

class AlarmService {
  private timers: Map<number, ReturnType<typeof setTimeout>> = new Map();
  private audioContext: AudioContext | null = null;
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

    const now = Date.now();
    const delay = triggerTime - now;

    if (delay <= 0) return;

    const MAX_TIMEOUT = 2147483647;
    if (delay > MAX_TIMEOUT) return;

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
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
  }

  snoozeAlarm(item: AlarmItem, mode: AlarmMode, minutes: number = 5) {
    this.stopSound();
    this.stopVibration();
    const snoozedItem = {
      ...item,
      _alarmMode: mode,
      startAt: new Date(Date.now() + minutes * 60 * 1000).toISOString(),
    };
    this.scheduleAlarm(snoozedItem);
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
      this.playSound();
    } else {
      this.vibrate();
    }

    if (this.callback) {
      this.callback(item, mode);
    }
  }

  playSound() {
    this.stopSound();
    try {
      this.audioContext = new AudioContext();
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
      this.gainNode.gain.value = 0.3;
      this.isPlaying = true;
      this.playAlarmPattern();
    } catch {
      // Web Audio not supported
    }
  }

  private playAlarmPattern() {
    if (!this.audioContext || !this.gainNode || !this.isPlaying) return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    for (let cycle = 0; cycle < 4; cycle++) {
      const offset = cycle * 1.2;

      for (let beep = 0; beep < 3; beep++) {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.connect(env);
        env.connect(this.gainNode);
        osc.frequency.value = beep === 2 ? 880 : 660;
        osc.type = "sine";
        const start = now + offset + beep * 0.25;
        env.gain.setValueAtTime(0, start);
        env.gain.linearRampToValueAtTime(0.4, start + 0.02);
        env.gain.linearRampToValueAtTime(0, start + 0.2);
        osc.start(start);
        osc.stop(start + 0.22);
      }
    }

    if (this.isPlaying) {
      setTimeout(() => this.playAlarmPattern(), 5000);
    }
  }

  private isVibrating = false;
  private vibrateTimer: ReturnType<typeof setTimeout> | null = null;

  vibrate() {
    this.isVibrating = true;
    this.vibratePattern();
  }

  private vibratePattern() {
    if (!this.isVibrating) return;
    if (navigator.vibrate) {
      navigator.vibrate([300, 200, 300, 200, 300]);
    }
    this.vibrateTimer = setTimeout(() => this.vibratePattern(), 3000);
  }

  startVibrating() {
    this.isVibrating = true;
    this.vibratePattern();
  }

  stopVibration() {
    this.isVibrating = false;
    if (this.vibrateTimer) {
      clearTimeout(this.vibrateTimer);
      this.vibrateTimer = null;
    }
    if (navigator.vibrate) {
      navigator.vibrate(0);
    }
  }

  stopSound() {
    this.isPlaying = false;
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch {
        // ignore
      }
      this.audioContext = null;
      this.gainNode = null;
    }
  }

  stopAll() {
    this.stopSound();
    this.stopVibration();
  }

  getScheduledCount(): number {
    return this.timers.size;
  }
}

export const alarmService = new AlarmService();
