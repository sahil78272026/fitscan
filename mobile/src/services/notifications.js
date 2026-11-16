import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerPushToken, unregisterPushToken } from './api';

export const PUSH_TOKEN_STORAGE_KEY = 'fitscan_push_token';
export const DEFAULT_PROJECT_ID = '9d9194f3-ba90-479a-9f2e-fd1df2c55938';

/**
 * Configure foreground notification presentation options.
 * Controls alert banners, sounds, and badges when app is in the foreground.
 */
export function initNotifications() {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch (err) {
    console.warn('[Notifications] Failed to initialize notification handler:', err);
  }
}

/**
 * Request notification permissions, configure Android notification channels,
 * retrieve Expo Push Token, and register it with the backend server.
 * Handles simulators/emulators gracefully without throwing errors.
 *
 * @returns {Promise<string|null>} The registered Expo push token, or null if unavailable.
 */
export async function registerForPushNotificationsAsync() {
  let token = null;

  // 1. Android Notification Channel Configuration
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'FitScan Reminders',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0ea5e9',
      });
    } catch (channelError) {
      console.warn('[Notifications] Failed to set Android notification channel:', channelError);
    }
  }

  // 2. Physical Device Check (Expo push tokens require physical hardware)
  if (!Device.isDevice) {
    console.log('[Notifications] Must use physical device for remote push notifications. Skipping token registration.');
    return null;
  }

  // 3. Permission Checks & Requests
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[Notifications] Permission not granted for push notifications:', finalStatus);
      return null;
    }

    // 4. Retrieve Expo Push Token
    const projectId =
      DEFAULT_PROJECT_ID ||
      Constants.expoConfig?.extra?.eas?.projectId ||
      Constants.easConfig?.projectId;

    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    token = tokenResponse?.data;

    if (token) {
      const deviceModel = Device.modelName || Device.deviceName || 'Mobile Device';
      // 5. Synchronize token with backend
      await registerPushToken(token, Platform.OS, deviceModel);
      // 6. Cache locally
      await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
      console.log('[Notifications] Push token registered and saved:', token);
    }
  } catch (err) {
    console.warn('[Notifications] Failed to register push token:', err);
  }

  return token;
}

/**
 * Unregister push token from backend and remove from local storage on logout.
 */
export async function unregisterPushNotificationsAsync() {
  try {
    const token = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
    if (token) {
      try {
        await unregisterPushToken(token);
      } catch (apiErr) {
        console.warn('[Notifications] Failed to unregister push token from backend:', apiErr);
      }
      await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
      console.log('[Notifications] Push token unregistered and cleared from local storage.');
    }
  } catch (err) {
    console.warn('[Notifications] Error in unregisterPushNotificationsAsync:', err);
  }
}

/**
 * Get the currently cached push token from local storage.
 *
 * @returns {Promise<string|null>}
 */
export async function getStoredPushToken() {
  try {
    return await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
  } catch (e) {
    return null;
  }
}

/**
 * Dispatch an immediate local notification directly on the device.
 * Bypasses remote FCM/APNs servers — works 100% reliably on emulators and physical devices.
 */
export async function scheduleLocalNotification({ title, body, data = {} }) {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'FitScan Reminders',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0ea5e9',
      });
    }
    return await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        channelId: 'default',
        data,
      },
      trigger: null,
    });
  } catch (err) {
    console.warn('[Notifications] Failed to schedule local notification:', err);
    return null;
  }
}

export default {
  initNotifications,
  registerForPushNotificationsAsync,
  unregisterPushNotificationsAsync,
  getStoredPushToken,
  scheduleLocalNotification,
};
