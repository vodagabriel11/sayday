import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/components/theme-provider";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import {
  ArrowLeft, User, CreditCard, Bell, Palette, Shield, HelpCircle,
  ChevronRight, LogOut, Trash2, Download, Moon, Sun, Monitor, Lock,
  Loader2, Crown, Eye, EyeOff, Star, MessageSquare, BookOpen, Zap, Check
} from "lucide-react";
import { cn } from "@/lib/utils";

type SettingsScreen = "main" | "profile" | "subscription" | "notifications" | "appearance" | "privacy" | "support";

function SubScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3 py-4 sticky top-0 bg-background z-10" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}>
      <button onClick={onBack} className="p-2 -ml-2 rounded-lg hover:bg-muted" data-testid="button-back-sub">
        <ArrowLeft className="w-5 h-5" />
      </button>
      <h1 className="text-xl font-bold text-foreground">{title}</h1>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1 mt-5 first:mt-0">{title}</h3>;
}

function NavRow({ icon: Icon, label, subtitle, onClick, danger }: {
  icon: any; label: string; subtitle?: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-3.5 rounded-lg text-left transition-colors",
        danger ? "hover:bg-red-50 dark:hover:bg-red-950/20" : "hover:bg-muted/60"
      )}
      data-testid={`setting-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className={cn(
        "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
        danger ? "bg-red-100 dark:bg-red-950/30" : "bg-muted"
      )}>
        <Icon className={cn("w-[18px] h-[18px]", danger ? "text-red-500" : "text-muted-foreground")} />
      </div>
      <div className="flex-1 min-w-0">
        <span className={cn("text-sm font-medium", danger ? "text-red-600 dark:text-red-400" : "text-foreground")}>{label}</span>
        {subtitle && <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>}
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </button>
  );
}

function SettingItem({ icon: Icon, label, value, onClick, danger, children }: {
  icon: any; label: string; value?: string; onClick?: () => void; danger?: boolean;
  children?: React.ReactNode;
}) {
  const Tag = children ? "div" : "button";
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors",
        danger ? "hover:bg-red-50 dark:hover:bg-red-950/20" : "hover:bg-muted/60",
        !onClick && !children && "cursor-default"
      )}
      data-testid={`setting-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <Icon className={cn("w-5 h-5 shrink-0", danger ? "text-red-500" : "text-muted-foreground")} />
      <span className={cn("flex-1 text-sm", danger ? "text-red-600 dark:text-red-400" : "text-foreground")}>{label}</span>
      {value && <span className="text-xs text-muted-foreground">{value}</span>}
      {children}
      {onClick && !children && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
    </Tag>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      className={cn(
        "w-10 h-6 rounded-full relative transition-colors shrink-0",
        checked ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"
      )}
      data-testid="toggle"
    >
      <div className={cn(
        "w-4 h-4 bg-white rounded-full absolute top-1 transition-transform",
        checked ? "translate-x-5" : "translate-x-1"
      )} />
    </button>
  );
}

function EditNameModal({ name, onClose }: { name: string; onClose: () => void }) {
  const [val, setVal] = useState(name);
  const { toast } = useToast();
  const mutation = useMutation({
    mutationFn: async (newName: string) => {
      const res = await apiRequest("PATCH", "/api/auth/profile", { name: newName });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/me"], data);
      onClose();
    },
    onError: () => toast({ title: "Failed to update name", variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-background rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()} data-testid="modal-edit-name">
        <h3 className="text-lg font-semibold text-foreground">Edit Name</h3>
        <input value={val} onChange={e => setVal(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm" data-testid="input-edit-name" />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium" data-testid="button-cancel">Cancel</button>
          <button onClick={() => val.trim() && mutation.mutate(val.trim())} disabled={mutation.isPending} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2" data-testid="button-save-name">
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/change-password", { currentPassword: current, newPassword: newPw });
    },
    onSuccess: () => {
      onClose();
    },
    onError: (err: any) => {
      const msg = err.message?.includes("401") ? "Current password is incorrect" : "Failed to change password";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (newPw !== confirm) { toast({ title: "Passwords don't match", variant: "destructive" }); return; }
    if (newPw.length < 6) { toast({ title: "Password must be at least 6 characters", variant: "destructive" }); return; }
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-background rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()} data-testid="modal-change-password">
        <h3 className="text-lg font-semibold text-foreground">Change Password</h3>
        <div className="relative">
          <input type={showCurrent ? "text" : "password"} value={current} onChange={e => setCurrent(e.target.value)} placeholder="Current password" className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm pr-10" data-testid="input-current-password" />
          <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
        </div>
        <div className="relative">
          <input type={showNew ? "text" : "password"} value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="New password" className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm pr-10" data-testid="input-new-password" />
          <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
        </div>
        <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Confirm new password" className={cn("w-full px-3 py-2.5 rounded-lg border bg-background text-sm", confirm && confirm !== newPw ? "border-red-400" : "border-border")} data-testid="input-confirm-new-password" />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium" data-testid="button-cancel">Cancel</button>
          <button onClick={handleSubmit} disabled={mutation.isPending} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2" data-testid="button-save-password">
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Change
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const mutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/auth/account");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.clear();
      navigate("/auth");
    },
    onError: () => toast({ title: "Failed to delete account", variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-background rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()} data-testid="modal-delete-account">
        <h3 className="text-lg font-semibold text-red-600">Delete Account</h3>
        <p className="text-sm text-muted-foreground">This will permanently delete your account and all your data. This action cannot be undone.</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium" data-testid="button-cancel">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2" data-testid="button-confirm-delete">
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Delete
          </button>
        </div>
      </div>
    </div>
  );
}


function ProfileScreen({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [editName, setEditName] = useState(false);
  const [changePw, setChangePw] = useState(false);
  const [deleteAccount, setDeleteAccount] = useState(false);
  if (!user) return null;

  return (
    <>
      <SubScreenHeader title="My Profile" onBack={onBack} />
      <div className="flex flex-col items-center py-6">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <User className="w-10 h-10 text-primary" />
        </div>
        <p className="font-semibold text-foreground" data-testid="text-profile-name">{user.name}</p>
        <p className="text-xs text-muted-foreground" data-testid="text-profile-email">{user.email}</p>
      </div>

      <div className="space-y-0.5">
        <SettingItem icon={User} label="Edit name" value={user.name} onClick={() => setEditName(true)} />
        <SettingItem icon={Lock} label="Change password" onClick={() => setChangePw(true)} />
      </div>

      <div className="mt-8 space-y-0.5">
        <SettingItem icon={Trash2} label="Delete account" onClick={() => setDeleteAccount(true)} danger />
      </div>

      {editName && <EditNameModal name={user.name} onClose={() => setEditName(false)} />}
      {changePw && <ChangePasswordModal onClose={() => setChangePw(false)} />}
      {deleteAccount && <DeleteAccountModal onClose={() => setDeleteAccount(false)} />}
    </>
  );
}

function SubscriptionScreen({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  const monthlyPrice = 8.99;
  const yearlyPrice = 71.99;
  const yearlyMonthly = (yearlyPrice / 12).toFixed(2);
  const savings = Math.round((1 - yearlyPrice / (monthlyPrice * 12)) * 100);

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

  if (!user) return null;

  const handleUpgrade = () => {
    toast({
      title: "Coming soon",
      description: "Payment processing will be available soon. Stay tuned!",
    });
  };

  return (
    <>
      <SubScreenHeader title="My Plan" onBack={onBack} />

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
            "flex-1 py-2 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-1.5",
            billing === "yearly" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
          )}
          data-testid="billing-yearly"
        >
          Yearly
          <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">-{savings}%</span>
        </button>
      </div>

      <div className={cn(
        "rounded-xl border-2 p-5 mb-3",
        user.subscriptionPlan === "free" ? "border-primary" : "border-border"
      )} data-testid="plan-free">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-bold text-foreground">Free</h3>
          {user.subscriptionPlan === "free" && (
            <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">CURRENT</span>
          )}
        </div>
        <p className="text-2xl font-bold text-foreground mb-3">$0<span className="text-sm font-normal text-muted-foreground">/month</span></p>
        <ul className="space-y-1.5 mb-4">
          {FREE_FEATURES.map(f => (
            <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
              {f}
            </li>
          ))}
        </ul>
        {user.subscriptionPlan === "free" ? (
          <button
            disabled
            className="w-full py-3 rounded-xl bg-muted text-muted-foreground font-bold text-sm cursor-not-allowed"
            data-testid="button-current-free"
          >
            Current Plan
          </button>
        ) : (
          <button
            onClick={() => toast({ title: "Coming soon", description: "Downgrade will be available soon." })}
            className="w-full py-3 rounded-xl border-2 border-border text-foreground font-bold text-sm hover:bg-muted/50 transition-colors"
            data-testid="button-downgrade"
          >
            Downgrade to Free
          </button>
        )}
      </div>

      <div className={cn(
        "rounded-xl border-2 p-5 mb-6 relative",
        user.subscriptionPlan === "pro" ? "border-primary" : "border-border"
      )} data-testid="plan-pro">
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-0.5 rounded-full">
          RECOMMENDED
        </div>
        <div className="flex items-center gap-2 mb-3">
          <Crown className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-foreground">Pro</h3>
          {user.subscriptionPlan === "pro" && (
            <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">CURRENT</span>
          )}
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
        <ul className="space-y-1.5 mb-4">
          {PRO_FEATURES.map(f => (
            <li key={f} className="flex items-center gap-2 text-sm text-foreground">
              <Check className="w-3.5 h-3.5 text-primary shrink-0" />
              {f}
            </li>
          ))}
        </ul>
        {user.subscriptionPlan === "pro" ? (
          <button
            disabled
            className="w-full py-3 rounded-xl bg-muted text-muted-foreground font-bold text-sm cursor-not-allowed"
            data-testid="button-current-pro"
          >
            Current Plan
          </button>
        ) : (
          <button
            onClick={handleUpgrade}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            data-testid="button-upgrade"
          >
            <Crown className="w-5 h-5" />
            Go Pro
          </button>
        )}
      </div>

      <div className="space-y-0.5">
        <SettingItem icon={CreditCard} label="Restore purchases" onClick={() => toast({ title: "No purchases to restore" })} />
        {user.subscriptionPlan === "pro" && (
          <SettingItem icon={CreditCard} label="Cancel subscription" onClick={() => toast({ title: "Coming soon" })} danger />
        )}
      </div>
    </>
  );
}

function NotificationsScreen({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", "/api/auth/profile", data);
      return res.json();
    },
    onSuccess: (data) => { queryClient.setQueryData(["/api/auth/me"], data); },
  });
  if (!user) return null;

  return (
    <>
      <SubScreenHeader title="Notification Preferences" onBack={onBack} />
      <div className="space-y-0.5 mt-2">
        <SettingItem icon={Bell} label="Reminders / Events">
          <Toggle checked={user.notifReminders} onChange={v => updateProfileMutation.mutate({ notifReminders: v, notifEventAlerts: v })} />
        </SettingItem>
        <SettingItem icon={Bell} label="Daily summary">
          <Toggle checked={user.notifDailySummary} onChange={v => updateProfileMutation.mutate({ notifDailySummary: v })} />
        </SettingItem>
      </div>
    </>
  );
}

function AppearanceScreen({ onBack }: { onBack: () => void }) {
  const { theme, setTheme } = useTheme();

  return (
    <>
      <SubScreenHeader title="Display & Theme" onBack={onBack} />

      <div className="mt-2">
        <p className="text-sm font-medium text-foreground mb-3 px-1">Theme</p>
        <div className="flex gap-2">
          {[
            { value: "light" as const, icon: Sun, label: "Light" },
            { value: "dark" as const, icon: Moon, label: "Dark" },
            { value: "system" as const, icon: Monitor, label: "System" },
          ].map(t => (
            <button
              key={t.value}
              onClick={() => setTheme(t.value)}
              className={cn(
                "flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all text-xs font-medium",
                theme === t.value ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground"
              )}
              data-testid={`theme-${t.value}`}
            >
              <t.icon className="w-5 h-5" />
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function PrivacyScreen({ onBack }: { onBack: () => void }) {
  const { toast } = useToast();
  const exportMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/export-data");
      return res.json();
    },
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sayday-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);


    },
    onError: () => toast({ title: "Failed to export data", variant: "destructive" }),
  });

  const clearDataMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/clear-data");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/weekly-tasks"] });
    },
    onError: () => toast({ title: "Failed to clear data", variant: "destructive" }),
  });

  return (
    <>
      <SubScreenHeader title="Privacy & Data" onBack={onBack} />
      <div className="space-y-0.5 mt-2">
        <SettingItem icon={Download} label="Export my data" onClick={() => exportMutation.mutate()} />
        <SettingItem icon={Trash2} label="Clear all data" onClick={() => {
          if (confirm("Are you sure you want to clear all your tasks, events, and notes? This cannot be undone.")) {
            clearDataMutation.mutate();
          }
        }} danger />
      </div>
      <div className="h-px bg-border my-4" />
      <div className="space-y-0.5">
        <SettingItem icon={Shield} label="Privacy policy" onClick={() => window.open("#", "_blank")} />
        <SettingItem icon={Shield} label="Terms of service" onClick={() => window.open("#", "_blank")} />
      </div>
    </>
  );
}

function SupportScreen({ onBack }: { onBack: () => void }) {
  return (
    <>
      <SubScreenHeader title="Help & Support" onBack={onBack} />
      <div className="space-y-0.5 mt-2">
        <SettingItem icon={Star} label="Rate the app" onClick={() => window.open("#", "_blank")} />
        <SettingItem icon={MessageSquare} label="Send feedback" onClick={() => window.open("mailto:support@sayday.app", "_blank")} />
        <SettingItem icon={BookOpen} label="Help center" onClick={() => window.open("#", "_blank")} />
      </div>
      <div className="h-px bg-border my-4" />
      <div className="px-3">
        <p className="text-xs text-muted-foreground">App version <span className="text-foreground font-medium">1.0.0</span></p>
      </div>
    </>
  );
}

export default function Settings() {
  const { user, logoutMutation } = useAuth();
  const [, navigate] = useLocation();
  const initialScreen = (() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get("screen");
    if (s && ["profile", "subscription", "notifications", "appearance", "privacy", "support"].includes(s)) {
      return s as SettingsScreen;
    }
    return "main";
  })();
  const [screen, setScreen] = useState<SettingsScreen>(initialScreen);

  if (!user) return null;

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => navigate("/auth"),
    });
  };

  if (screen !== "main") {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-md mx-auto px-4 pb-24">
          {screen === "profile" && <ProfileScreen onBack={() => setScreen("main")} />}
          {screen === "subscription" && <SubscriptionScreen onBack={() => setScreen("main")} />}
          {screen === "notifications" && <NotificationsScreen onBack={() => setScreen("main")} />}
          {screen === "appearance" && <AppearanceScreen onBack={() => setScreen("main")} />}
          {screen === "privacy" && <PrivacyScreen onBack={() => setScreen("main")} />}
          {screen === "support" && <SupportScreen onBack={() => setScreen("main")} />}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 pb-24">
        <div className="flex items-center gap-3 py-4 sticky top-0 bg-background z-10" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}>
          <button onClick={() => navigate("/")} className="p-2 -ml-2 rounded-lg hover:bg-muted" data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-foreground">Settings</h1>
        </div>

        <div className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border mb-6" data-testid="profile-card">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate" data-testid="text-user-name">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate" data-testid="text-user-email">{user.email}</p>
          </div>
          <div className={cn(
            "px-2.5 py-1 rounded-full text-xs font-semibold",
            user.subscriptionPlan === "pro" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )} data-testid="text-plan-badge">
            {user.subscriptionPlan === "pro" ? "PRO" : "FREE"}
          </div>
        </div>

        <div className="space-y-0.5">
          <NavRow icon={User} label="My Profile" subtitle={user.name} onClick={() => setScreen("profile")} />
          <NavRow icon={CreditCard} label="My Plan" subtitle={user.subscriptionPlan === "pro" ? "Pro" : "Free"} onClick={() => setScreen("subscription")} />
        </div>

        <div className="h-px bg-border/50 my-2 mx-3" />

        <div className="space-y-0.5">
          <NavRow icon={Bell} label="Notifications" onClick={() => setScreen("notifications")} />
          <NavRow icon={Palette} label="Display & Theme" onClick={() => setScreen("appearance")} />
        </div>

        <div className="h-px bg-border/50 my-2 mx-3" />

        <div className="space-y-0.5">
          <NavRow icon={Shield} label="Privacy & Data" onClick={() => setScreen("privacy")} />
          <NavRow icon={HelpCircle} label="Help & Support" onClick={() => setScreen("support")} />
        </div>

        <div className="h-px bg-border/50 my-2 mx-3" />

        <button
          onClick={handleLogout}
          disabled={logoutMutation.isPending}
          className="w-full flex items-center gap-3 px-3 py-3.5 rounded-lg text-left transition-colors hover:bg-red-50 dark:hover:bg-red-950/20"
          data-testid="button-logout"
        >
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-red-100 dark:bg-red-950/30">
            {logoutMutation.isPending ? <Loader2 className="w-[18px] h-[18px] text-red-500 animate-spin" /> : <LogOut className="w-[18px] h-[18px] text-red-500" />}
          </div>
          <span className="text-sm font-medium text-red-600 dark:text-red-400">Log Out</span>
        </button>
      </div>
    </div>
  );
}
