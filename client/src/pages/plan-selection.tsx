import { useState } from "react";
import saydayLogo from "@assets/saydaylogo_1773234839898.webp";
import { useLocation } from "wouter";
import { Check, Crown, Zap, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const FREE_FEATURES = [
  "50 tasks per week",
  "Basic reminders",
  "Basic events",
];

const PRO_FEATURES = [
  "Unlimited tasks",
  "Unlimited reminders",
  "Unlimited events",
  "Unlimited notes",
  "Auto-structured notes",
  "Recurring scheduling",
];

export default function PlanSelection() {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [selected, setSelected] = useState<"free" | "pro">("free");
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const monthlyPrice = 8.99;
  const yearlyPrice = 71.99;
  const yearlyMonthly = (yearlyPrice / 12).toFixed(2);
  const savings = Math.round((1 - yearlyPrice / (monthlyPrice * 12)) * 100);

  const handleContinue = () => {
    if (selected === "pro") {
      toast({
        title: "Coming soon",
        description: "Payment processing will be available soon. Stay tuned!",
      });
      localStorage.setItem("plan_selected", "1");
      navigate("/");
    } else {
      localStorage.setItem("plan_selected", "1");
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 pb-8">
        <div className="pb-4 text-center" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 2rem)' }}>
          <div className="flex items-center justify-center mb-2">
            <img src={saydayLogo} alt="sayday" className="h-8 dark:invert" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-1" data-testid="plan-selection-title">Choose Your Plan</h1>
          <p className="text-sm text-muted-foreground">You can change this anytime in Settings</p>
        </div>

        <div className="flex bg-muted rounded-lg p-1 mb-5" data-testid="billing-toggle">
          <button
            onClick={() => setBilling("monthly")}
            className={cn(
              "flex-1 py-2 text-sm font-medium rounded-md transition-all",
              billing === "monthly" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            )}
            data-testid="billing-monthly"
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling("yearly")}
            className={cn(
              "flex-1 py-2 text-sm font-medium rounded-md transition-all relative",
              billing === "yearly" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            )}
            data-testid="billing-yearly"
          >
            Yearly
            <span className="absolute -top-2 -right-1 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">-{savings}%</span>
          </button>
        </div>

        <button
          onClick={() => setSelected("free")}
          className={cn(
            "w-full rounded-xl border-2 bg-card p-5 mb-3 text-left transition-all",
            selected === "free" ? "border-primary shadow-sm" : "border-border"
          )}
          data-testid="plan-free"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-muted-foreground" />
              <h3 className="font-bold text-foreground">Free</h3>
            </div>
            <div className={cn(
              "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
              selected === "free" ? "border-primary bg-primary" : "border-muted-foreground/30"
            )}>
              {selected === "free" && <Check className="w-3 h-3 text-primary-foreground" />}
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground mb-3">$0<span className="text-sm font-normal text-muted-foreground">/month</span></p>
          <ul className="space-y-1.5">
            {FREE_FEATURES.map(f => (
              <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </button>

        <button
          onClick={() => setSelected("pro")}
          className={cn(
            "w-full rounded-xl border-2 bg-card p-5 mb-6 text-left transition-all relative",
            selected === "pro" ? "border-primary shadow-sm" : "border-border"
          )}
          data-testid="plan-pro"
        >
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-0.5 rounded-full">
            RECOMMENDED
          </div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-foreground">Pro</h3>
            </div>
            <div className={cn(
              "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
              selected === "pro" ? "border-primary bg-primary" : "border-muted-foreground/30"
            )}>
              {selected === "pro" && <Check className="w-3 h-3 text-primary-foreground" />}
            </div>
          </div>
          <div className="mb-3">
            {billing === "monthly" ? (
              <p className="text-2xl font-bold text-foreground">${monthlyPrice}<span className="text-sm font-normal text-muted-foreground">/month</span></p>
            ) : (
              <div>
                <p className="text-2xl font-bold text-foreground">${yearlyMonthly}<span className="text-sm font-normal text-muted-foreground">/month</span></p>
                <p className="text-xs text-muted-foreground mt-0.5">Billed ${yearlyPrice}/year · Save {savings}%</p>
              </div>
            )}
          </div>
          <ul className="space-y-1.5">
            {PRO_FEATURES.map(f => (
              <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </button>

        <button
          onClick={handleContinue}
          className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          data-testid="button-continue-plan"
        >
          {selected === "pro" ? "Continue with Pro" : "Continue with Free"}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
