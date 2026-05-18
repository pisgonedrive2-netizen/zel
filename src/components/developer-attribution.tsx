import { cn } from "@/lib/utils";

type Placement = "login" | "sidebar";

type Props = {
  className?: string;
  /** login: giriş ekranı altı · sidebar: sol menü altı */
  placement?: Placement;
  /** Daraltılmış sidebar’da kısa gösterim */
  sidebarCollapsed?: boolean;
};

const CREDIT_LINE = "OrkunTilki bu uygulamayı geliştirdi.";
const BRAND_LINE = "© 2026 Fox Stream . Dashboard";

/**
 * Geliştirici bilgisi — girişte ortada, oturumda sol menü altında.
 */
export function DeveloperAttribution({
  className,
  placement = "login",
  sidebarCollapsed = false,
}: Props) {
  if (placement === "sidebar") {
    return (
      <div
        role="contentinfo"
        className={cn(
          "border-t border-sidebar-border/80 bg-sidebar/50 px-3 py-2.5 text-[10px] leading-snug text-muted-foreground",
          className
        )}
      >
        {sidebarCollapsed ? (
          <p
            className="text-center font-semibold tracking-tight text-sidebar-foreground/55"
            title={`${CREDIT_LINE} ${BRAND_LINE}`}
          >
            OT
          </p>
        ) : (
          <>
            <p className="text-sidebar-foreground/80">{CREDIT_LINE}</p>
            <p className="mt-1 text-[9px] opacity-80">{BRAND_LINE}</p>
          </>
        )}
      </div>
    );
  }

  return (
    <footer
      role="contentinfo"
      className={cn(
        "shrink-0 border-t border-border/50 bg-background px-6 py-4 text-center text-[11px] leading-relaxed text-muted-foreground",
        className
      )}
    >
      <p>{CREDIT_LINE}</p>
      <p className="mt-1 opacity-80">{BRAND_LINE}</p>
    </footer>
  );
}
