import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { type Item } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ArrowLeft, MoreHorizontal, Trash2, Calendar as CalendarIcon, Save, Loader2, Pencil, Eye, ChevronDown, ChevronUp } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

export default function NoteDetail() {
  const [, params] = useRoute("/notes/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const noteId = params?.id ? Number(params.id) : null;

  const { data: allItems, isLoading } = useQuery<Item[]>({
    queryKey: ["/api/items"],
  });

  const note = allItems?.find((item) => item.id === noteId && item.type === "note") || null;

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [transcript, setTranscript] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [isListNote, setIsListNote] = useState(false);

  useEffect(() => {
    if (note) {
      const sc = note.structuredContent as any;
      setTitle(note.title);
      const bulletsOnly = sc?.bullets && sc.bullets.length > 0;
      const bodyIsBullets = sc?.body && bulletsOnly && (() => {
        const bodyLines = sc.body.split("\n").map((l: string) => l.replace(/^[-*•]\s*/, "").trim()).filter((l: string) => l);
        return bodyLines.length === sc.bullets.length && bodyLines.every((l: string, i: number) => l === sc.bullets[i]);
      })();
      const isList = ((!sc?.body) && bulletsOnly) || bodyIsBullets;
      setIsListNote(isList);
      if (isList) {
        const bulletText = sc.bullets.map((b: string) => `- ${b}`).join("\n");
        setBody(bulletText);
      } else if (sc?.body) {
        setBody(sc.body);
      } else {
        setBody(note.description || "");
      }
      setTranscript(note.transcript || "");
      setHasChanges(false);
    }
  }, [note]);

  const markChanged = () => setHasChanges(true);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!note) return;
      const existing = note.structuredContent as any;
      const summary = existing?.summary || "";

      let structuredContent;
      if (isListNote) {
        const bullets = body
          .split("\n")
          .map((line: string) => line.replace(/^[-*•]\s*/, "").trim())
          .filter((line: string) => line.length > 0);
        structuredContent = { body: null, bullets, summary };
      } else {
        const bullets = existing?.bullets || [];
        structuredContent = { body, bullets, summary };
      }

      return apiRequest("PATCH", `/api/items/${note.id}`, {
        title,
        description: summary || title,
        structuredContent,
        transcript: transcript || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      setHasChanges(false);
      setIsEditing(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Could not save note.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      navigate("/notes");
    },
  });

  const convertMutation = useMutation({
    mutationFn: async (n: Item) => {
      return apiRequest("PATCH", `/api/items/${n.id}`, { type: "reminder" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      navigate("/notes");
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (!note) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button
          onClick={() => navigate("/notes")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          data-testid="button-back-notes"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Notes
        </button>
        <p className="text-center text-muted-foreground py-12">Note not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-32">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => { window.history.length > 1 ? window.history.back() : navigate("/notes"); }}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          data-testid="button-back-notes"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant={isEditing ? "default" : "outline"}
            onClick={() => {
              if (isEditing && hasChanges) {
                updateMutation.mutate();
              } else {
                setIsEditing(!isEditing);
              }
            }}
            disabled={isEditing && hasChanges && (updateMutation.isPending || !title.trim())}
            className="h-8 gap-1.5 text-xs"
            data-testid="button-toggle-edit"
          >
            {isEditing
              ? (updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />)
              : <Pencil className="w-3.5 h-3.5" />}
            {isEditing
              ? (updateMutation.isPending ? "Saving..." : "Save")
              : "Edit"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8" data-testid="button-note-menu">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => convertMutation.mutate(note)}>
                <CalendarIcon className="w-4 h-4 mr-2" />
                Convert to task
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => deleteMutation.mutate(note.id)}
                className="text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {note.emoji && <span className="text-2xl">{note.emoji}</span>}
            {isEditing ? (
              <Input
                value={title}
                onChange={(e) => { setTitle(e.target.value); markChanged(); }}
                className="text-xl font-bold border-none px-0 h-auto focus-visible:ring-0 bg-transparent"
                data-testid="input-note-title"
              />
            ) : (
              <h1 className="text-xl font-bold text-foreground" data-testid="text-note-title">{title}</h1>
            )}
          </div>
          <div className="flex items-center gap-2 ml-0.5">
            <span className="text-xs text-muted-foreground/60">
              {new Date(note.createdAt).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
            {note.tags && note.tags.length > 0 && note.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        {isEditing ? (
          <textarea
            value={body}
            onChange={(e) => { setBody(e.target.value); markChanged(); }}
            placeholder="Write your note using markdown..."
            className={cn(
              "w-full text-sm rounded-xl border border-border bg-background p-4 resize-none min-h-[300px] font-mono",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              "placeholder:text-muted-foreground/50"
            )}
            data-testid="input-note-body"
          />
        ) : (
          <div className="space-y-4">
            <div
              className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground/90 prose-li:text-foreground/90 prose-strong:text-foreground prose-a:text-primary"
              data-testid="note-body-rendered"
            >
              {body ? (
                <ReactMarkdown>{body}</ReactMarkdown>
              ) : (
                <p className="text-muted-foreground/60 italic">No content yet. Tap Edit to start writing.</p>
              )}
            </div>
            {(() => {
              const sc = note.structuredContent as any;
              if (isListNote) return null;
              const hasSeparateBullets = sc?.body && sc?.bullets && sc.bullets.length > 0;
              if (!hasSeparateBullets) return null;
              return (
                <div className="border-t border-border pt-3" data-testid="note-key-takeaways">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Key takeaways</p>
                  <ul className="space-y-1">
                    {sc.bullets.map((b: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                        <span className="text-muted-foreground/50 mt-0.5">•</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}
          </div>
        )}

        {transcript && (
          <div className="border-t border-border pt-3">
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
              data-testid="button-toggle-transcript"
            >
              {showTranscript ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              Original transcript
            </button>
            {showTranscript && (
              <div className="mt-2 p-3 rounded-lg bg-muted/30 text-sm text-muted-foreground leading-relaxed" data-testid="note-transcript">
                {transcript}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
