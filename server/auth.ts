import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import bcrypt from "bcrypt";
import { type Express, type Request, type Response, type NextFunction } from "express";
import { storage } from "./storage";
import { type User } from "@shared/schema";

const PgSession = connectPgSimple(session);

declare global {
  namespace Express {
    interface User {
      id: number;
      name: string;
      email: string;
      subscriptionPlan: string;
      subscriptionExpiry: Date | null;
      stripeCustomerId: string | null;
      stripeSubscriptionId: string | null;
      weeklyTaskCount: number;
      weeklyTaskResetDate: Date;
      notifReminders: boolean;
      notifDailySummary: boolean;
      notifEventAlerts: boolean;
      defaultReminderMinutes: number;
      accentColor: string;
      fontSize: string;
      createdAt: Date;
    }
  }
}

function sanitizeUser(user: User) {
  const { password, ...safe } = user;
  return safe;
}

export function setupAuth(app: Express) {
  app.use(
    session({
      store: new PgSession({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET!,
      resave: false,
      saveUninitialized: false,
      proxy: true,
      cookie: {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "none",
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email.toLowerCase());
          if (!user) return done(null, false, { message: "Invalid email or password" });

          const valid = await bcrypt.compare(password, user.password);
          if (!valid) return done(null, false, { message: "Invalid email or password" });

          return done(null, sanitizeUser(user) as Express.User);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  passport.serializeUser((user: Express.User, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUserById(id);
      if (!user) return done(null, false);
      done(null, sanitizeUser(user) as Express.User);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { name, email, password } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ message: "Name, email, and password are required" });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const existing = await storage.getUserByEmail(email.toLowerCase());
      if (existing) {
        return res.status(409).json({ message: "An account with this email already exists" });
      }

      const hashed = await bcrypt.hash(password, 12);
      const user = await storage.createUser({
        name,
        email: email.toLowerCase(),
        password: hashed,
      });

      const safe = sanitizeUser(user);

      req.login(safe as Express.User, (err) => {
        if (err) return res.status(500).json({ message: "Registration successful but login failed" });
        return res.status(201).json(safe);
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed. Please try again." });
    }
  });

  app.post("/api/auth/login", (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate("local", (err: any, user: Express.User | false, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message || "Invalid credentials" });

      req.login(user, (err) => {
        if (err) return next(err);
        return res.json(user);
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/me", (req: Request, res: Response) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    res.json(req.user);
  });

  app.post("/api/auth/change-password", requireAuth, async (req: Request, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current and new password are required" });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters" });
      }

      const user = await storage.getUserById(req.user!.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) return res.status(401).json({ message: "Current password is incorrect" });

      const hashed = await bcrypt.hash(newPassword, 12);
      await storage.updateUser(user.id, { password: hashed });
      res.json({ message: "Password changed successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  app.patch("/api/auth/profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const { name, email, notifReminders, notifDailySummary, notifEventAlerts, defaultReminderMinutes, accentColor, fontSize } = req.body;
      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (email !== undefined) updates.email = email.toLowerCase();
      if (notifReminders !== undefined) updates.notifReminders = notifReminders;
      if (notifDailySummary !== undefined) updates.notifDailySummary = notifDailySummary;
      if (notifEventAlerts !== undefined) updates.notifEventAlerts = notifEventAlerts;
      if (defaultReminderMinutes !== undefined) updates.defaultReminderMinutes = defaultReminderMinutes;
      if (accentColor !== undefined) updates.accentColor = accentColor;
      if (fontSize !== undefined) updates.fontSize = fontSize;

      if (email) {
        const existing = await storage.getUserByEmail(email.toLowerCase());
        if (existing && existing.id !== req.user!.id) {
          return res.status(409).json({ message: "This email is already in use" });
        }
      }

      const updated = await storage.updateUser(req.user!.id, updates);
      if (!updated) return res.status(404).json({ message: "User not found" });
      res.json(sanitizeUser(updated));
    } catch (error) {
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.delete("/api/auth/account", requireAuth, async (req: Request, res: Response) => {
    try {
      await storage.deleteUser(req.user!.id);
      req.logout((err) => {
        if (err) console.error("Logout error after delete:", err);
        res.json({ message: "Account deleted" });
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete account" });
    }
  });

  app.get("/api/auth/weekly-tasks", requireAuth, async (req: Request, res: Response) => {
    try {
      const count = await storage.getWeeklyTaskCount(req.user!.id);
      res.json({ count, limit: req.user!.subscriptionPlan === "free" ? 10 : null });
    } catch (error) {
      res.status(500).json({ message: "Failed to get task count" });
    }
  });

  app.post("/api/auth/export-data", requireAuth, async (req: Request, res: Response) => {
    try {
      const allItems = await storage.getItems(req.user!.id);
      const data = {
        user: req.user,
        items: allItems,
        exportedAt: new Date().toISOString(),
      };
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: "Failed to export data" });
    }
  });

  app.post("/api/auth/clear-data", requireAuth, async (req: Request, res: Response) => {
    try {
      const allItems = await storage.getItems(req.user!.id);
      for (const item of allItems) {
        await storage.deleteItem(item.id);
      }
      await storage.resetWeeklyTaskCount(req.user!.id);
      res.json({ message: "All data cleared" });
    } catch (error) {
      res.status(500).json({ message: "Failed to clear data" });
    }
  });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}
