import { useState, useRef, useCallback } from "react";
import { Mic, Square, Loader2, Calendar, Bell, FileText, Clock, MapPin, Tag, Check, Trash2, Phone, Repeat, X, Vibrate } from "lucide-react";
import { type ParseIntentResponse, type ItemType } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  if (isToday) return `Today at ${timeStr}`;
  const tomorrow = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  const isTomorrow = d.getUTCFullYear() === tomorrow.getUTCFullYear() &&
    d.getUTCMonth() === tomorrow.getUTCMonth() &&
    d.getUTCDate() === tomorrow.getUTCDate();
  if (isTomorrow) return `Tomorrow at ${timeStr}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric", timeZone: "UTC" })} at ${timeStr}`;
}

function formatOffset(minutes: number): string {
  if (minutes === 0) return "At time";
  if (minutes < 60) return `${minutes} min`;
  if (minutes === 60) return "1 hour";
  if (minutes < 1440) return `${minutes / 60} hours`;
  return "1 day";
}

function formatRecurringLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `Every ${m} min`;
  if (m === 0) return h === 1 ? "Every 1 hour" : `Every ${h} hours`;
  return `Every ${h}h ${m}min`;
}

interface GlobalVoiceOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function GlobalVoiceOverlay({ open, onClose }: GlobalVoiceOverlayProps) {
  const [voiceState, setVoiceState] = useState<"idle" | "recording" | "processing">("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [transcript, setTranscript] = useState("");
  const [parsedData, setParsedData] = useState<ParseIntentResponse | null>(null);
  const [editData, setEditData] = useState<ParseIntentResponse | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const { toast } = useToast();

  const parseMutation = useMutation({
    mutationFn: async (input: string) => {
      const res = await apiRequest("POST", "/api/parse-intent", { text: input });
      return res.json();
    },
    onSuccess: (data: ParseIntentResponse) => {
      setParsedData(data);
      setEditData(null);
      setShowConfirmation(true);
    },
    onError: () => {
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
      handleFullClose();
    },
    onError: () => {
      toast({ title: "Error", description: "Could not save item.", variant: "destructive" });
    },
  });

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.start(100);
      setVoiceState("recording");
    } catch {
      toast({ title: "Error", description: "Microphone access denied.", variant: "destructive" });
    }
  }, []);

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

      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: base64 }),
      });

      if (res.ok) {
        const { transcript: t } = await res.json();
        setTranscript(t);
        parseMutation.mutate(t);
      }
    } catch {
      toast({ title: "Error", description: "Transcription failed.", variant: "destructive" });
    } finally {
      setVoiceState("idle");
    }
  }, []);

  const handleMicClick = () => {
    if (voiceState === "idle") startRecording();
    else if (voiceState === "recording") stopRecording();
  };

  const handleDiscard = () => {
    setShowConfirmation(false);
    setParsedData(null);
    setEditData(null);
    setTranscript("");
  };

  const handleFullClose = () => {
    handleDiscard();
    setVoiceState("idle");
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      mediaRecorderRef.current.stop();
    }
    onClose();
  };

  if (!open) return null;

  const current = editData || parsedData;
  const isProcessing = parseMutation.isPending || voiceState === "processing";

  const colors = current?.type === "event"
    ? { bg: "bg-blue-50/50 dark:bg-blue-950/20", border: "border-blue-100/60 dark:border-blue-900/30", icon: "text-blue-500" }
    : current?.type === "reminder"
    ? { bg: "bg-amber-50/50 dark:bg-amber-950/20", border: "border-amber-100/60 dark:border-amber-900/30", icon: "text-amber-500" }
    : { bg: "bg-emerald-50/50 dark:bg-emerald-950/20", border: "border-emerald-100/60 dark:border-emerald-900/30", icon: "text-emerald-500" };

  const Icon = current ? typeIcons[current.type] : Calendar;
  const timeStr = current ? formatPreviewTime(current.startAt) : null;
  const offsets = current?.reminderOffsets && current.reminderOffsets.length > 0 ? current.reminderOffsets : [0];

  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm" data-testid="global-voice-overlay">
      <button
        onClick={handleFullClose}
        className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors"
        data-testid="button-close-voice-overlay"
      >
        <X className="w-5 h-5 text-muted-foreground" />
      </button>

      <div className="flex flex-col items-center gap-6 w-full max-w-sm px-4">
        {showConfirmation && current ? (
          <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className={cn("border rounded-2xl p-4 transition-all", colors.bg, colors.border)} data-testid="card-global-confirmation">
              <div className="flex items-start gap-3">
                {current.emoji ? (
                  <span className="text-lg flex-shrink-0 mt-0.5">{current.emoji}</span>
                ) : (
                  <Icon className={cn("w-5 h-5 flex-shrink-0 mt-0.5", colors.icon)} />
                )}
                <div className="flex-1 min-w-0">
                  <Input
                    value={current.title}
                    onChange={(e) => setEditData({ ...current, title: e.target.value })}
                    className="text-[15px] font-semibold leading-tight border-none px-0 h-auto focus-visible:ring-0 bg-transparent"
                    data-testid="input-global-title"
                  />
                  {timeStr && <p className="text-xs text-muted-foreground mt-1">{timeStr}</p>}

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
                          data-testid="global-toggle-call"
                        >
                          <Phone className="w-3 h-3" />
                          Call Me
                        </button>
                        <button
                          onClick={() => setEditData({ ...current, notificationType: "push" })}
                          className={cn(
                            "flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border transition-all",
                            current.notificationType === "push"
                              ? "border-primary bg-primary/10 text-primary font-medium"
                              : "border-border text-muted-foreground hover:border-gray-300"
                          )}
                          data-testid="global-toggle-vibrate"
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

                  {current.tags && current.tags.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      <Tag className="w-3 h-3 text-muted-foreground" />
                      {current.tags.map((tag) => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{tag}</span>
                      ))}
                    </div>
                  )}

                  {current.location && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <MapPin className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground">{current.location}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-border/30">
                <Button variant="ghost" size="sm" onClick={handleDiscard} className="text-xs text-muted-foreground h-7 px-2" data-testid="button-global-discard">
                  <Trash2 className="w-3 h-3 mr-1" />
                  Discard
                </Button>
                <Button size="sm" onClick={() => createMutation.mutate(current)} disabled={createMutation.isPending} className="text-xs h-7 px-3" data-testid="button-global-save">
                  {createMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
                  {createMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <button
              onClick={handleMicClick}
              disabled={isProcessing}
              className={cn(
                "w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg",
                voiceState === "recording"
                  ? "bg-red-500 text-white animate-pulse"
                  : isProcessing
                  ? "bg-muted text-muted-foreground"
                  : "bg-primary text-primary-foreground"
              )}
              data-testid="button-global-mic"
            >
              {voiceState === "recording" && <span className="absolute w-28 h-28 rounded-full bg-red-500/30 animate-ping" />}
              {voiceState === "idle" && <Mic className="w-10 h-10" />}
              {voiceState === "recording" && <Square className="w-8 h-8" />}
              {isProcessing && <Loader2 className="w-10 h-10 animate-spin" />}
            </button>
            <p className="text-sm text-muted-foreground">
              {voiceState === "idle" && "Tap to speak"}
              {voiceState === "recording" && "Listening... Tap to stop"}
              {isProcessing && "Processing..."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
