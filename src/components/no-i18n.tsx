"use client";

/** Kullanıcı içeriği (harcama açıklaması, isim, marka adı) — RU sözlüğüne düşmez. */
export function NoI18n({
  children,
  className,
  as: Tag = "span",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "span" | "p" | "div";
}) {
  return (
    <Tag translate="no" className={className}>
      {children}
    </Tag>
  );
}
