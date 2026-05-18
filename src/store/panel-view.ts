"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface PanelViewAs {
  employeeId: string;
  employeeName: string;
}

interface PanelViewState {
  panelViewAs: PanelViewAs | null;
  enterStreamerPanel: (employeeId: string, employeeName: string) => void;
  exitStreamerPanel: () => void;
}

export const usePanelView = create<PanelViewState>()(
  persist(
    (set) => ({
      panelViewAs: null,
      enterStreamerPanel: (employeeId, employeeName) =>
        set({ panelViewAs: { employeeId, employeeName } }),
      exitStreamerPanel: () => set({ panelViewAs: null }),
    }),
    {
      name: "foxstream-panel-view-v1",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);

/** Admin yayıncı panelini görüntülerken geçerli rol. */
export function effectiveRole(
  userRole: "admin" | "streamer" | "auditor" | "brand" | null | undefined,
  panelViewAs: PanelViewAs | null
): "admin" | "streamer" | "auditor" | "brand" | null {
  if (userRole === "admin" && panelViewAs) return "streamer";
  return userRole ?? null;
}
