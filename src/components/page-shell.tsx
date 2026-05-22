import { cn } from "@/lib/utils";

const MAX_WIDTH = {
  md: "max-w-[1200px]",
  lg: "max-w-[1240px]",
  xl: "max-w-[1280px]",
  "2xl": "max-w-[1400px]",
} as const;

export type PageShellSize = keyof typeof MAX_WIDTH;

/** Tüm panel sayfalarında tutarlı, üstten kompakt padding. */
export function PageShell({
  children,
  size = "2xl",
  className,
}: {
  children: React.ReactNode;
  size?: PageShellSize;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-2 pb-4 sm:px-3 md:px-5",
        MAX_WIDTH[size],
        className
      )}
    >
      {children}
    </div>
  );
}

/** Kompakt sayfa başlığı — büyük ikonlu header yerine. */
export function PageHeader({
  title,
  description,
  actions,
  icon,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-2 flex-wrap">
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">
            {title}
          </h1>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">{actions}</div>
      )}
    </div>
  );
}
