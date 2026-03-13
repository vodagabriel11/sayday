import { useState } from "react";
import saydayLogo from "@assets/saydaylogo_1773234839898.webp";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2, ArrowLeft, CheckCircle2, XCircle, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type AuthView = "login" | "signup" | "forgot";

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "At least 6 characters", met: password.length >= 6 },
    { label: "Contains uppercase", met: /[A-Z]/.test(password) },
    { label: "Contains number", met: /[0-9]/.test(password) },
    { label: "Contains special char", met: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = checks.filter(c => c.met).length;
  const colors = ["bg-red-400", "bg-orange-400", "bg-yellow-400", "bg-green-400"];
  const labels = ["Weak", "Fair", "Good", "Strong"];

  if (!password) return null;

  return (
    <div className="space-y-2 mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={cn("h-1 flex-1 rounded-full transition-colors", i < score ? colors[score - 1] : "bg-gray-200 dark:bg-gray-700")} />
        ))}
      </div>
      <p className={cn("text-xs", score <= 1 ? "text-red-500" : score === 2 ? "text-orange-500" : score === 3 ? "text-yellow-600" : "text-green-600")}>
        {labels[score - 1] || "Too weak"}
      </p>
      <div className="space-y-1">
        {checks.map((check, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {check.met ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <Minus className="w-3 h-3 text-gray-400" />}
            <span>{check.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoginForm({ onSwitch }: { onSwitch: (view: AuthView) => void }) {
  const { loginMutation } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    loginMutation.mutate({ email, password }, {
      onError: (err: any) => {
        const msg = err.message?.includes("401") ? "Invalid email or password" : "Login failed. Please try again.";
        toast({ title: "Login failed", description: msg, variant: "destructive" });
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="login-email">Email</label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          placeholder="you@example.com"
          required
          data-testid="input-email"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="login-password">Password</label>
        <div className="relative">
          <input
            id="login-password"
            type={showPw ? "text" : "password"}
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all pr-10"
            placeholder="Enter your password"
            required
            data-testid="input-password"
          />
          <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" data-testid="button-toggle-password">
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <button
        type="submit"
        disabled={loginMutation.isPending}
        className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        data-testid="button-login"
      >
        {loginMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        Log In
      </button>
      <button type="button" onClick={() => onSwitch("forgot")} className="w-full text-sm text-primary hover:underline" data-testid="link-forgot-password">
        Forgot password?
      </button>
    </form>
  );
}

function SignupForm({ onSwitch }: { onSwitch: (view: AuthView) => void }) {
  const { registerMutation } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast({ title: "Error", description: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (!agreed) {
      toast({ title: "Error", description: "Please accept the Terms & Privacy Policy", variant: "destructive" });
      return;
    }
    registerMutation.mutate({ name, email, password }, {
      onError: (err: any) => {
        const msg = err.message?.includes("409") ? "An account with this email already exists" : "Registration failed. Please try again.";
        toast({ title: "Registration failed", description: msg, variant: "destructive" });
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="signup-name">Name</label>
        <input
          id="signup-name"
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          placeholder="Your name"
          required
          data-testid="input-name"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="signup-email">Email</label>
        <input
          id="signup-email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          placeholder="you@example.com"
          required
          data-testid="input-email"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="signup-password">Password</label>
        <div className="relative">
          <input
            id="signup-password"
            type={showPw ? "text" : "password"}
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all pr-10"
            placeholder="Create a password"
            required
            minLength={6}
            data-testid="input-password"
          />
          <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" data-testid="button-toggle-password">
            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <PasswordStrength password={password} />
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="signup-confirm">Confirm Password</label>
        <input
          id="signup-confirm"
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          className={cn(
            "w-full px-3 py-2.5 rounded-lg border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all",
            confirm && confirm !== password ? "border-red-400" : "border-border"
          )}
          placeholder="Confirm your password"
          required
          data-testid="input-confirm-password"
        />
        {confirm && confirm !== password && (
          <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><XCircle className="w-3 h-3" /> Passwords don't match</p>
        )}
      </div>
      <label className="flex items-start gap-2 text-sm text-muted-foreground cursor-pointer" data-testid="label-terms">
        <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-1 accent-primary" data-testid="input-terms" />
        <span>I agree to the <a href="#" className="text-primary underline">Terms of Service</a> and <a href="#" className="text-primary underline">Privacy Policy</a></span>
      </label>
      <button
        type="submit"
        disabled={registerMutation.isPending}
        className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        data-testid="button-signup"
      >
        {registerMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        Create Account
      </button>
    </form>
  );
}

function ForgotPasswordForm({ onSwitch }: { onSwitch: (view: AuthView) => void }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  if (sent) {
    return (
      <div className="text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-7 h-7 text-primary" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Check your email</h3>
        <p className="text-sm text-muted-foreground">
          If an account exists for <span className="font-medium text-foreground">{email}</span>, we've sent password reset instructions.
        </p>
        <button onClick={() => onSwitch("login")} className="text-sm text-primary hover:underline" data-testid="link-back-to-login">
          Back to Log In
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <button type="button" onClick={() => onSwitch("login")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2" data-testid="button-back">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <p className="text-sm text-muted-foreground">Enter your email and we'll send you a link to reset your password.</p>
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5" htmlFor="forgot-email">Email</label>
        <input
          id="forgot-email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          placeholder="you@example.com"
          required
          data-testid="input-email"
        />
      </div>
      <button
        type="submit"
        className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
        data-testid="button-send-reset"
      >
        Send Reset Link
      </button>
    </form>
  );
}

export default function AuthPage() {
  const { user, isLoading } = useAuth();
  const [view, setView] = useState<AuthView>("login");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Redirect to="/" />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex-1 flex flex-col justify-center px-6 py-8 max-w-md mx-auto w-full">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-3">
            <img src={saydayLogo} alt="sayday" className="h-9 dark:invert" />
          </div>
          <p className="text-sm text-muted-foreground">
            {view === "login" && "Welcome back! Log in to continue."}
            {view === "signup" && "Create your account to get started."}
            {view === "forgot" && "Reset your password"}
          </p>
        </div>

        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          {view !== "forgot" && (
            <div className="flex bg-muted rounded-lg p-1 mb-6" data-testid="auth-tab-switcher">
              <button
                onClick={() => setView("login")}
                className={cn(
                  "flex-1 py-2 text-sm font-medium rounded-md transition-all",
                  view === "login" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                )}
                data-testid="tab-login"
              >
                Log In
              </button>
              <button
                onClick={() => setView("signup")}
                className={cn(
                  "flex-1 py-2 text-sm font-medium rounded-md transition-all",
                  view === "signup" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                )}
                data-testid="tab-signup"
              >
                Sign Up
              </button>
            </div>
          )}

          {view === "login" && <LoginForm onSwitch={setView} />}
          {view === "signup" && <SignupForm onSwitch={setView} />}
          {view === "forgot" && <ForgotPasswordForm onSwitch={setView} />}
        </div>
      </div>
    </div>
  );
}
