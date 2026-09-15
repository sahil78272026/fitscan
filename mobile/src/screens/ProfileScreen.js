import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getSettings, logWeight } from '../services/api';
import OnboardingModal from '../components/OnboardingModal';
import MealPlanSelectorModal from '../components/MealPlanSelectorModal';

export default function ProfileScreen({ navigation, user, onLogout }) {
  const [userSettings, setUserSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [weightInput, setWeightInput] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [planSelectorOpen, setPlanSelectorOpen] = useState(false);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const settings = await getSettings();
      setUserSettings(settings);
    } catch (err) {
      console.warn('Profile load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleUpdateWeight = async () => {
    const w = parseFloat(weightInput);
    if (!w || w < 20 || w > 300) {
      Alert.alert('Invalid Weight', 'Please enter a valid weight in kg');
      return;
    }
    try {
      await logWeight(w);
      setWeightInput('');
      Alert.alert('Success ⚖️', `Updated weight to ${w} kg`);
      await fetchSettings();
    } catch (err) {
      Alert.alert('Error', 'Failed to update weight');
    }
  };

  const handleWizardComplete = async (updatedSettings) => {
    setUserSettings(updatedSettings);
    setWizardOpen(false);
    setPlanSelectorOpen(true);
  };

  const handlePlanSelected = (updatedSettings) => {
    setUserSettings(updatedSettings);
    setPlanSelectorOpen(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#58a6ff" />
          <Text style={styles.loaderText}>Loading Profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const selectedPlan = userSettings?.selected_meal_plan;

  return (
    <SafeAreaView style={styles.container}>
      {/* Onboarding Wizard Modal */}
      <OnboardingModal
        visible={wizardOpen}
        initialSettings={userSettings}
        onClose={() => setWizardOpen(false)}
        onComplete={handleWizardComplete}
      />

      {/* AI Meal Plan Generator Modal */}
      <MealPlanSelectorModal
        visible={planSelectorOpen}
        onClose={() => setPlanSelectorOpen(false)}
        onPlanSelected={handlePlanSelected}
      />

      {/* Navigation Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>← Tracker</Text>
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Profile & Goals</Text>
        <TouchableOpacity style={styles.mealPlanBtn} onPress={() => navigation.navigate('Meals')}>
          <Text style={styles.mealPlanBtnText}>📋 Schedule</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* User Card */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.name || user?.phone || 'U')[0].toUpperCase()}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name || 'FitScan User'}</Text>
            <Text style={styles.userPhone}>{user?.phone || 'Phone Not Provided'}</Text>
          </View>
        </View>

        {/* Active Selected Meal Plan Section */}
        <View style={styles.activePlanCard}>
          <View style={styles.planBadge}>
            <Text style={styles.planBadgeText}>Active Meal Plan</Text>
          </View>

          <Text style={styles.planTitle}>{selectedPlan?.title || 'No Meal Plan Selected'}</Text>
          <Text style={styles.planTagline}>
            {selectedPlan?.tagline || 'Set your physical metrics to generate AI daily meal plans'}
          </Text>

          {selectedPlan && (
            <View style={styles.macroPills}>
              <View style={styles.macroPill}>
                <Text style={styles.macroPillText}>Target: {userSettings?.calorie_goal || selectedPlan.daily_calories} kcal</Text>
              </View>
              <View style={styles.macroPill}>
                <Text style={styles.macroPillText}>Protein: {userSettings?.protein_goal || selectedPlan.protein_g}g</Text>
              </View>
              <View style={styles.macroPill}>
                <Text style={styles.macroPillText}>Carbs: {userSettings?.carbs_goal || selectedPlan.carbs_g}g</Text>
              </View>
              <View style={styles.macroPill}>
                <Text style={styles.macroPillText}>Fat: {userSettings?.fat_goal || selectedPlan.fat_g}g</Text>
              </View>
            </View>
          )}

          {/* Action Buttons matching Web */}
          <View style={styles.actionBtnStack}>
            {selectedPlan && (
              <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('Meals')}>
                <Text style={styles.primaryBtnText}>📖 View Full Meal Plan Schedule →</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.generatorBtn} onPress={() => setPlanSelectorOpen(true)}>
              <Text style={styles.generatorBtnText}>
                ✨ {selectedPlan ? 'Change AI Meal Plan' : 'Generate AI Meal Plans'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setWizardOpen(true)}>
              <Text style={styles.secondaryBtnText}>⚙️ Re-run Onboarding & Goals</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Personal Metrics Grid matching Web */}
        <Text style={styles.sectionTitle}>📋 Personal Metrics & Preferences</Text>
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Goal Type</Text>
            <Text style={styles.metricValue}>
              {(userSettings?.goal_type || 'fat_loss').replace('_', ' ').toUpperCase()}
            </Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Diet Type</Text>
            <Text style={styles.metricValue}>
              {(userSettings?.diet_type || 'veg').replace('_', ' ').toUpperCase()}
            </Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Budget Tier</Text>
            <Text style={styles.metricValue}>
              {(userSettings?.budget_tier || 'moderate').replace('_', ' ').toUpperCase()}
            </Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Current Weight</Text>
            <Text style={styles.metricValue}>
              {userSettings?.weight_kg ? `${userSettings.weight_kg} kg` : 'Not Set'}
            </Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Height</Text>
            <Text style={styles.metricValue}>
              {userSettings?.height_cm ? `${userSettings.height_cm} cm` : 'Not Set'}
            </Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Activity</Text>
            <Text style={styles.metricValue}>
              {(userSettings?.activity_level || 'moderate').replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Quick Log Weight Card */}
        <Text style={styles.sectionTitle}>⚖️ Update Current Weight</Text>
        <View style={styles.card}>
          <View style={styles.weightRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder="e.g. 74.5"
              placeholderTextColor="#6e7681"
              keyboardType="decimal-pad"
              value={weightInput}
              onChangeText={setWeightInput}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={handleUpdateWeight}>
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Account Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutBtnText}>🚪 Logout of Account</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#181410',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 0,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderText: {
    color: '#A79A85',
    fontSize: 14,
    marginTop: 10,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#221D17',
    borderBottomWidth: 1,
    borderBottomColor: '#3A3128',
  },
  backBtn: {
    padding: 6,
  },
  backBtnText: {
    color: '#E8A020',
    fontSize: 13,
    fontWeight: '600',
  },
  pageTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F4ECDD',
  },
  mealPlanBtn: {
    padding: 6,
  },
  mealPlanBtnText: {
    color: '#A79A85',
    fontSize: 13,
    fontWeight: '600',
  },
  scroll: {
    padding: 16,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#221D17',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2C251D',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  avatarText: {
    color: '#E8A020',
    fontSize: 20,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F4ECDD',
  },
  userPhone: {
    fontSize: 13,
    color: '#A79A85',
    marginTop: 2,
  },
  activePlanCard: {
    backgroundColor: '#221D17',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E8A020',
  },
  planBadge: {
    backgroundColor: '#2C251D',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 8,
  },
  planBadgeText: {
    color: '#E8A020',
    fontSize: 11,
    fontWeight: 'bold',
  },
  planTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F4ECDD',
    marginBottom: 4,
  },
  planTagline: {
    fontSize: 12,
    color: '#A79A85',
    marginBottom: 12,
  },
  macroPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  macroPill: {
    backgroundColor: '#181410',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  macroPillText: {
    color: '#F4ECDD',
    fontSize: 11,
  },
  actionBtnStack: {
    gap: 8,
  },
  primaryBtn: {
    backgroundColor: '#E8A020',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#221803',
    fontSize: 13,
    fontWeight: 'bold',
  },
  generatorBtn: {
    backgroundColor: '#E8A020',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  generatorBtnText: {
    color: '#221803',
    fontSize: 13,
    fontWeight: 'bold',
  },
  secondaryBtn: {
    backgroundColor: '#2C251D',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  secondaryBtnText: {
    color: '#F4ECDD',
    fontSize: 13,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#F4ECDD',
    marginBottom: 10,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#221D17',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  metricLabel: {
    fontSize: 11,
    color: '#A79A85',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#F4ECDD',
  },
  card: {
    backgroundColor: '#221D17',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  weightRow: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    backgroundColor: '#181410',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3A3128',
    color: '#F4ECDD',
    padding: 10,
    fontSize: 14,
  },
  saveBtn: {
    backgroundColor: '#E8A020',
    borderRadius: 8,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#221803',
    fontSize: 14,
    fontWeight: 'bold',
  },
  logoutBtn: {
    backgroundColor: '#221D17',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C7502F',
    marginTop: 10,
    marginBottom: 30,
  },
  logoutBtnText: {
    color: '#C7502F',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
