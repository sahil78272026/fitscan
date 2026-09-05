const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";

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

  const res = await fetch(url, { ...options, headers });

  // Handle 401 — redirect to login
  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("fitscan_token");
      localStorage.removeItem("fitscan_user");
      window.location.href = "/login";
    }
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Something went wrong" }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  // 204 No Content (e.g., DELETE)
  if (res.status === 204) return null;
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

export async function getMe() {
  return request("/auth/me");
}

// --- Meals ---

export async function getDailySummary(date = null) {
  const query = date ? `?date=${date}` : "";
  return request(`/daily-summary${query}`);
}

export async function logMeal(rawInput, mealType) {
  return request("/meals", {
    method: "POST",
    body: JSON.stringify({ raw_input: rawInput, meal_type: mealType }),
  });
}

export async function deleteMeal(mealId) {
  return request(`/meals/${mealId}`, { method: "DELETE" });
}

// --- Settings ---

export async function getSettings() {
  return request("/settings");
}

export async function updateCalorieGoal(calorieGoal) {
  return request("/settings/calorie-goal", {
    method: "PUT",
    body: JSON.stringify({ calorie_goal: calorieGoal }),
  });
}

// --- Calendar ---

export async function getCalendarMonth(year, month) {
  return request(`/calendar/month?year=${year}&month=${month}`);
}
