import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { AlarmItem } from "./alarm-service";

export type ReminderNotif = {
  offsetMinutes: number;
  type: string;
  isEnabled: boolean;
};

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const result = await LocalNotifications.requestPermissions();
    return result.display === "granted";
  } catch {
    return false;
  }
}

export async function scheduleItemNotifications(
  item: AlarmItem,
  reminders: ReminderNotif[]
) {
  if (!Capacitor.isNativePlatform() || !item.startAt) return;

  const now = Date.now();
  const notifications: any[] = [];

  for (const r of reminders) {
    if (!r.isEnabled) continue;

    const fireAt = new Date(
      new Date(item.startAt).getTime() - r.offsetMinutes * 60000
    );
    if (fireAt.getTime() <= now) continue;

    const id = (item.id % 200000) * 10 + (r.offsetMinutes % 10);

    const isVibrate = r.type === "vibrate" || r.type === "push";
    const body =
      r.offsetMinutes === 0
        ? item.description || "Time!"
        : `In ${r.offsetMinutes} min: ${item.title}`;

    notifications.push({
      id,
      title: item.title,
      body,
      schedule: { at: fireAt, allowWhileIdle: true },
      sound: isVibrate ? undefined : "default",
      extra: { itemId: item.id, notifType: r.type },
    });
  }

  if (notifications.length > 0) {
    await LocalNotifications.schedule({ notifications });
  }
}

export async function cancelItemNotifications(itemId: number) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const pending = await LocalNotifications.getPending();
    const base = (itemId % 200000) * 10;
    const toCancel = pending.notifications
      .filter((n) => n.id >= base && n.id < base + 10)
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
