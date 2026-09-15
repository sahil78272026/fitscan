import { Pedometer } from 'expo-sensors';
import { logSteps } from './api';

let subscription = null;

export async function checkPedometerAvailability() {
  try {
    const isAvailable = await Pedometer.isAvailableAsync();
    return isAvailable;
  } catch (error) {
    console.warn('Pedometer check error:', error);
    return false;
  }
}

export async function requestPedometerPermission() {
  try {
    const { status } = await Pedometer.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.warn('Pedometer permission request error:', error);
    return false;
  }
}

export async function getTodayStepCount() {
  try {
    const isAvailable = await checkPedometerAvailability();
    if (!isAvailable) return 0;

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();

    const result = await Pedometer.getStepCountAsync(start, end);
    return result ? result.steps : 0;
  } catch (error) {
    console.warn('Error fetching step count from device:', error);
    return 0;
  }
}

export function subscribeToLiveSteps(onStepChange) {
  if (subscription) {
    subscription.remove();
    subscription = null;
  }

  subscription = Pedometer.watchStepCount((result) => {
    if (result && typeof result.steps === 'number') {
      onStepChange(result.steps);
    }
  });

  return () => {
    if (subscription) {
      subscription.remove();
      subscription = null;
    }
  };
}

export async function syncStepsToBackend(steps) {
  if (steps <= 0) return;
  try {
    await logSteps(steps);
  } catch (error) {
    console.warn('Failed to sync steps to backend:', error);
  }
}
