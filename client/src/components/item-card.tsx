import { Calendar, Bell, FileText, Clock, MapPin, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { type Item, type ItemType } from "@shared/schema";
import { cn } from "@/lib/utils";

interface ItemCardProps {
  item: Item;
  onEdit?: (item: Item) => void;
  compact?: boolean;
  pastDay?: boolean;
}

const typeConfig: Record<ItemType, { icon: typeof Calendar; color: string; bgColor: string }> = {
  event: { icon: Calendar, color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-500/10" },
  reminder: { icon: Bell, color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-500/10" },
  note: { icon: FileText, color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-500/10" },
};

const itemColorConfig: Record<string, { color: string; bgColor: string }> = {
  amber: { color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-500/10" },
  blue: { color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-500/10" },
  red: { color: "text-red-600 dark:text-red-400", bgColor: "bg-red-500/10" },
  purple: { color: "text-purple-600 dark:text-purple-400", bgColor: "bg-purple-500/10" },
  emerald: { color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-500/10" },
  pink: { color: "text-pink-600 dark:text-pink-400", bgColor: "bg-pink-500/10" },
};

export function ItemCard({ item, onEdit, compact = false, pastDay = false }: ItemCardProps) {
  const [showAllBullets, setShowAllBullets] = useState(false);
  const baseConfig = typeConfig[item.type as ItemType];
  const Icon = baseConfig.icon;
  const config = (item.type === "note") ? baseConfig : (itemColorConfig[item.color || "amber"] || baseConfig);
  const hasEmoji = item.emoji && item.emoji.trim().length > 0;
  const isDone = item.isDone || pastDay;

  const use24h = typeof window !== "undefined" && localStorage.getItem("sayday_time_format") === "24h";

  const formatTime = (date: Date | string | null) => {
    if (!date) return null;
    const d = new Date(date);
    const h = d.getHours();
    const m = d.getMinutes();
    if (use24h) return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return null;
    const d = new Date(date);
    const now = new Date();
    const dKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const nowKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    if (dKey === nowKey) return "Today";
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const tomKey = `${tomorrow.getFullYear()}-${tomorrow.getMonth()}-${tomorrow.getDate()}`;
    if (dKey === tomKey) return "Tomorrow";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <Card
      className={cn(
        "group relative transition-all duration-200 hover-elevate cursor-pointer",
        isDone && "opacity-50",
        compact ? "p-3" : "p-4"
      )}
      onClick={() => onEdit?.(item)}
      data-testid={`card-item-${item.id}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className={cn("p-1 rounded", config.bgColor)}>
              {hasEmoji ? (
                <span className="text-sm">{item.emoji}</span>
              ) : (
                <Icon className={cn("w-3.5 h-3.5", config.color)} />
              )}
            </div>
            <h3
              className={cn(
                "font-medium text-sm truncate",
                isDone && "line-through text-muted-foreground"
              )}
              data-testid={`text-title-${item.id}`}
            >
              {item.title}
            </h3>
          </div>

          {item.type === "note" && item.description && !compact && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2 ml-7" data-testid={`text-desc-${item.id}`}>
              {item.description}
            </p>
          )}

          {item.type === "note" && !compact && (item as any).structuredContent?.bullets && (item as any).structuredContent.bullets.length > 0 && (
            <div className="ml-7 mb-2" data-testid={`content-preview-${item.id}`}>
              <ul className="space-y-0.5">
                {(showAllBullets ? (item as any).structuredContent.bullets : (item as any).structuredContent.bullets.slice(0, 3)).map((bullet: string, i: number) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/80">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
              {(item as any).structuredContent.bullets.length > 3 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowAllBullets(!showAllBullets); }}
                  className="flex items-center gap-0.5 text-[11px] text-primary font-medium mt-1"
                  data-testid={`button-show-more-${item.id}`}
                >
                  {showAllBullets ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {showAllBullets ? "Show less" : `+${(item as any).structuredContent.bullets.length - 3} more`}
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 ml-7 flex-wrap">
            {item.startAt && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {formatDate(item.startAt)}, {formatTime(item.startAt)}
              </span>
            )}
            {item.location && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3" />
                <span className="truncate max-w-[120px]">{item.location}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
