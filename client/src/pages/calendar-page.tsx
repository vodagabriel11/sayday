import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { type Item } from "@shared/schema";
import { ItemCard } from "@/components/item-card";
import { EventDetailSheet } from "@/components/event-detail-sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, ArrowLeft, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CalendarPage() {
  const [, navigate] = useLocation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const { data: allItems, isLoading } = useQuery<Item[]>({
    queryKey: ["/api/items"],
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now);
  };

  const toLocalDateKey = (d: Date | string) => {
    const date = new Date(d);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  };

  const itemsByDate = useMemo(() => {
    const map: Record<string, Item[]> = {};
    allItems?.forEach((item) => {
      if (item.startAt) {
        const key = toLocalDateKey(item.startAt);
        if (!map[key]) map[key] = [];
        map[key].push(item);
      }
    });
    return map;
  }, [allItems]);

  const selUtcFake = new Date(Date.UTC(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()));
  const selectedDateStr = toLocalDateKey(selUtcFake);
  const selectedItems = itemsByDate[selectedDateStr] || [];

  const today = new Date();
  const nowUtcFake = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const todayStr = toLocalDateKey(nowUtcFake);

  const isToday = selectedDateStr === todayStr;

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const calendarDays = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarDays.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push(d);
  }

  const monthName = currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !allItems) return [];
    const q = searchQuery.toLowerCase().trim();
    return allItems.filter(item => {
      const titleMatch = item.title?.toLowerCase().includes(q);
      const descMatch = item.description?.toLowerCase().includes(q);
      const tagMatch = item.tags?.some(t => t.toLowerCase().includes(q));
      const bulletMatch = (item.structuredContent as any)?.bullets?.some((b: unknown) => typeof b === "string" && b.toLowerCase().includes(q));
      return titleMatch || descMatch || tagMatch || bulletMatch;
    }).sort((a, b) => {
      if (a.startAt && b.startAt) return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
      if (a.startAt) return -1;
      if (b.startAt) return 1;
      return 0;
    });
  }, [searchQuery, allItems]);

  const formatSearchDate = (date: Date | string | null) => {
    if (!date) return "No date";
    const d = new Date(date);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  };

  const use24h = typeof window !== "undefined" && localStorage.getItem("sayday_time_format") === "24h";

  const formatSearchTime = (date: Date | string | null) => {
    if (!date) return "";
    const d = new Date(date);
    const h = d.getUTCHours();
    const m = d.getUTCMinutes();
    if (use24h) return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight" data-testid="text-calendar-heading">
          Calendar
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearchQuery(""); }} data-testid="button-search-toggle">
            {showSearch ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday} data-testid="button-today">
            Today
          </Button>
        </div>
      </div>

      {showSearch && (
        <div className="relative" data-testid="search-container">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            autoFocus
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events, reminders, notes..."
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            data-testid="input-search"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      )}

      {showSearch && searchQuery.trim() && (
        <div className="space-y-2" data-testid="search-results">
          <p className="text-xs text-muted-foreground font-medium">
            {searchResults.length} {searchResults.length === 1 ? "result" : "results"} for "{searchQuery}"
          </p>
          {searchResults.length === 0 ? (
            <div className="text-center py-6">
              <Search className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No items found</p>
            </div>
          ) : (
            searchResults.map(item => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.startAt) {
                    const d = new Date(item.startAt);
                    const itemDate = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
                    setSelectedDate(itemDate);
                    setCurrentDate(itemDate);
                    setSearchQuery("");
                    setShowSearch(false);
                  } else {
                    setEditItem(item);
                    setEditOpen(true);
                  }
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors text-left"
                data-testid={`search-result-${item.id}`}
              >
                <span className="text-lg flex-shrink-0">{item.emoji || (item.type === "event" ? "📅" : item.type === "reminder" ? "🔔" : "📝")}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatSearchDate(item.startAt)}
                    {item.startAt && ` · ${formatSearchTime(item.startAt)}`}
                  </p>
                </div>
                <span className={cn(
                  "text-[10px] font-medium px-2 py-0.5 rounded-full",
                  item.type === "event" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                  item.type === "reminder" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                )}>
                  {item.type}
                </span>
              </button>
            ))
          )}
        </div>
      )}

      <div className="bg-card rounded-md border border-card-border">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <Button size="icon" variant="ghost" onClick={prevMonth} data-testid="button-prev-month">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="font-semibold text-sm" data-testid="text-month">{monthName}</h2>
          <Button size="icon" variant="ghost" onClick={nextMonth} data-testid="button-next-month">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-px p-2">
          {weekDays.map((day) => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}

          {calendarDays.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="aspect-square" />;
            }

            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const hasItems = !!itemsByDate[dateStr]?.length;
            const isSelected = dateStr === selectedDateStr;
            const isTodayCell = dateStr === todayStr;

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(new Date(year, month, day))}
                className={cn(
                  "aspect-square rounded-md flex flex-col items-center justify-center text-sm relative transition-all",
                  isSelected
                    ? "bg-primary text-primary-foreground font-semibold"
                    : isTodayCell
                    ? "bg-primary/10 text-primary font-semibold"
                    : "hover:bg-muted",
                )}
                data-testid={`button-day-${day}`}
              >
                {day}
                {hasItems && !isSelected && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full bg-primary" />
                )}
                {hasItems && isSelected && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full bg-primary-foreground" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">
            {isToday ? "Today" : selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
            {selectedItems.length > 0 && (
              <span className="ml-2 text-muted-foreground font-normal">
                {selectedItems.length} {selectedItems.length === 1 ? "item" : "items"}
              </span>
            )}
          </h3>
        </div>

        {isToday ? (
          <button
            onClick={() => navigate("/today")}
            className="w-full flex items-center gap-3 px-4 py-4 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors"
            data-testid="button-view-today"
          >
            <ArrowLeft className="w-5 h-5 text-primary flex-shrink-0" />
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">View Today's Schedule</p>
              <p className="text-xs text-muted-foreground">
                {selectedItems.length > 0
                  ? `${selectedItems.length} ${selectedItems.length === 1 ? "entry" : "entries"} planned`
                  : "See your plan for today"}
              </p>
            </div>
          </button>
        ) : isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-md" />
            ))}
          </div>
        ) : selectedItems.length === 0 ? (
          <div className="text-center py-8">
            <CalendarIcon className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground" data-testid="text-no-events">
              No items scheduled
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {[...selectedItems].sort((a, b) => new Date(a.startAt!).getTime() - new Date(b.startAt!).getTime()).map((item) => (
              <ItemCard key={item.id} item={item} onEdit={(it) => { setEditItem(it); setEditOpen(true); }} />
            ))}
          </div>
        )}
      </div>

      <EventDetailSheet
        item={editItem}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  );
}
