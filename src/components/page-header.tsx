import { Badge } from "@/components/ui/badge";

type Tone = "green" | "blue" | "amber" | "red" | "slate";

const toneCls: Record<Tone, string> = {
  green: "text-green-400 border-green-500/30",
  blue:  "text-blue-400  border-blue-500/30",
  amber: "text-amber-400 border-amber-500/30",
  red:   "text-red-400   border-red-500/30",
  slate: "text-muted-foreground",
};

export default function PageHeader({ title, subtitle, badge, badgeTone = "blue" }: {
  title: string; subtitle?: string; badge?: string; badgeTone?: Tone;
}) {
  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {subtitle && <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>}
      </div>
      {badge && (
        <Badge variant="outline" className={`text-xs ${toneCls[badgeTone]}`}>{badge}</Badge>
      )}
    </div>
  );
}
