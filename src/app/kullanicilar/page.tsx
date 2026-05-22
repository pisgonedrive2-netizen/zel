"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Pencil, Trash2, KeyRound, Copy, Check, Eye, EyeOff,
  ShieldCheck, Crown, Headphones, User as UserIcon, Power, PowerOff, Sparkles,
  Tag,
  Download,
  Upload,
  ScrollText,
  Bell,
  ExternalLink,
  ShieldQuestion,
  Search,
  X as XIcon,
  Users as UsersIcon,
} from "lucide-react";
import { useAuth, generatePin, type AppUser, type Role } from "@/store/auth";
import { usePanelView } from "@/store/panel-view";
import { isSupabaseClientMode } from "@/lib/supabase-client";
import { fmtDateTime, fmtDateShort } from "@/lib/fmt-date";
import { cacheAdminPin, mergeUsersWithPinCache } from "@/lib/admin-pin-cache";
import { isMainAdmin } from "@/lib/user-guards";
import { copyLoginCredentials, formatLoginCredentials } from "@/lib/login-credentials";
import { syncImportedUsersToServer } from "@/lib/users-sync";
import { useStore } from "@/store/store";
import { useAuditLog, type AuditAction, type AuditEntry, logAudit } from "@/store/audit-log";
import {
  pickAppHydratePayload,
  downloadJson,
  parseLanetkelBackup,
  type LanetkelBackupV1,
} from "@/lib/app-backup";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Modal from "@/components/ui/modal";
import { Field, Input, Select, FormGrid, FormActions } from "@/components/ui/field";
import { FilterChipBar } from "@/components/filter-chip-bar";

const ROLE_LABELS: Record<Role, string> = {
  admin:    "Yönetici",
  streamer: "Yayıncı",
  auditor:  "Denetçi",
  brand:    "Marka",
};
const ROLE_ICONS: Record<Role, React.ComponentType<{ className?: string; size?: number }>> = {
  admin:    Crown,
  streamer: UserIcon,
  auditor:  Headphones,
  brand:    Tag,
};
const ROLE_COLORS: Record<Role, string> = {
  admin:    "text-blue-700 border-blue-300 bg-blue-50 dark:text-blue-300 dark:border-blue-500/45 dark:bg-blue-950/40",
  streamer: "text-amber-700 border-amber-300 bg-amber-50 dark:text-amber-300 dark:border-amber-500/45 dark:bg-amber-950/40",
  auditor:  "text-purple-700 border-purple-300 bg-purple-50 dark:text-purple-300 dark:border-purple-500/45 dark:bg-purple-950/40",
  brand:    "text-violet-800 border-violet-300 bg-violet-50 dark:text-violet-300 dark:border-violet-500/45 dark:bg-violet-950/40",
};

const AUDIT_TR: Record<AuditAction, string> = {
  user_created:        "Kullanıcı eklendi",
  user_updated:        "Kullanıcı güncellendi",
  user_deleted:        "Kullanıcı silindi",
  user_pin_reset:      "PIN sıfırlandı",
  expense_approved:    "Harcama onaylandı",
  expense_rejected:    "Harcama reddedildi",
  expense_needs_info:  "Harcama · ek bilgi istendi",
  backup_exported:     "Yedek indirildi",
  backup_imported:     "Yedek içe aktarıldı",
  session_idle_logout: "Oturum kapatıldı (hareketsizlik)",
};

// ── User Form ────────────────────────────────────────────────────────────
function UserForm({ initial, onSave, onClose }: {
  initial?: AppUser;
  onSave: (d: Omit<AppUser, "id">, generatedPin?: string) => void;
  onClose: () => void;
}) {
  const { employees, brands } = useStore();
  const isNew = !initial;
  const lockedMainAdmin = !!initial && isMainAdmin(initial);
  const [form, setForm] = useState<Omit<AppUser, "id">>({
    username:   initial?.username   ?? "",
    pin:        isNew ? generatePin() : "",
    name:       initial?.name       ?? "",
    role:       initial?.role       ?? "streamer",
    employeeId: initial?.employeeId,
    brandId:    initial?.brandId,
    avatar:     initial?.avatar     ?? "",
    active:     initial?.active     ?? true,
  });
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm(f => ({ ...f, [k]: v }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (isNew) {
          onSave(form, form.pin.trim() || undefined);
          return;
        }
        const pin = form.pin.trim();
        const { pin: _drop, ...profile } = form;
        onSave(pin.length >= 4 ? { ...profile, pin } : { ...profile, pin: "" }, undefined);
      }}
    >
      <div className="grid gap-4">
        {lockedMainAdmin && (
          <div className="rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2 text-xs text-blue-900 dark:border-blue-500/40 dark:bg-blue-950/35 dark:text-blue-100 leading-relaxed">
            Bu hesap <strong>Ana Yönetici</strong>dır. Kullanıcı adı, rol ve durum kilitlidir; ad, avatar ve PIN güncellenebilir.
          </div>
        )}
        <FormGrid>
          <Field label="Ad Soyad" required>
            <Input value={form.name} onChange={e => set("name", e.target.value)} required placeholder="Ad Soyad" />
          </Field>
          <Field label="Avatar Harfi" hint="1-2 karakter">
            <Input value={form.avatar} onChange={e => set("avatar", e.target.value.slice(0, 2).toUpperCase())} placeholder="A" maxLength={2} />
          </Field>
        </FormGrid>
        <FormGrid>
          <Field label="Kullanıcı Adı (giriş)" required>
            <Input
              value={form.username}
              onChange={e => set("username", e.target.value.toLowerCase().trim())}
              required
              placeholder="kullanici"
              disabled={lockedMainAdmin}
            />
          </Field>
          <Field label="Rol" required>
            <Select value={form.role} onChange={e => {
              const r = e.target.value as Role;
              setForm(f => {
                const next = { ...f, role: r };
                if (r === "streamer") {
                  next.brandId = undefined;
                } else if (r === "brand") {
                  next.employeeId = undefined;
                } else {
                  next.employeeId = undefined;
                  next.brandId = undefined;
                }
                return next;
              });
            }} required
              disabled={lockedMainAdmin}
              options={[
                { value: "streamer", label: "Yayıncı" },
                { value: "brand",    label: "Marka (sadece takvim + kendi izlenmeler)" },
                { value: "auditor",  label: "Denetçi" },
                { value: "admin",    label: "Yönetici (tüm yetki)" },
              ]} />
          </Field>
        </FormGrid>
        {form.role === "streamer" && (
          <Field label="Bağlı Yayıncı (Employee)" hint="Yayıncı hangi maaş kaydına bağlı?">
            <Select value={form.employeeId ?? ""} onChange={e => set("employeeId", e.target.value || undefined)}
              options={[{ value: "", label: "— Bağsız —" }, ...employees.filter(em => em.kind === "streamer").map(em => ({ value: em.id, label: em.name }))]} />
          </Field>
        )}
        {form.role === "brand" && (
          <Field label="Bağlı marka" hint="Giriş yapan kullanıcı sadece bu markanın özetini görür.">
            <Select
              value={form.brandId ?? ""}
              onChange={e => set("brandId", e.target.value || undefined)}
              options={[
                { value: "", label: "— Seçin —" },
                ...[...brands].sort((a, b) => a.shortName.localeCompare(b.shortName, "tr")).map((b) => ({
                  value: b.id,
                  label: `${b.shortName} — ${b.name}`,
                })),
              ]}
              required
            />
          </Field>
        )}
        <Field label="PIN" hint={isNew ? "Otomatik üretildi. Kayıt sonrası bir daha gösterilmez — kopyalayın!" : "Manuel değiştirmek için"}>
          <div className="flex gap-2">
            <Input
              value={form.pin}
              onChange={(e) => set("pin", e.target.value)}
              className="font-mono"
              placeholder={isNew ? undefined : "Yeni PIN (kaydetmek için doldurun)"}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => set("pin", generatePin())} className="gap-1.5">
              <Sparkles size={13} /> Yeni PIN
            </Button>
          </div>
        </Field>
        <Field label="Hesap Durumu">
          <Select value={form.active ? "yes" : "no"} onChange={e => set("active", e.target.value === "yes")}
            disabled={lockedMainAdmin}
            options={[{ value: "yes", label: "Aktif" }, { value: "no", label: "Pasif (giriş yapamaz)" }]} />
        </Field>
      </div>
      <FormActions onCancel={onClose} submitLabel={isNew ? "Kullanıcı Oluştur" : "Güncelle"} />
    </form>
  );
}

// ── Kopyala (kullanıcı adı + PIN) ───────────────────────────────────────
function CopyCredentialsBtn({ user, pin }: { user: AppUser; pin: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      title="Kullanıcı adı + şifre kopyala (paylaşım için)"
      onClick={async (e) => {
        e.stopPropagation();
        await copyLoginCredentials(user, pin);
        setOk(true);
        setTimeout(() => setOk(false), 1500);
      }}
      className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
    >
      {ok ? <Check size={12} className="text-green-600 dark:text-green-400" /> : <Copy size={12} />}
    </button>
  );
}

// ── Show Pin Modal ──────────────────────────────────────────────────────
function PinDisplayModal({ user, pin, onClose }: { user: AppUser; pin: string; onClose: () => void }) {
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);

  const copyAll = async () => {
    await copyLoginCredentials(user, pin);
    setCopiedAll(true);
    setCopiedPin(false);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  const copyPinOnly = async () => {
    await navigator.clipboard.writeText(pin);
    setCopiedPin(true);
    setCopiedAll(false);
    setTimeout(() => setCopiedPin(false), 2500);
  };

  const preview = formatLoginCredentials(user, pin);

  return (
    <div className="space-y-4 py-2">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-950/40 mb-2">
          <KeyRound className="text-green-700 dark:text-green-400" size={20} />
        </div>
        <h3 className="text-base font-semibold">PIN Hazır</h3>
        <p className="text-sm text-muted-foreground">
          <strong>{user.name}</strong> için yeni PIN oluşturuldu.
        </p>
      </div>

      <div className="px-4 py-3 rounded-lg border-2 border-dashed border-blue-300 bg-blue-50/40 dark:border-blue-500/45 dark:bg-blue-950/30 text-center">
        <p className="text-[11px] text-muted-foreground mb-1">Kullanıcı Adı</p>
        <p className="font-mono text-sm mb-3">{user.username}</p>
        <p className="text-[11px] text-muted-foreground mb-1">PIN</p>
        <p className="font-mono text-xl font-bold tracking-wider text-foreground">{pin}</p>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
        <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Paylaşım önizlemesi</p>
        <pre className="text-[11px] leading-relaxed text-foreground whitespace-pre-wrap font-sans">{preview}</pre>
      </div>

      <div className="px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-500/40 text-amber-900 dark:text-amber-100 text-xs leading-relaxed">
        Bu bilgiler bir daha gösterilmez. WhatsApp veya e-posta ile paylaşmak için &quot;Kullanıcı adı + şifre&quot; butonunu kullanın.
      </div>

      <div className="flex flex-col sm:flex-row gap-2 justify-end pt-2">
        <Button variant="outline" onClick={() => void copyPinOnly()} className="gap-1.5">
          {copiedPin ? <Check size={14} className="text-green-600 dark:text-green-400" /> : <Copy size={14} />}
          {copiedPin ? "PIN kopyalandı" : "Yalnız PIN"}
        </Button>
        <Button onClick={() => void copyAll()} className="gap-1.5">
          {copiedAll ? <Check size={14} /> : <Copy size={14} />}
          {copiedAll ? "Kopyalandı!" : "Kullanıcı adı + şifre"}
        </Button>
        <Button variant="secondary" onClick={onClose}>Tamam</Button>
      </div>
    </div>
  );
}

// ── Audit log paneli (kart filtre — kullanıcı listesi ile aynı format) ───
function AuditLogPanel({
  auditEntries,
  supabaseMode,
}: {
  auditEntries: ReadonlyArray<AuditEntry>;
  supabaseMode: boolean;
}) {
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [actorFilter, setActorFilter] = useState<string>("all");
  const [searchQ, setSearchQ] = useState("");
  const [days, setDays] = useState<string>("30");

  const uniqueActors = useMemo(() => {
    const set = new Set<string>();
    for (const e of auditEntries) set.add(e.actorName || e.actorId);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "tr"));
  }, [auditEntries]);

  const inPeriod = useCallback(
    (e: AuditEntry) => {
      if (days === "all") return true;
      const cutoff = Date.now() - parseInt(days, 10) * 86_400_000;
      return new Date(e.at).getTime() >= cutoff;
    },
    [days]
  );

  const periodEntries = useMemo(
    () => auditEntries.filter(inPeriod),
    [auditEntries, inPeriod]
  );

  const periodChips = useMemo(() => {
    const counts = (d: string) =>
      auditEntries.filter((e) => {
        if (d === "all") return true;
        const cutoff = Date.now() - parseInt(d, 10) * 86_400_000;
        return new Date(e.at).getTime() >= cutoff;
      }).length;
    return [
      { id: "7", label: "7 gün", count: counts("7"), chipCls: "border-border bg-card hover:bg-accent/40" },
      { id: "30", label: "30 gün", count: counts("30"), chipCls: "border-blue-300/70 bg-blue-50/60 text-blue-800 dark:border-blue-500/45 dark:bg-blue-950/40 dark:text-blue-200" },
      { id: "90", label: "90 gün", count: counts("90"), chipCls: "border-border bg-card hover:bg-accent/40" },
      { id: "all", label: "Tümü", count: counts("all"), chipCls: "border-foreground/30 bg-card" },
    ];
  }, [auditEntries]);

  const actionChips = useMemo(() => {
    const base = periodEntries;
    const chips = [
      {
        id: "all",
        label: "Tüm eylemler",
        count: base.length,
        chipCls: "border-foreground/30 bg-card hover:bg-accent/40",
      },
    ];
    for (const a of Object.keys(AUDIT_TR) as AuditAction[]) {
      chips.push({
        id: a,
        label: AUDIT_TR[a],
        count: base.filter((e) => e.action === a).length,
        chipCls: "border-violet-300/60 bg-violet-50/50 text-violet-900 dark:border-violet-500/40 dark:bg-violet-950/35 dark:text-violet-200",
      });
    }
    return chips;
  }, [periodEntries]);

  const actorChips = useMemo(() => {
    const chips = [
      {
        id: "all",
        label: "Tüm kullanıcılar",
        count: periodEntries.length,
        icon: UsersIcon,
        chipCls: "border-foreground/30 bg-card hover:bg-accent/40",
      },
    ];
    for (const a of uniqueActors) {
      chips.push({
        id: a,
        label: a.length > 18 ? `${a.slice(0, 16)}…` : a,
        count: periodEntries.filter((e) => (e.actorName || e.actorId) === a).length,
        icon: UserIcon,
        chipCls: "border-amber-300/60 bg-amber-50/50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/35 dark:text-amber-200",
      });
    }
    return chips;
  }, [periodEntries, uniqueActors]);

  const filtered = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    return periodEntries.filter((e) => {
      if (actionFilter !== "all" && e.action !== actionFilter) return false;
      if (actorFilter !== "all" && (e.actorName || e.actorId) !== actorFilter) return false;
      if (q) {
        const hay = `${e.actorName} ${e.actorId} ${e.detail} ${AUDIT_TR[e.action] ?? e.action}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [periodEntries, actionFilter, actorFilter, searchQ]);

  const hasExtraFilter =
    actionFilter !== "all" || actorFilter !== "all" || searchQ.trim().length > 0;

  return (
    <Card className="mt-6">
      <CardHeader className="flex-row items-start justify-between gap-2 flex-wrap">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ScrollText size={16} /> İşlem günlüğü
          </CardTitle>
          <CardDescription>
            {supabaseMode
              ? "Kullanıcı, yedek, oturum ve onay olayları (Supabase audit_logs)"
              : "Son kullanıcı, yedek ve oturum olayları (yerel)"}
          </CardDescription>
        </div>
        <Badge variant="outline" className="text-[10px] tabular-nums shrink-0">
          {filtered.length} / {auditEntries.length}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Dönem
          </p>
          <FilterChipBar
            ariaLabel="Günlük dönem filtreleri"
            chips={periodChips}
            value={days}
            onChange={setDays}
            columnsClass="grid-cols-2 sm:grid-cols-4"
          />
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Eylem türü
          </p>
          <FilterChipBar
            ariaLabel="Eylem filtreleri"
            chips={actionChips}
            value={actionFilter}
            onChange={setActionFilter}
            layout="wrap"
          />
        </div>

        {uniqueActors.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Eylemi yapan
            </p>
            <FilterChipBar
              ariaLabel="Kullanıcı filtreleri günlük"
              chips={actorChips}
              value={actorFilter}
              onChange={setActorFilter}
              layout="wrap"
            />
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              aria-label="Denetim kaydı ara"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Detay, kullanıcı veya eylem ara..."
              className="w-full h-9 rounded-md border border-input bg-background pl-9 pr-9 text-sm shadow-sm transition focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
            {searchQ && (
              <button
                type="button"
                onClick={() => setSearchQ("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-accent"
                aria-label="Aramayı temizle"
              >
                <XIcon size={12} />
              </button>
            )}
          </div>
          {hasExtraFilter && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1 h-9 text-xs shrink-0"
              onClick={() => {
                setActionFilter("all");
                setActorFilter("all");
                setSearchQ("");
              }}
            >
              <XIcon size={12} /> Ek filtreleri temizle
            </Button>
          )}
        </div>

        <div className="overflow-x-auto max-h-[28rem] overflow-y-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm">
              <tr className="border-b border-border">
                {["Tarih", "Eylem", "Yapan", "Detay"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">
                    Filtreye uyan kayıt yok.
                  </td>
                </tr>
              ) : (
                filtered.slice(0, 200).map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-border/60 hover:bg-accent/20 transition-colors"
                  >
                    <td className="px-4 py-2.5 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                      {fmtDateTime(e.at)}
                    </td>
                    <td className="px-4 py-2.5 text-sm font-medium whitespace-nowrap">
                      {AUDIT_TR[e.action] ?? e.action}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-muted-foreground whitespace-nowrap">
                      {e.actorName || e.actorId || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-md break-words">
                      {e.detail || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const router = useRouter();
  const enterStreamerPanel = usePanelView((s) => s.enterStreamerPanel);
  const enterBrandPanel = usePanelView((s) => s.enterBrandPanel);
  const { users, user: currentUser, addUser, updateUser, resetPin, deleteUser } = useAuth();
  const hydrateFromBackup = useStore((s) => s.hydrateFromBackup);
  const auditEntries = useAuditLog((s) => s.entries);
  const { employees, brands } = useStore();
  const supabaseMode = isSupabaseClientMode();

  const refreshUsers = useCallback(async () => {
    if (!supabaseMode) return;
    try {
      const res = await fetch("/api/users", { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as { users?: AppUser[] };
      if (!data.users) return;
      useAuth.setState({
        users: mergeUsersWithPinCache(data.users, useAuth.getState().users),
      });
    } catch {
      /* sessiz */
    }
  }, [supabaseMode]);

  const fileRef = useRef<HTMLInputElement>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const [modal, setModal]       = useState<"new" | AppUser | null>(null);
  const [pinModal, setPinModal] = useState<{ user: AppUser; pin: string } | null>(null);
  const [showPins, setShowPins] = useState(false);

  /** "all" → herkesi göster · Role → o rol · "inactive" → sadece pasifler */
  type UserFilter = "all" | Role | "inactive";
  const [roleFilter, setRoleFilter] = useState<UserFilter>("all");
  const [userSearch, setUserSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "role" | "lastLogin" | "status">("name");

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 7000);
    return () => clearTimeout(t);
  }, [flash]);

  useEffect(() => {
    void refreshUsers();
  }, [refreshUsers]);

  const runExportBackup = () => {
    const payload: LanetkelBackupV1 = {
      backupVersion: 1,
      exportedAt: new Date().toISOString(),
      auth: { users: useAuth.getState().users },
      app: pickAppHydratePayload(useStore.getState() as unknown as Record<string, unknown>),
    };
    downloadJson(`foxstream-yedek-${new Date().toISOString().slice(0, 10)}.json`, payload);
    const actor = useAuth.getState().user;
    logAudit({
      actorId: actor?.id ?? "system",
      actorName: actor?.name ?? "?",
      action: "backup_exported",
      detail: "Tam yedek (auth + mali veri)",
    });
  };

  const runImportBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      void (async () => {
        try {
          const raw = JSON.parse(String(reader.result));
          const parsed = parseLanetkelBackup(raw);
          if (!parsed) {
            setFlash("Yedek dosyası tanınmadı veya bozuk.");
            return;
          }
          if (
            !confirm(
              "Mevcut mali veri (maaş, kasa, harcamalar) bu yedekle değişecek. Kullanıcı listesi de yedektekilerle güncellenir. Devam edilsin mi?"
            )
          ) {
            return;
          }
          hydrateFromBackup(parsed.app);
          const cur = useAuth.getState().user;
          const nextUsers = parsed.auth.users;
          const row = cur ? nextUsers.find((u) => u.id === cur.id) : null;
          const mergedUser = row && cur ? { ...cur, ...row } : null;
          useAuth.setState({
            users: nextUsers,
            user: mergedUser?.active ? mergedUser : null,
          });
          if (supabaseMode) {
            try {
              await syncImportedUsersToServer(nextUsers);
              await refreshUsers();
            } catch (syncErr) {
              setFlash(
                `Yedek yüklendi; kullanıcılar sunucuya yazılamadı: ${
                  syncErr instanceof Error ? syncErr.message : "bilinmeyen hata"
                }`
              );
              return;
            }
          }
          logAudit({
            actorId: cur?.id ?? "system",
            actorName: cur?.name ?? "?",
            action: "backup_imported",
            detail: `Yedek zamanı: ${parsed.exportedAt}`,
          });
          setFlash(
            supabaseMode
              ? "Yedek yüklendi ve Supabase ile senkronize edildi."
              : "Yedek yüklendi (yerel mod)."
          );
        } catch {
          setFlash("Dosya okunamadı.");
        }
      })();
    };
    reader.readAsText(file);
  };

  const requestDesktopNotify = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setFlash("Bu ortam masaüstü bildirimini desteklemiyor.");
      return;
    }
    const p = await Notification.requestPermission();
    if (p !== "granted") setFlash("Bildirim izni verilmedi.");
  };

  const stats = {
    total:    users.length,
    admins:   users.filter(u => u.role === "admin").length,
    streamers:users.filter(u => u.role === "streamer").length,
    auditors: users.filter(u => u.role === "auditor").length,
    brands:   users.filter(u => u.role === "brand").length,
    inactive: users.filter(u => !u.active).length,
  };

  /** Görselleştirilen kullanıcı listesi — filtre + arama + sıralama uygulanmış. */
  const visibleUsers = useMemo(() => {
    let list = [...users];
    if (roleFilter === "inactive") {
      list = list.filter((u) => !u.active);
    } else if (roleFilter !== "all") {
      list = list.filter((u) => u.role === roleFilter);
    }
    const q = userSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q) ||
          (employees.find((e) => e.id === u.employeeId)?.name ?? "").toLowerCase().includes(q) ||
          (brands.find((b) => b.id === u.brandId)?.name ?? "").toLowerCase().includes(q) ||
          (brands.find((b) => b.id === u.brandId)?.shortName ?? "").toLowerCase().includes(q)
      );
    }
    const roleOrder: Record<Role, number> = { admin: 0, brand: 1, streamer: 2, auditor: 3 };
    list.sort((a, b) => {
      if (sortBy === "role") {
        const d = roleOrder[a.role] - roleOrder[b.role];
        if (d !== 0) return d;
        return a.name.localeCompare(b.name, "tr");
      }
      if (sortBy === "lastLogin") {
        const av = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0;
        const bv = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0;
        if (av !== bv) return bv - av;
        return a.name.localeCompare(b.name, "tr");
      }
      if (sortBy === "status") {
        if (a.active !== b.active) return a.active ? -1 : 1;
        return a.name.localeCompare(b.name, "tr");
      }
      return a.name.localeCompare(b.name, "tr");
    });
    return list;
  }, [users, roleFilter, userSearch, sortBy, employees, brands]);

  /** Filtre çiplerinde kullanılacak buton tanımları. */
  const filterChips: Array<{
    id: UserFilter;
    label: string;
    count: number;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    chipCls: string;
  }> = [
    { id: "all",      label: "Tümü",       count: stats.total,     icon: UsersIcon,   chipCls: "border-foreground/30 bg-card hover:bg-accent/40 text-foreground" },
    { id: "admin",    label: "Yöneticiler",count: stats.admins,    icon: Crown,       chipCls: "border-blue-300/70 bg-blue-50/60 hover:bg-blue-100 text-blue-800 dark:border-blue-500/45 dark:bg-blue-950/40 dark:text-blue-200 dark:hover:bg-blue-950/60" },
    { id: "streamer", label: "Yayıncılar", count: stats.streamers, icon: UserIcon,    chipCls: "border-amber-300/70 bg-amber-50/60 hover:bg-amber-100 text-amber-800 dark:border-amber-500/45 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/60" },
    { id: "brand",    label: "Markalar",   count: stats.brands,    icon: Tag,         chipCls: "border-violet-300/70 bg-violet-50/60 hover:bg-violet-100 text-violet-800 dark:border-violet-500/45 dark:bg-violet-950/40 dark:text-violet-200 dark:hover:bg-violet-950/60" },
    { id: "auditor",  label: "Denetçiler", count: stats.auditors,  icon: Headphones,  chipCls: "border-purple-300/70 bg-purple-50/60 hover:bg-purple-100 text-purple-800 dark:border-purple-500/45 dark:bg-purple-950/40 dark:text-purple-200 dark:hover:bg-purple-950/60" },
    { id: "inactive", label: "Pasif",      count: stats.inactive,  icon: PowerOff,    chipCls: stats.inactive > 0 ? "border-red-300/70 bg-red-50/60 hover:bg-red-100 text-red-800 dark:border-red-500/45 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-950/60" : "border-border bg-card text-muted-foreground hover:bg-accent/40" },
  ];

  const handleSave = async (data: Omit<AppUser, "id">, generatedPin?: string) => {
    const sanitized: Omit<AppUser, "id"> = {
      ...data,
      employeeId: data.role === "streamer" ? data.employeeId : undefined,
      brandId: data.role === "brand" ? data.brandId : undefined,
    };
    if (modal === "new") {
      const r = await addUser(sanitized);
      if (!r.ok) {
        setFlash(r.reason);
        return;
      }
      if (generatedPin) setPinModal({ user: r.user, pin: generatedPin });
      setFlash(`✓ ${r.user.name} kaydedildi (tüm cihazlarda görünür).`);
    } else if (modal) {
      const r = await updateUser(modal.id, sanitized);
      if (!r.ok) {
        setFlash(r.reason);
        return;
      }
      if (sanitized.pin && sanitized.pin.length >= 4) {
        cacheAdminPin(modal.id, sanitized.pin);
        setFlash("✓ Kullanıcı ve PIN güncellendi — giriş test edilebilir.");
      } else {
        setFlash("✓ Kullanıcı güncellendi.");
      }
    }
    setModal(null);
  };

  const handleResetPin = async (u: AppUser) => {
    const newPin = generatePin();
    const r = await resetPin(u.id, newPin);
    if (!r.ok) {
      setFlash(r.reason);
      return;
    }
    setPinModal({ user: { ...u, pin: newPin }, pin: newPin });
    setFlash(`✓ ${u.name} için PIN sıfırlandı ve sunucuya kaydedildi.`);
  };

  const handleVerifyPin = async (u: AppUser) => {
    if (!supabaseMode) {
      setFlash("Yerel modda sunucu doğrulaması yapılamaz.");
      return;
    }
    const input = window.prompt(
      `${u.name} kullanıcısının PIN'ini test et (sunucudaki hash ile karşılaştırır):`,
      u.pin && u.pin.length >= 4 ? u.pin : ""
    );
    if (!input) return;
    const trimmed = input.trim();
    if (trimmed.length < 4) {
      setFlash("PIN en az 4 karakter olmalı.");
      return;
    }
    try {
      const res = await fetch(`/api/users/${u.id}/verify-pin`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: trimmed }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        active?: boolean;
      };
      if (!res.ok) {
        setFlash(data.error ?? `Doğrulama hatası (${res.status})`);
        return;
      }
      if (data.ok) {
        cacheAdminPin(u.id, trimmed);
        useAuth.setState({
          users: useAuth.getState().users.map((x) => (x.id === u.id ? { ...x, pin: trimmed } : x)),
        });
        setFlash(
          data.active === false
            ? `⚠ ${u.name}: PIN doğru fakat hesap pasif — kullanıcı giriş yapamaz.`
            : `✓ ${u.name}: PIN sunucuda doğru. Bu kullanıcı giriş yapabilir.`
        );
      } else {
        setFlash(
          `✗ ${u.name}: PIN sunucuda eşleşmedi. "PIN sıfırla" ile yeni PIN atayın.`
        );
      }
    } catch (e) {
      setFlash(`Doğrulama hatası: ${e instanceof Error ? e.message : "bilinmiyor"}`);
    }
  };

  return (
    <div className="mx-auto w-full px-2 pb-4 sm:px-3 md:px-5 max-w-[1200px]">
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) runImportBackup(f);
          e.target.value = "";
        }}
      />

      {flash && (
        <div className="mb-4 rounded-lg border border-amber-500/50 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/35 dark:text-amber-50">
          {flash}
        </div>
      )}
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-foreground">Kullanıcılar</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Yayıncı, marka, denetçi ve yönetici hesaplarını yönetin · PIN sıfırlayın
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end shrink-0">
          <Button size="sm" onClick={() => setModal("new")} className="gap-1.5">
            <Plus size={14} /> Yeni Kullanıcı
          </Button>
          <Button size="sm" variant="outline" onClick={runExportBackup} className="gap-1.5">
            <Download size={13} /> Yedek indir
          </Button>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} className="gap-1.5">
            <Upload size={13} /> Yedek yükle
          </Button>
          <Button size="sm" variant="outline" onClick={() => void requestDesktopNotify()} className="gap-1.5">
            <Bell size={13} /> Bildirim izni
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowPins(s => !s)} className="gap-1.5">
            {showPins ? <EyeOff size={13} /> : <Eye size={13} />}
            {showPins ? "PIN'leri Gizle" : "PIN'leri Göster"}
          </Button>
        </div>
      </div>

      {/* Kayıtlı kullanıcılar — kart filtre + tablo (tüm kolonlar korunur) */}
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-2 flex-wrap border-b border-border/60 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              Kayıtlı Kullanıcılar
              <Badge variant="outline" className="text-[10px] tabular-nums">
                {visibleUsers.length}
                {visibleUsers.length !== users.length ? ` / ${users.length}` : ""}
              </Badge>
            </CardTitle>
            <CardDescription>
              {supabaseMode
                ? "Kullanıcılar Supabase app_users tablosunda saklanır"
                : "Yerel mod · kullanıcılar tarayıcıda saklanır · admin tüm PIN'leri sıfırlayabilir"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Rol / durum
            </p>
            <FilterChipBar
              ariaLabel="Kullanıcı filtreleri"
              chips={filterChips}
              value={roleFilter}
              onChange={(id) => setRoleFilter(id as UserFilter)}
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                aria-label="Kullanıcı ara"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Ad, kullanıcı adı veya bağlı yayıncı / marka ara..."
                className="w-full h-9 rounded-md border border-input bg-background pl-9 pr-9 text-sm shadow-sm transition focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
              {userSearch && (
                <button
                  type="button"
                  onClick={() => setUserSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-accent"
                  title="Aramayı temizle"
                  aria-label="Aramayı temizle"
                >
                  <XIcon size={12} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs shrink-0">
              <label className="text-muted-foreground" htmlFor="users-sort">
                Sırala:
              </label>
              <select
                id="users-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="h-9 rounded-md border border-input bg-background px-2 text-xs min-w-[10rem]"
              >
                <option value="name">İsme göre (A→Z)</option>
                <option value="role">Role göre</option>
                <option value="lastLogin">Son girişe göre</option>
                <option value="status">Aktif önce</option>
              </select>
            </div>
            {(roleFilter !== "all" || userSearch.trim()) && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1 h-9 text-xs shrink-0"
                onClick={() => {
                  setRoleFilter("all");
                  setUserSearch("");
                }}
              >
                <XIcon size={12} /> Filtreyi temizle
              </Button>
            )}
          </div>

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Kullanıcı","Rol","Kullanıcı Adı","PIN","Bağlantı","Son Giriş","Durum","Aksiyonlar"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleUsers.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <UsersIcon size={28} className="opacity-30" />
                        <p className="text-sm">
                          {userSearch.trim()
                            ? `"${userSearch}" için sonuç bulunamadı`
                            : roleFilter === "inactive"
                              ? "Pasif kullanıcı yok"
                              : "Bu rolde kullanıcı yok"}
                        </p>
                        {(roleFilter !== "all" || userSearch.trim()) && (
                          <button
                            type="button"
                            onClick={() => {
                              setRoleFilter("all");
                              setUserSearch("");
                            }}
                            className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                          >
                            Filtreyi temizle ve tümünü gör
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                {visibleUsers.map(u => {
                  const RoleIcon = ROLE_ICONS[u.role];
                  const locked = isMainAdmin(u);
                  const linkedEmp = u.employeeId ? employees.find(em => em.id === u.employeeId) : null;
                  const linkedBrand = u.brandId ? brands.find(b => b.id === u.brandId) : null;
                  const linkLabel =
                    u.role === "streamer" ? (linkedEmp?.name ?? "—") :
                    u.role === "brand" ? (linkedBrand ? `${linkedBrand.shortName}` : "—") :
                    "—";
                  return (
                    <tr key={u.id} className="border-b border-border/60 hover:bg-accent/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-md flex items-center justify-center font-medium text-sm ${
                            u.role === "admin"    ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" :
                            u.role === "streamer" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" :
                            u.role === "brand"    ? "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300" :
                                                    "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300"
                          }`}>{u.avatar || u.name[0]}</div>
                          <div>
                            <p className="text-sm font-medium flex items-center gap-1.5">
                              {u.name}
                              {locked && (
                                <Badge variant="outline" className="text-[9px] py-0 px-1.5 text-blue-700 border-blue-300 bg-blue-50 dark:text-blue-300 dark:border-blue-500/45 dark:bg-blue-950/40 gap-0.5">
                                  <ShieldCheck size={9} /> Ana yönetici
                                </Badge>
                              )}
                            </p>
                            {currentUser?.id === u.id && <p className="text-[10px] text-blue-600 dark:text-blue-400">(siz)</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`gap-1 text-[10px] ${ROLE_COLORS[u.role]}`}>
                          <RoleIcon size={10} /> {ROLE_LABELS[u.role]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{u.username}</td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {showPins ? (
                          u.pin && u.pin.length >= 4 ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="font-bold text-foreground">{u.pin}</span>
                              <CopyCredentialsBtn user={u} pin={u.pin} />
                            </span>
                          ) : (
                            <span
                              className="text-[11px] text-muted-foreground italic max-w-[140px] leading-snug"
                              title="PIN sunucuda hash olarak saklanır. Görmek için PIN sıfırlayın veya bu oturumda yeni PIN atayın."
                            >
                              Bu oturumda kayıtlı değil
                            </span>
                          )
                        ) : (
                          <span className="text-muted-foreground tracking-widest">
                            {u.pin.length > 0 ? "•".repeat(Math.min(8, u.pin.length)) : "••••••••"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{linkLabel}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {u.lastLoginAt
                          ? fmtDateShort(u.lastLoginAt)
                          : <span className="opacity-50">henüz giriş yok</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        {u.active ? (
                          <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50 dark:text-green-300 dark:border-green-500/45 dark:bg-green-950/40 gap-1 text-[10px]">
                            <Power size={9} /> Aktif
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50 dark:text-red-300 dark:border-red-500/45 dark:bg-red-950/40 gap-1 text-[10px]">
                            <PowerOff size={9} /> Pasif
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {u.role === "streamer" && linkedEmp && (
                            <button
                              type="button"
                              title="Yayıncı paneline gir"
                              onClick={() => {
                                enterStreamerPanel(linkedEmp.id, linkedEmp.name);
                                router.push("/yayinci/maas");
                              }}
                              className="p-1.5 rounded hover:bg-violet-500/10 text-violet-600 dark:text-violet-400 transition-colors"
                            >
                              <ExternalLink size={13} />
                            </button>
                          )}
                          {u.role === "brand" && linkedBrand && (
                            <button
                              type="button"
                              title="Marka paneline gir"
                              onClick={() => {
                                enterBrandPanel(linkedBrand.id, linkedBrand.name);
                                router.push("/marka/izlenmeler");
                              }}
                              className="p-1.5 rounded hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 transition-colors"
                            >
                              <ExternalLink size={13} />
                            </button>
                          )}
                          <button onClick={() => handleResetPin(u)}
                            title="PIN sıfırla"
                            className="p-1.5 rounded hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 transition-colors">
                            <KeyRound size={13} />
                          </button>
                          {supabaseMode && (
                            <button onClick={() => void handleVerifyPin(u)}
                              title="PIN'i sunucuda test et"
                              className="p-1.5 rounded hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 transition-colors">
                              <ShieldQuestion size={13} />
                            </button>
                          )}
                          {!locked ? (
                            <button onClick={async () => {
                              const r = await updateUser(u.id, { active: !u.active });
                              if (!r.ok) setFlash(r.reason);
                            }}
                              title={u.active ? "Pasifleştir" : "Aktifleştir"}
                              className={`p-1.5 rounded transition-colors ${u.active ? "hover:bg-accent text-muted-foreground" : "hover:bg-green-500/10 text-green-600 dark:text-green-400"}`}>
                              {u.active ? <PowerOff size={13} /> : <Power size={13} />}
                            </button>
                          ) : (
                            <span title="Ana yönetici pasifleştirilemez" className="p-1.5 rounded text-muted-foreground/40 cursor-not-allowed">
                              <PowerOff size={13} />
                            </span>
                          )}
                          <button onClick={() => setModal({ ...u })}
                            title="Düzenle"
                            className="p-1.5 rounded hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 transition-colors">
                            <Pencil size={13} />
                          </button>
                          {currentUser?.id !== u.id && !locked ? (
                            <button onClick={async () => {
                              if (confirm(`${u.name} kullanıcısını silmek istiyor musun?`)) {
                                const r = await deleteUser(u.id);
                                if (!r.ok) setFlash(r.reason);
                              }
                            }}
                              title="Sil"
                              className="p-1.5 rounded hover:bg-red-500/10 text-red-600 dark:text-red-400 transition-colors">
                              <Trash2 size={13} />
                            </button>
                          ) : locked ? (
                            <span title="Ana yönetici silinemez" className="p-1.5 rounded text-muted-foreground/40 cursor-not-allowed">
                              <Trash2 size={13} />
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <AuditLogPanel
        auditEntries={auditEntries}
        supabaseMode={supabaseMode}
      />

      <div className="mt-6 px-4 py-3 rounded-xl border border-blue-200 bg-blue-50/40 dark:border-blue-500/40 dark:bg-blue-950/35">
        <p className="text-sm text-blue-900 dark:text-blue-100 font-medium mb-1 flex items-center gap-1.5">
          <ShieldCheck size={13} /> Yönetici Yetkileri
        </p>
        <p className="text-xs text-blue-800 dark:text-blue-200/90 leading-relaxed">
          Her aktif yönetici yeni kullanıcı oluşturabilir, başka yönetici ekleyebilir ve PIN sıfırlayabilir.{" "}
          <strong>Ana Yönetici</strong> (kurucu) hesabı silinemez, pasifleştirilemez, rolü/ kullanıcı adı değiştirilemez —
          tüm yönetici grubu için temel güvence olarak kalır. PIN'ler Supabase tarafında bcrypt ile saklanır; ekran üzerinde
          sadece sıfırlama anında gösterilir.
        </p>
      </div>

      {/* Modals */}
      <Modal open={modal !== null} onClose={() => setModal(null)}
        title={modal === "new" ? "Yeni Kullanıcı" : "Kullanıcıyı Düzenle"} size="lg">
        {modal && (
          <UserForm
            key={modal === "new" ? "new" : modal.id}
            initial={modal === "new" ? undefined : modal}
            onSave={handleSave}
            onClose={() => setModal(null)}
          />
        )}
      </Modal>

      <Modal open={pinModal !== null} onClose={() => setPinModal(null)} title="" size="md">
        {pinModal && <PinDisplayModal user={pinModal.user} pin={pinModal.pin} onClose={() => setPinModal(null)} />}
      </Modal>
    </div>
  );
}
