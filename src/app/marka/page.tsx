import { redirect } from "next/navigation";
import { toYearMonthLocal } from "@/lib/data";

export default function MarkaIndexPage() {
  const month = toYearMonthLocal(new Date());
  redirect(`/marka/izlenmeler?month=${month}`);
}
