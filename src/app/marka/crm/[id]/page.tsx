"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, Mail, Phone, Send, Plus, MessageSquare, TrendingUp,
} from "lucide-react";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { clientIsReadOnly } from "@/lib/org-capability";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Select, Textarea } from "@/components/ui/field";
import { fmtDateTime } from "@/lib/fmt-date";
import {
  fetchContactDetail, addInteraction, type ContactDetail,
} from "@/lib/crm-api";
import {
  CONTACT_STATUS_LABELS, DEAL_STAGE_LABELS, INTERACTION_TYPE_LABELS,
  type InteractionType,
} from "@/types/crm";

const CUR_SYMBOL: Record<string, string> = { USD: "$", EUR: "€", TRY: "₺" };

export default function MarkaCrmKontakPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id ?? "");
  const { user, brandId, brand, canViewBrand, isAdminView } = useMarkaPortal();
  const readOnly = !isAdminView && clientIsReadOnly(user?.orgRole);

  const [detail, setDetail] = useState<ContactDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<InteractionType>("note");
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setDetail(await fetchContactDetail(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandId || !summary.trim()) return;
    setBusy(true);
    try {
      await addInteraction({ brandId, contactId: id, type, summary: summary.trim() });
      setSummary("");
      setType("note");
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Eklenemedi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <MarkaPageGuard user={user} canViewBrand={canViewBrand} brandId={brandId} brand={brand}>
      <div className="mx-auto max-w-[1000px] space-y-5 pb-10">
        <button onClick={() => router.push("/marka/crm")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={15} /> CRM
        </button>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>
        )}

        {loading && !detail ? (
          <div className="py-16 text-center text-muted-foreground"><Loader2 size={24} className="mx-auto animate-spin opacity-50" /></div>
        ) : !detail ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Kontak bulunamadı.</CardContent></Card>
        ) : (
          <>
            <Card>
              <CardContent className="py-5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold text-foreground">{detail.contact.name}</h1>
                  <Badge variant="outline" className="text-[10px]">{CONTACT_STATUS_LABELS[detail.contact.status]}</Badge>
                </div>
                {detail.contact.company && <p className="text-sm text-muted-foreground">{detail.contact.company}</p>}
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {detail.contact.email && <span className="flex items-center gap-1"><Mail size={12} /> {detail.contact.email}</span>}
                  {detail.contact.phone && <span className="flex items-center gap-1"><Phone size={12} /> {detail.contact.phone}</span>}
                  {detail.contact.telegram && <span className="flex items-center gap-1"><Send size={12} /> {detail.contact.telegram}</span>}
                </div>
                {detail.contact.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {detail.contact.tags.map((t) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                  </div>
                )}
                {detail.contact.notes && <p className="mt-2 text-sm text-foreground/80">{detail.contact.notes}</p>}
              </CardContent>
            </Card>

            {/* Anlaşmalar */}
            <Card>
              <CardHeader className="border-b border-border/60 pb-4">
                <CardTitle className="flex items-center gap-2"><TrendingUp size={16} /> Anlaşmalar</CardTitle>
                <CardDescription>{detail.deals.length} anlaşma</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 pt-4">
                {detail.deals.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Bağlı anlaşma yok.</p>
                ) : (
                  detail.deals.map((d) => (
                    <div key={d.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                      <div>
                        <p className="font-medium text-foreground">{d.title}</p>
                        <p className="text-xs text-muted-foreground">{DEAL_STAGE_LABELS[d.stage]} · %{d.probability}</p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums">{CUR_SYMBOL[d.currency]}{d.value.toLocaleString("tr-TR")}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Etkileşim ekle */}
            <Card>
              <CardHeader className="border-b border-border/60 pb-4">
                <CardTitle className="flex items-center gap-2"><MessageSquare size={16} /> Etkileşimler</CardTitle>
                <CardDescription>Görüşme, not ve iletişim geçmişi</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {!readOnly && (
                  <form onSubmit={submitInteraction} className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr]">
                      <Field label="Tür">
                        <Select value={type} onChange={(e) => setType(e.target.value as InteractionType)}
                          options={(Object.keys(INTERACTION_TYPE_LABELS) as InteractionType[]).map((t) => ({ value: t, label: INTERACTION_TYPE_LABELS[t] }))} />
                      </Field>
                      <Field label="Özet">
                        <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} placeholder="Ne konuşuldu?" />
                      </Field>
                    </div>
                    <div className="flex justify-end">
                      <Button type="submit" size="sm" className="gap-1.5" disabled={busy || !summary.trim()}>
                        {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Etkileşim ekle
                      </Button>
                    </div>
                  </form>
                )}

                {detail.interactions.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">Henüz etkileşim yok.</p>
                ) : (
                  <ol className="space-y-3">
                    {detail.interactions.map((i) => (
                      <li key={i.id} className="flex gap-3 text-sm">
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary/60" />
                        <div>
                          <p className="text-foreground">
                            <Badge variant="outline" className="mr-1.5 text-[10px]">{INTERACTION_TYPE_LABELS[i.type]}</Badge>
                            {i.summary}
                          </p>
                          <p className="text-[11px] text-muted-foreground">{i.actorName} · {fmtDateTime(i.occurredAt)}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </MarkaPageGuard>
  );
}
