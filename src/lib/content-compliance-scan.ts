/** Basit içerik uyumluluk taraması — #ad, yaş sınırı, yasaklı ifadeler. */
export type ComplianceScanResult = {
  ok: boolean;
  violations: { type: string; severity: "info" | "warn" | "block"; message: string }[];
};

const AD_PATTERNS = [/#ad\b/i, /#reklam\b/i, /#işbirliği\b/i, /#isbirligi\b/i, /sponsored/i, /reklam/i];
const AGE_PATTERNS = [/\b18\+\b/, /yaş sınırı/i, /yas siniri/i, /sorumlu oyun/i];
const RISK_WORDS = [/\bgaranti\s+kazanç\b/i, /\bkesin\s+kazan\b/i, /\bbedava\s+para\b/i];

export function scanPostCompliance(caption: string, url = ""): ComplianceScanResult {
  const text = `${caption} ${url}`.trim();
  const violations: ComplianceScanResult["violations"] = [];

  if (text && !AD_PATTERNS.some((re) => re.test(text))) {
    violations.push({
      type: "ad_disclosure",
      severity: "warn",
      message: "#ad / reklam bildirimi eksik olabilir",
    });
  }
  if (text && !AGE_PATTERNS.some((re) => re.test(text))) {
    violations.push({
      type: "age_disclosure",
      severity: "info",
      message: "18+ veya sorumlu oyun ifadesi yok",
    });
  }
  for (const re of RISK_WORDS) {
    if (re.test(text)) {
      violations.push({
        type: "risky_claim",
        severity: "block",
        message: `Riskli ifade: ${re.source}`,
      });
    }
  }

  const ok = !violations.some((v) => v.severity === "block");
  return { ok, violations };
}
