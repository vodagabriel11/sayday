import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { AlarmItem } from "./alarm-service";

export type ReminderNotif = {
  offsetMinutes: number;
  type: string;
  isEnabled: boolean;
};

const ALARM_CHANNEL_ID = "sayday_alarm";

export async function createNotificationChannels(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (Capacitor.getPlatform() !== "android") return;
  try {
    await LocalNotifications.createChannel({
      id: ALARM_CHANNEL_ID,
      name: "Reminders & Alarms",
      description: "Alarm notifications for reminders and events",
      importance: 5,       // IMPORTANCE_HIGH (bypasses DND on Android)
      visibility: 1,       // VISIBILITY_PUBLIC (shows on lock screen)
      sound: "alarm",      // references res/raw/alarm.wav
      vibration: true,
      lights: true,
    });
  } catch {}
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const result = await LocalNotifications.requestPermissions();
    return result.display === "granted";
  } catch {
    return false;
  }
}

export async function testNotification(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    alert("Not native platform!");
    return;
  }
  try {
    const perm = await LocalNotifications.requestPermissions();
    const pending = await LocalNotifications.getPending();

    if (perm.display !== "granted") {
      alert(`Permission: ${perm.display}\nGo to Settings → Sayday → Notifications`);
      return;
    }

    await LocalNotifications.cancel({
      notifications: pending.notifications.map((n) => ({ id: n.id })),
    });

    const notif: any = {
      id: 88888,
      title: "⏰ Sayday Alarm",
      body: "Alarm is working!",
      schedule: { at: new Date(Date.now() + 10000) },
      sound: Capacitor.getPlatform() === "ios" ? "alarm.caf" : "alarm",
      extra: { itemId: 0, notifType: "call" },
    };
    if (Capacitor.getPlatform() === "android") {
      notif.channelId = ALARM_CHANNEL_ID;
    }

    await LocalNotifications.schedule({ notifications: [notif] });

    const after = await LocalNotifications.getPending();
    alert(
      `Permission: ${perm.display}\n` +
      `Pending before: ${pending.notifications.length}\n` +
      `Pending after: ${after.notifications.length}\n` +
      `→ Lock phone now, wait 10 seconds`
    );
  } catch (e: any) {
    alert("Error: " + (e?.message || JSON.stringify(e)));
  }
}

export async function scheduleItemNotifications(
  item: AlarmItem,
  reminders: ReminderNotif[]
) {
  if (!Capacitor.isNativePlatform() || !item.startAt) return;

  const perm = await LocalNotifications.checkPermissions();
  if (perm.display !== "granted") return;

  const now = Date.now();
  const isAndroid = Capacitor.getPlatform() === "android";
  const notifications: any[] = [];

  for (let i = 0; i < reminders.length; i++) {
    const r = reminders[i];
    if (!r.isEnabled) continue;

    const fireAt = new Date(
      new Date(item.startAt).getTime() - r.offsetMinutes * 60000
    );
    if (fireAt.getTime() <= now) continue;

    const id = Math.abs((item.id * 100 + i) % 2147483000);
    const isVibrate = r.type === "vibrate" || r.type === "push";
    const body =
      r.offsetMinutes === 0
        ? item.description || item.title
        : `In ${r.offsetMinutes} min: ${item.title}`;

    const notif: any = {
      id,
      title: item.emoji ? `${item.emoji} ${item.title}` : item.title,
      body,
      schedule: { at: fireAt },
      sound: isVibrate ? undefined : (isAndroid ? "alarm" : "alarm.caf"),
      extra: { itemId: item.id, notifType: r.type },
    };

    if (isAndroid) {
      notif.channelId = ALARM_CHANNEL_ID;
    }

    notifications.push(notif);
  }

  if (notifications.length > 0) {
    try {
      await LocalNotifications.schedule({ notifications });
    } catch {}
  }
}

export async function cancelItemNotifications(itemId: number) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const pending = await LocalNotifications.getPending();
    const toCancel = pending.notifications
      .filter((n) => {
        const extra = (n as any).extra;
        return extra?.itemId === itemId;
      })
      .map((n) => ({ id: n.id }));
    if (toCancel.length > 0) {
      await LocalNotifications.cancel({ notifications: toCancel });
    }
  } catch {}
}

export async function cancelAllItemNotifications() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({
        notifications: pending.notifications.map((n) => ({ id: n.id })),
      });
    }
  } catch {}
}
