import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type Item, type ItemReminder } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Bell, Phone, Clock, Save, Repeat, Trash2, Vibrate } from "lucide-react";

const OFFSET_OPTIONS = [
  { label: "At time", value: 0 },
  { label: "5 min", value: 5 },
  { label: "10 min", value: 10 },
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "1 hour", value: 60 },
  { label: "2 hours", value: 120 },
  { label: "1 day", value: 1440 },
];

const RECURRING_PRESETS = [
  { label: "Every 30 min", value: 30 },
  { label: "Hourly", value: 60 },
  { label: "Every 2 hours", value: 120 },
  { label: "Every 3 hours", value: 180 },
  { label: "Every 6 hours", value: 360 },
  { label: "Daily", value: 1440 },
  { label: "Weekly", value: 10080 },
  { label: "Monthly", value: 43200 },
];

interface EventDetailSheetProps {
  item: Item | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EventDetailSheet({ item, open, onOpenChange }: EventDetailSheetProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notifType, setNotifType] = useState<"call" | "vibrate">("call");
  const [recurringInterval, setRecurringInterval] = useState<number | null>(null);
  const [showRecurringPanel, setShowRecurringPanel] = useState(false);
  const [showCustomRecurring, setShowCustomRecurring] = useState(false);
  const [customHours, setCustomHours] = useState("");
  const [customMinutes, setCustomMinutes] = useState("");

  const { data: reminders, isFetched: remindersFetched } = useQuery<ItemReminder[]>({
    queryKey: ["/api/items", item?.id, "reminders"],
    queryFn: async () => {
      if (!item) return [];
      const res = await fetch(`/api/items/${item.id}/reminders`);
      return res.json();
    },
    enabled: !!item && open,
    staleTime: 60_000,
    placeholderData: [],
  });

  useEffect(() => {
    if (item) {
      setTitle(item.title);
      if (item.startAt) {
        const d = new Date(item.startAt);
        const yyyy = d.getFullYear();
        const mo = (d.getMonth() + 1).toString().padStart(2, "0");
        const dd = d.getDate().toString().padStart(2, "0");
        const hh = d.getHours().toString().padStart(2, "0");
        const mm = d.getMinutes().toString().padStart(2, "0");
        setDate(`${yyyy}-${mo}-${dd}`);
        setTime(`${hh}:${mm}`);
      } else {
        setDate("");
        setTime("");
      }
      if (item.endAt) {
        const ed = new Date(item.endAt);
        const ehh = ed.getHours().toString().padStart(2, "0");
        const emm = ed.getMinutes().toString().padStart(2, "0");
        setEndTime(`${ehh}:${emm}`);
      } else {
        setEndTime("");
      }
      setRecurringInterval((item as any).recurringInterval || null);
      setShowRecurringPanel(!!(item as any).recurringInterval);
      setShowCustomRecurring(false);
      setCustomHours("");
      setCustomMinutes("");
    }
  }, [item]);

  useEffect(() => {
    if (!remindersFetched) return;
    if (reminders && reminders.length > 0) {
      const hasCall = reminders.some(r => r.type === "call");
      setNotifType(hasCall ? "call" : "vibrate");
    } else {
      setNotifType("call");
    }
  }, [reminders, remindersFetched]);

  const updateItemMutation = useMutation({
    mutationFn: async () => {
      if (!item) return;
      const data: any = { title, recurringInterval: recurringInterval || null };
      if (date && time) {
        const [y, mo, d] = date.split("-").map(Number);
        const [h, m] = time.split(":").map(Number);
        data.startAt = new Date(y, mo - 1, d, h, m, 0).toISOString();
      }
      if (date && endTime) {
        const [y, mo, d] = date.split("-").map(Number);
        const [h, m] = endTime.split(":").map(Number);
        data.endAt = new Date(y, mo - 1, d, h, m, 0).toISOString();
      }
      return apiRequest("PATCH", `/api/items/${item.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Could not save.", variant: "destructive" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async () => {
      if (!item) return;
      return apiRequest("DELETE", `/api/items/${item.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Could not delete.", variant: "destructive" });
    },
  });

  const [optimisticOffsets, setOptimisticOffsets] = useState<Set<number> | null>(null);
  const remindersList = Array.isArray(reminders) ? reminders : [];

  const toggleOffsetMutation = useMutation({
    mutationFn: async (offsetValue: number) => {
      if (!item) return;
      const existing = remindersList.find(r => r.offsetMinutes === offsetValue);
      if (existing) {
        return apiRequest("DELETE", `/api/reminders/${existing.id}`);
      } else {
        return apiRequest("POST", "/api/reminders", {
          itemId: item.id,
          type: notifType,
          offsetMinutes: offsetValue,
          isEnabled: true,
        });
      }
    },
    onMutate: (offsetValue: number) => {
      const current = new Set(remindersList.map(r => r.offsetMinutes));
      if (current.has(offsetValue)) {
        current.delete(offsetValue);
      } else {
        current.add(offsetValue);
      }
      setOptimisticOffsets(current);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/items", item?.id, "reminders"] });
      setOptimisticOffsets(null);
    },
    onError: () => { setOptimisticOffsets(null); },
  });

  const updateAllTypesMutation = useMutation({
    mutationFn: async (type: "call" | "vibrate") => {
      if (!item || remindersList.length === 0) return;
      await Promise.all(
        remindersList.map(r => apiRequest("PATCH", `/api/reminders/${r.id}`, { type }))
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/items", item?.id, "reminders"] });
    },
  });

  const activeOffsets = optimisticOffsets ?? new Set(remindersList.map(r => r.offsetMinutes));

  function handleTypeChange(type: "call" | "vibrate") {
    setNotifType(type);
    if (remindersList.length > 0) {
      updateAllTypesMutation.mutate(type);
    }
  }

  if (!item) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[95vh] !bottom-auto !top-1/2 !-translate-y-1/2 rounded-2xl mx-auto max-w-lg !inset-x-4 overflow-y-auto z-[70]" onOpenAutoFocus={(e) => e.preventDefault()} data-testid="event-detail-sheet">
        <SheetHeader className="mb-5">
          <SheetTitle className="text-lg">{item.type === "reminder" ? "Reminder" : "Event"} Settings</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 pb-8">
          <div className="space-y-1.5">
            <Label htmlFor="event-title" className="text-sm font-medium">Name</Label>
            <Input
              id="event-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Name"
              data-testid="input-event-title"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Date & Time</Label>
            <div className="grid grid-cols-3 gap-2">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="text-xs h-11 cursor-pointer picker-full" data-testid="input-event-date" />
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="text-xs h-11 cursor-pointer picker-full" data-testid="input-event-start-time" />
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} placeholder="End" className="text-xs h-11 cursor-pointer picker-full" data-testid="input-event-end-time" />
            </div>
            <p className="text-[11px] text-muted-foreground">Start time — End time</p>
          </div>

          {(<>
          <div className="space-y-3">
            <Label className="text-sm font-medium">Notification type</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleTypeChange("call")}
                className={cn(
                  "flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all text-sm",
                  notifType === "call"
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-gray-200 dark:border-gray-700 text-muted-foreground hover:border-gray-300"
                )}
                data-testid="button-notif-call"
              >
                <Phone className="w-4 h-4" />
                Call Me
              </button>
              <button
                onClick={() => handleTypeChange("vibrate")}
                className={cn(
                  "flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all text-sm",
                  notifType === "vibrate"
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-gray-200 dark:border-gray-700 text-muted-foreground hover:border-gray-300"
                )}
                data-testid="button-notif-vibrate"
              >
                <Vibrate className="w-4 h-4" />
                Vibrate
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Remind me
            </Label>
            <p className="text-[11px] text-muted-foreground">Tap to add or remove. Select multiple.</p>
            <div className="flex flex-wrap gap-1.5">
              {OFFSET_OPTIONS.map((opt) => {
                const isAtTime = opt.value === 0;
                const lockedOn = isAtTime && !!recurringInterval;
                return (
                  <button
                    key={opt.value}
                    onClick={() => { if (!lockedOn) toggleOffsetMutation.mutate(opt.value); }}
                    disabled={toggleOffsetMutation.isPending || lockedOn}
                    className={cn(
                      "text-xs px-3 py-2 rounded-xl border-2 transition-all",
                      activeOffsets.has(opt.value) || lockedOn
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-gray-200 dark:border-gray-700 text-muted-foreground hover:border-gray-300",
                      lockedOn && "opacity-70 cursor-not-allowed"
                    )}
                    data-testid={`button-offset-${opt.value}`}
                  >
                    {opt.label}
                  </button>
                );
              })}
              <button
                onClick={() => {
                  const opening = !showRecurringPanel;
                  setShowRecurringPanel(opening);
                  if (!opening && recurringInterval) {
                    setRecurringInterval(null);
                    setShowCustomRecurring(false);
                  }
                  if (opening && !activeOffsets.has(0)) {
                    toggleOffsetMutation.mutate(0);
                  }
                }}
                className={cn(
                  "flex items-center gap-1 text-xs px-3 py-2 rounded-xl border-2 transition-all",
                  showRecurringPanel || recurringInterval
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-gray-200 dark:border-gray-700 text-muted-foreground hover:border-gray-300"
                )}
                data-testid="button-recurring-toggle"
              >
                <Repeat className="w-3 h-3" />
                Recurring
              </button>
            </div>

            {showRecurringPanel && (
              <div className="mt-2 space-y-2 pl-0.5">
                <p className="text-[11px] text-muted-foreground">Set a repeating schedule. Tap again to remove.</p>
                <div className="flex flex-wrap gap-1.5">
                  {RECURRING_PRESETS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setRecurringInterval(recurringInterval === opt.value ? null : opt.value);
                        setShowCustomRecurring(false);
                      }}
                      className={cn(
                        "text-xs px-3 py-2 rounded-xl border-2 transition-all",
                        recurringInterval === opt.value
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-gray-200 dark:border-gray-700 text-muted-foreground hover:border-gray-300"
                      )}
                      data-testid={`button-recurring-${opt.value}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setShowCustomRecurring(!showCustomRecurring);
                      if (!showCustomRecurring) {
                        const isPreset = RECURRING_PRESETS.some(p => p.value === recurringInterval);
                        if (recurringInterval && !isPreset) {
                          setCustomHours(Math.floor(recurringInterval / 60).toString());
                          setCustomMinutes((recurringInterval % 60).toString());
                        }
                      }
                    }}
                    className={cn(
                      "text-xs px-3 py-2 rounded-xl border-2 transition-all",
                      showCustomRecurring || (recurringInterval && !RECURRING_PRESETS.some(p => p.value === recurringInterval))
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-gray-200 dark:border-gray-700 text-muted-foreground hover:border-gray-300"
                    )}
                    data-testid="button-recurring-custom"
                  >
                    Custom
                  </button>
                </div>
                {showCustomRecurring && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min="0"
                        max="720"
                        value={customHours}
                        onChange={(e) => setCustomHours(e.target.value)}
                        placeholder="0"
                        className="w-16 h-9 text-center text-sm"
                        data-testid="input-recurring-hours"
                      />
                      <span className="text-xs text-muted-foreground">h</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min="0"
                        max="59"
                        value={customMinutes}
                        onChange={(e) => setCustomMinutes(e.target.value)}
                        placeholder="0"
                        className="w-16 h-9 text-center text-sm"
                        data-testid="input-recurring-minutes"
                      />
                      <span className="text-xs text-muted-foreground">min</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 text-xs"
                      onClick={() => {
                        const h = parseInt(customHours) || 0;
                        const m = parseInt(customMinutes) || 0;
                        const total = h * 60 + m;
                        if (total > 0) {
                          setRecurringInterval(total);
                          setShowCustomRecurring(false);
                        }
                      }}
                      data-testid="button-recurring-apply"
                    >
                      Apply
                    </Button>
                  </div>
                )}
                {recurringInterval && !RECURRING_PRESETS.some(p => p.value === recurringInterval) && !showCustomRecurring && (
                  <p className="text-[11px] text-primary font-medium">
                    Custom: every {Math.floor(recurringInterval / 60) > 0 ? `${Math.floor(recurringInterval / 60)}h ` : ""}{recurringInterval % 60 > 0 ? `${recurringInterval % 60}min` : ""}
                  </p>
                )}
              </div>
            )}
          </div>
          </>)}


          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() => deleteItemMutation.mutate()}
              disabled={deleteItemMutation.isPending}
              className="h-11 gap-2 text-sm font-medium text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
              data-testid="button-delete-event"
            >
              <Trash2 className="w-4 h-4" />
              {deleteItemMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
            <Button
              onClick={() => updateItemMutation.mutate()}
              disabled={updateItemMutation.isPending || !title.trim()}
              className="h-11 gap-2 text-sm font-medium"
              data-testid="button-save-event"
            >
              <Save className="w-4 h-4" />
              {updateItemMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
