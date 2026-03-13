import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { X, Send, Loader2, Calendar, Bell, FileText, MapPin, Clock, Mic, Square, Check, Bot, Phone, Repeat, Paperclip, Image, Camera, Upload, Vibrate } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Item, ItemReminder, ParseIntentResponse, ItemType } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { EventDetailSheet } from "@/components/event-detail-sheet";

interface ChatboxProps {
  open: boolean;
  onClose: () => void;
  onNavigateToNote?: () => void;
}

interface PendingMessage {
  id: string;
  type: "user-pending" | "system";
  text: string;
  timestamp: Date;
}

const typeIcons: Record<ItemType, typeof Calendar> = {
  event: Calendar,
  reminder: Bell,
  note: FileText,
};

const typeColors: Record<ItemType, string> = {
  event: "text-blue-600 dark:text-blue-400",
  reminder: "text-amber-600 dark:text-amber-400",
  note: "text-emerald-600 dark:text-emerald-400",
};

const typeBgColors: Record<ItemType, string> = {
  event: "bg-blue-500/10",
  reminder: "bg-amber-500/10",
  note: "",
};

function formatOffset(minutes: number): string {
  if (minutes === 0) return "At time";
  if (minutes < 60) return `${minutes} min`;
  if (minutes === 60) return "1 hour";
  if (minutes < 1440) return `${minutes / 60} hours`;
  return "1 day";
}

function formatItemTime(item: Item) {
  if (!item.startAt) return null;
  const d = new Date(item.startAt);
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

function UserBubble({ text, timestamp }: { text: string; timestamp: string }) {
  const d = new Date(timestamp);
  const is24h = typeof window !== "undefined" && localStorage.getItem("sayday_time_format") === "24h";
  const bubbleTime = is24h
    ? `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`
    : d.toLocaleString([], { hour: "numeric", minute: "2-digit" });
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%]">
        <div className="bg-foreground/5 dark:bg-foreground/10 border border-border/50 rounded-xl rounded-br-sm px-3 py-2" data-testid="chatbox-user-message">
          <p className="text-sm text-foreground">{text}</p>
        </div>
        <p className="text-[10px] text-muted-foreground/60 text-right mt-0.5 mr-1">
          {bubbleTime}
        </p>
      </div>
    </div>
  );
}

function AiBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-start gap-2">
      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
        <Bot className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="max-w-[80%]">
        <div className="rounded-xl rounded-bl-sm px-3 py-2" data-testid="chatbox-ai-message">
          <p className="text-sm text-muted-foreground">{text}</p>
        </div>
      </div>
    </div>
  );
}

function ItemCard({ item, onClick }: { item: Item; onClick: () => void }) {
  const Icon = typeIcons[item.type as ItemType] || FileText;
  const timeStr = formatItemTime(item);
  const isActionable = item.type === "reminder" || item.type === "event";

  const { data: reminders } = useQuery<ItemReminder[]>({
    queryKey: ["/api/items", item.id, "reminders"],
    queryFn: async () => {
      const res = await fetch(`/api/items/${item.id}/reminders`);
      return res.json();
    },
    enabled: isActionable,
  });

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
      await queryClient.invalidateQueries({ queryKey: ["/api/items", item.id, "reminders"] });
      setOptimisticType(null);
    },
    onError: () => { setOptimisticType(null); },
  });

  const colors = item.type === "note"
    ? { bg: "bg-gray-50/80 dark:bg-gray-800/30", border: "border-gray-200/60 dark:border-gray-700/30", icon: "text-gray-500" }
    : { bg: "bg-amber-50/50 dark:bg-amber-950/20", border: "border-amber-100/60 dark:border-amber-900/30", icon: "text-amber-500" };

  return (
    <div className="flex justify-start pl-9">
      <div
        onClick={onClick}
        className={cn(
          "border rounded-2xl p-4 max-w-[85%] cursor-pointer transition-all hover:shadow-md",
          colors.bg, colors.border,
          item.isDone && "opacity-50"
        )}
        data-testid={`chatbox-item-${item.id}`}
      >
        <div className="flex items-start gap-3">
          {item.emoji ? (
            <span className="text-lg flex-shrink-0 mt-0.5">{item.emoji}</span>
          ) : (
            <Icon className={cn("w-5 h-5 flex-shrink-0 mt-0.5", colors.icon)} />
          )}
          <div className="flex-1 min-w-0">
            <h3
              className={cn(
                "font-semibold text-[15px] leading-tight",
                item.isDone && "line-through text-muted-foreground"
              )}
              data-testid={`text-title-${item.id}`}
            >
              {item.title}
            </h3>
            {timeStr && (
              <p className="text-xs text-muted-foreground mt-1">{timeStr}</p>
            )}

            {item.type === "note" && (() => {
              const structured = item.structuredContent as any;
              const preview = structured?.summary || item.description || "";
              if (!preview) return null;
              return (
                <div className="mt-1.5 relative">
                  <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2">{preview}</p>
                  <p className="text-[11px] text-primary font-medium mt-1">Read more →</p>
                </div>
              );
            })()}

            {isActionable && reminders && reminders.length > 0 && (
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
                    data-testid={`chatbox-toggle-call-${item.id}`}
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
                    data-testid={`chatbox-toggle-vibrate-${item.id}`}
                  >
                    <Vibrate className="w-3 h-3" />
                    Vibrate
                  </button>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  <Clock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-[11px] text-muted-foreground">
                    {[...reminders].sort((a, b) => a.offsetMinutes - b.offsetMinutes).map((r, i) => (
                      <span key={r.id} data-testid={`chatbox-reminder-time-${r.id}`}>
                        {formatOffset(r.offsetMinutes)}{i < reminders.length - 1 ? ",  " : ""}
                      </span>
                    ))}
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
        </div>
      </div>
    </div>
  );
}

function generateFallbackResponse(data: ParseIntentResponse): string {
  const timeStr = data.startAt ? (() => {
    const dt = new Date(data.startAt);
    const is24h = typeof window !== "undefined" && localStorage.getItem("sayday_time_format") === "24h";
    const datePart = dt.toLocaleDateString([], { month: "short", day: "numeric" });
    const timePart = is24h
      ? `${dt.getUTCHours().toString().padStart(2, "0")}:${dt.getUTCMinutes().toString().padStart(2, "0")}`
      : `${(dt.getUTCHours() % 12 || 12)}:${dt.getUTCMinutes().toString().padStart(2, "0")} ${dt.getUTCHours() >= 12 ? "PM" : "AM"}`;
    return `${datePart}, ${timePart}`;
  })() : "";
  const locationStr = data.location ? ` at ${data.location}` : "";
  switch (data.type) {
    case "reminder":
      return `Got it! I've set a reminder: "${data.title}"${timeStr ? ` for ${timeStr}` : ""}.`;
    case "event":
      return `Done! I've added an event: "${data.title}"${timeStr ? ` on ${timeStr}` : ""}${locationStr}.`;
    case "note":
      return `Noted! I've saved: "${data.title}".`;
    default:
      return `Done! I've created: "${data.title}".`;
  }
}

export function Chatbox({ open, onClose, onNavigateToNote }: ChatboxProps) {
  const [text, setText] = useState("");
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  const [voiceState, setVoiceState] = useState<"idle" | "recording" | "processing">("idle");
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [isPhotoProcessing, setIsPhotoProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!open) {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state === "recording") {
        recorder.stop();
        recorder.stream.getTracks().forEach((t) => t.stop());
      }
      mediaRecorderRef.current = null;
      chunksRef.current = [];
      setVoiceState("idle");
    }
  }, [open]);

  const { data: allItems } = useQuery<Item[]>({
    queryKey: ["/api/items"],
  });

  const sortedItems = (allItems || [])
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const findMatchingItem = useCallback((searchTitle: string): Item | undefined => {
    if (!allItems) return undefined;
    const query = searchTitle.toLowerCase();
    return allItems.find((item) => item.title.toLowerCase().includes(query)) ||
      allItems.find((item) => query.includes(item.title.toLowerCase()));
  }, [allItems]);

  const parseMutation = useMutation({
    mutationFn: async (input: string) => {
      const res = await apiRequest("POST", "/api/parse-intent", { text: input });
      return res.json() as Promise<ParseIntentResponse[]>;
    },
    onSuccess: (data: ParseIntentResponse[], input: string) => {
      if (!data || data.length === 0) return;
      for (const item of data) {
        if (item.action === "update" && item.searchTitle) {
          const match = findMatchingItem(item.searchTitle);
          if (match) {
            updateItemMutation.mutate({ item: match, data: item, transcript: input });
            continue;
          }
        }
        createMutation.mutate({ data: item, transcript: input });
      }
    },
    onError: () => {
      setPendingMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, type: "system", text: "Could not process your input. Try again.", timestamp: new Date() },
      ]);
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ item, data }: { item: Item; data: ParseIntentResponse; transcript: string }) => {
      const updatePayload: any = {};
      if (data.title && data.title !== data.searchTitle) updatePayload.title = data.title;
      if (data.startAt) updatePayload.startAt = data.startAt;
      if (data.endAt) updatePayload.endAt = data.endAt;
      if (data.location !== undefined) updatePayload.location = data.location;
      if (data.tags && data.tags.length > 0) updatePayload.tags = data.tags;
      if (data.recurringIntervalMinutes) updatePayload.recurringInterval = data.recurringIntervalMinutes;
      if (data.description) updatePayload.description = data.description;

      const aiResponse = data.chatResponse || `Updated "${item.title}"`;
      updatePayload.aiResponse = aiResponse;

      return apiRequest("PATCH", `/api/items/${item.id}`, updatePayload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      setPendingMessages((prev) => prev.filter((m) => m.type !== "user-pending"));
    },
    onError: () => {
      setPendingMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, type: "system", text: "Could not update item. Try again.", timestamp: new Date() },
      ]);
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({ data, transcript }: { data: ParseIntentResponse; transcript: string }) => {
      const aiResponse = data.chatResponse || generateFallbackResponse(data);
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
        aiResponse,
        reminders,
        recurringInterval: data.recurringIntervalMinutes || null,
        emoji: data.emoji || null,
      };
      return apiRequest("POST", "/api/items", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/weekly-tasks"] });
      setPendingMessages((prev) => prev.filter((m) => m.type !== "user-pending"));
    },
    onError: (err: any) => {
      const msg = err.message || "";
      let errText = "Could not save item. Try again.";
      if (msg.includes("WEEKLY_LIMIT_REACHED") || msg.includes("10 tasks/week")) {
        errText = "You've reached your 10 tasks/week limit. Upgrade to Pro for unlimited tasks.";
      } else if (msg.includes("PRO_FEATURE")) {
        errText = "This feature requires a Pro subscription.";
      }
      setPendingMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, type: "system", text: errText, timestamp: new Date() },
      ]);
    },
  });

  const handlePhotoCapture = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    setShowUploadMenu(false);
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setIsPhotoProcessing(true);
    setPendingMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, type: "user-pending", text: "Analyzing photo...", timestamp: new Date() },
    ]);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      if (!base64) { setIsPhotoProcessing(false); return; }
      try {
        const res = await apiRequest("POST", "/api/parse-image", { image: base64 });
        const data = await res.json() as { description: string; items: ParseIntentResponse[] };
        setPendingMessages((prev) => prev.filter((m) => m.text !== "Analyzing photo..."));
        setPendingMessages((prev) => [
          ...prev,
          { id: `user-${Date.now()}`, type: "user-pending", text: data.description, timestamp: new Date() },
        ]);
        const items = data.items.map(d => {
          if ((d.type === "reminder" || d.type === "event") && !d.notificationType) {
            d.notificationType = "call";
          }
          return d;
        });
        for (const item of items) {
          const notifType = item.notificationType || "call";
          const offsets = item.reminderOffsets && item.reminderOffsets.length > 0 ? item.reminderOffsets : [0];
          const reminders = (item.type === "reminder" || item.type === "event")
            ? offsets.map(offset => ({ type: notifType, offsetMinutes: offset, isEnabled: true }))
            : [];
          await apiRequest("POST", "/api/items", {
            title: item.title, type: item.type, emoji: item.emoji,
            description: item.description, startAt: item.startAt, endAt: item.endAt,
            recurrence: item.recurrence, tags: item.tags, bullets: item.bullets,
            reminders,
          });
        }
        queryClient.invalidateQueries({ queryKey: ["/api/items"] });
        queryClient.invalidateQueries({ queryKey: ["/api/auth/weekly-tasks"] });
      } catch {
        toast({ title: "Error", description: "Could not process the photo. Try again.", variant: "destructive" });
      } finally {
        setIsPhotoProcessing(false);
      }
    };
    reader.readAsDataURL(file);
  }, [toast]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    setShowUploadMenu(false);
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (file.type.startsWith("image/")) {
      setIsPhotoProcessing(true);
      setPendingMessages((prev) => [
        ...prev,
        { id: `user-${Date.now()}`, type: "user-pending", text: "Analyzing photo...", timestamp: new Date() },
      ]);
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        if (!base64) { setIsPhotoProcessing(false); return; }
        try {
          const res = await apiRequest("POST", "/api/parse-image", { image: base64 });
          const data = await res.json() as { description: string; items: ParseIntentResponse[] };
          setPendingMessages((prev) => prev.filter((m) => m.text !== "Analyzing photo..."));
          setPendingMessages((prev) => [
            ...prev,
            { id: `user-${Date.now()}`, type: "user-pending", text: data.description, timestamp: new Date() },
          ]);
          const items = data.items.map(d => {
            if ((d.type === "reminder" || d.type === "event") && !d.notificationType) d.notificationType = "call";
            return d;
          });
          for (const item of items) {
            const notifType = item.notificationType || "call";
            const offsets = item.reminderOffsets && item.reminderOffsets.length > 0 ? item.reminderOffsets : [0];
            const reminders = (item.type === "reminder" || item.type === "event")
              ? offsets.map(offset => ({ type: notifType, offsetMinutes: offset, isEnabled: true }))
              : [];
            await apiRequest("POST", "/api/items", {
              title: item.title, type: item.type, emoji: item.emoji,
              description: item.description, startAt: item.startAt, endAt: item.endAt,
              recurrence: item.recurrence, tags: item.tags, bullets: item.bullets,
              reminders,
            });
          }
          queryClient.invalidateQueries({ queryKey: ["/api/items"] });
          queryClient.invalidateQueries({ queryKey: ["/api/auth/weekly-tasks"] });
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
    setPendingMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, type: "user-pending", text: `Analyzing file: ${file.name}...`, timestamp: new Date() },
    ]);
    try {
      const fileText = await file.text();
      const res = await apiRequest("POST", "/api/parse-file", { content: fileText.slice(0, 10000), fileName: file.name });
      const data = await res.json() as { description: string; items: ParseIntentResponse[] };
      setPendingMessages((prev) => prev.filter((m) => m.text?.includes("Analyzing file:")));
      setPendingMessages((prev) => [
        ...prev,
        { id: `user-${Date.now()}`, type: "user-pending", text: data.description, timestamp: new Date() },
      ]);
      const items = data.items.map(d => {
        if ((d.type === "reminder" || d.type === "event") && !d.notificationType) {
          d.notificationType = "call";
        }
        return d;
      });
      for (const item of items) {
        const notifType = item.notificationType || "call";
        const offsets = item.reminderOffsets && item.reminderOffsets.length > 0 ? item.reminderOffsets : [0];
        const reminders = (item.type === "reminder" || item.type === "event")
          ? offsets.map(offset => ({ type: notifType, offsetMinutes: offset, isEnabled: true }))
          : [];
        await apiRequest("POST", "/api/items", {
          title: item.title, type: item.type, emoji: item.emoji,
          description: item.description, startAt: item.startAt, endAt: item.endAt,
          recurrence: item.recurrence, tags: item.tags, bullets: item.bullets,
          reminders,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/weekly-tasks"] });
    } catch {
      toast({ title: "Error", description: "Could not process the file. Try again.", variant: "destructive" });
    } finally {
      setIsPhotoProcessing(false);
    }
  }, [toast]);

  const handleSend = useCallback(() => {
    const input = text.trim();
    if (!input) return;
    setPendingMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, type: "user-pending", text: input, timestamp: new Date() },
    ]);
    setText("");
    parseMutation.mutate(input);
  }, [text, parseMutation]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm",
      });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.start(100);
      setVoiceState("recording");
    } catch {
      toast({ title: "Error", description: "Microphone access denied", variant: "destructive" });
    }
  }, [toast]);

  const stopRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    setVoiceState("processing");
    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        const b = new Blob(chunksRef.current, { type: "audio/webm" });
        recorder.stream.getTracks().forEach((t) => t.stop());
        resolve(b);
      };
      recorder.stop();
    });
    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.readAsDataURL(blob);
      });
      const res = await apiRequest("POST", "/api/transcribe", { audio: base64 });
      const { transcript } = await res.json();
      if (!transcript || !transcript.trim()) {
        setPendingMessages((prev) => [...prev, { id: `err-${Date.now()}`, type: "system", text: "Could not understand audio. Try again.", timestamp: new Date() }]);
        return;
      }
      setPendingMessages((prev) => [...prev, { id: `user-${Date.now()}`, type: "user-pending", text: transcript, timestamp: new Date() }]);
      parseMutation.mutate(transcript);
    } catch {
      setPendingMessages((prev) => [...prev, { id: `err-${Date.now()}`, type: "system", text: "Transcription failed. Try again.", timestamp: new Date() }]);
    } finally {
      setVoiceState("idle");
    }
  }, [parseMutation, toast]);

  const handleVoiceClick = () => {
    if (voiceState === "idle") startRecording();
    else if (voiceState === "recording") stopRecording();
  };

  const savedScrollPos = useRef<number | null>(null);
  const restoreScroll = useRef(false);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "instant") => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior });
  }, []);

  const prevOpenRef = useRef(false);
  const prevItemsLenRef = useRef(0);
  const prevPendingLenRef = useRef(0);
  useEffect(() => {
    if (open && scrollRef.current) {
      const justOpened = !prevOpenRef.current;
      const newMessage = sortedItems.length !== prevItemsLenRef.current || pendingMessages.length !== prevPendingLenRef.current;
      if (justOpened || newMessage) {
        scrollToBottom("instant");
      }
    }
    prevOpenRef.current = open;
    prevItemsLenRef.current = sortedItems.length;
    prevPendingLenRef.current = pendingMessages.length;
  }, [open, sortedItems.length, pendingMessages.length, scrollToBottom]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const isProcessing = parseMutation.isPending || createMutation.isPending || updateItemMutation.isPending || isPhotoProcessing;

  return (
    <div className={cn("fixed inset-0 z-[60] flex flex-col bg-background", !open && "hidden")} data-testid="chatbox-panel">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-primary/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <Bot className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Chat</h2>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
          data-testid="button-close-chatbox"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {sortedItems.length === 0 && pendingMessages.length === 0 && (
          <div className="space-y-3">
            <AiBubble text="Hi there! I'm your sayday assistant. Tell me what you need - I can create reminders, events, and notes for you. Just type or speak naturally!" />
          </div>
        )}

        {sortedItems.map((item) => (
          <div key={item.id} className="space-y-2">
            {item.transcript && (
              <UserBubble text={item.transcript} timestamp={item.createdAt.toString()} />
            )}
            {(item as any).aiResponse ? (
              <AiBubble text={(item as any).aiResponse} />
            ) : item.transcript ? (
              <AiBubble text={generateFallbackResponse({ type: item.type as any, title: item.title, startAt: item.startAt?.toString() || null, location: item.location })} />
            ) : null}
            <ItemCard item={item} onClick={() => {
              if (item.type === "reminder" || item.type === "event") {
                setSelectedItem(item);
                setDetailSheetOpen(true);
              } else if (item.type === "note") {
                savedScrollPos.current = scrollRef.current?.scrollTop ?? null;
                restoreScroll.current = true;
                onNavigateToNote?.();
                onClose();
                navigate(`/notes/${item.id}`);
              }
            }} />
          </div>
        ))}

        {pendingMessages.map((msg) => {
          if (msg.type === "user-pending") {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[85%]">
                  <div className="bg-foreground/5 dark:bg-foreground/10 border border-border/50 rounded-xl rounded-br-sm px-3 py-2" data-testid="chatbox-user-message">
                    <p className="text-sm text-foreground">{msg.text}</p>
                  </div>
                </div>
              </div>
            );
          }
          if (msg.type === "system") {
            return (
              <div key={msg.id} className="flex justify-center">
                <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full" data-testid="chatbox-system-message">{msg.text}</span>
              </div>
            );
          }
          return null;
        })}

        {isProcessing && (
          <div className="flex justify-start gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="bg-muted rounded-xl px-4 py-2.5">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t px-3 py-3 bg-background">
        <div className="relative max-w-lg mx-auto">
          <div className="flex items-end gap-0 rounded-2xl border border-border bg-muted/30 min-h-[52px] px-1 py-1">
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowUploadMenu(!showUploadMenu)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                data-testid="chatbox-upload-button"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              {showUploadMenu && (
                <div className="absolute bottom-12 left-0 bg-background border border-border rounded-xl shadow-lg py-1 min-w-[160px] z-10" data-testid="upload-menu">
                  <label className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/50 cursor-pointer transition-colors" data-testid="upload-files-option">
                    <Upload className="w-4 h-4 text-muted-foreground" />
                    Upload Files
                    <input type="file" className="hidden" accept=".txt,.md,.csv,.json,.xml,.html,.log,.doc,.docx,.pdf,image/*" onChange={(e) => { setShowUploadMenu(false); handleFileUpload(e); }} />
                  </label>
                  <label className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/50 cursor-pointer transition-colors" data-testid="upload-photos-option">
                    <Image className="w-4 h-4 text-muted-foreground" />
                    Photos
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { setShowUploadMenu(false); handlePhotoCapture(e); }} />
                  </label>
                  <label className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/50 cursor-pointer transition-colors" data-testid="upload-camera-option">
                    <Camera className="w-4 h-4 text-muted-foreground" />
                    Take a Photo
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { setShowUploadMenu(false); handlePhotoCapture(e); }} />
                  </label>
                </div>
              )}
            </div>
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Ask me anything..."
              className="flex-1 min-h-[40px] px-2 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              disabled={isProcessing}
              data-testid="chatbox-input"
            />
            {text.trim() ? (
              <button
                onClick={handleSend}
                disabled={isProcessing}
                className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 disabled:opacity-30 hover:opacity-90 transition-opacity"
                data-testid="chatbox-send-button"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            ) : (
              <button
                onClick={handleVoiceClick}
                disabled={voiceState === "processing" || isProcessing}
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all",
                  voiceState === "recording" ? "bg-red-500 text-white animate-pulse" :
                  voiceState === "processing" ? "bg-muted text-muted-foreground" :
                  "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600"
                )}
                data-testid="chatbox-voice-button"
              >
                {voiceState === "idle" && <Mic className="w-4 h-4" />}
                {voiceState === "recording" && <Square className="w-4 h-4" />}
                {voiceState === "processing" && <Loader2 className="w-4 h-4 animate-spin" />}
              </button>
            )}
          </div>
        </div>
      </div>

      <EventDetailSheet
        item={selectedItem}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
      />
    </div>
  );
}
