import { useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, Bell, FileText, Clock, MapPin, Check, Trash2, Phone, Repeat, Loader2, Vibrate, ChevronDown, ChevronUp } from "lucide-react";
import { type ParseIntentResponse, type ItemType } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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

interface VoiceConfirmationSheetProps {
  open: boolean;
  onClose: () => void;
  parsedData: ParseIntentResponse | null;
  transcript: string;
}

export function VoiceConfirmationSheet({ open, onClose, parsedData, transcript }: VoiceConfirmationSheetProps) {
  const [editData, setEditData] = useState<ParseIntentResponse | null>(null);
  const [showAllBullets, setShowAllBullets] = useState(false);
  const { toast } = useToast();

  const current = editData || parsedData;

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
      onClose();
    },
    onError: (err: any) => {
      const msg = err.message || "";
      if (msg.includes("WEEKLY_LIMIT_REACHED") || msg.includes("10 tasks/week")) {
        toast({ title: "Task Limit Reached", description: "You've used all 10 free tasks this week. Upgrade to Pro for unlimited tasks.", variant: "destructive" });
      } else if (msg.includes("PRO_FEATURE")) {
        toast({ title: "Pro Feature", description: "This feature requires a Pro subscription.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: "Could not save item.", variant: "destructive" });
      }
    },
  });

  const handleDiscard = () => {
    setEditData(null);
    setShowAllBullets(false);
    onClose();
  };

  if (!current) return null;

  const colors = current.type === "note"
    ? { bg: "bg-emerald-50/50 dark:bg-emerald-950/20", border: "border-emerald-100/60 dark:border-emerald-900/30", icon: "text-emerald-500" }
    : { bg: "bg-amber-50/50 dark:bg-amber-950/20", border: "border-amber-100/60 dark:border-amber-900/30", icon: "text-amber-500" };

  const Icon = typeIcons[current.type];
  const timeStr = formatPreviewTime(current.startAt);
  const offsets = current.reminderOffsets && current.reminderOffsets.length > 0 ? current.reminderOffsets : [0];

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) handleDiscard(); }}>
      <SheetContent side="bottom" className="rounded-t-2xl max-w-lg mx-auto z-[70] px-4 pb-6 pt-4" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className={cn("border rounded-2xl p-4 transition-all", colors.bg, colors.border)} data-testid="card-voice-confirmation">
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
                data-testid="input-voice-title"
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
                      data-testid="voice-toggle-call"
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
                      data-testid="voice-toggle-vibrate"
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

              {current.location && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <MapPin className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">{current.location}</span>
                </div>
              )}

              {current.type === "note" && current.structuredContent?.bullets && current.structuredContent.bullets.length > 0 && (
                <div className="mt-2" data-testid="voice-content-preview">
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
                      onClick={(e) => { e.stopPropagation(); setShowAllBullets(!showAllBullets); }}
                      className="flex items-center gap-0.5 text-[11px] text-primary font-medium mt-1"
                      data-testid="button-show-more-bullets"
                    >
                      {showAllBullets ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {showAllBullets ? "Show less" : `+${current.structuredContent.bullets.length - 3} more`}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-border/30">
            <Button variant="ghost" size="sm" onClick={handleDiscard} className="text-xs text-muted-foreground h-7 px-2" data-testid="button-voice-discard">
              <Trash2 className="w-3 h-3 mr-1" />
              Discard
            </Button>
            <Button size="sm" onClick={() => createMutation.mutate(current)} disabled={createMutation.isPending} className="text-xs h-7 px-3" data-testid="button-voice-save">
              {createMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
              {createMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
