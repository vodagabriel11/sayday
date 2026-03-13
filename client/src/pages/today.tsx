import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { type Item, type ItemReminder } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, ChevronUp, ChevronDown, Bell, Clock, Phone, Repeat, Settings2, Vibrate, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { EventDetailSheet } from "@/components/event-detail-sheet";

function formatOffset(minutes: number): string {
  if (minutes === 0) return "At time";
  if (minutes < 60) return `${minutes} min`;
  if (minutes === 60) return "1 hour";
  if (minutes < 1440) return `${minutes / 60} hours`;
  return "1 day";
}

function formatRecurringLabel(minutes: number): string {
  if (minutes === 60) return "Hourly";
  if (minutes === 1440) return "Daily";
  if (minutes === 10080) return "Weekly";
  if (minutes === 43200) return "Monthly";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `Every ${m} min`;
  if (m === 0) return h === 1 ? "Every 1 hour" : `Every ${h} hours`;
  return `Every ${h}h ${m}min`;
}


function formatHour(hour: number, use24h = false) {
  if (hour === 24) return use24h ? "00:00" : "12 AM";
  if (use24h) return `${hour.toString().padStart(2, "0")}:00`;
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

function formatTimeShort(date: Date | string, use24h = false) {
  const d = new Date(date);
  const h = d.getHours();
  const m = d.getMinutes();
  if (use24h) return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function getDurationStr(startAt: Date | string, endAt: Date | string | null) {
  if (!endAt) return null;
  const diff = new Date(endAt).getTime() - new Date(startAt).getTime();
  const mins = Math.round(diff / 60000);
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem > 0 ? `${hrs}hr ${rem}min` : `${hrs}hr`;
  }
  return `${mins}min`;
}

interface TimelineCardProps {
  item: Item;
  reminders: ItemReminder[];
  onDragStart: (e: React.DragEvent, item: Item) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onCardClick: (item: Item) => void;
  compact: boolean;
  use24h: boolean;
  dragPreviewTime?: string | null;
}

const CARD_COLOR_OPTIONS = [
  { key: "amber", label: "Amber", swatch: "bg-amber-400", bg: "bg-amber-50/50 dark:bg-amber-950/20", border: "border-amber-100/60 dark:border-amber-900/30", icon: "text-amber-500", timeBg: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  { key: "blue", label: "Blue", swatch: "bg-blue-400", bg: "bg-blue-50/50 dark:bg-blue-950/20", border: "border-blue-100/60 dark:border-blue-900/30", icon: "text-blue-500", timeBg: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300", dot: "bg-blue-500" },
  { key: "red", label: "Red", swatch: "bg-red-400", bg: "bg-red-50/50 dark:bg-red-950/20", border: "border-red-100/60 dark:border-red-900/30", icon: "text-red-500", timeBg: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300", dot: "bg-red-500" },
  { key: "purple", label: "Purple", swatch: "bg-purple-400", bg: "bg-purple-50/50 dark:bg-purple-950/20", border: "border-purple-100/60 dark:border-purple-900/30", icon: "text-purple-500", timeBg: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300", dot: "bg-purple-500" },
  { key: "emerald", label: "Green", swatch: "bg-emerald-400", bg: "bg-emerald-50/50 dark:bg-emerald-950/20", border: "border-emerald-100/60 dark:border-emerald-900/30", icon: "text-emerald-500", timeBg: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  { key: "pink", label: "Pink", swatch: "bg-pink-400", bg: "bg-pink-50/50 dark:bg-pink-950/20", border: "border-pink-100/60 dark:border-pink-900/30", icon: "text-pink-500", timeBg: "bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300", dot: "bg-pink-500" },
] as const;

function getCardColors(color: string) {
  const found = CARD_COLOR_OPTIONS.find(c => c.key === color);
  if (found) return { bg: found.bg, border: found.border, icon: found.icon, timeBg: found.timeBg, dot: found.dot };
  return { bg: CARD_COLOR_OPTIONS[0].bg, border: CARD_COLOR_OPTIONS[0].border, icon: CARD_COLOR_OPTIONS[0].icon, timeBg: CARD_COLOR_OPTIONS[0].timeBg, dot: CARD_COLOR_OPTIONS[0].dot };
}

function TimelineCard({ item, reminders, onDragStart, onDragEnd, onCardClick, compact, use24h, dragPreviewTime }: TimelineCardProps) {
  const duration = item.startAt && item.endAt ? getDurationStr(item.startAt, item.endAt) : null;
  const colors = getCardColors(item.color || "amber");
  const hasEmoji = item.emoji && item.emoji.trim().length > 0;
  const Icon = item.type === "event" ? Calendar : Bell;
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showColorPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showColorPicker]);

  const changeColorMutation = useMutation({
    mutationFn: (color: string) => apiRequest("PATCH", `/api/items/${item.id}`, { color }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      setShowColorPicker(false);
    },
  });
  const isActionable = item.type === "reminder" || item.type === "event";

  const [optimisticType, setOptimisticType] = useState<"call" | "vibrate" | null>(null);
  const currentType = optimisticType ?? (reminders && reminders.length > 0 ? (reminders[0].type === "push" ? "vibrate" : reminders[0].type) : "call");

  const toggleAllTypeMutation = useMutation({
    mutationFn: async (type: "call" | "vibrate") => {
      if (!reminders || reminders.length === 0) return;
      await Promise.all(
        reminders.map(r => apiRequest("PATCH", `/api/reminders/${r.id}`, { type }))
      );
    },
    onMutate: (type) => { setOptimisticType(type); },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/items/reminders/batch"] });
      setOptimisticType(null);
    },
    onError: () => { setOptimisticType(null); },
  });

  const doneColors = {
    bg: "bg-gray-50 dark:bg-gray-900/30",
    border: "border-gray-200 dark:border-gray-700/40",
    icon: "text-gray-400",
    timeBg: "bg-gray-100 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400",
  };
  const c = item.isDone ? doneColors : colors;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, item)}
      onDragEnd={onDragEnd}
      onClick={() => onCardClick(item)}
      className={cn(
        "border rounded-2xl p-4 cursor-pointer active:cursor-grabbing transition-all",
        "hover:shadow-md",
        c.bg, c.border,
        compact ? "py-2.5" : "py-4"
      )}
      data-testid={`card-item-${item.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {(item.startAt || dragPreviewTime) && (
            <span className={cn(
              "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md mb-1.5 transition-all",
              dragPreviewTime ? "bg-primary/15 text-primary font-bold scale-105" : c.timeBg
            )}>
              {dragPreviewTime || formatTimeShort(item.startAt!, use24h)}
            </span>
          )}
          <h3
            className={cn(
              "flex items-center gap-1.5 font-semibold text-[15px] leading-tight",
              item.isDone && "line-through text-gray-400"
            )}
            data-testid={`text-title-${item.id}`}
          >
            {hasEmoji ? (
              <span className="text-sm flex-shrink-0">{item.emoji}</span>
            ) : (
              <Icon className={cn("w-3.5 h-3.5 flex-shrink-0", c.icon)} />
            )}
            {item.title}
          </h3>
          {item.type === "note" && (item as any).structuredContent?.bullets && (item as any).structuredContent.bullets.length > 0 && !compact && (
            <div className="mt-1.5" data-testid={`content-preview-${item.id}`}>
              <ul className="space-y-0.5">
                {(item as any).structuredContent.bullets.slice(0, 3).map((bullet: string, i: number) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/80">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
              {(item as any).structuredContent.bullets.length > 3 && (
                <button
                  onClick={(e) => { e.stopPropagation(); onCardClick(item); }}
                  className="text-[11px] text-primary font-medium mt-0.5"
                  data-testid={`button-read-more-${item.id}`}
                >
                  +{(item as any).structuredContent.bullets.length - 3} more
                </button>
              )}
            </div>
          )}

          {isActionable && !item.isDone && (
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); toggleAllTypeMutation.mutate("call"); }}
                  className={cn(
                    "flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border transition-all",
                    currentType === "call"
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border text-muted-foreground hover:border-gray-300"
                  )}
                  data-testid={`today-toggle-call-${item.id}`}
                >
                  <Phone className="w-3 h-3" />
                  Call Me
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleAllTypeMutation.mutate("vibrate"); }}
                  className={cn(
                    "flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border transition-all",
                    currentType === "vibrate"
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border text-muted-foreground hover:border-gray-300"
                  )}
                  data-testid={`today-toggle-vibrate-${item.id}`}
                >
                  <Vibrate className="w-3 h-3" />
                  Vibrate
                </button>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <Clock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                <span className="text-[11px] text-muted-foreground">
                  {reminders && reminders.length > 0 ? [...reminders].sort((a, b) => a.offsetMinutes - b.offsetMinutes).map((r, i) => (
                    <span key={r.id}>
                      {formatOffset(r.offsetMinutes)}{i < reminders.length - 1 ? ",  " : ""}
                    </span>
                  )) : "At time"}
                </span>
                {(item as any).recurringInterval && (
                  <span className="flex items-center gap-0.5 text-[10px] font-semibold text-primary px-1.5 py-0.5 rounded-full flex-shrink-0 ml-1" data-testid={`badge-recurring-${item.id}`}>
                    <Repeat className="w-2.5 h-2.5" />
                    {formatRecurringLabel((item as any).recurringInterval)}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {!item.isDone && (
          <div className="relative flex-shrink-0" ref={colorPickerRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowColorPicker(!showColorPicker); }}
              className={cn("w-5 h-5 rounded-full border-2 border-white dark:border-gray-800 shadow-sm transition-transform hover:scale-110", getCardColors(item.color || "amber").dot)}
              data-testid={`button-color-${item.id}`}
            />
            {showColorPicker && (
              <div className="absolute right-0 top-7 z-20 flex gap-1.5 p-2 rounded-xl bg-background border border-border shadow-lg animate-in fade-in zoom-in-95 duration-150">
                {CARD_COLOR_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    onClick={(e) => { e.stopPropagation(); changeColorMutation.mutate(opt.key); }}
                    className={cn(
                      "w-6 h-6 rounded-full transition-transform hover:scale-110 border-2",
                      opt.swatch,
                      (item.color || "amber") === opt.key ? "border-foreground scale-110" : "border-transparent"
                    )}
                    title={opt.label}
                    data-testid={`button-color-option-${opt.key}-${item.id}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Today() {
  const [compact, setCompact] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragItemId, setDragItemId] = useState<number | null>(null);
  const [dragHoverTime, setDragHoverTime] = useState<{ hour: number; minute: number } | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showTimeSettings, setShowTimeSettings] = useState(false);
  const [startHour, setStartHour] = useState(6);
  const [endHour, setEndHour] = useState(24);
  const [use24h, setUse24h] = useState(() => localStorage.getItem("sayday_time_format") === "24h");
  const dragItemRef = useRef<Item | null>(null);
  const lastDragEndRef = useRef(0);
  const { toast } = useToast();

  const autoMarkedRef = useRef<Set<number>>(new Set());
  const recentlyDroppedRef = useRef<Set<number>>(new Set());

  const [todayKey, setTodayKey] = useState(() => new Date().toDateString());
  useEffect(() => {
    const check = setInterval(() => {
      const current = new Date().toDateString();
      if (current !== todayKey) {
        setTodayKey(current);
        setShowDone(false);
        autoMarkedRef.current.clear();
        recentlyDroppedRef.current.clear();
        queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      }
    }, 10000);
    return () => clearInterval(check);
  }, [todayKey]);

  const { data: allItems, isLoading } = useQuery<Item[]>({
    queryKey: ["/api/items"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest("PATCH", `/api/items/${id}`, data);
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/items"] });
      const previous = queryClient.getQueryData<Item[]>(["/api/items"]);
      queryClient.setQueryData<Item[]>(["/api/items"], (old) =>
        old?.map((item) =>
          item.id === id
            ? {
                ...item,
                ...(data.startAt ? { startAt: new Date(data.startAt) } : {}),
                ...(data.endAt ? { endAt: new Date(data.endAt) } : {}),
                ...(data.isDone !== undefined ? { isDone: data.isDone } : {}),
              }
            : item
        )
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/items"], context.previous);
      }
      toast({ title: "Error", description: "Could not update item.", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
    },
  });

  const doneMutation = useMutation({
    mutationFn: async (item: Item) => {
      return apiRequest("POST", `/api/items/${item.id}/done`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
    },
  });

  const isDateToday = (d: Date | string) => {
    const date = new Date(d);
    const now = new Date();
    return date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();
  };

  const todayItems = allItems?.filter((item) => {
    if (!item.startAt) return false;
    return isDateToday(item.startAt);
  }) || [];

  const actionableIds = todayItems
    .filter(i => i.type === "reminder" || i.type === "event")
    .map(i => i.id);

  const { data: batchReminders } = useQuery<Record<number, ItemReminder[]>>({
    queryKey: ["/api/items/reminders/batch", ...actionableIds],
    queryFn: async () => {
      if (actionableIds.length === 0) return {};
      const res = await apiRequest("POST", "/api/items/reminders/batch", { itemIds: actionableIds });
      return res.json();
    },
    enabled: actionableIds.length > 0,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const autoMarkInitialRef = useRef(false);
  const [autoMarkTick, setAutoMarkTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setAutoMarkTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    void autoMarkTick;
    if (isDragging) return;
    if (Date.now() - lastDragEndRef.current < 10000) return;
    const now = new Date();
    const nowH = now.getHours();
    const nowM = now.getMinutes();
    const toMark: Item[] = [];
    todayItems.forEach((item) => {
      if (!item.startAt || item.isDone || autoMarkedRef.current.has(item.id) || recentlyDroppedRef.current.has(item.id)) return;
      if (item.type !== "event" && item.type !== "reminder") return;
      const d = new Date(item.startAt);
      const h = d.getHours();
      const m = d.getMinutes();
      if (h < nowH || (h === nowH && m < nowM)) {
        toMark.push(item);
      }
    });
    if (toMark.length === 0) return;
    queryClient.setQueryData<Item[]>(["/api/items"], (old) =>
      old?.map((item) =>
        toMark.some(m => m.id === item.id) ? { ...item, isDone: true } : item
      )
    );
    toMark.forEach((item) => {
      autoMarkedRef.current.add(item.id);
      apiRequest("PATCH", `/api/items/${item.id}`, { isDone: true }).catch(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      });
    });
  }, [todayItems, autoMarkTick, isDragging]);

  const doneCount = todayItems.filter(item => item.isDone).length;

  const visibleItems = showDone ? todayItems : todayItems.filter(item => !item.isDone);

  const hoursWithItems = new Set<number>();
  visibleItems.forEach((item) => {
    if (item.startAt) hoursWithItems.add(new Date(item.startAt).getHours());
  });

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeLabel = (() => {
    if (use24h) return `${currentHour.toString().padStart(2, "0")}:${currentMinute.toString().padStart(2, "0")}`;
    const h = currentHour % 12 || 12;
    const ampm = currentHour >= 12 ? "PM" : "AM";
    return `${h}:${currentMinute.toString().padStart(2, "0")} ${ampm}`;
  })();

  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const getMinuteFromSlot = useCallback((e: React.DragEvent, slotEl: HTMLElement): number => {
    const rect = slotEl.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const pct = Math.max(0, Math.min(1, y / rect.height));
    return Math.min(59, Math.floor(pct * 60));
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, item: Item) => {
    dragItemRef.current = item;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", item.id.toString());
    const el = e.currentTarget as HTMLElement;
    el.style.opacity = "0.5";
    recentlyDroppedRef.current.add(item.id);
    setDragItemId(item.id);
    setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    const el = e.currentTarget as HTMLElement;
    el.style.opacity = "1";
    setDragHoverTime(null);
    setDragItemId(null);
    lastDragEndRef.current = Date.now();
    if (dragItemRef.current) {
      const itemId = dragItemRef.current.id;
      setTimeout(() => recentlyDroppedRef.current.delete(itemId), 10000);
      dragItemRef.current = null;
    }
    setIsDragging(false);
  }, []);

  const handleDragOverHour = useCallback((e: React.DragEvent, hour: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (e.clientY === 0) return;
    const minute = getMinuteFromSlot(e, e.currentTarget as HTMLElement);
    setDragHoverTime({ hour, minute });
  }, [getMinuteFromSlot]);

  const handleDragLeaveHour = useCallback(() => {
    setDragHoverTime(null);
  }, []);

  const handleDropOnHour = useCallback((e: React.DragEvent, hour: number) => {
    e.preventDefault();
    const minute = getMinuteFromSlot(e, e.currentTarget as HTMLElement);
    setDragHoverTime(null);
    setDragItemId(null);
    setIsDragging(false);

    const item = dragItemRef.current;
    if (!item || !item.startAt) return;

    const oldDate = new Date(item.startAt);
    const newDate = new Date(oldDate);
    newDate.setHours(hour);
    newDate.setMinutes(minute);
    newDate.setSeconds(0);

    let newEndAt = null;
    if (item.endAt) {
      const duration = new Date(item.endAt).getTime() - oldDate.getTime();
      newEndAt = new Date(newDate.getTime() + duration).toISOString();
    }

    const now = new Date();
    const droppedInPast = hour < now.getHours() || (hour === now.getHours() && minute < now.getMinutes());

    const updateData: any = {
      startAt: newDate.toISOString(),
      isDone: droppedInPast,
    };
    if (newEndAt) updateData.endAt = newEndAt;

    autoMarkedRef.current.delete(item.id);
    recentlyDroppedRef.current.add(item.id);
    setTimeout(() => recentlyDroppedRef.current.delete(item.id), 5000);
    updateMutation.mutate({ id: item.id, data: updateData });
  }, [updateMutation, getMinuteFromSlot]);

  const handleToggleDone = useCallback((item: Item) => {
    if (Date.now() - lastDragEndRef.current < 500) return;
    if (item.isDone) {
      updateMutation.mutate({ id: item.id, data: { isDone: false } });
    } else {
      doneMutation.mutate(item);
    }
  }, [updateMutation, doneMutation]);

  const handleCardClick = useCallback((item: Item) => {
    if (Date.now() - lastDragEndRef.current < 500) return;
    setSelectedItem(item);
    setSheetOpen(true);
  }, []);

  const hours = (() => {
    if (compact) {
      return Array.from(hoursWithItems).sort((a, b) => a - b);
    }
    let minHour = startHour;
    let maxHour = endHour;
    hoursWithItems.forEach((h) => {
      if (h < minHour) minHour = h;
      if (h > maxHour) maxHour = h;
    });
    return Array.from({ length: maxHour - minHour + 1 }, (_, i) => i + minHour);
  })();

  return (
    <div className="max-w-2xl mx-auto px-1 py-6">
      <div className="flex items-center justify-between mb-4 px-2">
        <div>
          <h1 className="text-lg font-bold tracking-tight" data-testid="text-today-heading">Today</h1>
          <p className="text-xs text-muted-foreground">{dateStr}</p>
        </div>
        <div className="flex items-center gap-2">
          {doneCount > 0 && (
            <button
              onClick={() => setShowDone(!showDone)}
              className={cn(
                "flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors",
                showDone ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
              data-testid="button-show-done"
            >
              {showDone ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{doneCount}</span>
            </button>
          )}
          {!compact && (
            <button
              onClick={() => setShowTimeSettings(!showTimeSettings)}
              className={cn(
                "flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors",
                showTimeSettings ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
              data-testid="button-time-settings"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => setCompact(!compact)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-muted/50"
            data-testid="button-compact-toggle"
          >
            {compact ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            {compact ? "Extended" : "Compact"}
          </button>
        </div>
      </div>

      {showTimeSettings && !compact && (
        <div className="flex items-center justify-center gap-3 mb-4 px-2 py-2.5 rounded-xl bg-muted/30 border border-border mx-2 flex-wrap" data-testid="time-settings-panel">
          <div className="flex items-center bg-background border border-border rounded-lg overflow-hidden" data-testid="time-format-toggle">
            <button
              onClick={() => { setUse24h(false); localStorage.setItem("sayday_time_format", "12h"); }}
              className={cn("text-xs px-2.5 py-1 transition-colors", !use24h ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground")}
              data-testid="button-12h"
            >
              AM/PM
            </button>
            <button
              onClick={() => { setUse24h(true); localStorage.setItem("sayday_time_format", "24h"); }}
              className={cn("text-xs px-2.5 py-1 transition-colors", use24h ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground")}
              data-testid="button-24h"
            >
              24h
            </button>
          </div>
          <span className="text-xs text-muted-foreground">From</span>
          <select
            value={startHour}
            onChange={(e) => {
              const v = Number(e.target.value);
              setStartHour(v);
              if (v >= endHour) setEndHour(v + 1);
            }}
            className="text-xs bg-background border border-border rounded-md px-2 py-1"
            data-testid="select-start-hour"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>{formatHour(i, use24h)}</option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">to</span>
          <select
            value={endHour}
            onChange={(e) => setEndHour(Number(e.target.value))}
            className="text-xs bg-background border border-border rounded-md px-2 py-1"
            data-testid="select-end-hour"
          >
            {Array.from({ length: 24 - startHour }, (_, i) => i + startHour + 1).map((h) => (
              <option key={h} value={h}>{formatHour(h, use24h)}</option>
            ))}
          </select>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-md" />
          ))}
        </div>
      ) : hours.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground" data-testid="text-no-items-today">No items scheduled for today</p>
        </div>
      ) : (
        <div className="relative" data-testid="timeline-container">
          {hours.map((hour) => {
            const hasItems = hoursWithItems.has(hour);
            const isCurrentHour = hour === currentHour;
            const isHoveredHour = dragHoverTime?.hour === hour;
            const hourItems = visibleItems.filter((item) => {
              if (!item.startAt) return false;
              return new Date(item.startAt).getHours() === hour;
            }).sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime());

            const dragTimeLabel = isHoveredHour && dragHoverTime ? (() => {
              const h = dragHoverTime.hour;
              const m = dragHoverTime.minute;
              if (use24h) return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
              const ampm = h >= 12 ? "PM" : "AM";
              const h12 = h % 12 || 12;
              return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
            })() : null;

            return (
              <div
                key={hour}
                className={cn(
                  "relative flex gap-1.5 transition-colors",
                  isHoveredHour ? "min-h-[120px]" : (hasItems ? "min-h-[48px]" : "min-h-[18px]"),
                  isHoveredHour && "bg-primary/8 rounded-md"
                )}
                onDragOver={hour < 24 ? (e) => handleDragOverHour(e, hour) : undefined}
                onDragLeave={hour < 24 ? handleDragLeaveHour : undefined}
                onDrop={hour < 24 ? (e) => handleDropOnHour(e, hour) : undefined}
                data-hour={hour}
                data-testid={`timeline-slot-${hour}`}
              >
                <div className="w-14 text-right flex-shrink-0 pt-0.5">
                  {isHoveredHour && dragTimeLabel ? (
                    <span className="text-xs text-primary font-bold">
                      {dragTimeLabel}
                    </span>
                  ) : isCurrentHour ? (
                    <span className="text-xs font-bold text-primary">
                      {currentTimeLabel}
                    </span>
                  ) : (
                    <span className={cn(
                      "text-[11px] font-medium",
                      hour === 24 ? "text-muted-foreground/40" : (hasItems ? "text-muted-foreground" : "text-muted-foreground/50")
                    )}>
                      {formatHour(hour, use24h)}
                    </span>
                  )}
                </div>

                <div className="flex flex-col items-center flex-shrink-0 w-4">
                  {hasItems ? (() => {
                    const allDone = hourItems.length > 0 && hourItems.every(it => it.isDone);
                    return (
                      <>
                        <div className={cn("w-3 h-3 rounded-full mt-2 flex-shrink-0", allDone ? "bg-gray-300 dark:bg-gray-600" : "bg-primary")} />
                        <div className="w-px bg-gray-200 dark:bg-gray-700 flex-1" />
                      </>
                    );
                  })() : (
                    <div className={cn("w-px flex-1", isHoveredHour ? "bg-primary/40" : "bg-gray-200 dark:bg-gray-700")} />
                  )}
                </div>

                <div className="flex-1 pt-0.5">
                  {hasItems && (
                    <div className="space-y-2 pb-1">
                      {hourItems.map((item) => {
                        const isBeingDragged = dragItemId === item.id;
                        const previewTime = isBeingDragged && dragHoverTime ? (() => {
                          const h = dragHoverTime.hour;
                          const m = dragHoverTime.minute;
                          if (use24h) return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
                          const ampm = h >= 12 ? "PM" : "AM";
                          const h12 = h % 12 || 12;
                          return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
                        })() : null;
                        return (
                          <div key={item.id}>
                            <TimelineCard
                              item={item}
                              reminders={batchReminders?.[item.id] || []}
                              onDragStart={handleDragStart}
                              onDragEnd={handleDragEnd}
                              onCardClick={handleCardClick}
                              compact={compact}
                              use24h={use24h}
                              dragPreviewTime={previewTime}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <EventDetailSheet
        item={selectedItem}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}
