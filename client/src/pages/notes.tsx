import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { type Item, type ParseIntentResponse } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, FileText, ChevronRight, Tag, Send, Loader2, Mic, Square } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function Notes() {
  const [search, setSearch] = useState("");
  const [noteText, setNoteText] = useState("");
  const [, navigate] = useLocation();
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [voiceState, setVoiceState] = useState<"idle" | "recording" | "processing">("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  const { data: allItems, isLoading } = useQuery<Item[]>({
    queryKey: ["/api/items"],
  });

  const notes = useMemo(() => {
    return allItems?.filter((item) => item.type === "note") || [];
  }, [allItems]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    notes.forEach((n) => n.tags?.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [notes]);

  const filteredNotes = useMemo(() => {
    let filtered = notes;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.description?.toLowerCase().includes(q) ||
          n.transcript?.toLowerCase().includes(q)
      );
    }
    if (selectedTag) {
      filtered = filtered.filter((n) => n.tags?.includes(selectedTag));
    }
    return filtered;
  }, [notes, search, selectedTag]);

  const parseMutation = useMutation({
    mutationFn: async (input: string) => {
      const res = await apiRequest("POST", "/api/parse-intent", { text: `note: ${input}` });
      return res.json();
    },
    onSuccess: (data: ParseIntentResponse) => {
      createMutation.mutate({ data, transcript: noteText });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not process your input.", variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({ data, transcript }: { data: ParseIntentResponse; transcript: string }) => {
      const payload = {
        type: "note" as const,
        title: data.title,
        description: data.description || null,
        transcript: transcript || null,
        startAt: null,
        endAt: null,
        location: null,
        tags: data.tags || [],
        source: "app",
        structuredContent: data.structuredContent || null,
        aiResponse: data.chatResponse || null,
      };
      return apiRequest("POST", "/api/items", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      setNoteText("");
      
    },
    onError: () => {
      toast({ title: "Error", description: "Could not save note.", variant: "destructive" });
    },
  });

  const handleSubmit = useCallback(() => {
    if (!noteText.trim()) return;
    parseMutation.mutate(noteText.trim());
  }, [noteText, parseMutation]);

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
    } catch (err) {
      console.error("Microphone access denied:", err);
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
      const res = await fetch("/api/transcribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audio: base64 }) });
      if (res.ok) {
        const { transcript } = await res.json();
        setNoteText(transcript);
        parseMutation.mutate(transcript);
      }
    } catch (err) {
      console.error("Transcription error:", err);
    } finally {
      setVoiceState("idle");
    }
  }, [parseMutation]);

  const handleVoiceClick = () => {
    if (voiceState === "idle") startRecording();
    else if (voiceState === "recording") stopRecording();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isPending = parseMutation.isPending || createMutation.isPending;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-notes-heading">
            Notes
          </h1>
          <p className="text-sm text-muted-foreground">
            {notes.length} {notes.length === 1 ? "note" : "notes"}
          </p>
        </div>
        <button
          onClick={() => setShowSearch(!showSearch)}
          className={cn(
            "p-2 rounded-full transition-colors",
            showSearch ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
          data-testid="button-toggle-search"
        >
          <Search className="w-5 h-5" />
        </button>
      </div>

      <div className="relative">
        <input
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a note..."
          className="w-full h-12 pl-4 pr-14 rounded-xl border-2 border-primary/30 bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
          disabled={isPending || voiceState !== "idle"}
          data-testid="input-add-note"
        />
        <button
          onClick={noteText.trim() ? handleSubmit : handleVoiceClick}
          disabled={isPending && !noteText.trim()}
          className={cn(
            "absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center transition-all",
            voiceState === "recording"
              ? "bg-red-100 text-red-500"
              : noteText.trim()
              ? "bg-primary text-primary-foreground"
              : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
          )}
          data-testid="button-voice-send-note"
        >
          {isPending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : voiceState === "processing" ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : voiceState === "recording" ? (
            <Square className="w-5 h-5" />
          ) : noteText.trim() ? (
            <Send className="w-5 h-5" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </button>
      </div>

      {showSearch && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes..."
            className="w-full h-10 pl-9 pr-4 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
            data-testid="input-search-notes"
          />
        </div>
      )}

      {allTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Tag className="w-3.5 h-3.5 text-muted-foreground" />
          <Badge
            variant={selectedTag === null ? "default" : "outline"}
            className="cursor-pointer text-xs"
            onClick={() => setSelectedTag(null)}
            data-testid="button-filter-all"
          >
            All
          </Badge>
          {allTags.map((tag) => (
            <Badge
              key={tag}
              variant={selectedTag === tag ? "default" : "outline"}
              className="cursor-pointer text-xs"
              onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
              data-testid={`button-filter-${tag}`}
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-md" />
          ))}
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
            <FileText className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-muted-foreground" data-testid="text-empty-notes">
            {search || selectedTag ? "No matching notes" : "No notes yet"}
          </h3>
          <p className="text-sm text-muted-foreground/70">
            {search || selectedTag
              ? "Try adjusting your search or filters"
              : "Type or speak to add your first note"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredNotes.map((note) => (
            <Card
              key={note.id}
              className="p-3 hover-elevate transition-all cursor-pointer"
              onClick={() => navigate(`/notes/${note.id}`)}
              data-testid={`card-note-${note.id}`}
            >
              <div className="flex items-center gap-2">
                {note.emoji ? (
                  <span className="text-base flex-shrink-0">{note.emoji}</span>
                ) : (
                  <div className="p-1 rounded bg-emerald-500/10 flex-shrink-0">
                    <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                )}
                <h3 className="font-medium text-sm truncate flex-1" data-testid={`text-note-title-${note.id}`}>
                  {note.title}
                </h3>
                {note.tags && note.tags.length > 0 && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex-shrink-0">
                    {note.tags[0]}
                  </Badge>
                )}
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
