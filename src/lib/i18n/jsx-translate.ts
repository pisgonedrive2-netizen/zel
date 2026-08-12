import { t } from "./t";
import { getRuntimeLocale } from "./locale-state";

const ATTRS = new Set([
  "title",
  "subtitle",
  "description",
  "placeholder",
  "aria-label",
  "ariaLabel",
  "label",
  "alt",
  "header",
  "hint",
  "badge",
  "emptyText",
  "ctaLabel",
  "buttonLabel",
  "sub",
  "message",
  "detail",
  "submitLabel",
  "deleteLabel",
  "tag",
  "text",
  "caption",
  "tooltip",
  "empty",
  "helperText",
]);

const SKIP_TYPE = new Set(["script", "style", "code", "pre", "noscript", "svg", "path"]);

function skipI18n(rec: Record<string, unknown>): boolean {
  return rec.translate === "no" || rec["data-i18n"] === "off";
}

export function translateJsxProps(type: unknown, props: unknown): unknown {
  if (!props || typeof props !== "object" || getRuntimeLocale() !== "ru") return props;
  if (typeof type === "string" && SKIP_TYPE.has(type)) return props;
  const rec = props as Record<string, unknown>;
  if (skipI18n(rec)) return props;

  let next: Record<string, unknown> | null = null;
  const take = () => {
    if (!next) next = { ...rec };
    return next;
  };

  for (const key of Object.keys(rec)) {
    if (!ATTRS.has(key)) continue;
    const v = rec[key];
    if (typeof v === "string") {
      const tr = t(v);
      if (tr !== v) take()[key] = tr;
    }
  }

  const ch = rec.children;
  if (typeof ch === "string") {
    const tr = t(ch);
    if (tr !== ch) take().children = tr;
  } else if (Array.isArray(ch)) {
    let changed = false;
    const mapped = ch.map((c) => {
      if (typeof c !== "string") return c;
      const tr = t(c);
      if (tr !== c) changed = true;
      return tr;
    });
    if (changed) take().children = mapped;
  }

  return next ?? props;
}
