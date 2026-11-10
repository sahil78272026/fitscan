const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";
export const ENABLE_API_LOGGING = process.env.NODE_ENV !== "production";
const REQUEST_TIMEOUT_MS = 15000;
export const SCAN_REQUEST_TIMEOUT_MS = 45000;

export function createNetworkError(originalError) {
  const error = new Error("Unable to connect to server. Please check your internet connection.");
  error.name = "NetworkError";
  error.netErr = true;
  error.originalError = originalError;
  return error;
}

export function isNetworkError(err) {
  if (!err) return false;
  if (err.name === "AbortError" || err.netErr) return true;
  const msg = err.message || "";
  return (
    err instanceof TypeError ||
    msg.includes("Failed to fetch") ||
    msg.includes("Network request failed") ||
    msg.includes("network error") ||
    msg.includes("aborted")
  );
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (options.signal) {
    options.signal.addEventListener("abort", () => controller.abort());
  }

  try {
    if (ENABLE_API_LOGGING) {
      console.log(`[API Request] ${options.method || "GET"} ${url}`);
    }
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    if (ENABLE_API_LOGGING) {
      console.log(`[API Response] ${res.status} ${url}`);
    }
    return res;
  } catch (err) {
    if (ENABLE_API_LOGGING) {
      console.error(`[API Error] ${options.method || "GET"} ${url}:`, err);
    }
    if (isNetworkError(err)) {
      throw createNetworkError(err);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("fitscan_token");
}

async function request(endpoint, options = {}, requireAuth = true) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  // Add auth header if token exists
  if (requireAuth) {
    const token = getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const timeoutMs = options.timeoutMs || REQUEST_TIMEOUT_MS;
  const res = await fetchWithTimeout(url, { ...options, headers }, timeoutMs);

  // Handle 401 — redirect to login
  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("fitscan_token");
      localStorage.removeItem("fitscan_user");
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login";
    }
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: "Something went wrong" }));
    const message =
      typeof errorData.detail === "string"
        ? errorData.detail
        : errorData.detail?.message || `HTTP ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.data = errorData;
    err.code = (typeof errorData.detail === "object" && errorData.detail?.code) || errorData.code || null;
    throw err;
  }

  // 204 No Content (e.g., DELETE)
  if (res.status === 204) return null;
  return res.json();
}

async function requestForm(endpoint, formData, timeoutMs = REQUEST_TIMEOUT_MS) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {};
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers,
    body: formData,
  }, timeoutMs);

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("fitscan_token");
      localStorage.removeItem("fitscan_user");
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login";
    }
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: "Something went wrong" }));
    const message =
      typeof errorData.detail === "string"
        ? errorData.detail
        : errorData.detail?.message || `HTTP ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.data = errorData;
    err.code = (typeof errorData.detail === "object" && errorData.detail?.code) || errorData.code || null;
    throw err;
  }

  return res.json();
}

// --- Auth ---

export async function sendOtp(phone) {
  return request("/auth/send-otp", {
    method: "POST",
    body: JSON.stringify({ phone }),
  }, false);
}

export async function verifyOtp(phone, otp, name = null) {
  return request("/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ phone, otp, name }),
  }, false);
}

export async function verifyFirebaseToken(idToken, email = null, name = null, avatarUrl = null, phone = null) {
  return request("/auth/firebase-verify", {
    method: "POST",
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
  return request("/auth/email-login", {
    method: "POST",
    body: JSON.stringify({
      email,
      name,
      avatar_url: avatarUrl,
    }),
  }, false);
}

export async function getMe() {
  return request("/auth/me");
}

export async function deleteAccount() {
  return request("/auth/me", {
    method: "DELETE",
  });
}

export async function requestPublicDataDeletion(identifier, reason = null) {
  return request("/auth/request-data-deletion", {
    method: "POST",
    body: JSON.stringify({ identifier, reason }),
  }, false);
}

// --- Meals ---

export async function getDailySummary(date = null) {
  const query = date ? `?date=${date}` : "";
  return request(`/daily-summary${query}`);
}

export async function logMeal(rawInput, mealType, mealDate = null, imageUrl = null) {
  const body = { raw_input: rawInput, meal_type: mealType };
  if (mealDate) body.meal_date = mealDate;
  if (imageUrl) body.image_url = imageUrl;
  return request("/meals", {
    method: "POST",
    body: JSON.stringify(body),
    timeoutMs: SCAN_REQUEST_TIMEOUT_MS,
  });
}

export async function scanMealImage(imageFile, rawInput = "", mealType = "lunch", mealDate = null, imageUrl = null) {
  const formData = new FormData();
  formData.append("image", imageFile);
  if (rawInput) formData.append("raw_input", rawInput);
  if (mealType) formData.append("meal_type", mealType);
  if (mealDate) formData.append("meal_date", mealDate);
  if (imageUrl) formData.append("image_url", imageUrl);

  return requestForm("/meals/scan-image", formData, SCAN_REQUEST_TIMEOUT_MS);
}

export async function getMealRecommendations() {
  return request("/meals/recommendations");
}

export async function deleteMeal(mealId) {
  return request(`/meals/${mealId}`, { method: "DELETE" });
}

// --- Settings ---

export async function getSettings() {
  return request("/settings");
}

export async function updateUserGoals(goalData) {
  return request("/settings/goals", {
    method: "PUT",
    body: JSON.stringify(goalData),
  });
}

export async function updateCalorieGoal(calorieGoal) {
  return request("/settings/calorie-goal", {
    method: "PUT",
    body: JSON.stringify({ calorie_goal: calorieGoal }),
  });
}

export async function getSuggestedMealPlans() {
  return request("/settings/meal-plans/suggest", {
    method: "POST",
  });
}

export async function selectMealPlan(mealPlan) {
  return request("/settings/meal-plan/select", {
    method: "PUT",
    body: JSON.stringify({ meal_plan: mealPlan }),
  });
}

export async function swapMealPlan(sourceMealType, targetMealType, mealPlan = null) {
  const body = {};
  if (sourceMealType && targetMealType) {
    body.source_meal_type = sourceMealType;
    body.target_meal_type = targetMealType;
  }
  if (mealPlan) {
    body.meal_plan = mealPlan;
  }
  return request("/settings/meal-plan/swap", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateSubscriptionTier(tier) {
  return request("/settings/subscription", {
    method: "PUT",
    body: JSON.stringify({ tier }),
  });
}

// --- Calendar & Stats ---

export async function getCalendarMonth(year, month) {
  return request(`/calendar/month?year=${year}&month=${month}`);
}

export async function getAdherenceStats() {
  return request("/stats/adherence");
}

// --- Weight Tracking ---

export async function logWeight(weightKg, loggedDate = null) {
  const body = { weight_kg: parseFloat(weightKg) };
  if (loggedDate) body.logged_date = loggedDate;
  return request("/weight", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getWeightHistory(days = 30) {
  return request(`/weight/history?days=${days}`);
}

export async function deleteWeightLog(logId) {
  return request(`/weight/${logId}`, { method: "DELETE" });
}

// --- Morning Briefing ---

export async function getMorningBriefing(clientHour = null) {
  const hourParam = clientHour !== null ? `?client_hour=${clientHour}` : `?client_hour=${new Date().getHours()}`;
  return request(`/daily-summary/morning-briefing${hourParam}`);
}

export async function updateMorningBriefingPreferences(preferences) {
  return request("/settings/morning-briefing", {
    method: "PUT",
    body: JSON.stringify(preferences),
  });
}

// --- Subscription & Paywall ---

export async function getSubscriptionStatus() {
  return request("/subscription/status");
}

// --- Dynamic Coupons ---

export async function validateCoupon(code, planType = "annual") {
  return request("/coupons/validate", {
    method: "POST",
    body: JSON.stringify({ code, plan_type: planType }),
  });
}

export async function redeemCoupon(code, planType = "annual") {
  return request("/coupons/redeem", {
    method: "POST",
    body: JSON.stringify({ code, plan_type: planType }),
  });
}

// --- Razorpay Payments ---

export async function getPricingPlans() {
  return request("/payments/plans");
}

export async function createPaymentOrder(planId, couponCode = null) {
  const body = { plan_id: planId };
  if (couponCode) {
    body.coupon_code = couponCode;
  }
  return request("/payments/razorpay/create-order", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function verifyPaymentSignature(payload) {
  return request("/payments/razorpay/verify-payment", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}



