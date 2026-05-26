"use client";

import NextLink from "next/link";
import type { ComponentProps } from "react";

type AppLinkProps = ComponentProps<typeof NextLink>;

/**
 * Varsayılan prefetch kapalı — sidebar’daki çoklu Link, kullanılmayan
 * CSS preload uyarılarını (Chrome) tetikliyordu. Hızlı geçiş gereken yerde
 * prefetch={true} verin.
 */
export function AppLink({ prefetch = false, ...props }: AppLinkProps) {
  return <NextLink prefetch={prefetch} {...props} />;
}

export default AppLink;
