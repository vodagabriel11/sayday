import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import saydayLogo from "@assets/saydaylogo_1773234839898.webp";
import { Switch, Route, useLocation, Link, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery, useMutation } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider, useTheme } from "@/components/theme-provider";
import { Home as HomeIcon, Clock, CalendarDays, FileEdit, Mic, Settings, Moon, MessageCircle, Square, Loader2 } from "lucide-react";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Today from "@/pages/today";
import CalendarPage from "@/pages/calendar-page";
import Notes from "@/pages/notes";
import NoteDetail from "@/pages/note-detail";
import AuthPage from "@/pages/auth-page";
import SettingsPage from "@/pages/settings";
import Paywall from "@/pages/paywall";
import Onboarding from "@/pages/onboarding";
import PlanSelection from "@/pages/plan-selection";
import { Chatbox } from "@/components/chatbox";
import { AlarmOverlay } from "@/components/alarm-overlay";
import { VoiceConfirmationSheet } from "@/components/voice-confirmation-sheet";
import { alarmService } from "@/lib/alarm-service";
import {
  scheduleItemNotifications,
  cancelAllItemNotifications,
  type ReminderNotif,
} from "@/lib/notification-service";
import { Capacitor } from "@capacitor/core";
import { ProtectedRoute } from "@/lib/protected-route";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { type Item, type ParseIntentResponse } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function NavItem({ href, icon: Icon, label, active }: {
  href: string;
  icon: typeof HomeIcon;
  label: string;
  active: boolean;
}) {
  return (
    <Link href={href}>
      <button
        className={cn(
          "flex flex-col items-center gap-0.5 px-3 py-1.5 text-[11px] transition-colors min-w-[56px]",
          active
            ? "text-primary font-semibold"
            : "text-gray-400 dark:text-gray-500"
        )}
        data-testid={`nav-${label.toLowerCase()}`}
      >
        <Icon className={cn("w-5 h-5", active && "text-primary")} />
        <span>{label}</span>
      </button>
    </Link>
  );
}

function CenterMicButton({ isHome, voiceState, onPress }: {
  isHome: boolean;
  voiceState: "idle" | "recording" | "processing";
  onPress: () => void;
}) {
  if (isHome) {
    return (
      <Link href="/">
        <button
          className="flex flex-col items-center min-w-[56px]"
          data-testid="nav-mic-center"
        >
          <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
            <Mic className="w-5 h-5" />
          </div>
        </button>
      </Link>
    );
  }

  const isRecording = voiceState === "recording";
  const isProcessing = voiceState === "processing";

  return (
    <button
      className="flex flex-col items-center min-w-[56px] relative"
      data-testid="nav-mic-center"
      onClick={onPress}
      disabled={isProcessing}
    >
      {isRecording && (
        <span className="absolute w-12 h-12 rounded-full bg-red-500/30 animate-ping" />
      )}
      <div className={cn(
        "w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-200",
        isRecording
          ? "bg-red-500 text-white"
          : isProcessing
          ? "bg-muted text-muted-foreground"
          : "bg-primary text-primary-foreground"
      )}>
        {isRecording && <Square className="w-5 h-5" />}
        {isProcessing && <Loader2 className="w-5 h-5 animate-spin" />}
        {voiceState === "idle" && <Mic className="w-5 h-5" />}
      </div>
    </button>
  );
}

function AlarmSync() {
  const { data: items } = useQuery<Item[]>({ queryKey: ["/api/items"] });

  useEffect(() => {
    if (!items) return;

    alarmService.syncAlarms(items);

    if (!Capacitor.isNativePlatform()) return;

    const activeItems = items.filter(
      (i) => i.startAt && !i.isDone && (i.type === "event" || i.type === "reminder")
    );

    cancelAllItemNotifications().then(async () => {
      if (activeItems.length === 0) return;
      try {
        const res = await apiRequest("POST", "/api/items/reminders/batch", {
          itemIds: activeItems.map((i) => i.id),
        });
        const remindersMap = (await res.json()) as Record<number, ReminderNotif[]>;
        for (const item of activeItems) {
          const reminders = remindersMap[item.id] || [];
          await scheduleItemNotifications(
            item,
            reminders.length > 0
              ? reminders
              : [{ offsetMinutes: 0, type: "call", isEnabled: true }]
          );
        }
      } catch {
        for (const item of activeItems) {
          await scheduleItemNotifications(item, [
            { offsetMinutes: 0, type: "call", isEnabled: true },
          ]);
        }
      }
    });
  }, [items]);

  return null;
}

const NAV_PAGES = ["/", "/today", "/calendar", "/notes"];

function useSwipeNavigation(location: string, navigate: (path: string) => void) {
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isSwiping = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwiping.current = true;
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!isSwiping.current) return;
    isSwiping.current = false;

    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    if (Math.abs(deltaX) < 60 || Math.abs(deltaY) > Math.abs(deltaX) * 0.7) return;

    const basePath = location.startsWith("/notes") ? "/notes" : location;
    const currentIndex = NAV_PAGES.indexOf(basePath);
    if (currentIndex === -1) return;

    if (deltaX < 0 && currentIndex < NAV_PAGES.length - 1) {
      navigate(NAV_PAGES[currentIndex + 1]);
    } else if (deltaX > 0 && currentIndex > 0) {
      navigate(NAV_PAGES[currentIndex - 1]);
    }
  }, [location, navigate]);

  return { onTouchStart, onTouchEnd };
}

function useInlineRecording() {
  const [voiceState, setVoiceState] = useState<"idle" | "recording" | "processing">("idle");
  const [transcript, setTranscript] = useState("");
  const [parsedData, setParsedData] = useState<ParseIntentResponse | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  const parseMutation = useMutation({
    mutationFn: async (input: string) => {
      const res = await apiRequest("POST", "/api/parse-intent", { text: input });
      return res.json();
    },
    onSuccess: (data: ParseIntentResponse) => {
      setParsedData(data);
      setShowConfirmation(true);
    },
    onError: () => {
      toast({ title: "Error", description: "Could not process your input. Try again.", variant: "destructive" });
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

      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: base64 }),
        credentials: "include",
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
  }, [toast, parseMutation]);

  const handleMicPress = useCallback(() => {
    if (voiceState === "idle") startRecording();
    else if (voiceState === "recording") stopRecording();
  }, [voiceState, startRecording, stopRecording]);

  const handleCloseConfirmation = useCallback(() => {
    setShowConfirmation(false);
    setParsedData(null);
    setTranscript("");
  }, []);

  return {
    voiceState,
    transcript,
    parsedData,
    showConfirmation,
    handleMicPress,
    handleCloseConfirmation,
  };
}

function Layout() {
  const [location, navigate] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const chatReturnRef = useRef(false);
  const prevLocationRef = useRef(location);
  const [chatOpen, setChatOpen] = useState(false);
  const swipe = useSwipeNavigation(location, navigate);
  const recording = useInlineRecording();

  useLayoutEffect(() => {
    const prevLoc = prevLocationRef.current;
    prevLocationRef.current = location;
    if (chatReturnRef.current && location === "/" && prevLoc.startsWith("/notes/")) {
      chatReturnRef.current = false;
      setChatOpen(true);
    }
  }, [location]);

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center justify-between px-4 py-3 bg-background sticky top-0 z-50" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}>
        <div className="flex items-center">
          <img src={saydayLogo} alt="sayday" className="h-6 dark:invert" />
        </div>
        <button onClick={() => navigate("/settings")} className="p-2 rounded-full hover:bg-muted transition-colors" data-testid="button-settings">
          <Settings className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto" onTouchStart={swipe.onTouchStart} onTouchEnd={swipe.onTouchEnd}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/today" component={Today} />
          <Route path="/calendar" component={CalendarPage} />
          <Route path="/notes" component={Notes} />
          <Route path="/notes/:id" component={NoteDetail} />
          <Route component={NotFound} />
        </Switch>
      </main>

      {location === "/" && (
        <button
          className="fixed bottom-24 right-5 h-12 px-4 rounded-full bg-orange-100 dark:bg-orange-900/40 text-gray-500 dark:text-gray-400 shadow-lg flex items-center gap-2 hover:opacity-90 transition-opacity z-40"
          data-testid="button-chat-fab"
          onClick={() => setChatOpen(true)}
        >
          <MessageCircle className="w-5 h-5" />
          <span className="text-sm font-semibold">Chat</span>
        </button>
      )}

      <Chatbox open={chatOpen} onClose={() => setChatOpen(false)} onNavigateToNote={() => { chatReturnRef.current = true; }} />
      <VoiceConfirmationSheet
        open={recording.showConfirmation}
        onClose={recording.handleCloseConfirmation}
        parsedData={recording.parsedData}
        transcript={recording.transcript}
      />
      <AlarmSync />
      <AlarmOverlay />

      <nav className="border-t border-gray-100 dark:border-gray-800 bg-background sticky bottom-0 z-50 safe-area-bottom">
        <div className="flex items-center justify-around px-2 pt-1 pb-2 max-w-lg mx-auto">
          <NavItem href="/" icon={HomeIcon} label="Home" active={location === "/"} />
          <NavItem href="/today" icon={Clock} label="Today" active={location === "/today"} />
          <CenterMicButton
            isHome={location === "/"}
            voiceState={recording.voiceState}
            onPress={recording.handleMicPress}
          />
          <NavItem href="/calendar" icon={CalendarDays} label="Calendar" active={location === "/calendar"} />
          <NavItem href="/notes" icon={FileEdit} label="Notes" active={location.startsWith("/notes")} />
        </div>
      </nav>
    </div>
  );
}

function AuthenticatedApp() {
  return (
    <ProtectedRoute>
      <Layout />
    </ProtectedRoute>
  );
}

function AppRoutes() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  const onboardingSeen = localStorage.getItem("onboarding_seen") === "1";
  const planSelected = localStorage.getItem("plan_selected") === "1";

  if (!user) {
    if (!onboardingSeen && location !== "/auth") {
      return <Onboarding />;
    }
    return (
      <Switch>
        <Route path="/auth" component={AuthPage} />
        <Route path="/onboarding" component={Onboarding} />
        <Route><Redirect to="/auth" /></Route>
      </Switch>
    );
  }

  if (!planSelected && location !== "/settings" && location !== "/paywall") {
    return (
      <Switch>
        <Route path="/plan-selection" component={PlanSelection} />
        <Route><Redirect to="/plan-selection" /></Route>
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/auth"><Redirect to="/" /></Route>
      <Route path="/onboarding"><Redirect to="/" /></Route>
      <Route path="/plan-selection" component={PlanSelection} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/paywall" component={Paywall} />
      <Route>
        <AuthenticatedApp />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <AppRoutes />
          <Toaster />
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
