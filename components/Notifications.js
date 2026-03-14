/**
 * Notifications.js
 * Safe wrapper for expo-notifications
 */

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ─────────────────────────────────────────────
// Request notification permissions
// ─────────────────────────────────────────────
export async function requestPermissions() {
  try {
    const { status } = await Notifications.requestPermissionsAsync();

    if (status !== "granted") {
      console.log("Notification permission denied");
      return false;
    }

    console.log("Notification permission granted");
    return true;

  } catch (error) {
    console.log("Permission error:", error);
    return false;
  }
}

// ─────────────────────────────────────────────
// Send notification instantly
// ─────────────────────────────────────────────
export async function scheduleNotification({ title, body, data }) {
  try {

    await Notifications.scheduleNotificationAsync({
      content: {
        title: title,
        body: body,
        data: data || {},
      },
      trigger: null, // show immediately
    });

  } catch (error) {
    console.log("Notification error:", error);
  }
}
