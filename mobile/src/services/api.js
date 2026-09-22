import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getInitialApiUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  const debuggerHost = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost;
  if (debuggerHost) {
    const hostIp = debuggerHost.split(':')[0];
    return `http://${hostIp}:8000/api`;
  }
  return Platform.OS === 'android' ? 'http://10.0.2.2:8000/api' : 'http://127.0.0.1:8000/api';
};

let API_BASE_URL = getInitialApiUrl();

export const setApiBaseUrl = (url) => {
  if (url) API_BASE_URL = url;
};

export const getApiBaseUrl = () => API_BASE_URL;

async function getToken() {
  try {
    return await AsyncStorage.getItem('fitscan_token');
  } catch (e) {
    return null;
  }
}

async function request(endpoint, options = {}, requireAuth = true) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (requireAuth) {
    const token = await getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    await AsyncStorage.removeItem('fitscan_token');
    await AsyncStorage.removeItem('fitscan_user');
    throw new Error('Session expired. Please log in again.');
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Something went wrong' }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

// --- Auth ---
export async function sendOtp(phone) {
  return request('/auth/send-otp', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  }, false);
}

export async function verifyOtp(phone, otp, name = null) {
  return request('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, otp, name }),
  }, false);
}

export async function verifyFirebaseToken(idToken, phone = null, name = null) {
  return request('/auth/firebase-verify', {
    method: 'POST',
    body: JSON.stringify({ firebase_token: idToken, phone, name }),
  }, false);
}

export async function getMe() {
  return request('/auth/me');
}

// --- Daily Summary & Calendar ---
export async function getDailySummary(date = null) {
  const query = date ? `?date=${date}` : '';
  return request(`/daily-summary${query}`);
}

export async function getCalendarMonth(year, month) {
  return request(`/calendar/month?year=${year}&month=${month}`);
}

// --- Step Tracking ---
export async function logSteps(stepCount, loggedDate = null) {
  const body = { step_count: parseInt(stepCount, 10) };
  if (loggedDate) body.logged_date = loggedDate;
  return request('/steps', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getDailySteps(date = null) {
  const query = date ? `?logged_date=${date}` : '';
  return request(`/steps/daily${query}`);
}

export async function getStepHistory(days = 7) {
  return request(`/steps/history?days=${days}`);
}

// --- Meals ---
export async function logMeal(rawInput, mealType, mealDate = null) {
  const body = { raw_input: rawInput, meal_type: mealType };
  if (mealDate) body.meal_date = mealDate;
  return request('/meals', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function scanMealImageBase64(photoBase64, rawInput = '', mealType = 'lunch', mealDate = null) {
  const body = {
    photo_base64: photoBase64,
    raw_input: rawInput,
    meal_type: mealType,
  };
  if (mealDate) body.meal_date = mealDate;

  return request('/meals/scan-image-base64', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function scanMealImage(imageUri, rawInput = '', mealType = 'lunch', mealDate = null) {
  const actualUri = typeof imageUri === 'string'
    ? imageUri
    : (imageUri?.uri || imageUri?.localUri || '');

  const imgRes = await fetch(actualUri);
  const blob = await imgRes.blob();
  const fileName = (actualUri.split('/').pop()?.split('?')[0]) || 'meal.jpg';

  const formData = new FormData();
  formData.append('image', blob, fileName);

  if (rawInput) formData.append('raw_input', String(rawInput));
  if (mealType) formData.append('meal_type', String(mealType));
  if (mealDate) formData.append('meal_date', String(mealDate));

  const url = `${API_BASE_URL}/meals/scan-image`;
  const headers = {};
  const token = await getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (res.status === 401) {
    await AsyncStorage.removeItem('fitscan_token');
    await AsyncStorage.removeItem('fitscan_user');
    throw new Error('Session expired. Please log in again.');
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Something went wrong' }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function deleteMeal(mealId) {
  return request(`/meals/${mealId}`, { method: 'DELETE' });
}

// --- Settings ---
export async function getSettings() {
  return request('/settings');
}

export async function updateUserGoals(goalData) {
  return request('/settings/goals', {
    method: 'PUT',
    body: JSON.stringify(goalData),
  });
}

export async function updateCalorieGoal(calorieGoal) {
  return request('/settings/calorie-goal', {
    method: 'PUT',
    body: JSON.stringify({ calorie_goal: calorieGoal }),
  });
}

export async function getSuggestedMealPlans() {
  return request('/settings/meal-plans/suggest', {
    method: 'POST',
  });
}

export async function selectMealPlan(mealPlan) {
  return request('/settings/meal-plan/select', {
    method: 'PUT',
    body: JSON.stringify({ meal_plan: mealPlan }),
  });
}

// --- Weight Tracking ---
export async function logWeight(weightKg, loggedDate = null) {
  const body = { weight_kg: parseFloat(weightKg) };
  if (loggedDate) body.logged_date = loggedDate;
  return request('/weight', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getWeightHistory(days = 30) {
  return request(`/weight/history?days=${days}`);
}

export async function deleteWeightLog(logId) {
  return request(`/weight/${logId}`, { method: 'DELETE' });
}

// --- Stats & Adherence ---
export async function getAdherenceStats() {
  return request('/stats/adherence');
}

