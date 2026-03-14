/**
 * notifications.js
 * ─────────────────
 * Safe wrapper around expo-notifications.
 * Works in both Expo Go (SDK 53+, where push is removed) and dev/production builds.
 * All calls are try/catch guarded so the app never crashes.
 */

let Notifications = null;

// Try to load expo-notifications — it may be unavailable or restricted in Expo Go SDK 53+
try {
  Notifications = require('expo-notifications');

  // Only set handler if the API exists
  if (Notifications?.setNotificationHandler) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }
} catch (e) {
  console.warn('[notifications] expo-notifications not available:', e.message);
}

/**
 * Request notification permission safely.
 * Returns true if granted, false otherwise.
 */
export async function requestPermissions() {
  try {
    if (!Notifications?.requestPermissionsAsync) return false;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (e) {
    console.warn('[notifications] requestPermissions failed:', e.message);
    return false;
  }
}

/**
 * Schedule an immediate local notification safely.
 * Silently ignores errors (e.g. Expo Go SDK 53 restriction).
 */
export async function scheduleNotification({ title, body, data }) {
  try {
    if (!Notifications?.scheduleNotificationAsync) {
      console.warn('[notifications] scheduleNotificationAsync not available (Expo Go SDK 53+). Use a dev build for notifications.');
      return;
    }
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data },
      trigger: null,
    });
  } catch (e) {
    console.warn('[notifications] scheduleNotification failed:', e.message);
  }
}

export default Notifications;