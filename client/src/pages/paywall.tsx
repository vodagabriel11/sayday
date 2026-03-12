import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { ArrowLeft, Check, Crown, Zap, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const FREE_FEATURES = [
  "10 tasks per week",
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

export default function Paywall({ message }: { message?: string }) {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const monthlyPrice = 8.99;
  const yearlyPrice = 71.99;
  const yearlyMonthly = (yearlyPrice / 12).toFixed(2);
  const savings = Math.round((1 - yearlyPrice / (monthlyPrice * 12)) * 100);

  const handleUpgrade = () => {
    toast({
      title: "Coming soon",
      description: "Payment processing will be available soon. Stay tuned!",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 pb-24">
        <div className="flex items-center gap-3 py-4 sticky top-0 bg-background z-10">
          <button onClick={() => navigate(-1 as any)} className="p-2 -ml-2 rounded-lg hover:bg-muted" data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-foreground">Upgrade</h1>
        </div>

        {message && (
          <div className="px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 mb-6 flex items-start gap-2" data-testid="paywall-message">
            <Lock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300">{message}</p>
          </div>
        )}

        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <Crown className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-1">Unlock Full Power</h2>
          <p className="text-sm text-muted-foreground">Choose the plan that works for you</p>
        </div>

        <div className="flex bg-muted rounded-lg p-1 mb-6" data-testid="billing-toggle">
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

        <div className="rounded-xl border border-border bg-card p-5 mb-4" data-testid="plan-free">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-bold text-foreground">Free</h3>
            {user?.subscriptionPlan === "free" && (
              <span className="text-[10px] font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-full">CURRENT</span>
            )}
          </div>
          <p className="text-2xl font-bold text-foreground mb-4">$0<span className="text-sm font-normal text-muted-foreground">/month</span></p>
          <ul className="space-y-2">
            {FREE_FEATURES.map(f => (
              <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border-2 border-primary bg-card p-5 mb-6 relative" data-testid="plan-pro">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
            RECOMMENDED
          </div>
          <div className="flex items-center gap-2 mb-3">
            <Crown className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-foreground">Pro</h3>
            {user?.subscriptionPlan === "pro" && (
              <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">CURRENT</span>
            )}
          </div>
          <div className="mb-4">
            {billing === "monthly" ? (
              <p className="text-2xl font-bold text-foreground">${monthlyPrice}<span className="text-sm font-normal text-muted-foreground">/month</span></p>
            ) : (
              <div>
                <p className="text-2xl font-bold text-foreground">${yearlyMonthly}<span className="text-sm font-normal text-muted-foreground">/month</span></p>
                <p className="text-xs text-muted-foreground mt-1">Billed ${yearlyPrice}/year · Save {savings}%</p>
              </div>
            )}
          </div>
          <ul className="space-y-2">
            {PRO_FEATURES.map(f => (
              <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                <Check className="w-4 h-4 text-primary shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {user?.subscriptionPlan !== "pro" && (
          <button
            onClick={handleUpgrade}
            className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg"
            data-testid="button-upgrade"
          >
            <Crown className="w-5 h-5" />
            Upgrade to Pro
          </button>
        )}

        <button className="w-full text-center text-sm text-muted-foreground hover:text-foreground mt-4 py-2" data-testid="button-restore">
          Restore purchases
        </button>
      </div>
    </div>
  );
}
