import { Badge as ShadBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "green" | "blue" | "amber" | "red" | "slate" | "purple" | "cyan";

const cls: Record<Tone, string> = {
  green:  "text-green-400 border-green-500/30 bg-green-500/10",
  blue:   "text-blue-400  border-blue-500/30  bg-blue-500/10",
  amber:  "text-amber-400 border-amber-500/30 bg-amber-500/10",
  red:    "text-red-400   border-red-500/30   bg-red-500/10",
  slate:  "text-muted-foreground bg-muted/30",
  purple: "text-purple-400 border-purple-500/30 bg-purple-500/10",
  cyan:   "text-cyan-400  border-cyan-500/30  bg-cyan-500/10",
};

export default function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: Tone }) {
  return (
    <ShadBadge variant="outline" className={cn("text-xs font-medium", cls[tone])}>
      {children}
    </ShadBadge>
  );
}
