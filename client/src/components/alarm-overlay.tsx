import { useState, useEffect, useCallback, useRef } from "react";
import { Calendar, Bell, Check, Clock, X, AlarmClock, Volume2, Vibrate } from "lucide-react";
import { alarmService, type AlarmItem, type AlarmMode } from "@/lib/alarm-service";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

export function AlarmOverlay() {
  const [activeAlarm, setActiveAlarm] = useState<AlarmItem | null>(null);
  const [alarmMode, setAlarmMode] = useState<AlarmMode>("call");
  const [snoozed, setSnoozed] = useState(false);
  const snoozeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerAlarmForItem = useCallback(async (itemId: number, notifType: string) => {
    try {
      const res = await fetch(`/api/items/${itemId}`, { credentials: "include" });
      const item = await res.json();
      if (!item || !item.id) return;
      const mode: AlarmMode = notifType === "vibrate" || notifType === "push" ? "vibrate" : "call";
      setActiveAlarm(item);
      setAlarmMode(mode);
      setSnoozed(false);
      if (mode === "call") alarmService.playSound();
      else alarmService.startVibrating();
    } catch {}
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let foregroundListener: any;
    let tapListener: any;

    LocalNotifications.addListener("localNotificationReceived", (notification) => {
      const { itemId, notifType } = notification.extra || {};
      if (itemId) triggerAlarmForItem(itemId, notifType || "call");
    }).then((l) => { foregroundListener = l; });

    LocalNotifications.addListener("localNotificationActionPerformed", (action) => {
      const { itemId, notifType } = action.notification.extra || {};
      if (itemId) triggerAlarmForItem(itemId, notifType || "call");
    }).then((l) => { tapListener = l; });

    return () => {
      foregroundListener?.remove();
      tapListener?.remove();
    };
  }, [triggerAlarmForItem]);

  useEffect(() => {
    alarmService.setReminderTypeFetcher(async (itemId: number) => {
      try {
        const res = await fetch(`/api/items/${itemId}/reminders`);
        const reminders = await res.json();
        if (reminders && reminders.length > 0) {
          return reminders[0].type === "push" ? "vibrate" : "call";
        }
      } catch {
        // fallback
      }
      return "call";
    });

    alarmService.setCallback((item, mode) => {
      setActiveAlarm(item);
      setAlarmMode(mode);
      setSnoozed(false);
      if (mode === "vibrate") {
        alarmService.startVibrating();
      }
    });

    return () => {
      alarmService.clearCallback();
      if (snoozeTimerRef.current) clearTimeout(snoozeTimerRef.current);
    };
  }, []);

  const handleDone = useCallback(async () => {
    if (!activeAlarm) return;
    alarmService.stopAll();
    try {
      await apiRequest("POST", `/api/items/${activeAlarm.id}/done`);
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
    } catch {
      // ignore
    }
    setActiveAlarm(null);
  }, [activeAlarm]);

  const handleSnooze = useCallback(() => {
    if (!activeAlarm) return;
    alarmService.snoozeAlarm(activeAlarm, alarmMode, 5);
    setSnoozed(true);
    if (snoozeTimerRef.current) clearTimeout(snoozeTimerRef.current);
    snoozeTimerRef.current = setTimeout(() => setActiveAlarm(null), 1200);
  }, [activeAlarm, alarmMode]);

  const handleDismiss = useCallback(() => {
    alarmService.stopAll();
    setActiveAlarm(null);
  }, []);

  if (!activeAlarm) return null;

  const formatTime = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return `${d.getUTCHours().toString().padStart(2, "0")}:${d.getUTCMinutes().toString().padStart(2, "0")}`;
  };

  const isEvent = activeAlarm.type === "event";
  const Icon = isEvent ? Calendar : Bell;
  const ModeIcon = alarmMode === "call" ? Volume2 : Vibrate;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-[blurReveal_0.3s_ease-out]" data-testid="alarm-overlay">
      <div className="w-[320px] mx-4 rounded-3xl bg-background shadow-2xl overflow-hidden">
        <div className={cn(
          "relative px-6 pt-10 pb-6 flex flex-col items-center text-center",
          isEvent ? "bg-blue-500/10 dark:bg-blue-500/20" : "bg-amber-500/10 dark:bg-amber-500/20"
        )}>
          <div className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center mb-4 animate-pulse",
            isEvent ? "bg-blue-500/20 text-blue-600 dark:text-blue-400" : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
          )}>
            <AlarmClock className="w-8 h-8" />
          </div>

          <div className="flex items-center gap-2 mb-2">
            {activeAlarm.emoji ? (
              <span className="text-base">{activeAlarm.emoji}</span>
            ) : (
              <Icon className={cn(
                "w-4 h-4",
                isEvent ? "text-blue-500" : "text-amber-500"
              )} />
            )}
            <span className={cn(
              "text-xs font-semibold uppercase tracking-wider",
              isEvent ? "text-blue-500" : "text-amber-500"
            )}>
              {isEvent ? "Event" : "Reminder"}
            </span>
            <ModeIcon className="w-3.5 h-3.5 text-muted-foreground" />
          </div>

          <h2 className="text-xl font-bold text-foreground mb-2 leading-tight" data-testid="alarm-title">
            {activeAlarm.title}
          </h2>

          {activeAlarm.startAt && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-sm font-medium">{formatTime(activeAlarm.startAt)}</span>
            </div>
          )}

          {activeAlarm.description && (
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed line-clamp-2">
              {activeAlarm.description}
            </p>
          )}
        </div>

        {snoozed ? (
          <div className="px-6 py-6 flex items-center justify-center gap-2 text-primary">
            <Clock className="w-5 h-5" />
            <span className="font-semibold">Snoozed for 5 minutes</span>
          </div>
        ) : (
          <div className="px-6 py-5 flex flex-col gap-3">
            <button
              onClick={handleDone}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold text-base transition-transform active:scale-[0.97]"
              data-testid="alarm-done"
            >
              <Check className="w-5 h-5" />
              Done
            </button>

            <div className="flex gap-3">
              <button
                onClick={handleSnooze}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-muted text-foreground font-medium text-sm transition-transform active:scale-[0.97]"
                data-testid="alarm-snooze"
              >
                <Clock className="w-4 h-4" />
                Snooze 5m
              </button>
              <button
                onClick={handleDismiss}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-muted text-muted-foreground font-medium text-sm transition-transform active:scale-[0.97]"
                data-testid="alarm-dismiss"
              >
                <X className="w-4 h-4" />
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
