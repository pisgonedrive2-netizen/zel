"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Contact, Plus, Loader2, RefreshCcw, Trash2, ArrowUpRight, Building2, TrendingUp, Link2,
} from "lucide-react";
import { useMarkaPortal } from "@/hooks/use-marka-portal";
import { useStore } from "@/store/store";
import { MarkaPageGuard } from "@/components/marka-page-guard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Modal from "@/components/ui/modal";
import { Field, Input, Select, Textarea, NumberInput, FormGrid, FormActions } from "@/components/ui/field";
import {
  fetchCrm, saveContact, saveDeal, deleteCrm,
} from "@/lib/crm-api";
import {
  CONTACT_STATUS_LABELS, DEAL_STAGE_LABELS,
  type ContactStatus, type CrmContact, type CrmCurrency, type CrmDeal, type DealStage,
} from "@/types/crm";

const CUR_SYMBOL: Record<CrmCurrency, string> = { USD: "$", EUR: "€", TRY: "₺" };
const STAGES: { id: DealStage; label: string; accent: string }[] = [
  { id: "lead", label: "Aday", accent: "border-t-zinc-400" },
  { id: "qualified", label: "Nitelikli", accent: "border-t-sky-500" },
  { id: "proposal", label: "Teklif", accent: "border-t-amber-500" },
  { id: "won", label: "Kazanıldı", accent: "border-t-green-500" },
  { id: "lost", label: "Kaybedildi", accent: "border-t-red-500" },
];
const CONTACT_STATUS_CLS: Record<ContactStatus, string> = {
  lead: "border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400",
  active: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/45 dark:bg-blue-950/40 dark:text-blue-300",
  vip: "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-500/45 dark:bg-violet-950/40 dark:text-violet-300",
  passive: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/45 dark:bg-amber-950/40 dark:text-amber-300",
  lost: "border-red-300 bg-red-50 text-red-600 dark:border-red-500/45 dark:bg-red-950/40 dark:text-red-300",
};

const emptyContact = {
  id: "", name: "", company: "", email: "", phone: "", telegram: "",
  source: "manual", status: "lead" as ContactStatus, owner: "", tags: "", notes: "",
};
const emptyDeal = {
  id: "", title: "", contactId: "", stage: "lead" as DealStage, value: 0,
  currency: "USD" as CrmCurrency, probability: 50, expectedClose: "",
  affiliatePartnerId: "", brandDealId: "", notes: "",
};

export default function MarkaCrmPage() {
  const { user, brandId, brand, canViewBrand } = useMarkaPortal();
  const affiliatePartners = useStore((s) => s.affiliatePartners);
  const brandDeals = useStore((s) => s.brandDeals);

  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [deals, setDeals] = useState<CrmDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [dealOpen, setDealOpen] = useState(false);
  const [contactForm, setContactForm] = useState(emptyContact);
  const [dealForm, setDealForm] = useState(emptyDeal);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!brandId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCrm(brandId);
      setContacts(data.contacts);
      setDeals(data.deals);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useEffect(() => {
    void load();
  }, [load]);

  const brandPartners = useMemo(
    () => affiliatePartners.filter((p) => p.brandId === brandId),
    [affiliatePartners, brandId]
  );
  const myBrandDeals = useMemo(
    () => brandDeals.filter((d) => d.brandId === brandId),
    [brandDeals, brandId]
  );
  const contactName = useCallback((cid?: string) => contacts.find((c) => c.id === cid)?.name ?? "—", [contacts]);

  const byStage = useMemo(() => {
    const map: Record<DealStage, CrmDeal[]> = { lead: [], qualified: [], proposal: [], won: [], lost: [] };
    for (const d of deals) map[d.stage]?.push(d);
    return map;
  }, [deals]);

  const pipelineValue = useMemo(() => {
    const open = deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
    const won = deals.filter((d) => d.stage === "won");
    const sum = (arr: CrmDeal[]) => arr.reduce((a, d) => a + d.value, 0);
    return { openCount: open.length, openValue: sum(open), wonValue: sum(won) };
  }, [deals]);

  const submitContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandId || !contactForm.name.trim()) return;
    setBusy(true);
    try {
      await saveContact({
        id: contactForm.id || undefined,
        brandId,
        name: contactForm.name.trim(),
        company: contactForm.company,
        email: contactForm.email || undefined,
        phone: contactForm.phone || undefined,
        telegram: contactForm.telegram || undefined,
        source: contactForm.source,
        status: contactForm.status,
        owner: contactForm.owner,
        tags: contactForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
        notes: contactForm.notes,
      });
      setContactOpen(false);
      setContactForm(emptyContact);
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };

  const submitDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandId || !dealForm.title.trim()) return;
    setBusy(true);
    try {
      await saveDeal({
        id: dealForm.id || undefined,
        brandId,
        title: dealForm.title.trim(),
        contactId: dealForm.contactId || undefined,
        stage: dealForm.stage,
        value: dealForm.value,
        currency: dealForm.currency,
        probability: dealForm.probability,
        expectedClose: dealForm.expectedClose || undefined,
        affiliatePartnerId: dealForm.affiliatePartnerId || undefined,
        brandDealId: dealForm.brandDealId || undefined,
        notes: dealForm.notes,
      });
      setDealOpen(false);
      setDealForm(emptyDeal);
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Kaydedilemedi");
    } finally {
      setBusy(false);
    }
  };

  const advanceDeal = async (d: CrmDeal) => {
    if (!brandId) return;
    const order: DealStage[] = ["lead", "qualified", "proposal", "won"];
    const idx = order.indexOf(d.stage);
    const next = idx < 0 ? "qualified" : order[Math.min(idx + 1, order.length - 1)];
    try {
      await saveDeal({ ...d, brandId, stage: next });
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Güncellenemedi");
    }
  };

  const removeDeal = async (d: CrmDeal) => {
    try {
      await deleteCrm("deal", d.id);
      void load();
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : "Silinemedi");
    }
  };

  const openEditDeal = (d: CrmDeal) => {
    setDealForm({
      id: d.id, title: d.title, contactId: d.contactId ?? "", stage: d.stage, value: d.value,
      currency: d.currency, probability: d.probability, expectedClose: d.expectedClose ?? "",
      affiliatePartnerId: d.affiliatePartnerId ?? "", brandDealId: d.brandDealId ?? "", notes: d.notes,
    });
    setDealOpen(true);
  };

  return (
    <MarkaPageGuard user={user} canViewBrand={canViewBrand} brandId={brandId} brand={brand}>
      <div className="mx-auto max-w-[1280px] space-y-5 pb-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <Contact size={22} /> CRM
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{brand?.name} kontak ve satış pipeline yönetimi</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />} Yenile
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setContactForm(emptyContact); setContactOpen(true); }}>
              <Plus size={14} /> Kontak
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => { setDealForm(emptyDeal); setDealOpen(true); }}>
              <Plus size={14} /> Anlaşma
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>
        )}

        {/* Özet */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Card><CardContent className="flex items-center gap-3 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><TrendingUp size={18} /></div>
            <div><p className="text-xs text-muted-foreground">Açık anlaşma</p><p className="text-lg font-bold tabular-nums">{pipelineValue.openCount}</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600"><TrendingUp size={18} /></div>
            <div><p className="text-xs text-muted-foreground">Açık pipeline ($)</p><p className="text-lg font-bold tabular-nums">${pipelineValue.openValue.toLocaleString("tr-TR")}</p></div>
          </CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 text-green-600"><TrendingUp size={18} /></div>
            <div><p className="text-xs text-muted-foreground">Kazanılan ($)</p><p className="text-lg font-bold tabular-nums">${pipelineValue.wonValue.toLocaleString("tr-TR")}</p></div>
          </CardContent></Card>
        </div>

        {/* Pipeline */}
        <div className="grid gap-3 lg:grid-cols-5 md:grid-cols-3 sm:grid-cols-2">
          {STAGES.map((col) => (
            <div key={col.id} className={`rounded-xl border border-t-4 ${col.accent} border-border bg-card`}>
              <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5">
                <h2 className="text-xs font-semibold text-foreground">{col.label}</h2>
                <Badge variant="outline" className="text-[10px] tabular-nums">{byStage[col.id].length}</Badge>
              </div>
              <div className="space-y-2 p-2">
                {byStage[col.id].length === 0 ? (
                  <p className="py-4 text-center text-[11px] text-muted-foreground">—</p>
                ) : (
                  byStage[col.id].map((d) => (
                    <div key={d.id} className="rounded-lg border border-border bg-background px-2.5 py-2">
                      <button onClick={() => openEditDeal(d)} className="block w-full text-left text-sm font-medium text-foreground hover:underline">{d.title}</button>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{contactName(d.contactId)}</p>
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="text-xs font-semibold tabular-nums">{CUR_SYMBOL[d.currency]}{d.value.toLocaleString("tr-TR")}</span>
                        <span className="text-[10px] text-muted-foreground">%{d.probability}</span>
                      </div>
                      {(d.affiliatePartnerId || d.brandDealId) && (
                        <p className="mt-1 flex items-center gap-1 text-[10px] text-violet-600 dark:text-violet-300"><Link2 size={10} /> bağlı</p>
                      )}
                      <div className="mt-1.5 flex items-center gap-1">
                        {col.id !== "won" && col.id !== "lost" && (
                          <Button size="sm" variant="ghost" className="h-6 flex-1 gap-1 text-[10px]" onClick={() => void advanceDeal(d)}>
                            İlerlet <ArrowUpRight size={11} />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-red-600 hover:bg-red-500/10 dark:text-red-400" onClick={() => void removeDeal(d)} aria-label="Sil">
                          <Trash2 size={11} />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Kontaklar */}
        <Card>
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle className="flex items-center gap-2"><Building2 size={16} /> Kontaklar</CardTitle>
            <CardDescription>{contacts.length} kontak · detay için isme tıklayın</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {loading && contacts.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground"><Loader2 size={22} className="mx-auto animate-spin opacity-50" /></div>
            ) : contacts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Henüz kontak yok.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-muted/30">
                    {["Kontak", "Şirket", "İletişim", "Durum", "Etiketler"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {contacts.map((c) => (
                      <tr key={c.id} className="border-b border-border/60 transition-colors hover:bg-accent/15">
                        <td className="px-3 py-3">
                          <Link href={`/marka/crm/${c.id}`} className="font-medium text-foreground hover:underline">{c.name}</Link>
                          {c.owner && <p className="text-[11px] text-muted-foreground">Sahip: {c.owner}</p>}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">{c.company || "—"}</td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">
                          {c.email || c.phone || c.telegram || "—"}
                        </td>
                        <td className="px-3 py-3"><Badge variant="outline" className={`text-[10px] ${CONTACT_STATUS_CLS[c.status]}`}>{CONTACT_STATUS_LABELS[c.status]}</Badge></td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1">
                            {c.tags.length === 0 ? "—" : c.tags.map((t) => (
                              <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Kontak modal */}
      <Modal open={contactOpen} onClose={() => setContactOpen(false)} title={contactForm.id ? "Kontağı düzenle" : "Yeni kontak"} size="md">
        <form onSubmit={submitContact} className="space-y-4">
          <FormGrid>
            <Field label="Ad" required><Input value={contactForm.name} onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))} required autoFocus /></Field>
            <Field label="Şirket"><Input value={contactForm.company} onChange={(e) => setContactForm((f) => ({ ...f, company: e.target.value }))} /></Field>
            <Field label="E-posta"><Input type="email" value={contactForm.email} onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))} /></Field>
            <Field label="Telefon"><Input value={contactForm.phone} onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))} /></Field>
            <Field label="Telegram"><Input value={contactForm.telegram} onChange={(e) => setContactForm((f) => ({ ...f, telegram: e.target.value }))} /></Field>
            <Field label="Kaynak"><Input value={contactForm.source} onChange={(e) => setContactForm((f) => ({ ...f, source: e.target.value }))} placeholder="manual, referans, reklam…" /></Field>
            <Field label="Durum">
              <Select value={contactForm.status} onChange={(e) => setContactForm((f) => ({ ...f, status: e.target.value as ContactStatus }))}
                options={(Object.keys(CONTACT_STATUS_LABELS) as ContactStatus[]).map((s) => ({ value: s, label: CONTACT_STATUS_LABELS[s] }))} />
            </Field>
            <Field label="Sahip / sorumlu"><Input value={contactForm.owner} onChange={(e) => setContactForm((f) => ({ ...f, owner: e.target.value }))} /></Field>
          </FormGrid>
          <Field label="Etiketler" hint="Virgülle ayırın"><Input value={contactForm.tags} onChange={(e) => setContactForm((f) => ({ ...f, tags: e.target.value }))} placeholder="vip, istanbul, bonus" /></Field>
          <Field label="Notlar"><Textarea value={contactForm.notes} onChange={(e) => setContactForm((f) => ({ ...f, notes: e.target.value }))} rows={2} /></Field>
          <FormActions onCancel={() => setContactOpen(false)} submitLabel={busy ? "Kaydediliyor..." : "Kaydet"} />
        </form>
      </Modal>

      {/* Anlaşma modal */}
      <Modal open={dealOpen} onClose={() => setDealOpen(false)} title={dealForm.id ? "Anlaşmayı düzenle" : "Yeni anlaşma"} size="md">
        <form onSubmit={submitDeal} className="space-y-4">
          <Field label="Başlık" required><Input value={dealForm.title} onChange={(e) => setDealForm((f) => ({ ...f, title: e.target.value }))} required autoFocus /></Field>
          <FormGrid>
            <Field label="Kontak">
              <Select value={dealForm.contactId} onChange={(e) => setDealForm((f) => ({ ...f, contactId: e.target.value }))}
                options={[{ value: "", label: "—" }, ...contacts.map((c) => ({ value: c.id, label: c.name }))]} />
            </Field>
            <Field label="Aşama">
              <Select value={dealForm.stage} onChange={(e) => setDealForm((f) => ({ ...f, stage: e.target.value as DealStage }))}
                options={(Object.keys(DEAL_STAGE_LABELS) as DealStage[]).map((s) => ({ value: s, label: DEAL_STAGE_LABELS[s] }))} />
            </Field>
            <Field label="Değer"><NumberInput value={dealForm.value} onChange={(v) => setDealForm((f) => ({ ...f, value: v }))} min={0} /></Field>
            <Field label="Para birimi">
              <Select value={dealForm.currency} onChange={(e) => setDealForm((f) => ({ ...f, currency: e.target.value as CrmCurrency }))}
                options={[{ value: "USD", label: "USD ($)" }, { value: "EUR", label: "EUR (€)" }, { value: "TRY", label: "TRY (₺)" }]} />
            </Field>
            <Field label="Olasılık (%)"><NumberInput value={dealForm.probability} onChange={(v) => setDealForm((f) => ({ ...f, probability: Math.min(100, Math.max(0, v)) }))} min={0} max={100} /></Field>
            <Field label="Tahmini kapanış"><Input type="date" value={dealForm.expectedClose} onChange={(e) => setDealForm((f) => ({ ...f, expectedClose: e.target.value }))} /></Field>
            <Field label="Affiliate partner (bağla)">
              <Select value={dealForm.affiliatePartnerId} onChange={(e) => setDealForm((f) => ({ ...f, affiliatePartnerId: e.target.value }))}
                options={[{ value: "", label: "—" }, ...brandPartners.map((p) => ({ value: p.id, label: p.name }))]} />
            </Field>
            <Field label="Marka anlaşması (bağla)">
              <Select value={dealForm.brandDealId} onChange={(e) => setDealForm((f) => ({ ...f, brandDealId: e.target.value }))}
                options={[{ value: "", label: "—" }, ...myBrandDeals.map((d) => ({ value: d.id, label: d.title || d.id }))]} />
            </Field>
          </FormGrid>
          <Field label="Notlar"><Textarea value={dealForm.notes} onChange={(e) => setDealForm((f) => ({ ...f, notes: e.target.value }))} rows={2} /></Field>
          <FormActions onCancel={() => setDealOpen(false)} submitLabel={busy ? "Kaydediliyor..." : "Kaydet"} />
        </form>
      </Modal>
    </MarkaPageGuard>
  );
}
