export default function SectionCard({ title, children, className = "" }: {
  title?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`border border-border rounded-xl bg-card overflow-hidden ${className}`}>
      {title && (
        <div className="px-4 py-3 border-b border-border">
          <p className="text-sm font-medium text-foreground">{title}</p>
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
