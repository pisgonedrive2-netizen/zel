import type { AppNotification } from "@/store/store";

export type NotificationPref = {
  inApp: boolean;
  desktop: boolean;
  email: boolean;
};

export type NotificationPrefsMap = Partial<Record<AppNotification["type"], NotificationPref>>;
