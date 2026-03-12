import { db } from "./db";
import { items, itemReminders, users, type Item, type InsertItem, type ItemReminder, type InsertItemReminder, type User, type InsertUser } from "@shared/schema";
import { eq, and, gte, lte, desc, asc, sql, inArray } from "drizzle-orm";

export interface IStorage {
  createUser(user: InsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<void>;

  getItems(userId?: number): Promise<Item[]>;
  getItem(id: number): Promise<Item | undefined>;
  getItemsByType(type: string, userId?: number): Promise<Item[]>;
  getItemsForDate(date: Date, userId?: number): Promise<Item[]>;
  getItemsForDateRange(start: Date, end: Date, userId?: number): Promise<Item[]>;
  createItem(item: InsertItem): Promise<Item>;
  updateItem(id: number, item: Partial<InsertItem>): Promise<Item | undefined>;
  deleteItem(id: number): Promise<void>;
  markItemDone(id: number): Promise<Item | undefined>;
  getWeeklyTaskCount(userId: number): Promise<number>;
  incrementWeeklyTaskCount(userId: number): Promise<void>;
  resetWeeklyTaskCount(userId: number): Promise<void>;

  getRemindersForItem(itemId: number): Promise<ItemReminder[]>;
  getRemindersForItems(itemIds: number[]): Promise<Record<number, ItemReminder[]>>;
  createReminder(reminder: InsertItemReminder): Promise<ItemReminder>;
  updateReminder(id: number, reminder: Partial<InsertItemReminder>): Promise<ItemReminder | undefined>;
  deleteReminder(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return user;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getItems(userId?: number): Promise<Item[]> {
    if (userId) {
      return db.select().from(items).where(eq(items.userId, userId)).orderBy(desc(items.createdAt));
    }
    return db.select().from(items).orderBy(desc(items.createdAt));
  }

  async getItem(id: number): Promise<Item | undefined> {
    const [item] = await db.select().from(items).where(eq(items.id, id));
    return item;
  }

  async getItemsByType(type: string, userId?: number): Promise<Item[]> {
    if (userId) {
      return db.select().from(items).where(and(eq(items.type, type as any), eq(items.userId, userId))).orderBy(desc(items.createdAt));
    }
    return db.select().from(items).where(eq(items.type, type as any)).orderBy(desc(items.createdAt));
  }

  async getItemsForDate(date: Date, userId?: number): Promise<Item[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const conditions = [gte(items.startAt, startOfDay), lte(items.startAt, endOfDay)];
    if (userId) conditions.push(eq(items.userId, userId));

    return db.select().from(items).where(and(...conditions)).orderBy(asc(items.startAt));
  }

  async getItemsForDateRange(start: Date, end: Date, userId?: number): Promise<Item[]> {
    const conditions = [gte(items.startAt, start), lte(items.startAt, end)];
    if (userId) conditions.push(eq(items.userId, userId));

    return db.select().from(items).where(and(...conditions)).orderBy(asc(items.startAt));
  }

  async createItem(item: InsertItem): Promise<Item> {
    const [created] = await db.insert(items).values(item).returning();
    return created;
  }

  async updateItem(id: number, item: Partial<InsertItem>): Promise<Item | undefined> {
    const [updated] = await db.update(items)
      .set({ ...item, updatedAt: new Date() })
      .where(eq(items.id, id))
      .returning();
    return updated;
  }

  async deleteItem(id: number): Promise<void> {
    await db.delete(items).where(eq(items.id, id));
  }

  async markItemDone(id: number): Promise<Item | undefined> {
    const [updated] = await db.update(items)
      .set({ isDone: true, updatedAt: new Date() })
      .where(eq(items.id, id))
      .returning();
    return updated;
  }

  async getWeeklyTaskCount(userId: number): Promise<number> {
    const user = await this.getUserById(userId);
    if (!user) return 0;
    const now = new Date();
    const resetDate = new Date(user.weeklyTaskResetDate);
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    if (resetDate < monday) {
      await this.resetWeeklyTaskCount(userId);
      return 0;
    }
    return user.weeklyTaskCount;
  }

  async incrementWeeklyTaskCount(userId: number): Promise<void> {
    await db.update(users)
      .set({ weeklyTaskCount: sql`${users.weeklyTaskCount} + 1` })
      .where(eq(users.id, userId));
  }

  async resetWeeklyTaskCount(userId: number): Promise<void> {
    await db.update(users)
      .set({ weeklyTaskCount: 0, weeklyTaskResetDate: new Date() })
      .where(eq(users.id, userId));
  }

  async getRemindersForItem(itemId: number): Promise<ItemReminder[]> {
    return db.select().from(itemReminders).where(eq(itemReminders.itemId, itemId));
  }

  async getRemindersForItems(itemIds: number[]): Promise<Record<number, ItemReminder[]>> {
    if (itemIds.length === 0) return {};
    const rows = await db.select().from(itemReminders).where(inArray(itemReminders.itemId, itemIds));
    const result: Record<number, ItemReminder[]> = {};
    for (const id of itemIds) result[id] = [];
    for (const r of rows) result[r.itemId].push(r);
    return result;
  }

  async createReminder(reminder: InsertItemReminder): Promise<ItemReminder> {
    const [created] = await db.insert(itemReminders).values(reminder).returning();
    return created;
  }

  async updateReminder(id: number, reminder: Partial<InsertItemReminder>): Promise<ItemReminder | undefined> {
    const [updated] = await db.update(itemReminders)
      .set(reminder)
      .where(eq(itemReminders.id, id))
      .returning();
    return updated;
  }

  async deleteReminder(id: number): Promise<void> {
    await db.delete(itemReminders).where(eq(itemReminders.id, id));
  }
}

export const storage = new DatabaseStorage();
