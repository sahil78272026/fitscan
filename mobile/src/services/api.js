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

export const ENABLE_API_LOGGING = __DEV__;
const REQUEST_TIMEOUT_MS = 15000;
export const SCAN_REQUEST_TIMEOUT_MS = 45000;

export function createNetworkError(originalError) {
  const error = new Error('Unable to connect to server. Please check your internet connection.');
  error.name = 'NetworkError';
  error.netErr = true;
  error.originalError = originalError;
  return error;
}

export function isNetworkError(err) {
  if (!err) return false;
  if (err.name === 'AbortError' || err.netErr) return true;
  const msg = err.message || '';
  return (
    err instanceof TypeError ||
    msg.includes('Failed to fetch') ||
    msg.includes('Network request failed') ||
    msg.includes('network error') ||
    msg.includes('aborted')
  );
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort());
  }

  try {
    if (ENABLE_API_LOGGING) {
      console.log(`[Mobile API Request] ${options.method || 'GET'} ${url}`);
    }
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    if (ENABLE_API_LOGGING) {
      console.log(`[Mobile API Response] ${res.status} ${url}`);
    }
    return res;
  } catch (err) {
    if (ENABLE_API_LOGGING) {
      console.error(`[Mobile API Error] ${options.method || 'GET'} ${url}:`, err);
    }
    if (isNetworkError(err)) {
      throw createNetworkError(err);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

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

  const timeoutMs = options.timeoutMs || REQUEST_TIMEOUT_MS;
  const res = await fetchWithTimeout(url, { ...options, headers }, timeoutMs);

  if (res.status === 401) {
    await AsyncStorage.removeItem('fitscan_token');
    await AsyncStorage.removeItem('fitscan_user');
    throw new Error('Session expired. Please log in again.');
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Something went wrong' }));
    const message =
      typeof errorData.detail === 'string'
        ? errorData.detail
        : errorData.detail?.message || `HTTP ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.data = errorData;
    err.code = (typeof errorData.detail === 'object' && errorData.detail?.code) || errorData.code || null;
    throw err;
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

export async function verifyFirebaseToken(idToken, email = null, name = null, avatarUrl = null, phone = null) {
  return request('/auth/firebase-verify', {
    method: 'POST',
    body: JSON.stringify({
      firebase_token: idToken,
      email,
      name,
      avatar_url: avatarUrl,
      phone,
    }),
  }, false);
}

export async function loginWithEmail(email, name = null, avatarUrl = null) {
  return request('/auth/email-login', {
    method: 'POST',
    body: JSON.stringify({
      email,
      name,
      avatar_url: avatarUrl,
    }),
  }, false);
}

export async function getMe() {
  return request('/auth/me');
}

export async function deleteAccount(reauthToken = null) {
  const headers = {};
  if (reauthToken) {
    headers['X-Reauth-Token'] = reauthToken;
  }
  return request('/auth/me', {
    method: 'DELETE',
    headers,
  });
}

export async function resetUserData(scope = 'all_logs', confirmation = 'RESET', reauthToken = null) {
  const headers = {};
  if (reauthToken) {
    headers['X-Reauth-Token'] = reauthToken;
  }
  return request('/settings/reset-data', {
    method: 'POST',
    headers,
    body: JSON.stringify({ scope, confirmation }),
  });
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
export async function logSteps(stepCount, loggedDate = null, caloriesBurned = null) {
  const body = { step_count: parseInt(stepCount, 10) };
  if (loggedDate) body.logged_date = loggedDate;
  if (typeof caloriesBurned === 'number' && caloriesBurned > 0) {
    body.calories_burned = caloriesBurned;
  }
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
export async function logMeal(rawInput, mealType, mealDate = null, imageUrl = null) {
  const body = { raw_input: rawInput, meal_type: mealType };
  if (mealDate) body.meal_date = mealDate;
  if (imageUrl) body.image_url = imageUrl;
  return request('/meals', {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: SCAN_REQUEST_TIMEOUT_MS,
  });
}

export async function scanMealImageBase64(photoBase64, rawInput = '', mealType = 'lunch', mealDate = null, imageUrl = null) {
  const body = {
    photo_base64: photoBase64,
    raw_input: rawInput,
    meal_type: mealType,
  };
  if (mealDate) body.meal_date = mealDate;
  if (imageUrl) body.image_url = imageUrl;

  return request('/meals/scan-image-base64', {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: SCAN_REQUEST_TIMEOUT_MS,
  });
}

export async function scanMealImage(imageUri, rawInput = '', mealType = 'lunch', mealDate = null, imageUrl = null) {
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
  if (imageUrl) formData.append('image_url', String(imageUrl));

  const url = `${API_BASE_URL}/meals/scan-image`;
  const headers = {};
  const token = await getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers,
    body: formData,
  }, SCAN_REQUEST_TIMEOUT_MS);

  if (res.status === 401) {
    await AsyncStorage.removeItem('fitscan_token');
    await AsyncStorage.removeItem('fitscan_user');
    throw new Error('Session expired. Please log in again.');
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Something went wrong' }));
    const message =
      typeof errorData.detail === 'string'
        ? errorData.detail
        : errorData.detail?.message || `HTTP ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.data = errorData;
    err.code = (typeof errorData.detail === 'object' && errorData.detail?.code) || errorData.code || null;
    throw err;
  }

  return res.json();
}

export async function deleteMeal(mealId) {
  return request(`/meals/${mealId}`, { method: 'DELETE' });
}

export async function getMealRecommendations() {
  return request('/meals/recommendations');
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

/**
 * Swap two meal slots in the active meal plan without triggering 24h AI cooldown.
 * Supports:
 *   - swapMealPlan(sourceIdx, targetIdx, optionalMealPlan)
 *   - swapMealPlan(sourceMealType, targetMealType, optionalMealPlan)
 *
 * @param {number|string} source - Source slot index or meal_type string
 * @param {number|string} target - Target slot index or meal_type string
 * @param {object|null} mealPlan - Optional full updated meal plan object
 * @returns {Promise<object>} Updated SettingsResponse
 */
export async function swapMealPlan(source, target, mealPlan = null) {
  let sourceMealType = typeof source === 'string' ? source : null;
  let targetMealType = typeof target === 'string' ? target : null;
  let plan = mealPlan;

  if ((!sourceMealType || !targetMealType) && typeof source === 'number' && typeof target === 'number') {
    if (plan && Array.isArray(plan.meals)) {
      sourceMealType = plan.meals[source]?.meal_type;
      targetMealType = plan.meals[target]?.meal_type;
    } else {
      try {
        const settings = await getSettings();
        const loadedPlan = typeof settings?.selected_meal_plan === 'string'
          ? JSON.parse(settings.selected_meal_plan)
          : settings?.selected_meal_plan;
        if (loadedPlan && Array.isArray(loadedPlan.meals)) {
          sourceMealType = loadedPlan.meals[source]?.meal_type;
          targetMealType = loadedPlan.meals[target]?.meal_type;
          if (!plan) plan = loadedPlan;
        }
      } catch (err) {
        console.warn('Failed to resolve meal types from settings in swapMealPlan:', err);
      }
    }
  }

  const body = {};
  if (sourceMealType && targetMealType) {
    body.source_meal_type = sourceMealType;
    body.target_meal_type = targetMealType;
  }
  if (plan) {
    body.meal_plan = plan;
  }

  if (!body.source_meal_type && !body.meal_plan) {
    body.source_meal_type = String(source);
    body.target_meal_type = String(target);
  }

  return request('/settings/meal-plan/swap', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateSubscriptionTier(tier) {
  return request('/settings/subscription', {
    method: 'PUT',
    body: JSON.stringify({ tier }),
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

// --- Morning Briefing ---
export async function getMorningBriefing(clientHour = null) {
  const hourParam = clientHour !== null ? `?client_hour=${clientHour}` : `?client_hour=${new Date().getHours()}`;
  return request(`/daily-summary/morning-briefing${hourParam}`);
}

export async function updateMorningBriefingPreferences(preferences) {
  return request('/settings/morning-briefing', {
    method: 'PUT',
    body: JSON.stringify(preferences),
  });
}

// --- Subscription & Paywall ---
export async function getSubscriptionStatus() {
  return request('/subscription/status');
}

// --- Dynamic Coupons ---
export async function validateCoupon(code, planType = 'annual') {
  return request('/coupons/validate', {
    method: 'POST',
    body: JSON.stringify({ code, plan_type: planType }),
  });
}

export async function redeemCoupon(code, planType = 'annual') {
  return request('/coupons/redeem', {
    method: 'POST',
    body: JSON.stringify({ code, plan_type: planType }),
  });
}

// --- Razorpay Payments ---
export async function getPricingPlans() {
  return request('/payments/plans');
}

export async function createPaymentOrder(planId, couponCode = null) {
  const body = { plan_id: planId };
  if (couponCode) {
    body.coupon_code = couponCode;
  }
  return request('/payments/razorpay/create-order', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function verifyPaymentSignature(payload) {
  return request('/payments/razorpay/verify-payment', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}



