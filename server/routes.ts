import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import { storage } from "./storage";
import { parseIntent, transcribeAudio, generateEmojis, describeImage, parseFileContent } from "./ai";
import { insertItemSchema, parseIntentResponseSchema } from "@shared/schema";
import { requireAuth } from "./auth";

const audioBodyParser = express.json({ limit: "50mb" });

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/items", requireAuth, async (req, res) => {
    try {
      const { type, date, startDate, endDate } = req.query;
      const userId = req.user!.id;
      let result;
      if (type) {
        result = await storage.getItemsByType(type as string, userId);
      } else if (date) {
        result = await storage.getItemsForDate(new Date(date as string), userId);
      } else if (startDate && endDate) {
        result = await storage.getItemsForDateRange(new Date(startDate as string), new Date(endDate as string), userId);
      } else {
        result = await storage.getItems(userId);
      }
      res.json(result);
    } catch (error) {
      console.error("Error fetching items:", error);
      res.status(500).json({ error: "Failed to fetch items" });
    }
  });

  app.get("/api/items/:id", requireAuth, async (req, res) => {
    try {
      const item = await storage.getItem(parseInt(req.params.id));
      if (!item) return res.status(404).json({ error: "Item not found" });
      if (item.userId !== req.user!.id) return res.status(403).json({ error: "Access denied" });
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch item" });
    }
  });

  app.post("/api/items", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const data = { ...req.body, userId };
      if (data.startAt) data.startAt = new Date(data.startAt);
      if (data.endAt) data.endAt = new Date(data.endAt);

      const validTypes = ["reminder", "event", "note"];
      if (!data.type || !validTypes.includes(data.type)) {
        return res.status(400).json({ error: "Invalid type. Must be reminder, event, or note." });
      }
      if (!data.title || typeof data.title !== "string" || data.title.trim().length === 0) {
        return res.status(400).json({ error: "Title is required." });
      }

      if (req.user!.subscriptionPlan === "free") {
        const weeklyCount = await storage.getWeeklyTaskCount(userId);
        if (weeklyCount >= 50) {
          return res.status(403).json({ error: "WEEKLY_LIMIT_REACHED", message: "You've reached your 50 tasks/week limit. Upgrade to Pro for unlimited tasks." });
        }
        if (data.recurringInterval) {
          return res.status(403).json({ error: "PRO_FEATURE", message: "Recurring events are a Pro feature. Upgrade to unlock." });
        }
      }

      const item = await storage.createItem(data);
      await storage.incrementWeeklyTaskCount(userId);

      if (data.reminders && Array.isArray(data.reminders)) {
        for (const reminder of data.reminders) {
          await storage.createReminder({ itemId: item.id, ...reminder });
        }
      }
      if ((item.type === "reminder" || item.type === "event") && (!data.reminders || data.reminders.length === 0)) {
        await storage.createReminder({ itemId: item.id, type: "call", offsetMinutes: 0, isEnabled: true });
      }
      if (item.type === "event") {
        const existingOffsets = (data.reminders || []).map((r: any) => r.offsetMinutes);
        if (!existingOffsets.includes(120)) {
          const notifType = (data.reminders && data.reminders.length > 0) ? data.reminders[0].type : "call";
          await storage.createReminder({ itemId: item.id, type: notifType, offsetMinutes: 120, isEnabled: true });
        }
      }
      res.status(201).json(item);
    } catch (error) {
      console.error("Error creating item:", error);
      res.status(500).json({ error: "Failed to create item" });
    }
  });

  app.patch("/api/items/:id", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getItem(parseInt(req.params.id));
      if (!existing) return res.status(404).json({ error: "Item not found" });
      if (existing.userId !== req.user!.id) return res.status(403).json({ error: "Access denied" });

      const data = req.body;
      if (data.startAt) data.startAt = new Date(data.startAt);
      if (data.endAt) data.endAt = new Date(data.endAt);

      if (req.user!.subscriptionPlan === "free" && data.recurringInterval) {
        return res.status(403).json({ error: "PRO_FEATURE", message: "Recurring events are a Pro feature. Upgrade to unlock." });
      }

      const item = await storage.updateItem(parseInt(req.params.id), data);
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to update item" });
    }
  });

  app.delete("/api/items/:id", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getItem(parseInt(req.params.id));
      if (!existing) return res.status(404).json({ error: "Item not found" });
      if (existing.userId !== req.user!.id) return res.status(403).json({ error: "Access denied" });
      await storage.deleteItem(parseInt(req.params.id));
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete item" });
    }
  });

  app.post("/api/items/:id/done", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getItem(parseInt(req.params.id));
      if (!existing) return res.status(404).json({ error: "Item not found" });
      if (existing.userId !== req.user!.id) return res.status(403).json({ error: "Access denied" });
      const item = await storage.markItemDone(parseInt(req.params.id));
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to mark item done" });
    }
  });

  app.post("/api/parse-intent", requireAuth, async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) return res.status(400).json({ error: "Text is required" });
      const result = await parseIntent(text);
      res.json(result);
    } catch (error) {
      console.error("Error parsing intent:", error);
      res.status(500).json({ error: "Failed to parse intent" });
    }
  });

  app.post("/api/parse-image", requireAuth, audioBodyParser, async (req, res) => {
    try {
      const { image } = req.body;
      if (!image) return res.status(400).json({ error: "Image data is required" });
      const description = await describeImage(image);
      const parsed = await parseIntent(description);
      res.json({ description, items: parsed });
    } catch (error) {
      console.error("Error parsing image:", error);
      res.status(500).json({ error: "Failed to parse image" });
    }
  });

  app.post("/api/parse-file", requireAuth, audioBodyParser, async (req, res) => {
    try {
      const { content, fileName } = req.body;
      if (!content) return res.status(400).json({ error: "File content is required" });
      const prefix = fileName ? `File: "${fileName}"\n\n` : "";
      const description = await parseFileContent(prefix + content);
      const parsed = await parseIntent(description);
      res.json({ description, items: parsed });
    } catch (error) {
      console.error("Error parsing file:", error);
      res.status(500).json({ error: "Failed to parse file" });
    }
  });

  app.post("/api/transcribe", requireAuth, audioBodyParser, async (req, res) => {
    try {
      const { audio } = req.body;
      if (!audio) return res.status(400).json({ error: "Audio data is required" });

      const rawBuffer = Buffer.from(audio, "base64");
      const transcript = await transcribeAudio(rawBuffer);
      res.json({ transcript });
    } catch (error) {
      console.error("Error transcribing audio:", error);
      res.status(500).json({ error: "Failed to transcribe audio" });
    }
  });

  app.post("/api/items/reminders/batch", requireAuth, async (req, res) => {
    try {
      const { itemIds } = req.body;
      if (!Array.isArray(itemIds)) return res.status(400).json({ error: "itemIds required" });
      const result = await storage.getRemindersForItems(itemIds);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch reminders" });
    }
  });

  app.get("/api/items/:id/reminders", requireAuth, async (req, res) => {
    try {
      const item = await storage.getItem(parseInt(req.params.id));
      if (!item) return res.status(404).json({ error: "Item not found" });
      if (item.userId !== req.user!.id) return res.status(403).json({ error: "Access denied" });
      const reminders = await storage.getRemindersForItem(parseInt(req.params.id));
      res.json(reminders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch reminders" });
    }
  });

  app.post("/api/reminders", requireAuth, async (req, res) => {
    try {
      const item = await storage.getItem(req.body.itemId);
      if (!item) return res.status(404).json({ error: "Item not found" });
      if (item.userId !== req.user!.id) return res.status(403).json({ error: "Access denied" });
      const reminder = await storage.createReminder(req.body);
      res.status(201).json(reminder);
    } catch (error) {
      res.status(500).json({ error: "Failed to create reminder" });
    }
  });

  app.patch("/api/reminders/:id", requireAuth, async (req, res) => {
    try {
      const reminder = await storage.updateReminder(parseInt(req.params.id), req.body);
      if (!reminder) return res.status(404).json({ error: "Reminder not found" });
      res.json(reminder);
    } catch (error) {
      res.status(500).json({ error: "Failed to update reminder" });
    }
  });

  app.delete("/api/reminders/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteReminder(parseInt(req.params.id));
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete reminder" });
    }
  });

  app.post("/api/items/backfill-emojis", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const allItems = await storage.getItems(userId);
      const itemsWithoutEmoji = allItems.filter(i => !i.emoji);
      if (itemsWithoutEmoji.length === 0) {
        return res.json({ updated: 0 });
      }
      const batches = [];
      for (let i = 0; i < itemsWithoutEmoji.length; i += 30) {
        batches.push(itemsWithoutEmoji.slice(i, i + 30));
      }
      let totalUpdated = 0;
      for (const batch of batches) {
        const emojiMap = await generateEmojis(batch.map(i => ({ id: i.id, title: i.title, type: i.type })));
        for (const [id, emoji] of Object.entries(emojiMap)) {
          await storage.updateItem(Number(id), { emoji });
          totalUpdated++;
        }
      }
      res.json({ updated: totalUpdated });
    } catch (error) {
      res.status(500).json({ error: "Failed to backfill emojis" });
    }
  });

  return httpServer;
}
