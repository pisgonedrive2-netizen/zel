interface ProgressBarProps {
  value: number; // 0-100
  color?: string;
}

export default function ProgressBar({ value, color = "#3b82f6" }: ProgressBarProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-muted-foreground text-xs tabular-nums w-8 text-right">{value}%</span>
    </div>
  );
}
