import { useState } from "react";
import { useLocation } from "wouter";
import { Mic, CalendarDays, Bell, ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const slides = [
  {
    icon: Mic,
    color: "bg-primary/10 text-primary",
    title: "Just Say It",
    description: "Tell sayday what you need — events, reminders, or notes — using your voice or text. AI understands and organizes everything for you.",
  },
  {
    icon: CalendarDays,
    color: "bg-blue-100 dark:bg-blue-900/30 text-blue-500",
    title: "Stay Organized",
    description: "Your tasks, events, and reminders automatically land on your calendar. Swipe between Home, Today, Calendar, and Notes — all in one place.",
  },
  {
    icon: Bell,
    color: "bg-amber-100 dark:bg-amber-900/30 text-amber-500",
    title: "Never Miss a Thing",
    description: "Get alerted at the right time with smart reminders. Set one-time or recurring alerts so nothing slips through the cracks.",
  },
];

export default function Onboarding() {
  const [current, setCurrent] = useState(0);
  const [, navigate] = useLocation();

  const finish = () => {
    localStorage.setItem("onboarding_seen", "1");
    navigate("/auth");
  };

  const next = () => {
    if (current < slides.length - 1) setCurrent(current + 1);
    else finish();
  };

  const prev = () => {
    if (current > 0) setCurrent(current - 1);
  };

  const slide = slides[current];
  const Icon = slide.icon;

  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex-1 flex flex-col justify-center px-8 max-w-md mx-auto w-full">
        <div className="flex flex-col items-center text-center">
          <div className={cn("w-24 h-24 rounded-3xl flex items-center justify-center mb-8", slide.color)}>
            <Icon className="w-12 h-12" />
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-3" data-testid={`onboarding-title-${current}`}>
            {slide.title}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px]" data-testid={`onboarding-desc-${current}`}>
            {slide.description}
          </p>
        </div>
      </div>

      <div className="px-8 pb-10 max-w-md mx-auto w-full">
        <div className="flex items-center justify-center gap-2 mb-8">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={cn(
                "h-2 rounded-full transition-all",
                i === current ? "w-8 bg-primary" : "w-2 bg-muted-foreground/30"
              )}
              data-testid={`onboarding-dot-${i}`}
            />
          ))}
        </div>

        <div className="flex items-center gap-3">
          {current > 0 && (
            <button
              onClick={prev}
              className="w-12 h-12 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              data-testid="button-onboarding-prev"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={next}
            className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            data-testid="button-onboarding-next"
          >
            {current < slides.length - 1 ? "Next" : "Get Started"}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {current < slides.length - 1 && (
          <button
            onClick={finish}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground mt-4 py-2 transition-colors"
            data-testid="button-onboarding-skip"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  );
}
