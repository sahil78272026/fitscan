/**
 * FitScan Client-Side Personalization Engine
 * Deterministic, offline-first personalization for greetings, milestones,
 * coaching insights, and diet-filtered adaptive meal suggestions.
 */

// Food database mapped strictly to diet_type: 'veg', 'vegan', 'eggetarian', 'non_veg'
const ADAPTIVE_FOOD_DB = [
  // --- Vegetarian (veg: includes dairy & legumes, NO eggs, NO meat) ---
  {
    id: 's_veg_1',
    name: 'Paneer Tikka with Mint Chutney',
    calories: 240,
    protein: 18,
    carbs: 8,
    fat: 16,
    diet: 'veg',
    slot: 'dinner',
    tag: 'High Protein',
    meal_type: 'dinner',
  },
  {
    id: 's_veg_2',
    name: 'Greek Yogurt with Roasted Almonds',
    calories: 180,
    protein: 15,
    carbs: 10,
    fat: 8,
    diet: 'veg',
    slot: 'snack',
    tag: 'Clean Protein',
    meal_type: 'snack',
  },
  {
    id: 's_veg_3',
    name: 'Soya Chunks Bhurji with Veggies',
    calories: 210,
    protein: 26,
    carbs: 14,
    fat: 5,
    diet: 'veg',
    slot: 'lunch',
    tag: 'Hypertrophy',
    meal_type: 'lunch',
  },
  {
    id: 's_veg_4',
    name: 'Sprouts & Pomegranate Chaat',
    calories: 150,
    protein: 9,
    carbs: 24,
    fat: 2,
    diet: 'veg',
    slot: 'snack',
    tag: 'High Fiber',
    meal_type: 'snack',
  },
  {
    id: 's_veg_5',
    name: 'Dal Tadka with Brown Rice',
    calories: 320,
    protein: 14,
    carbs: 52,
    fat: 6,
    diet: 'veg',
    slot: 'lunch',
    tag: 'Balanced',
    meal_type: 'lunch',
  },
  {
    id: 's_veg_6',
    name: 'Oatmeal with Chia & Whey Protein',
    calories: 290,
    protein: 24,
    carbs: 34,
    fat: 6,
    diet: 'veg',
    slot: 'breakfast',
    tag: 'Morning Power',
    meal_type: 'breakfast',
  },

  // --- Vegan (vegan: NO dairy, NO eggs, NO meat) ---
  {
    id: 's_vgn_1',
    name: 'Tofu & Broccoli Stir-Fry',
    calories: 210,
    protein: 20,
    carbs: 12,
    fat: 10,
    diet: 'vegan',
    slot: 'dinner',
    tag: '100% Plant',
    meal_type: 'dinner',
  },
  {
    id: 's_vgn_2',
    name: 'Edamame with Sea Salt',
    calories: 140,
    protein: 12,
    carbs: 10,
    fat: 5,
    diet: 'vegan',
    slot: 'snack',
    tag: 'Lean Snack',
    meal_type: 'snack',
  },
  {
    id: 's_vgn_3',
    name: 'Chickpea & Quinoa Buddha Bowl',
    calories: 340,
    protein: 16,
    carbs: 50,
    fat: 8,
    diet: 'vegan',
    slot: 'lunch',
    tag: 'Micronutrient Rich',
    meal_type: 'lunch',
  },
  {
    id: 's_vgn_4',
    name: 'Tempeh Steak with Grilled Peppers',
    calories: 260,
    protein: 24,
    carbs: 14,
    fat: 12,
    diet: 'vegan',
    slot: 'dinner',
    tag: 'Plant Muscle',
    meal_type: 'dinner',
  },
  {
    id: 's_vgn_5',
    name: 'Chia Seed Pudding with Almond Milk',
    calories: 190,
    protein: 7,
    carbs: 18,
    fat: 10,
    diet: 'vegan',
    slot: 'breakfast',
    tag: 'Omega-3',
    meal_type: 'breakfast',
  },

  // --- Eggetarian (eggetarian: eggs + veg, NO meat/fish) ---
  {
    id: 's_egg_1',
    name: '3 Egg Whites + 1 Whole Boiled Egg',
    calories: 145,
    protein: 18,
    carbs: 1,
    fat: 6,
    diet: 'eggetarian',
    slot: 'snack',
    tag: 'Bioavailable',
    meal_type: 'snack',
  },
  {
    id: 's_egg_2',
    name: 'Egg Bhurji with 2 Roti',
    calories: 310,
    protein: 20,
    carbs: 32,
    fat: 12,
    diet: 'eggetarian',
    slot: 'dinner',
    tag: 'Classic Protein',
    meal_type: 'dinner',
  },
  {
    id: 's_egg_3',
    name: 'Vegetable Egg White Omelette',
    calories: 160,
    protein: 22,
    carbs: 5,
    fat: 4,
    diet: 'eggetarian',
    slot: 'breakfast',
    tag: 'Lean & Clean',
    meal_type: 'breakfast',
  },

  // --- Non-Vegetarian (non_veg: chicken, fish, eggs, veg) ---
  {
    id: 's_nvg_1',
    name: 'Grilled Herb Chicken Breast (150g)',
    calories: 240,
    protein: 42,
    carbs: 0,
    fat: 5,
    diet: 'non_veg',
    slot: 'dinner',
    tag: 'Pure Protein',
    meal_type: 'dinner',
  },
  {
    id: 's_nvg_2',
    name: 'Pan-Seared White Fish with Lemon',
    calories: 190,
    protein: 34,
    carbs: 2,
    fat: 4,
    diet: 'non_veg',
    slot: 'lunch',
    tag: 'Lean Catch',
    meal_type: 'lunch',
  },
  {
    id: 's_nvg_3',
    name: 'Smoked Chicken & Avocado Wrap',
    calories: 340,
    protein: 28,
    carbs: 26,
    fat: 14,
    diet: 'non_veg',
    slot: 'lunch',
    tag: 'High Energy',
    meal_type: 'lunch',
  },
  {
    id: 's_nvg_4',
    name: 'Egg & Chicken Salad with Greens',
    calories: 270,
    protein: 36,
    carbs: 6,
    fat: 10,
    diet: 'non_veg',
    slot: 'dinner',
    tag: 'Low Carb',
    meal_type: 'dinner',
  },
];

/**
 * 1. Dynamic Greeting Details
 */
export function getGreetingDetails({
  user,
  userSettings,
  summary,
  hour = new Date().getHours(),
}) {
  // Resolve first name or friendly fallback
  let userName = 'Friend';
  if (user?.name && typeof user.name === 'string' && user.name.trim().length > 0) {
    userName = user.name.trim().split(' ')[0];
  } else if (user?.email && typeof user.email === 'string') {
    userName = user.email.split('@')[0];
  }

  // Time segment
  let greeting = 'Good morning';
  let icon = 'sunrise';
  let timePeriod = 'morning';

  if (hour >= 5 && hour < 12) {
    greeting = 'Good morning';
    icon = 'sunrise';
    timePeriod = 'morning';
  } else if (hour >= 12 && hour < 17) {
    greeting = 'Good afternoon';
    icon = 'sun';
    timePeriod = 'afternoon';
  } else if (hour >= 17 && hour < 21) {
    greeting = 'Good evening';
    icon = 'sunset';
    timePeriod = 'evening';
  } else {
    greeting = 'Night owl';
    icon = 'moon';
    timePeriod = 'night';
  }

  // Goal & remaining metrics context
  const goalType = userSettings?.goal_type || 'fat_loss';
  const remainingCals = summary?.remaining_calories ?? Math.max(0, (userSettings?.calorie_goal || 2000) - (summary?.total_calories || 0));
  const remainingProtein = summary?.remaining_protein ?? Math.max(0, (userSettings?.protein_goal || 150) - (summary?.total_protein || 0));

  let subGreeting = '';
  if (goalType === 'fat_loss' || goalType === 'weight_loss') {
    if (timePeriod === 'morning') {
      subGreeting = 'Targeting a clean calorie deficit today. Start strong!';
    } else if (timePeriod === 'afternoon') {
      subGreeting = `${remainingCals} kcal remaining. Keep afternoon snacks light & lean.`;
    } else if (timePeriod === 'evening') {
      subGreeting = 'Dinner focus: High volume & fiber to lock in your deficit.';
    } else {
      subGreeting = 'Great job staying disciplined today. Rest & recover.';
    }
  } else if (goalType === 'muscle_building') {
    if (timePeriod === 'morning') {
      subGreeting = 'High-protein breakfast to kickstart muscle protein synthesis!';
    } else if (timePeriod === 'afternoon') {
      subGreeting = `${remainingProtein}g protein to reach target. Fuel up for performance.`;
    } else if (timePeriod === 'evening') {
      subGreeting = 'Dinner time: Prioritize recovery protein & complex carbs.';
    } else {
      subGreeting = 'Overnight recovery phase: Hydrate and get deep rest.';
    }
  } else {
    // Maintenance / General Fitness
    if (timePeriod === 'morning') {
      subGreeting = 'Ready for a balanced day of nutrition & energy?';
    } else if (timePeriod === 'afternoon') {
      subGreeting = `${remainingCals} kcal remaining for today’s budget.`;
    } else {
      subGreeting = 'Consistent nutrition is the foundation of long-term health.';
    }
  }

  return {
    greeting: `${greeting}, ${userName}`,
    subGreeting,
    icon,
    timePeriod,
    userName,
    goalType,
  };
}

/**
 * 2. Active & Contextual Milestones
 */
export function getActiveMilestones({
  adherenceStats,
  weightData,
  summary,
  userSettings,
}) {
  const milestones = [];

  // Streak Thresholds (Ladder Badges)
  const currentStreak = Number(adherenceStats?.current_streak || 0);

  if (currentStreak === 30) {
    milestones.push({
      id: 'streak_30',
      title: '30-Day Legend Streak!',
      subtitle: '30 consecutive days of logging! You belong to the top 1% of consistent athletes.',
      icon: '30D',
      variant: 'celebration',
      priority: 1,
    });
  } else if (currentStreak === 15) {
    milestones.push({
      id: 'streak_15',
      title: '15-Day Macro Master!',
      subtitle: 'Two straight weeks of dedication. Tracking is now an automatic habit.',
      icon: '15D',
      variant: 'celebration',
      priority: 1,
    });
  } else if (currentStreak === 7) {
    milestones.push({
      id: 'streak_7',
      title: '7-Day Warrior Streak!',
      subtitle: 'One full week of disciplined tracking unlocked. Phenomenal momentum!',
      icon: '7D',
      variant: 'celebration',
      priority: 1,
    });
  } else if (currentStreak === 3) {
    milestones.push({
      id: 'streak_3',
      title: '3-Day Warmup Streak!',
      subtitle: '3 days in a row logged. The hardest part is starting — keep rolling!',
      icon: '3D',
      variant: 'celebration',
      priority: 1,
    });
  }

  // Approaching Milestone (1 day away)
  if (currentStreak === 2) {
    milestones.push({
      id: 'streak_up_3',
      title: '1 Day from 3-Day Warmup!',
      subtitle: 'Log your meals today to unlock your first streak badge.',
      icon: '3D',
      variant: 'upcoming',
      priority: 2,
    });
  } else if (currentStreak === 6) {
    milestones.push({
      id: 'streak_up_7',
      title: '1 Day from 7-Day Warrior!',
      subtitle: 'Log today to reach a full 7-day streak and claim your warrior badge!',
      icon: '7D',
      variant: 'upcoming',
      priority: 2,
    });
  } else if (currentStreak === 14) {
    milestones.push({
      id: 'streak_up_15',
      title: '1 Day from Macro Master!',
      subtitle: 'One more day to hit the 15-day streak milestone.',
      icon: '15D',
      variant: 'upcoming',
      priority: 2,
    });
  } else if (currentStreak === 29) {
    milestones.push({
      id: 'streak_up_30',
      title: '1 Day from 30-Day Legend!',
      subtitle: 'The 30-day pinnacle is right in front of you. Finish strong today!',
      icon: '30D',
      variant: 'upcoming',
      priority: 2,
    });
  }

  // Daily Protein Goal Achieved
  const proteinConsumed = Number(summary?.total_protein || 0);
  const proteinGoal = Number(summary?.protein_goal || userSettings?.protein_goal || 0);
  if (proteinGoal > 0 && proteinConsumed >= proteinGoal) {
    milestones.push({
      id: 'protein_achieved',
      title: 'Protein Target Smashed!',
      subtitle: `${proteinConsumed}g protein logged today (Goal: ${proteinGoal}g). Muscles fully fueled!`,
      icon: 'PRO',
      variant: 'macro_success',
      priority: 3,
    });
  }

  // Weight Trend Milestones
  if (weightData && typeof weightData.net_change_kg === 'number') {
    const net = weightData.net_change_kg;
    const goalType = userSettings?.goal_type || 'fat_loss';
    if ((goalType === 'fat_loss' || goalType === 'weight_loss') && net <= -1.0) {
      milestones.push({
        id: 'weight_loss_milestone',
        title: `Weight Milestone: ${Math.abs(net)} kg Down!`,
        subtitle: 'Consistent caloric deficit confirmed on the scale. Outstanding progress!',
        icon: '-1KG',
        variant: 'celebration',
        priority: 2,
      });
    } else if (goalType === 'muscle_building' && net >= 1.0) {
      milestones.push({
        id: 'weight_gain_milestone',
        title: `Weight Milestone: +${net} kg Lean Gain!`,
        subtitle: 'Controlled hypertrophy surplus reflected on the scale. Great job!',
        icon: '+1KG',
        variant: 'celebration',
        priority: 2,
      });
    }
  }

  // Sort by priority (celebration > upcoming > daily)
  return milestones.sort((a, b) => a.priority - b.priority);
}

/**
 * 3. Real-Time Goal Insights
 */
export function getGoalInsights({
  summary,
  userSettings,
  hour = new Date().getHours(),
}) {
  const consumedCals = Number(summary?.total_calories || 0);
  const goalCals = Number(summary?.calorie_goal || userSettings?.calorie_goal || 2000);
  const remainingCals = goalCals - consumedCals;

  const consumedProtein = Number(summary?.total_protein || 0);
  const goalProtein = Number(summary?.protein_goal || userSettings?.protein_goal || 150);
  const proteinGap = Math.max(0, goalProtein - consumedProtein);

  const goalType = userSettings?.goal_type || 'fat_loss';

  if (consumedCals > goalCals) {
    const surplus = consumedCals - goalCals;
    return {
      status: 'surplus',
      badge: 'Surplus',
      variant: 'danger',
      title: 'Caloric Surplus Notice',
      message: `You are currently ${surplus} kcal above your daily budget. Keep any evening bites light with leafy greens or high-water foods.`,
    };
  }

  if (proteinGap > 35 && hour >= 16) {
    return {
      status: 'protein_gap',
      badge: 'Protein Priority',
      variant: 'warning',
      title: 'Protein Gap: High',
      message: `You need ${proteinGap}g more protein to hit your ${goalType === 'muscle_building' ? 'Muscle Building' : 'Daily'} target. Prioritize lean protein in your next meal.`,
    };
  }

  if (remainingCals < 350 && hour < 18) {
    return {
      status: 'budget_pacing',
      badge: 'Budget Pacing',
      variant: 'warning',
      title: 'Low Calorie Headroom',
      message: `Only ${remainingCals} kcal remaining before dinner. Save room for your evening nutrition!`,
    };
  }

  return {
    status: 'on_track',
    badge: 'On Track',
    variant: 'success',
    title: 'Macro Pacing Strong',
    message: `You have ${remainingCals} kcal and ${proteinGap}g protein remaining today. Excellent discipline!`,
  };
}

/**
 * 4. Adaptive Suggestions (Strictly Diet-Filtered)
 */
export function getAdaptiveSuggestions({
  userSettings,
  summary,
  hour = new Date().getHours(),
}) {
  const userDiet = (userSettings?.diet_type || 'veg').toLowerCase();

  // Filter food database strictly by user's dietary restriction
  let pool = ADAPTIVE_FOOD_DB.filter((item) => {
    if (userDiet === 'vegan') {
      return item.diet === 'vegan';
    }
    if (userDiet === 'veg') {
      return item.diet === 'veg' || item.diet === 'vegan';
    }
    if (userDiet === 'eggetarian') {
      return item.diet === 'eggetarian' || item.diet === 'veg' || item.diet === 'vegan';
    }
    // non_veg can eat anything
    return true;
  });

  // Target current meal slot based on hour
  let targetSlot = 'snack';
  if (hour < 11) targetSlot = 'breakfast';
  else if (hour < 16) targetSlot = 'lunch';
  else if (hour < 20) targetSlot = 'dinner';
  else targetSlot = 'snack';

  // Sort pool: prioritize matching meal slot, then protein density
  pool.sort((a, b) => {
    const aSlotMatch = a.slot === targetSlot ? 1 : 0;
    const bSlotMatch = b.slot === targetSlot ? 1 : 0;
    if (aSlotMatch !== bSlotMatch) return bSlotMatch - aSlotMatch;
    return b.protein - a.protein;
  });

  // Return top 3 tailored suggestions
  return pool.slice(0, 3);
}

export default {
  getGreetingDetails,
  getActiveMilestones,
  getGoalInsights,
  getAdaptiveSuggestions,
};
