"use client";

import { create } from "zustand";

interface SidebarState {
  open: boolean;
  collapsed: boolean;
  toggleOpen: () => void;
  setOpen: (v: boolean) => void;
  toggleCollapsed: () => void;
  setCollapsed: (v: boolean) => void;
}

export const useSidebar = create<SidebarState>((set) => ({
  open: false,
  collapsed: false,
  toggleOpen: () => set((s) => ({ open: !s.open })),
  setOpen: (v) => set({ open: v }),
  toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
  setCollapsed: (v) => set({ collapsed: v }),
}));
