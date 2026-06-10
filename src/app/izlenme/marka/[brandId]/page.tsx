import { BrandDetailClient } from "./brand-detail-client";

type PageProps = {
  params: Promise<{ brandId: string }>;
};

export default async function BrandDetailPage(props: PageProps) {
  const { brandId } = await props.params;
  return <BrandDetailClient brandId={brandId} />;
}
