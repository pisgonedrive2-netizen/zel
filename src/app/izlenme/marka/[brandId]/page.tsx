import { use } from "react";
import { BrandDetailClient } from "./brand-detail-client";

export default function BrandDetailPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = use(params);
  return <BrandDetailClient brandId={brandId} />;
}
