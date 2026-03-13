import { useState, useCallback, useEffect, useRef } from "react";
import { Mic, Send, Loader2, Paperclip, Calendar, Bell, FileText, Clock, Check, Trash2, ChevronDown, ChevronUp, Phone, Repeat, Vibrate, Lock, Upload, Image, Camera, Crown, Pencil } from "lucide-react";
import { VoiceButton } from "@/components/voice-button";
import { type ParseIntentResponse, type ItemType } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { Item } from "@shared/schema";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const typeIcons: Record<ItemType, typeof Calendar> = {
  event: Calendar,
  reminder: Bell,
  note: FileText,
};

function formatPreviewTime(dt: string | null | undefined) {
  if (!dt) return null;
  const d = new Date(dt);
  const now = new Date();
  const isToday = d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate();
  const hours = d.getUTCHours();
  const mins = d.getUTCMinutes();
  const is24h = typeof window !== "undefined" && localStorage.getItem("sayday_time_format") === "24h";
  const timeStr = is24h
    ? `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`
    : `${(hours % 12 || 12)}:${mins.toString().padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
  if (isToday) return `Today, ${timeStr}`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + `, ${timeStr}`;
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

function formatOffset(minutes: number): string {
  if (minutes === 0) return "At time";
  if (minutes < 60) return `${minutes} min`;
  if (minutes === 60) return "1 hour";
  if (minutes < 1440) return `${minutes / 60} hours`;
  return "1 day";
}

function ConfirmEditSheet({ data, open, onOpenChange, onSave, onDiscard }: {
  data: ParseIntentResponse;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (updated: ParseIntentResponse) => void;
  onDiscard: () => void;
}) {
  const [title, setTitle] = useState(data.title);
  const [dateVal, setDateVal] = useState(data.startAt ? data.startAt.slice(0, 10) : "");
  const [timeVal, setTimeVal] = useState(data.startAt ? data.startAt.slice(11, 16) : "");
  const [endTimeVal, setEndTimeVal] = useState(data.endAt ? data.endAt.slice(11, 16) : "");
  const [notifType, setNotifType] = useState<"call" | "vibrate">(data.notificationType as "call" | "vibrate" || "call");
  const [offsets, setOffsets] = useState<Set<number>>(new Set(data.reminderOffsets || [0]));

  const handleDone = () => {
    const startAt = dateVal && timeVal ? `${dateVal}T${timeVal}:00Z` : data.startAt;
    const endAt = data.type === "event" && dateVal && endTimeVal ? `${dateVal}T${endTimeVal}:00Z` : data.endAt;
    onSave({
      ...data,
      title,
      startAt,
      endAt,
      notificationType: notifType,
      reminderOffsets: Array.from(offsets),
    });
  };

  const toggleOffset = (val: number) => {
    setOffsets(prev => {
      const next = new Set(prev);
      if (next.has(val)) next.delete(val);
      else next.add(val);
      return next;
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[95vh] !bottom-auto !top-1/2 !-translate-y-1/2 rounded-2xl mx-auto max-w-lg !inset-x-4 overflow-y-auto z-[70]" onOpenAutoFocus={(e) => e.preventDefault()} data-testid="home-edit-sheet">
        <SheetHeader className="mb-5">
          <SheetTitle className="text-lg">{data.type === "event" ? "Event" : data.type === "reminder" ? "Reminder" : "Note"} Details</SheetTitle>
        </SheetHeader>
        <div className="space-y-5 pb-8">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Name</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} data-testid="edit-input-title" />
          </div>
          {(data.type === "reminder" || data.type === "event") && (
            <>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Date & Time</Label>
                <div className={cn("grid gap-2", data.type === "event" ? "grid-cols-3" : "grid-cols-2")}>
                  <Input type="date" value={dateVal} onChange={(e) => setDateVal(e.target.value)} className="text-xs h-11 cursor-pointer picker-full" data-testid="edit-input-date" />
                  <Input type="time" value={timeVal} onChange={(e) => setTimeVal(e.target.value)} className="text-xs h-11 cursor-pointer picker-full" data-testid="edit-input-time" />
                  {data.type === "event" && (
                    <Input type="time" value={endTimeVal} onChange={(e) => setEndTimeVal(e.target.value)} placeholder="End" className="text-xs h-11 cursor-pointer picker-full" data-testid="edit-input-endtime" />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">Start time{data.type === "event" ? " — End time" : ""}</p>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Notification type</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setNotifType("call")}
                    className={cn(
                      "flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all text-sm",
                      notifType === "call" ? "border-primary bg-primary/10 text-primary font-medium" : "border-gray-200 dark:border-gray-700 text-muted-foreground hover:border-gray-300"
                    )}
                    data-testid="edit-notif-call"
                  >
                    <Phone className="w-4 h-4" />
                    Call Me
                  </button>
                  <button
                    onClick={() => setNotifType("vibrate")}
                    className={cn(
                      "flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all text-sm",
                      notifType === "vibrate" ? "border-primary bg-primary/10 text-primary font-medium" : "border-gray-200 dark:border-gray-700 text-muted-foreground hover:border-gray-300"
                    )}
                    data-testid="edit-notif-vibrate"
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
                  {[
                    { label: "At time", value: 0 },
                    { label: "5 min", value: 5 },
                    { label: "10 min", value: 10 },
                    { label: "15 min", value: 15 },
                    { label: "30 min", value: 30 },
                    { label: "45 min", value: 45 },
                    { label: "1 hour", value: 60 },
                    { label: "2 hours", value: 120 },
                    { label: "1 day", value: 1440 },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => toggleOffset(opt.value)}
                      className={cn(
                        "text-xs px-3 py-2 rounded-xl border-2 transition-all",
                        offsets.has(opt.value) ? "border-primary bg-primary/10 text-primary font-medium" : "border-gray-200 dark:border-gray-700 text-muted-foreground hover:border-gray-300"
                      )}
                      data-testid={`edit-offset-${opt.value}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {data.structuredContent?.bullets && data.structuredContent.bullets.length > 0 && (
            <div className="space-y-1.5" data-testid="edit-content-preview">
              <Label className="text-sm font-medium">Content</Label>
              <div className="p-3 rounded-xl bg-muted/30 border border-border">
                {data.structuredContent.summary && (
                  <p className="text-xs text-muted-foreground mb-2">{data.structuredContent.summary}</p>
                )}
                <ul className="space-y-1">
                  {data.structuredContent.bullets.map((bullet: string, i: number) => (
                    <li key={i} className="flex items-start gap-1.5 text-sm text-foreground/80">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={onDiscard}
              className="h-11 gap-2 text-sm font-medium text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
              data-testid="edit-button-discard"
            >
              <Trash2 className="w-4 h-4" />
              Discard
            </Button>
            <Button
              onClick={handleDone}
              className="h-11 gap-2 text-sm font-medium"
              data-testid="edit-button-done"
            >
              <Check className="w-4 h-4" />
              Done
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function Home() {
  const [text, setText] = useState("");
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [parsedQueue, setParsedQueue] = useState<ParseIntentResponse[]>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);
  const [editData, setEditData] = useState<ParseIntentResponse | null>(null);
  const [transcript, setTranscript] = useState("");
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const uploadMenuRef = useRef<HTMLDivElement>(null);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!showUploadMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (uploadMenuRef.current && !uploadMenuRef.current.contains(e.target as Node)) {
        setShowUploadMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showUploadMenu]);

  const { data: items } = useQuery<Item[]>({
    queryKey: ["/api/items"],
    placeholderData: (prev) => prev,
  });

  const { data: weeklyTasks } = useQuery<{ count: number; limit: number | null }>({
    queryKey: ["/api/auth/weekly-tasks"],
  });

  const nextItem = (() => {
    void tick;
    if (!items) return null;
    const now = new Date();
    const nowAsUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes());
    const upcoming = items
      .filter((item) => {
        if (!item.startAt || item.isDone) return false;
        if (item.type !== "event" && item.type !== "reminder") return false;
        return new Date(item.startAt).getTime() >= nowAsUTC;
      })
      .sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime());
    return upcoming.length > 0 ? upcoming[0] : null;
  })();

  const [isPhotoProcessing, setIsPhotoProcessing] = useState(false);

  const processAIResult = useCallback((data: { description: string; items: ParseIntentResponse[] }) => {
    setTranscript(data.description);
    const items = data.items.map(d => {
      if ((d.type === "reminder" || d.type === "event") && !d.notificationType) {
        d.notificationType = "call";
      }
      return d;
    });
    setParsedQueue(items);
    setCurrentQueueIndex(0);
    setEditData(null);
    setShowConfirmation(true);
  }, []);

  const handlePhotoCapture = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    setShowUploadMenu(false);
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setIsPhotoProcessing(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      if (!base64) { setIsPhotoProcessing(false); return; }
      try {
        const res = await apiRequest("POST", "/api/parse-image", { image: base64 });
        const data = await res.json() as { description: string; items: ParseIntentResponse[] };
        processAIResult(data);
      } catch {
        toast({ title: "Error", description: "Could not process the photo. Try again.", variant: "destructive" });
      } finally {
        setIsPhotoProcessing(false);
      }
    };
    reader.readAsDataURL(file);
  }, [processAIResult]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    setShowUploadMenu(false);
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (file.type.startsWith("image/")) {
      setIsPhotoProcessing(true);
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        if (!base64) { setIsPhotoProcessing(false); return; }
        try {
          const res = await apiRequest("POST", "/api/parse-image", { image: base64 });
          const data = await res.json() as { description: string; items: ParseIntentResponse[] };
          processAIResult(data);
        } catch {
          toast({ title: "Error", description: "Could not process the file. Try again.", variant: "destructive" });
        } finally {
          setIsPhotoProcessing(false);
        }
      };
      reader.readAsDataURL(file);
      return;
    }

    setIsPhotoProcessing(true);
    try {
      const text = await file.text();
      const res = await apiRequest("POST", "/api/parse-file", { content: text.slice(0, 10000), fileName: file.name });
      const data = await res.json() as { description: string; items: ParseIntentResponse[] };
      processAIResult(data);
    } catch {
      toast({ title: "Error", description: "Could not process the file. Try again.", variant: "destructive" });
    } finally {
      setIsPhotoProcessing(false);
    }
  }, [processAIResult]);

  const parseMutation = useMutation({
    mutationFn: async (input: string) => {
      const res = await apiRequest("POST", "/api/parse-intent", { text: input });
      return res.json() as Promise<ParseIntentResponse[]>;
    },
    onSuccess: (data: ParseIntentResponse[]) => {
      const items = data.map(d => {
        if ((d.type === "reminder" || d.type === "event") && !d.notificationType) {
          d.notificationType = "call";
        }
        return d;
      });
      setParsedQueue(items);
      setCurrentQueueIndex(0);
      setEditData(null);
      setShowConfirmation(true);
      setIsVoiceActive(false);
    },
    onError: (err) => {
      setIsVoiceActive(false);
      toast({ title: "Error", description: "Could not process your input. Try again.", variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ParseIntentResponse) => {
      const notifType = data.notificationType || "call";
      const offsets = data.reminderOffsets && data.reminderOffsets.length > 0 ? data.reminderOffsets : [0];
      const reminders = (data.type === "reminder" || data.type === "event")
        ? offsets.map(offset => ({ type: notifType, offsetMinutes: offset, isEnabled: true }))
        : undefined;

      const payload = {
        type: data.type,
        title: data.title,
        description: data.description || null,
        transcript: transcript || null,
        startAt: data.startAt || null,
        endAt: data.endAt || null,
        location: data.location || null,
        tags: data.tags || [],
        source: "app",
        structuredContent: data.structuredContent || null,
        aiResponse: data.chatResponse || null,
        reminders,
        recurringInterval: data.recurringIntervalMinutes || null,
        emoji: data.emoji || null,
      };
      return apiRequest("POST", "/api/items", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/weekly-tasks"] });
      setEditData(null);
      if (currentQueueIndex < parsedQueue.length - 1) {
        setCurrentQueueIndex(prev => prev + 1);
      } else {
        setShowConfirmation(false);
        setParsedQueue([]);
        setCurrentQueueIndex(0);
        setTranscript("");
        setText("");
      }
    },
    onError: (err: any) => {
      const msg = err.message || "";
      if (msg.includes("WEEKLY_LIMIT_REACHED") || msg.includes("50 tasks/week")) {
        setShowLimitDialog(true);
      } else if (msg.includes("PRO_FEATURE") || msg.includes("Pro feature")) {
        setShowLimitDialog(true);
      } else {
        toast({ title: "Error", description: "Could not save item.", variant: "destructive" });
      }
    },
  });

  const handleVoiceTranscript = useCallback((t: string) => {
    setTranscript(t);
    if (t.trim()) {
      parseMutation.mutate(t);
    } else {
      setIsVoiceActive(false);
    }
  }, []);

  const handleTextSubmit = useCallback(() => {
    if (!text.trim()) return;
    setTranscript(text.trim());
    parseMutation.mutate(text.trim());
  }, [text]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleTextSubmit();
  }, [handleTextSubmit]);

  const [showAllBullets, setShowAllBullets] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  const handleDiscard = () => {
    setEditData(null);
    setShowAllBullets(false);
    setShowTranscript(false);
    if (currentQueueIndex < parsedQueue.length - 1) {
      setCurrentQueueIndex(prev => prev + 1);
    } else {
      setShowConfirmation(false);
      setParsedQueue([]);
      setCurrentQueueIndex(0);
      setTranscript("");
    }
  };

  const handleDiscardAll = () => {
    setShowConfirmation(false);
    setParsedQueue([]);
    setCurrentQueueIndex(0);
    setEditData(null);
    setTranscript("");
    setShowAllBullets(false);
    setShowTranscript(false);
  };

  const formatNextItem = (item: Item) => {
    if (!item.startAt) return { time: null, title: item.title };
    const date = new Date(item.startAt);
    const now = new Date();
    const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round((dateDay.getTime() - nowDay.getTime()) / 86400000);
    const h = date.getHours();
    const m = date.getMinutes();
    const is24h = typeof window !== "undefined" && localStorage.getItem("sayday_time_format") === "24h";
    const timeStr = is24h
      ? `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
      : `${(h % 12 || 12)}:${m.toString().padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
    const dayLabel = diffDays === 0 ? 'Today' : diffDays === 1 ? 'Tomorrow' : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return { time: timeStr, day: dayLabel, title: item.title };
  };

  const parsedData = parsedQueue[currentQueueIndex] || null;
  const current = editData || parsedData;

  const colors = current?.type === "note"
    ? { bg: "bg-emerald-50/50 dark:bg-emerald-950/20", border: "border-emerald-100/60 dark:border-emerald-900/30", icon: "text-emerald-500" }
    : { bg: "bg-amber-50/50 dark:bg-amber-950/20", border: "border-amber-100/60 dark:border-amber-900/30", icon: "text-amber-500" };

  const Icon = current ? typeIcons[current.type] : Calendar;
  const timeStr = current ? formatPreviewTime(current.startAt) : null;
  const offsets = current?.reminderOffsets && current.reminderOffsets.length > 0 ? current.reminderOffsets : [0];

  return (
    <div className="flex flex-col items-center min-h-full px-4">
      <div className="w-full max-w-lg mt-14">
        <div className="flex items-center gap-0 rounded-xl border-2 border-primary/30 bg-background h-14 px-1 focus-within:border-primary transition-colors">
          <div className="relative flex-shrink-0" ref={uploadMenuRef}>
            <button
              onClick={() => setShowUploadMenu(!showUploadMenu)}
              className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              data-testid="button-attach"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            {showUploadMenu && (
              <div className="absolute top-12 left-0 bg-background border border-border rounded-xl shadow-lg py-1 min-w-[160px] z-10" data-testid="upload-menu">
                <label className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/50 cursor-pointer transition-colors" data-testid="upload-files-option">
                  <Upload className="w-4 h-4 text-muted-foreground" />
                  Upload Files
                  <input type="file" className="hidden" accept=".txt,.md,.csv,.json,.xml,.html,.log,.doc,.docx,.pdf,image/*" onChange={handleFileUpload} />
                </label>
                <label className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/50 cursor-pointer transition-colors" data-testid="upload-photos-option">
                  <Image className="w-4 h-4 text-muted-foreground" />
                  Photos
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoCapture} />
                </label>
                <label className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/50 cursor-pointer transition-colors" data-testid="upload-camera-option">
                  <Camera className="w-4 h-4 text-muted-foreground" />
                  Take a Photo
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} />
                </label>
              </div>
            )}
          </div>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write or attach your plan..."
            className="flex-1 h-full px-2 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            disabled={parseMutation.isPending || isPhotoProcessing}
            data-testid="input-text"
          />
          <button
            onClick={handleTextSubmit}
            disabled={!text.trim() || parseMutation.isPending || isPhotoProcessing}
            className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary transition-colors disabled:opacity-30 flex-shrink-0"
            data-testid="button-send"
          >
            {parseMutation.isPending || isPhotoProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>

      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-lg py-8">
        <div className="flex flex-col items-center gap-4">
          {showConfirmation && current ? (
            <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div
                className={cn(
                  "border rounded-2xl p-5 transition-all",
                  colors.bg, colors.border
                )}
                data-testid="card-confirmation"
              >
                {parsedQueue.length > 1 && (
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/30">
                  <span className="text-[11px] font-medium text-muted-foreground" data-testid="text-queue-counter">
                    {currentQueueIndex + 1} of {parsedQueue.length}
                  </span>
                  <button
                    onClick={handleDiscardAll}
                    className="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
                    data-testid="button-discard-all"
                  >
                    Discard all
                  </button>
                </div>
              )}
              <div className="flex items-start gap-3">
                  {current.emoji ? (
                    <span className="text-lg flex-shrink-0 mt-1">{current.emoji}</span>
                  ) : (
                    <Icon className={cn("w-5 h-5 flex-shrink-0 mt-1", colors.icon)} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-semibold leading-snug break-words" data-testid="text-title">
                      {current.title}
                    </p>
                    {timeStr && (
                      <p className="text-xs text-muted-foreground mt-1">{timeStr}</p>
                    )}

                    {current.type === "note" && current.structuredContent?.bullets && current.structuredContent.bullets.length > 0 && (
                      <div className="mt-2" data-testid="inline-content-preview">
                        {current.structuredContent.summary && (
                          <p className="text-xs text-muted-foreground mb-1.5">{current.structuredContent.summary}</p>
                        )}
                        <ul className="space-y-0.5">
                          {(showAllBullets ? current.structuredContent.bullets : current.structuredContent.bullets.slice(0, 3)).map((bullet: string, i: number) => (
                            <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/80">
                              <span className="text-primary mt-0.5">•</span>
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>
                        {current.structuredContent.bullets.length > 3 && (
                          <button
                            onClick={() => setShowAllBullets(!showAllBullets)}
                            className="flex items-center gap-0.5 text-[11px] text-primary font-medium mt-1"
                            data-testid="button-inline-show-more"
                          >
                            {showAllBullets ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            {showAllBullets ? "Show less" : `+${current.structuredContent.bullets.length - 3} more`}
                          </button>
                        )}
                      </div>
                    )}

                    {current.type === "note" && transcript && (
                      <div className="mt-2">
                        <button
                          onClick={() => setShowTranscript(!showTranscript)}
                          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                          data-testid="button-inline-transcript"
                        >
                          {showTranscript ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          Original transcript
                        </button>
                        {showTranscript && (
                          <p className="text-[11px] text-muted-foreground mt-1 p-2 bg-muted/50 rounded-md" data-testid="text-inline-transcript">
                            {transcript}
                          </p>
                        )}
                      </div>
                    )}

                    {(current.type === "reminder" || current.type === "event") && (
                      <div className="mt-2 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditData({ ...current, notificationType: "call" })}
                            className={cn(
                              "flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border transition-all",
                              (current.notificationType || "call") === "call"
                                ? "border-primary bg-primary/10 text-primary font-medium"
                                : "border-border text-muted-foreground hover:border-gray-300"
                            )}
                            data-testid="toggle-call"
                          >
                            <Phone className="w-3 h-3" />
                            Call Me
                          </button>
                          <button
                            onClick={() => setEditData({ ...current, notificationType: "vibrate" })}
                            className={cn(
                              "flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border transition-all",
                              current.notificationType === "vibrate"
                                ? "border-primary bg-primary/10 text-primary font-medium"
                                : "border-border text-muted-foreground hover:border-gray-300"
                            )}
                            data-testid="toggle-vibrate"
                          >
                            <Vibrate className="w-3 h-3" />
                            Vibrate
                          </button>
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                          <Clock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                          <span className="text-[11px] text-muted-foreground">
                            {offsets.map((o, i) => (
                              <span key={i}>
                                {formatOffset(o)}{i < offsets.length - 1 ? ",  " : ""}
                              </span>
                            ))}
                          </span>
                          {current.recurringIntervalMinutes && (
                            <span className="flex items-center gap-0.5 text-[10px] font-semibold text-primary px-1.5 py-0.5 rounded-full flex-shrink-0 ml-1">
                              <Repeat className="w-2.5 h-2.5" />
                              {formatRecurringLabel(current.recurringIntervalMinutes)}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-border/30">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDiscard}
                    className="text-xs text-muted-foreground h-7 px-2"
                    data-testid="button-discard"
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    {parsedQueue.length > 1 && currentQueueIndex < parsedQueue.length - 1 ? "Skip" : "Discard"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowEditDialog(true)}
                    className="text-xs h-7 px-2"
                    data-testid="button-edit"
                  >
                    <Pencil className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => createMutation.mutate(current)}
                    disabled={createMutation.isPending}
                    className="text-xs h-7 px-3"
                    data-testid="button-save"
                  >
                    {createMutation.isPending ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Check className="w-3 h-3 mr-1" />
                    )}
                    {createMutation.isPending ? "Saving..." : (parsedQueue.length > 1 && currentQueueIndex < parsedQueue.length - 1 ? "Save & Next" : "Save")}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <VoiceButton
                onTranscript={handleVoiceTranscript}
                size="large"
                isProcessing={parseMutation.isPending}
                onRecordingStart={() => setIsVoiceActive(true)}
              />
              <div className={cn("transition-opacity duration-200 mt-4 min-h-[32px]", (isVoiceActive || parseMutation.isPending) ? "opacity-0 pointer-events-none" : "opacity-100")}>
                {(() => {
                  const hasEventsOrReminders = items?.some(i => (i.type === "event" || i.type === "reminder") && !i.isDone);
                  if (!items) {
                    return <div className="h-6" />;
                  }
                  if (!hasEventsOrReminders) {
                    return (
                      <p className="text-sm text-muted-foreground text-center max-w-[220px] leading-relaxed" data-testid="text-guidance">
                        Tap to speak any reminder, event or note
                      </p>
                    );
                  }
                  if (nextItem) {
                    const info = formatNextItem(nextItem);
                    return (
                      <div className="flex items-center gap-2 max-w-xs opacity-60" data-testid="text-next-item">
                        <span className="text-muted-foreground text-sm font-medium flex-shrink-0">Next</span>
                        {info.time && (
                          <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-sm font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap flex-shrink-0">
                            {info.time}
                          </span>
                        )}
                        {nextItem.emoji && <span className="text-base flex-shrink-0">{nextItem.emoji}</span>}
                        <span className="text-foreground text-base font-medium leading-snug truncate">
                          {info.title}
                        </span>
                      </div>
                    );
                  }
                  return <div className="h-6" />;
                })()}
              </div>
            </>
          )}
        </div>
      </div>
      {current && showEditDialog && (
        <ConfirmEditSheet
          data={current}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          onSave={(updated) => { setEditData(updated); setShowEditDialog(false); }}
          onDiscard={() => { setShowEditDialog(false); handleDiscard(); }}
        />
      )}
      <Dialog open={showLimitDialog} onOpenChange={setShowLimitDialog}>
        <DialogContent className="max-w-xs rounded-2xl p-6 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Crown className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold" data-testid="text-limit-title">Weekly Limit Reached</h3>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed" data-testid="text-limit-desc">
                You've used all 50 free tasks this week. Upgrade to Pro for unlimited tasks.
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full">
              <Button
                onClick={() => { setShowLimitDialog(false); navigate("/settings?screen=subscription"); }}
                className="w-full"
                data-testid="button-upgrade-pro"
              >
                <Crown className="w-4 h-4 mr-2" />
                Upgrade to Pro
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowLimitDialog(false)}
                className="w-full text-muted-foreground"
                data-testid="button-dismiss-limit"
              >
                Maybe Later
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
