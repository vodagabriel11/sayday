import { useState, useRef, useCallback } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceButtonProps {
  onTranscript: (text: string) => void;
  size?: "default" | "large";
  className?: string;
  isProcessing?: boolean;
  onRecordingStart?: () => void;
}

export function VoiceButton({ onTranscript, size = "default", className, isProcessing: externalProcessing = false, onRecordingStart }: VoiceButtonProps) {
  const [state, setState] = useState<"idle" | "recording" | "processing">("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
        },
      });
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(100);
      setState("recording");
      onRecordingStart?.();
    } catch (err) {
      console.error("Microphone access denied:", err);
    }
  }, [onRecordingStart]);

  const stopRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;

    setState("processing");

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
        const { transcript } = await res.json();
        onTranscript(transcript);
      }
    } catch (err) {
      console.error("Transcription error:", err);
    } finally {
      setState("idle");
    }
  }, [onTranscript]);

  const handleClick = () => {
    if (state === "idle" && !externalProcessing) startRecording();
    else if (state === "recording") stopRecording();
  };

  const isLarge = size === "large";
  const showProcessing = state === "processing" || (state === "idle" && externalProcessing);

  return (
    <button
      onClick={handleClick}
      disabled={showProcessing}
      data-testid="button-voice"
      className={cn(
        "relative rounded-full flex items-center justify-center transition-all duration-300",
        isLarge ? "w-36 h-36" : "w-10 h-10",
        state === "recording"
          ? "bg-red-500 text-white"
          : showProcessing
          ? "bg-muted text-muted-foreground"
          : "bg-primary text-primary-foreground",
        state === "idle" && !externalProcessing && isLarge && "animate-breathe",
        className
      )}
    >
      {state === "idle" && !externalProcessing && <Mic className={isLarge ? "w-14 h-14" : "w-4 h-4"} />}
      {state === "recording" && <Square className={isLarge ? "w-12 h-12" : "w-4 h-4"} />}
      {showProcessing && <Loader2 className={cn(isLarge ? "w-14 h-14" : "w-4 h-4", "animate-spin")} />}
    </button>
  );
}
