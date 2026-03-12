import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Bell, Clock, MapPin, Tag, ChevronDown, ChevronUp, Check, Pencil, Trash2, FileText } from "lucide-react";
import { type ParseIntentResponse, type ItemType } from "@shared/schema";
import { cn } from "@/lib/utils";

interface ConfirmationPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ParseIntentResponse | null;
  transcript: string;
  onConfirm: (data: ParseIntentResponse) => void;
  onDelete: () => void;
  isPending: boolean;
}

const typeIcons: Record<ItemType, typeof Calendar> = {
  event: Calendar,
  reminder: Bell,
  note: FileText,
};

const typeColors: Record<ItemType, string> = {
  event: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  reminder: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  note: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

export function ConfirmationPopup({
  open,
  onOpenChange,
  data,
  transcript,
  onConfirm,
  onDelete,
  isPending,
}: ConfirmationPopupProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showAllBullets, setShowAllBullets] = useState(false);
  const [editData, setEditData] = useState<ParseIntentResponse | null>(null);
  const [lastDataRef, setLastDataRef] = useState<ParseIntentResponse | null>(null);

  if (data !== lastDataRef) {
    setLastDataRef(data);
    setEditData(null);
    setShowDetails(false);
    setShowTranscript(false);
    setShowAllBullets(false);
  }

  const current = editData || data;
  if (!current) return null;

  const TypeIcon = typeIcons[current.type];

  const handleConfirm = () => {
    onConfirm(current);
  };

  const formatDateTime = (dt: string | null | undefined) => {
    if (!dt) return "No time set";
    const d = new Date(dt);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const isTomorrow = d.toDateString() === new Date(now.getTime() + 86400000).toDateString();

    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    if (isToday) return `Today, ${time}`;
    if (isTomorrow) return `Tomorrow, ${time}`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + `, ${time}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md gap-4" data-testid="dialog-confirmation">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Confirm item</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className={cn("p-2 rounded-md", typeColors[current.type])}>
              {current.emoji ? (
                <span className="text-xl">{current.emoji}</span>
              ) : (
                <TypeIcon className="w-5 h-5" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="secondary" className="text-xs capitalize" data-testid="badge-type">
                  {current.type}
                </Badge>
                {current.confidence !== undefined && current.confidence >= 0.8 && (
                  <Badge variant="outline" className="text-xs">
                    {Math.round(current.confidence * 100)}% confident
                  </Badge>
                )}
              </div>
              <Input
                value={current.title}
                onChange={(e) => setEditData({ ...current, title: e.target.value })}
                className="text-base font-medium border-none px-0 h-auto focus-visible:ring-0"
                data-testid="input-title"
              />
            </div>
          </div>

          {current.startAt && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span data-testid="text-datetime">{formatDateTime(current.startAt)}</span>
              {current.endAt && (
                <>
                  <span>-</span>
                  <span>{formatDateTime(current.endAt)}</span>
                </>
              )}
            </div>
          )}

          {current.location && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span data-testid="text-location">{current.location}</span>
            </div>
          )}

          {current.tags && current.tags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Tag className="w-3.5 h-3.5 text-muted-foreground" />
              {current.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {current.type === "note" && current.structuredContent?.bullets && current.structuredContent.bullets.length > 0 && (
            <div data-testid="content-preview">
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
                  data-testid="button-show-more-bullets"
                >
                  {showAllBullets ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {showAllBullets ? "Show less" : `+${current.structuredContent.bullets.length - 3} more`}
                </button>
              )}
            </div>
          )}

          {transcript && (
            <div>
              <button
                onClick={() => setShowTranscript(!showTranscript)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                data-testid="button-toggle-transcript"
              >
                {showTranscript ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                Original transcript
              </button>
              {showTranscript && (
                <p className="text-xs text-muted-foreground mt-1 p-2 bg-muted rounded-md" data-testid="text-transcript">
                  {transcript}
                </p>
              )}
            </div>
          )}

          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 text-xs font-medium text-primary transition-colors"
            data-testid="button-toggle-details"
          >
            {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showDetails ? "Hide details" : "More details"}
          </button>

          {showDetails && (
            <div className="space-y-3 border-t pt-3">
              <div>
                <Label className="text-xs text-muted-foreground">Description</Label>
                <Textarea
                  value={current.description || ""}
                  onChange={(e) => setEditData({ ...current, description: e.target.value })}
                  className="mt-1 text-sm resize-none"
                  rows={2}
                  data-testid="input-description"
                />
              </div>
              {current.type !== "note" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Start</Label>
                    <Input
                      type="datetime-local"
                      value={current.startAt ? new Date(current.startAt).toISOString().slice(0, 16) : ""}
                      onChange={(e) => setEditData({ ...current, startAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                      className="mt-1 text-sm"
                      data-testid="input-start"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">End</Label>
                    <Input
                      type="datetime-local"
                      value={current.endAt ? new Date(current.endAt).toISOString().slice(0, 16) : ""}
                      onChange={(e) => setEditData({ ...current, endAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                      className="mt-1 text-sm"
                      data-testid="input-end"
                    />
                  </div>
                </div>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">Location</Label>
                <Input
                  value={current.location || ""}
                  onChange={(e) => setEditData({ ...current, location: e.target.value || null })}
                  className="mt-1 text-sm"
                  placeholder="Add location"
                  data-testid="input-location"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-destructive"
            data-testid="button-delete"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Discard
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isPending}
            size="sm"
            data-testid="button-confirm"
          >
            <Check className="w-4 h-4 mr-1" />
            {isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
