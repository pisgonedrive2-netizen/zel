"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import Modal from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CHECK_ITEMS: Array<{ id: string; label: string }> = [
  { id: "age18", label: "18+ yaş uyarısı ve hedef kitle uyumu" },
  { id: "ad_disclosure", label: "Reklam / #ad / iş birliği açıklaması planlandı" },
  { id: "bonus_rules", label: "Bonus ve promosyon kuralları paylaşıldı" },
  { id: "geo", label: "Yasaklı pazarlar ve lisans kapsamı kontrol edildi" },
  { id: "rg", label: "Sorumlu oyun mesajı gereksinimi değerlendirildi" },
];

export function ComplianceChecklistModal({
  open,
  onClose,
  streamerName,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  streamerName: string;
  onConfirm: () => void;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  function toggle(id: string) {
    setChecked((c) => ({ ...c, [id]: !c[id] }));
  }

  const allDone = CHECK_ITEMS.every((item) => checked[item.id]);

  function handleConfirm() {
    if (!allDone) return;
    setChecked({});
    onConfirm();
  }

  function handleClose() {
    setChecked({});
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Teklif öncesi uyumluluk kontrolü"
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">{streamerName}</strong> için teklif
          göndermeden önce aşağıdaki maddeleri onaylayın.
        </p>
        <ul className="space-y-2">
          {CHECK_ITEMS.map((item) => {
            const on = !!checked[item.id];
            return (
              <li key={item.id}>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                    on
                      ? "border-[#22C55E]/50 bg-[#22C55E]/10"
                      : "border-border hover:bg-muted/40"
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={on}
                    onChange={() => toggle(item.id)}
                  />
                  <span>{item.label}</span>
                </label>
              </li>
            );
          })}
        </ul>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleClose}>
            İptal
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-1.5"
            disabled={!allDone}
            onClick={handleConfirm}
          >
            <ShieldCheck size={14} />
            Teklife devam et
          </Button>
        </div>
      </div>
    </Modal>
  );
}
