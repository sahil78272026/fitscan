/**
 * FitScan Meal Plan PDF Generator Utility
 *
 * Generates an elegant, printable A4 PDF document for the user's active daily meal plan.
 * Implements HTML escaping, nutritional summary targets, structured meal schedule cards,
 * recipe instructions, ingredients checklists, and print media CSS optimizations.
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { estimateMealCost } from './mealCostEstimator';

/**
 * Escapes HTML control characters to prevent XSS and malformed document layout.
 *
 * @param {string|null|undefined} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generates a complete, standard HTML5 printable document string representing the meal plan.
 *
 * @param {object|null} selectedPlan - Meal plan object containing title, daily_calories, macros, meals
 * @param {object|null} [userSettings={}] - User settings containing goal_type, diet_type, budget_tier, targets
 * @returns {string} Standard HTML5 document string
 */
export function generateMealPlanHtml(selectedPlan, userSettings = {}) {
  const plan = selectedPlan && typeof selectedPlan === 'object' ? selectedPlan : {};
  const settings = userSettings && typeof userSettings === 'object' ? userSettings : {};

  const planTitle = plan.title || 'Personalized Daily Meal Plan';
  const goalType = (settings.goal_type || 'fat_loss').replace(/_/g, ' ').toUpperCase();
  const dietType = (settings.diet_type || 'balanced').replace(/_/g, ' ').toUpperCase();

  const dailyCalories = plan.daily_calories || settings.calorie_goal || 2000;
  const proteinG = plan.protein_g || settings.protein_goal || 150;
  const carbsG = plan.carbs_g || settings.carbs_goal || 200;
  const fatG = plan.fat_g || settings.fat_goal || 65;
  const dailyBudget = plan.estimated_cost || settings.budget_tier || 'Moderate Budget';

  const meals = Array.isArray(plan.meals) ? plan.meals : [];
  const exportDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  // Render meal cards
  let mealsHtml = '';
  if (meals.length === 0) {
    mealsHtml = `
      <div class="empty-meals">
        <p>No meals scheduled in this plan.</p>
      </div>
    `;
  } else {
    mealsHtml = meals
      .map((meal, index) => {
        if (!meal || typeof meal !== 'object') return '';

        const mealTypeKey = (meal.meal_type || `Meal ${index + 1}`).toLowerCase();
        const mealTypeLabel = (meal.meal_type || `Meal ${index + 1}`).toUpperCase();
        const dishName = meal.dish_name || 'Healthy Dish';
        const cal = meal.calories != null ? meal.calories : 0;
        const p = meal.protein != null ? meal.protein : 0;
        const c = meal.carbs != null ? meal.carbs : 0;
        const f = meal.fat != null ? meal.fat : 0;

        // Cost estimation badge
        let costBadgeHtml = '';
        try {
          const costInfo = estimateMealCost(meal, plan, settings);
          if (costInfo && costInfo.formatted) {
            costBadgeHtml = `<span class="badge cost-badge">${escapeHtml(costInfo.formatted)}</span>`;
          }
        } catch {
          // fallback if cost estimation unavailable
        }

        // Ingredients
        let ingredientsHtml = '';
        if (Array.isArray(meal.ingredients) && meal.ingredients.length > 0) {
          ingredientsHtml = `
            <div class="section-block">
              <div class="section-title">Ingredients</div>
              <ul class="ingredients-list">
                ${meal.ingredients
                  .map((ing) => `<li>${escapeHtml(ing)}</li>`)
                  .join('')}
              </ul>
            </div>
          `;
        }

        // Preparation Summary
        let prepText = meal.recipe_summary || '';
        if (!prepText && Array.isArray(meal.instructions) && meal.instructions.length > 0) {
          prepText = meal.instructions.join(' ');
        } else if (!prepText && meal.description) {
          prepText = meal.description;
        }

        let prepHtml = '';
        if (prepText) {
          prepHtml = `
            <div class="section-block">
              <div class="section-title">Recipe Preparation</div>
              <p class="recipe-text">${escapeHtml(prepText)}</p>
            </div>
          `;
        }

        return `
          <div class="meal-card">
            <div class="meal-header">
              <div class="meal-type-badge">
                <span class="meal-type-text">${escapeHtml(mealTypeLabel)}</span>
              </div>
              <div class="meal-badges">
                ${costBadgeHtml}
                <span class="badge calorie-badge">${cal} kcal</span>
              </div>
            </div>

            <div class="dish-title">${escapeHtml(dishName)}</div>

            <div class="macro-split">
              (P: ${p}g | C: ${c}g | F: ${f}g)
            </div>

            <div class="macro-bar-container">
              <div class="macro-pill p-pill">Protein: <strong>${p}g</strong></div>
              <div class="macro-pill c-pill">Carbs: <strong>${c}g</strong></div>
              <div class="macro-pill f-pill">Fat: <strong>${f}g</strong></div>
            </div>

            ${ingredientsHtml}
            ${prepHtml}
          </div>
        `;
      })
      .join('');
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CoreControl Meal Plan - ${escapeHtml(planTitle)}</title>
  <style>
    @page { margin: 15mm 12mm; size: A4 portrait; }
    @media print { body { background: #fff; color: #111; } .meal-card { page-break-inside: avoid; } }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #FFFFFF;
      color: #1A1A1A;
      line-height: 1.45;
      padding: 10px 14px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* Brand Header */
    .brand-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #E8A020;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }

    .brand-logo-title {
      font-size: 22px;
      font-weight: 800;
      color: #08090C;
      letter-spacing: -0.5px;
    }

    .brand-logo-title span {
      color: #E8A020;
    }

    .brand-subtitle {
      font-size: 11px;
      color: #666666;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 2px;
    }

    .header-metadata {
      text-align: right;
    }

    .header-date {
      font-size: 11px;
      font-weight: 600;
      color: #555555;
    }

    .header-tagline {
      font-size: 10px;
      color: #888888;
    }

    /* Plan Hero Summary */
    .plan-hero {
      background: #FDF9F3;
      border: 1px solid #F3DFC1;
      border-radius: 8px;
      padding: 14px 16px;
      margin-bottom: 18px;
    }

    .plan-title {
      font-size: 18px;
      font-weight: 700;
      color: #08090C;
      margin-bottom: 6px;
    }

    .plan-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 12px;
    }

    .tag {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: 4px;
      letter-spacing: 0.4px;
    }

    .tag-goal {
      background: #E8A020;
      color: #FFFFFF;
    }

    .tag-diet {
      background: #EAE5E0;
      color: #3A3128;
    }

    .tag-budget {
      background: #E8F5E9;
      color: #2E7D32;
    }

    /* Macro Targets Grid */
    .targets-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      border-top: 1px solid #EAE5E0;
      padding-top: 10px;
    }

    .target-box {
      text-align: center;
      padding: 6px 4px;
      background: #FFFFFF;
      border-radius: 6px;
      border: 1px solid #ECE7E1;
    }

    .target-value {
      font-size: 15px;
      font-weight: 800;
      color: #08090C;
    }

    .target-label {
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      color: #777777;
      margin-top: 2px;
      letter-spacing: 0.3px;
    }

    /* Meal Schedule Section */
    .section-heading {
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #08090C;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .section-heading::after {
      content: "";
      flex: 1;
      height: 1px;
      background: #EAE5E0;
    }

    /* Meal Card */
    .meal-card {
      background: #FFFFFF;
      border: 1px solid #E2DCD5;
      border-left: 4px solid #E8A020;
      border-radius: 6px;
      padding: 12px 14px;
      margin-bottom: 14px;
    }

    .meal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }

    .meal-type-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      font-weight: 700;
      color: #3A3128;
    }

    .meal-badges {
      display: flex;
      gap: 6px;
      align-items: center;
    }

    .badge {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 4px;
    }

    .calorie-badge {
      background: #FFF3DC;
      color: #9E6400;
      border: 1px solid #F3DFC1;
    }

    .cost-badge {
      background: #E8F5E9;
      color: #2E7D32;
      border: 1px solid #C8E6C9;
    }

    .dish-title {
      font-size: 14px;
      font-weight: 700;
      color: #08090C;
      margin-bottom: 4px;
    }

    .macro-split {
      font-size: 11px;
      font-weight: 600;
      color: #666666;
      margin-bottom: 8px;
    }

    .macro-bar-container {
      display: flex;
      gap: 8px;
      margin-bottom: 10px;
    }

    .macro-pill {
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 3px;
    }

    .p-pill { background: #E8F5E9; color: #1B5E20; border: 1px solid #C8E6C9; }
    .c-pill { background: #FFF8E1; color: #B78103; border: 1px solid #FFE082; }
    .f-pill { background: #FFEBEE; color: #B71C1C; border: 1px solid #FFCDD2; }

    .section-block {
      margin-top: 8px;
      padding-top: 6px;
      border-top: 1px dashed #EAE5E0;
    }

    .section-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #777777;
      margin-bottom: 4px;
    }

    .ingredients-list {
      list-style-type: square;
      padding-left: 18px;
      font-size: 11px;
      color: #333333;
    }

    .ingredients-list li {
      margin-bottom: 2px;
    }

    .recipe-text {
      font-size: 11px;
      color: #444444;
      line-height: 1.4;
    }

    .empty-meals {
      text-align: center;
      padding: 24px;
      color: #888888;
      font-style: italic;
    }

    /* Footer */
    .document-footer {
      border-top: 1px solid #EAE5E0;
      margin-top: 20px;
      padding-top: 10px;
      text-align: center;
      font-size: 10px;
      color: #888888;
    }

    .document-footer strong {
      color: #08090C;
    }
  </style>
</head>
<body>
  <div class="brand-header">
    <div>
      <div class="brand-logo-title">FIT<span>SCAN</span></div>
      <div class="brand-subtitle">AI Nutrition &amp; Fitness Coach</div>
    </div>
    <div class="header-metadata">
      <div class="header-date">${escapeHtml(exportDate)}</div>
      <div class="header-tagline">Personalized Nutrition Plan</div>
    </div>
  </div>

  <div class="plan-hero">
    <div class="plan-title">${escapeHtml(planTitle)}</div>
    <div class="plan-tags">
      <span class="tag tag-goal">Goal: ${escapeHtml(goalType)}</span>
      <span class="tag tag-diet">Diet: ${escapeHtml(dietType)}</span>
      <span class="tag tag-budget">Budget: ${escapeHtml(dailyBudget)}</span>
    </div>

    <div class="targets-grid">
      <div class="target-box">
        <div class="target-value">${dailyCalories}</div>
        <div class="target-label">Daily Calories</div>
      </div>
      <div class="target-box">
        <div class="target-value">${proteinG}g</div>
        <div class="target-label">Protein</div>
      </div>
      <div class="target-box">
        <div class="target-value">${carbsG}g</div>
        <div class="target-label">Carbohydrates</div>
      </div>
      <div class="target-box">
        <div class="target-value">${fatG}g</div>
        <div class="target-label">Fats</div>
      </div>
    </div>
  </div>

  <div class="section-heading">Scheduled Meals &amp; Recipes</div>

  ${mealsHtml}

  <div class="document-footer">
    Generated by <strong>CoreControl</strong> • AI Nutrition Coach • Personalized Meal Plan
  </div>
</body>
</html>`;
}

/**
 * Generates and exports the meal plan as a PDF file, triggering native sharing or print dialogue.
 *
 * @param {object|null} selectedPlan - Active meal plan
 * @param {object|null} [userSettings={}] - User settings & nutrition goals
 * @returns {Promise<string>} File URI of the generated PDF
 */
export async function exportMealPlanPdf(selectedPlan, userSettings = {}) {
  const html = generateMealPlanHtml(selectedPlan, userSettings);
  const { uri } = await Print.printToFileAsync({ html });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      UTI: '.pdf',
      dialogTitle: 'CoreControl Meal Plan',
    });
  } else {
    await Print.printAsync({ html });
  }

  return uri;
}
