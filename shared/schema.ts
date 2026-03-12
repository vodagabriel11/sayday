import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const subscriptionPlanEnum = ["free", "pro"] as const;
export type SubscriptionPlan = (typeof subscriptionPlanEnum)[number];

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  password: text("password").notNull(),
  subscriptionPlan: text("subscription_plan").notNull().default("free").$type<SubscriptionPlan>(),
  subscriptionExpiry: timestamp("subscription_expiry"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  weeklyTaskCount: integer("weekly_task_count").notNull().default(0),
  weeklyTaskResetDate: timestamp("weekly_task_reset_date").default(sql`CURRENT_TIMESTAMP`).notNull(),
  notifReminders: boolean("notif_reminders").notNull().default(true),
  notifDailySummary: boolean("notif_daily_summary").notNull().default(false),
  notifEventAlerts: boolean("notif_event_alerts").notNull().default(true),
  defaultReminderMinutes: integer("default_reminder_minutes").notNull().default(15),
  accentColor: text("accent_color").notNull().default("green"),
  fontSize: text("font_size").notNull().default("medium"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const itemTypeEnum = ["reminder", "event", "note"] as const;
export type ItemType = (typeof itemTypeEnum)[number];

export const sourceEnum = ["app", "whatsapp", "attachment"] as const;
export type SourceType = (typeof sourceEnum)[number];

export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull().$type<ItemType>(),
  title: text("title").notNull(),
  description: text("description"),
  transcript: text("transcript"),
  startAt: timestamp("start_at"),
  endAt: timestamp("end_at"),
  location: text("location"),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  source: text("source").notNull().default("app").$type<SourceType>(),
  isDone: boolean("is_done").notNull().default(false),
  structuredContent: jsonb("structured_content"),
  aiResponse: text("ai_response"),
  recurringInterval: integer("recurring_interval"),
  color: text("color").notNull().default("amber"),
  emoji: text("emoji"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const itemReminders = pgTable("item_reminders", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("push"),
  offsetMinutes: integer("offset_minutes").notNull().default(15),
  isEnabled: boolean("is_enabled").notNull().default(true),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertItemSchema = createInsertSchema(items).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertItemReminderSchema = createInsertSchema(itemReminders).omit({
  id: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Item = typeof items.$inferSelect;
export type InsertItem = z.infer<typeof insertItemSchema>;
export type ItemReminder = typeof itemReminders.$inferSelect;
export type InsertItemReminder = z.infer<typeof insertItemReminderSchema>;

export const parseIntentResponseSchema = z.object({
  action: z.enum(["create", "update"]).optional(),
  searchTitle: z.string().optional(),
  type: z.enum(itemTypeEnum),
  title: z.string(),
  description: z.string().optional(),
  startAt: z.string().nullable().optional(),
  endAt: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  structuredContent: z.any().optional(),
  confidence: z.number().optional(),
  explanation: z.string().optional(),
  chatResponse: z.string().optional(),
  notificationType: z.enum(["call", "push", "vibrate"]).optional(),
  reminderOffsets: z.array(z.number()).optional(),
  recurringIntervalMinutes: z.number().optional(),
  emoji: z.string().optional(),
});

export type ParseIntentResponse = z.infer<typeof parseIntentResponseSchema>;
