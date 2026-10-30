/**
 * FitScan Proportional Meal Cost Estimation Utility
 *
 * Estimates individual meal cost from the user's selected meal plan and daily budget tier.
 * Implements dual-strategy calculation:
 * 1. Primary: Macro caloric share (meal calories / total daily calories) * daily budget
 * 2. Fallback: Meal type standard distribution weight (Breakfast 25%, Lunch 35%, Snack 15%, Dinner 25%)
 */

export const BUDGET_TIER_COSTS = {
  low_budget: { inr: 120, usd: 1.5, label: 'Low Budget (₹100–140/day)' },
  moderate: { inr: 215, usd: 2.75, label: 'Moderate Budget (₹180–250/day)' },
  flexible: { inr: 350, usd: 4.5, label: 'Flexible Tier (₹300+/day)' },
};

/**
 * Parses daily budget from plan's estimated_cost string or userSettings budget tier.
 * Handles ranges ("₹180-250/day"), single values ("~₹180/day"), and USD ("$2.50").
 *
 * @param {string|null} costString - e.g. "₹180-250/day", "~₹180/day", "$3.50/day"
 * @param {string} [budgetTier='moderate'] - 'low_budget' | 'moderate' | 'flexible'
 * @param {string} [currencyPreference='INR'] - 'INR' | 'USD'
 * @returns {{ dailyBudget: number, currency: string, tierLabel: string }}
 */
export function parseDailyBudget(costString, budgetTier = 'moderate', currencyPreference = 'INR') {
  const isUsd = (costString && costString.includes('$')) || currencyPreference === 'USD';
  const currency = isUsd ? '$' : '₹';
  const tierKey = budgetTier in BUDGET_TIER_COSTS ? budgetTier : 'moderate';
  const fallbackTier = BUDGET_TIER_COSTS[tierKey];

  if (!costString || typeof costString !== 'string') {
    return {
      dailyBudget: isUsd ? fallbackTier.usd : fallbackTier.inr,
      currency,
      tierLabel: fallbackTier.label,
    };
  }

  // 1. Try parsing range e.g. "180-250" or "100 - 140"
  const rangeMatch = costString.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
  if (rangeMatch) {
    const low = parseFloat(rangeMatch[1]);
    const high = parseFloat(rangeMatch[2]);
    const mid = (low + high) / 2;
    return {
      dailyBudget: mid,
      currency,
      tierLabel: `Daily Range: ${currency}${low}–${high}`,
    };
  }

  // 2. Try parsing single number e.g. "~₹180" or "300+"
  const plusMatch = costString.match(/(\d+(?:\.\d+)?)\s*\+/);
  if (plusMatch) {
    const base = parseFloat(plusMatch[1]);
    const estimated = base * 1.15; // e.g. 300+ -> ~350
    return {
      dailyBudget: estimated,
      currency,
      tierLabel: `Flexible Tier (${currency}${base}+/day)`,
    };
  }

  const singleMatch = costString.match(/(\d+(?:\.\d+)?)/);
  if (singleMatch) {
    return {
      dailyBudget: parseFloat(singleMatch[1]),
      currency,
      tierLabel: `Daily Budget: ${currency}${singleMatch[1]}`,
    };
  }

  return {
    dailyBudget: isUsd ? fallbackTier.usd : fallbackTier.inr,
    currency,
    tierLabel: fallbackTier.label,
  };
}

/**
 * Computes individual meal estimated cost based on caloric share and budget tier.
 *
 * @param {object} meal - Meal item { calories, meal_type, dish_name, estimated_cost? }
 * @param {object} selectedPlan - Active plan { daily_calories, estimated_cost }
 * @param {object} [userSettings] - User settings { budget_tier, calorie_goal, currency }
 * @returns {{
 *   formatted: string,
 *   amount: number,
 *   currency: string,
 *   percentage: number,
 *   dailyBudget: number,
 *   isDirect: boolean
 * }}
 */
export function estimateMealCost(meal, selectedPlan, userSettings = {}) {
  if (!meal) {
    return {
      formatted: '💰 ~₹50',
      amount: 50,
      currency: '₹',
      percentage: 25,
      dailyBudget: 200,
      isDirect: false,
    };
  }

  // 1. Direct attribute precedence (if API provided explicit cost string)
  if (meal.estimated_cost && typeof meal.estimated_cost === 'string') {
    const directMatch = meal.estimated_cost.match(/([₹$])\s*([0-9]+(?:\.[0-9]+)?)/);
    if (directMatch) {
      const curr = directMatch[1];
      const amt = parseFloat(directMatch[2]);
      return {
        formatted: `${curr}~${amt}`,
        amount: amt,
        currency: curr,
        percentage: 25,
        dailyBudget: amt * 4,
        isDirect: true,
      };
    }
  }

  // 2. Resolve Daily Budget base & Currency
  const { dailyBudget, currency } = parseDailyBudget(
    selectedPlan?.estimated_cost,
    userSettings?.budget_tier,
    userSettings?.currency
  );

  // 3. Calculate Caloric Ratio
  const dailyCalories = selectedPlan?.daily_calories || userSettings?.calorie_goal || 2000;
  let ratio = 0.25; // default fallback

  if (meal.calories && typeof meal.calories === 'number' && dailyCalories > 0) {
    ratio = meal.calories / dailyCalories;
  } else {
    const mealTypeWeights = {
      breakfast: 0.25,
      lunch: 0.35,
      snack: 0.15,
      dinner: 0.25,
    };
    const key = (meal.meal_type || '').toLowerCase();
    ratio = mealTypeWeights[key] || 0.25;
  }

  // Clamp ratio between 10% and 55% for realism
  const clampedRatio = Math.min(Math.max(ratio, 0.10), 0.55);
  const rawCost = dailyBudget * clampedRatio;
  const percentage = Math.round(clampedRatio * 100);

  if (currency === '$') {
    const roundedUsd = parseFloat(rawCost.toFixed(2));
    return {
      formatted: `~$${roundedUsd.toFixed(2)}`,
      amount: roundedUsd,
      currency: '$',
      percentage,
      dailyBudget: parseFloat(dailyBudget.toFixed(2)),
      isDirect: false,
    };
  }

  // For INR, round to nearest ₹5 increment (e.g. ₹45, ₹50, ₹65, ₹70)
  const roundedInr = Math.round(rawCost / 5) * 5 || Math.round(rawCost) || 50;
  return {
    formatted: `~₹${roundedInr}`,
    amount: roundedInr,
    currency: '₹',
    percentage,
    dailyBudget: Math.round(dailyBudget),
    isDirect: false,
  };
}

export default estimateMealCost;
