import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

/**
 * "Claude is waiting" while the app is open but not looking at that window.
 *
 * Foreground only: a local notification is what a WebView can raise, and the socket that carries the event
 * lives as long as the app does. A phone in a pocket is the ntfy topic's job (server `--ntfy`), which needs
 * no code here. On a plain browser (no Capacitor) this is a no-op rather than an error.
 */
export async function requestNotificationPermission(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { display } = await LocalNotifications.checkPermissions();
    if (display !== "granted") await LocalNotifications.requestPermissions();
  } catch {
    /* plugin absent in a web build */
  }
}

export async function notifyWaiting(window: number, name: string, message: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 1000 + window,
          title: `Claude is waiting — ${name}`,
          body: message || "Turn finished.",
          extra: { window },
        },
      ],
    });
  } catch {
    /* no permission, or no plugin */
  }
}
