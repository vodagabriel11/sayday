import { db } from "./db";
import { items, itemReminders } from "@shared/schema";
import { sql } from "drizzle-orm";

export async function seedDatabase() {
  const existing = await db.select().from(items).limit(1);
  if (existing.length > 0) return;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const seedItems = [
    {
      type: "event" as const,
      title: "Team standup meeting",
      description: "Daily sync with the dev team to discuss progress and blockers",
      startAt: new Date(today.getTime() + 10 * 60 * 60 * 1000),
      endAt: new Date(today.getTime() + 10.5 * 60 * 60 * 1000),
      location: "Conference Room B",
      tags: ["Work", "Meeting"],
      source: "app" as const,
      isDone: false,
    },
    {
      type: "reminder" as const,
      title: "Pick up dry cleaning",
      description: "Shirts and suit from Express Cleaners on Main St",
      startAt: new Date(today.getTime() + 17 * 60 * 60 * 1000),
      tags: ["Personal", "Errands"],
      source: "app" as const,
      isDone: false,
    },
    {
      type: "event" as const,
      title: "Dentist appointment",
      description: "Regular checkup and cleaning at Dr. Smith's office",
      startAt: new Date(today.getTime() + 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000),
      endAt: new Date(today.getTime() + 24 * 60 * 60 * 1000 + 15 * 60 * 60 * 1000),
      location: "SmileCare Dental, 45 Oak Avenue",
      tags: ["Health", "Personal"],
      source: "app" as const,
      isDone: false,
    },
    {
      type: "note" as const,
      title: "App redesign ideas",
      description: "Brainstorming notes for the mobile app refresh",
      tags: ["Work", "Ideas"],
      source: "app" as const,
      isDone: false,
      structuredContent: {
        bullets: [
          "Simplify onboarding flow to 3 steps max",
          "Add dark mode support with system preference detection",
          "Replace tab bar with gesture-based navigation",
          "Use micro-animations for state transitions",
        ],
        summary: "Key ideas for improving the mobile app UX with focus on simplicity and modern interactions",
      },
    },
    {
      type: "reminder" as const,
      title: "Call Mom for birthday",
      description: "Mom's birthday is coming up, plan a surprise dinner",
      startAt: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000),
      tags: ["Personal", "Family"],
      source: "app" as const,
      isDone: false,
    },
    {
      type: "note" as const,
      title: "Grocery list for the week",
      description: "Weekly shopping list",
      tags: ["Shopping", "Personal"],
      source: "app" as const,
      isDone: false,
      structuredContent: {
        bullets: [
          "Avocados (3), tomatoes, spinach, mushrooms",
          "Chicken breast (1kg), salmon fillets",
          "Greek yogurt, almond milk, eggs",
          "Whole wheat bread, pasta, rice",
          "Olive oil, garlic, lemons",
        ],
        summary: "Weekly groceries focused on healthy meals and meal prep",
      },
    },
    {
      type: "event" as const,
      title: "Yoga class",
      description: "Vinyasa flow class with instructor Maria",
      startAt: new Date(today.getTime() + 18 * 60 * 60 * 1000),
      endAt: new Date(today.getTime() + 19 * 60 * 60 * 1000),
      location: "ZenFit Studio, Level 2",
      tags: ["Health", "Personal"],
      source: "app" as const,
      isDone: false,
    },
  ];

  const createdItems = await db.insert(items).values(seedItems).returning();

  const remindersData = [
    { itemId: createdItems[0].id, type: "push", offsetMinutes: 15, isEnabled: true },
    { itemId: createdItems[1].id, type: "push", offsetMinutes: 30, isEnabled: true },
    { itemId: createdItems[2].id, type: "push", offsetMinutes: 60, isEnabled: true },
    { itemId: createdItems[2].id, type: "push", offsetMinutes: 1440, isEnabled: true },
    { itemId: createdItems[4].id, type: "push", offsetMinutes: 120, isEnabled: true },
    { itemId: createdItems[6].id, type: "push", offsetMinutes: 30, isEnabled: true },
  ];

  await db.insert(itemReminders).values(remindersData);

  console.log(`Seeded ${createdItems.length} items and ${remindersData.length} reminders`);
}
