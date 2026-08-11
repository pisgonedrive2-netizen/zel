"use client";

import { ReactNode } from "react";
import { t } from "@/lib/i18n/t";
import { useUiPrefs } from "@/store/ui-prefs";

interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  keyFn: (row: T) => string;
}

const alignClass = {
  left:   "text-left",
  right:  "text-right",
  center: "text-center",
};

export default function DataTable<T>({ columns, rows, keyFn }: DataTableProps<T>) {
  const locale = useUiPrefs((s) => s.locale);
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {columns.map((col, i) => (
              <th
                key={i}
                className={[
                  "px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide",
                  alignClass[col.align ?? "left"],
                ].join(" ")}
              >
                {t(col.header, locale)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={keyFn(row)}
              className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
            >
              {columns.map((col, i) => (
                <td
                  key={i}
                  className={["px-4 py-3 text-foreground", alignClass[col.align ?? "left"]].join(" ")}
                >
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
