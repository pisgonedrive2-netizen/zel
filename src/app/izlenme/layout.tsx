import { Suspense } from "react";

export default function IzlenmeLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-muted-foreground">İzlenme yükleniyor…</div>
      }
    >
      {children}
    </Suspense>
  );
}
