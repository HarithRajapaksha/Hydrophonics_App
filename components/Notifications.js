import { Platform, Vibration } from "react-native";
import { isRunningInExpoGo } from "expo";

let Notifications;
let isMocked = false;

// expo-notifications' top-level side effects (importing it) throws a hard error in Expo Go on Android SDK 53+.
// To prevent the entire application from crashing, we conditionally require expo-notifications only if NOT on Android in Expo Go.
if (Platform.OS === "android" && isRunningInExpoGo()) {
  isMocked = true;
  console.warn(
    "[Notifications] Running in Expo Go on Android. System tray push notifications are restricted by the OS. " +
    "Bridging alerts to custom in-app banner with native device vibration fallback."
  );
} else {
  try {
    Notifications = require("expo-notifications");

    // Configure foreground notification presentation
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    // Setup Android Notification Channel (for non-Expo Go environments)
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('hydro-alerts', {
        name: 'Hydroponics Alerts',
        description: 'Notifications for hydroponic sensor breaches',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#10B981',
      });
    }
  } catch (error) {
    console.warn("[Notifications] Failed to load expo-notifications:", error);
    isMocked = true;
  }
}

// ─── Bridge Event System to push alerts to in-app banners ───────────────────
let notificationListener = null;

export function registerNotificationListener(listener) {
  notificationListener = listener;
}

export function unregisterNotificationListener() {
  notificationListener = null;
}

// Set to true so Settings can correctly display custom info descriptions
export const isNotificationMocked = isMocked;

// ─────────────────────────────────────────────
// Request notification permissions
// ─────────────────────────────────────────────
export async function requestPermissions() {
  if (isMocked) {
    return true; // Always approved under mock to keep switch toggleable
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === "granted";
  } catch (error) {
    console.error("[Notifications] Permission request error:", error);
    return false;
  }
}

// ─────────────────────────────────────────────
// Send notification instantly (with Vibration & custom tray overlays)
// ─────────────────────────────────────────────
export async function scheduleNotification({ title, body, data }) {
  // 1. Play real physical haptic vibration (double vibration pulse)
  try {
    Vibration.vibrate([0, 250, 100, 250]);
  } catch (vErr) {
    console.log("Vibration failed:", vErr);
  }

  // 2. Dispatch event to show the custom in-app sliding notification banner
  if (notificationListener) {
    notificationListener({ title, body, data });
  }

  // 3. Fallback to scheduling normal local OS-tray notification (for dev builds & iOS)
  if (!isMocked && Notifications) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: title,
          body: body,
          data: data || {},
          sound: true,
          ...(Platform.OS === 'android' ? { channelId: 'hydro-alerts' } : {}),
        },
        trigger: null, // deliver immediately
      });
    } catch (error) {
      console.log("[Notifications] System tray fallback failed:", error);
    }
  }
}
