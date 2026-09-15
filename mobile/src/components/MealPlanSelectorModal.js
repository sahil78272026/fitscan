import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { getSuggestedMealPlans, selectMealPlan } from '../services/api';

export default function MealPlanSelectorModal({ visible, onClose, onPlanSelected }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchPlans();
    }
  }, [visible]);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const data = await getSuggestedMealPlans();
      setPlans(data?.plans || []);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to generate AI meal plans');
    } finally {
      setLoading(false);
    }
  };

  const handleChoosePlan = async (plan) => {
    setSelecting(true);
    try {
      const updated = await selectMealPlan(plan);
      Alert.alert('Meal Plan Activated! 🎯', `Activated: ${plan.title}`);
      onPlanSelected(updated);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to activate meal plan');
    } finally {
      setSelecting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        <View style={styles.modalHeader}>
          <Text style={styles.headerTitle}>✨ AI Meal Plan Generator</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeText}>✕ Close</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color="#58a6ff" />
            <Text style={styles.loaderText}>Generating personalized AI Meal Plans...</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={styles.subtext}>
              Choose from AI-crafted meal plans tailored to your specific calorie & macro targets:
            </Text>

            {plans.map((plan, idx) => (
              <View key={idx} style={styles.planCard}>
                <View style={styles.planCardHeader}>
                  <Text style={styles.planTitle}>{plan.title}</Text>
                  {plan.estimated_cost && (
                    <Text style={styles.costBadge}>💰 {plan.estimated_cost}</Text>
                  )}
                </View>

                <Text style={styles.planTagline}>{plan.tagline}</Text>

                <View style={styles.macroRow}>
                  <View style={styles.macroBox}>
                    <Text style={styles.macroVal}>{plan.daily_calories} kcal</Text>
                    <Text style={styles.macroLbl}>Calories</Text>
                  </View>
                  <View style={styles.macroBox}>
                    <Text style={[styles.macroVal, { color: '#ff7b72' }]}>{plan.protein_g}g</Text>
                    <Text style={styles.macroLbl}>Protein</Text>
                  </View>
                  <View style={styles.macroBox}>
                    <Text style={[styles.macroVal, { color: '#d29922' }]}>{plan.carbs_g}g</Text>
                    <Text style={styles.macroLbl}>Carbs</Text>
                  </View>
                  <View style={styles.macroBox}>
                    <Text style={[styles.macroVal, { color: '#a5d6ff' }]}>{plan.fat_g}g</Text>
                    <Text style={styles.macroLbl}>Fat</Text>
                  </View>
                </View>

                {/* Meals preview */}
                <View style={styles.mealsPreview}>
                  {plan.meals?.map((m, mIdx) => (
                    <Text key={mIdx} style={styles.mealPreviewItem}>
                      • <Text style={{ fontWeight: 'bold', color: '#c9d1d9' }}>{m.meal_type}</Text>: {m.dish_name} ({m.calories} kcal)
                    </Text>
                  ))}
                </View>

                <TouchableOpacity
                  style={styles.selectBtn}
                  onPress={() => handleChoosePlan(plan)}
                  disabled={selecting}
                >
                  {selecting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.selectBtnText}>Select & Activate Plan →</Text>
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1117',
    paddingTop: 44,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#161b22',
    borderBottomWidth: 1,
    borderBottomColor: '#30363d',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f0f6fc',
  },
  closeText: {
    color: '#8b949e',
    fontSize: 14,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    color: '#8b949e',
    fontSize: 14,
    marginTop: 12,
  },
  scroll: {
    padding: 16,
  },
  subtext: {
    color: '#8b949e',
    fontSize: 13,
    marginBottom: 16,
  },
  planCard: {
    backgroundColor: '#161b22',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  planCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#58a6ff',
    flex: 1,
  },
  costBadge: {
    color: '#3fb950',
    fontSize: 12,
    fontWeight: 'bold',
    backgroundColor: '#0d1117',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  planTagline: {
    fontSize: 12,
    color: '#8b949e',
    marginBottom: 14,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#0d1117',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  macroBox: {
    alignItems: 'center',
  },
  macroVal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f0f6fc',
  },
  macroLbl: {
    fontSize: 10,
    color: '#8b949e',
    marginTop: 2,
  },
  mealsPreview: {
    gap: 4,
    marginBottom: 14,
  },
  mealPreviewItem: {
    fontSize: 12,
    color: '#8b949e',
  },
  selectBtn: {
    backgroundColor: '#238636',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  selectBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
