import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Platform,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getDailySummary,
  logMeal,
  deleteMeal,
  getSettings,
  logWeight,
  getStepHistory,
} from '../services/api';

import { useFocusEffect } from '@react-navigation/native';

export default function HomeScreen({ navigation, user, onLogout }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rawInput, setRawInput] = useState('');
  const [mealType, setMealType] = useState('lunch');
  const [submitting, setSubmitting] = useState(false);
  const [newWeight, setNewWeight] = useState('');

  const formatDateStr = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const isToday = formatDateStr(selectedDate) === formatDateStr(new Date());

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const dateStr = formatDateStr(selectedDate);
      const sumData = await getDailySummary(dateStr);
      setSummary(sumData);
    } catch (err) {
      console.warn('Dashboard load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleLogMeal = async () => {
    if (!rawInput.trim()) {
      Alert.alert('Empty Input', 'Please type a meal description or use photo scan.');
      return;
    }
    setSubmitting(true);
    try {
      const dateStr = formatDateStr(selectedDate);
      await logMeal(rawInput.trim(), mealType, dateStr);
      setRawInput('');
      Alert.alert('Success! 🎉', 'Meal logged and macros updated.');
      await loadData();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to log meal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMeal = async (mealId) => {
    Alert.alert('Delete Meal', 'Are you sure you want to remove this meal?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMeal(mealId);
            await loadData();
          } catch (err) {
            Alert.alert('Error', 'Failed to delete meal');
          }
        },
      },
    ]);
  };

  const handleQuickLogWeight = async () => {
    const w = parseFloat(newWeight);
    if (!w || w < 20 || w > 300) {
      Alert.alert('Invalid Weight', 'Please enter a valid weight in kg (e.g. 72.5)');
      return;
    }
    try {
      await logWeight(w);
      setNewWeight('');
      Alert.alert('Weight Saved ⚖️', `Logged ${w} kg`);
      await loadData();
    } catch (err) {
      Alert.alert('Error', 'Failed to log weight');
    }
  };

  const consumedCals = summary?.total_calories || 0;
  const goalCals = summary?.calorie_goal || 2000;
  const calPercent = Math.min((consumedCals / goalCals) * 100, 100).toFixed(0);

  const dateLabel = selectedDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <View>
          <View style={styles.logoRow}>
            <Text style={styles.logoIcon}>🏋️</Text>
            <Text style={styles.logoText}>FitScan</Text>
          </View>
          <Text style={styles.dateLabel}>{dateLabel}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor="#58a6ff" />}
      >
        {/* Calorie Progress Circle Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🔥 Calorie Summary</Text>
          <View style={styles.calsRow}>
            <View style={styles.calCircle}>
              <Text style={styles.calCircleVal}>{consumedCals}</Text>
              <Text style={styles.calCircleSub}>of {goalCals} kcal</Text>
            </View>

            <View style={styles.calsDetails}>
              <View style={styles.calStatBox}>
                <Text style={styles.calStatVal}>{consumedCals}</Text>
                <Text style={styles.calStatLbl}>Consumed</Text>
              </View>
              <View style={styles.calStatBox}>
                <Text style={[styles.calStatVal, { color: summary?.remaining_calories < 0 ? '#f85149' : '#3fb950' }]}>
                  {summary?.remaining_calories ?? goalCals}
                </Text>
                <Text style={styles.calStatLbl}>Remaining</Text>
              </View>
            </View>
          </View>

          {/* Calorie Bar */}
          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: `${calPercent}%` }]} />
          </View>
        </View>

        {/* Macro Progress Bars */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🥗 Macronutrients</Text>
          
          {/* Protein */}
          <View style={styles.macroBlock}>
            <View style={styles.macroHeader}>
              <Text style={styles.macroName}>🥩 Protein</Text>
              <Text style={styles.macroValue}>
                {summary?.total_protein || 0}g / {summary?.protein_goal || 150}g
              </Text>
            </View>
            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: `${Math.min(((summary?.total_protein || 0) / (summary?.protein_goal || 150)) * 100, 100)}%`, backgroundColor: '#7BA05B' }]} />
            </View>
          </View>

          {/* Carbs */}
          <View style={styles.macroBlock}>
            <View style={styles.macroHeader}>
              <Text style={styles.macroName}>🌾 Carbs</Text>
              <Text style={styles.macroValue}>
                {summary?.total_carbs || 0}g / {summary?.carbs_goal || 200}g
              </Text>
            </View>
            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: `${Math.min(((summary?.total_carbs || 0) / (summary?.carbs_goal || 200)) * 100, 100)}%`, backgroundColor: '#D9A441' }]} />
            </View>
          </View>

          {/* Fat */}
          <View style={styles.macroBlock}>
            <View style={styles.macroHeader}>
              <Text style={styles.macroName}>🥑 Fat</Text>
              <Text style={styles.macroValue}>
                {summary?.total_fat || 0}g / {summary?.fat_goal || 65}g
              </Text>
            </View>
            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: `${Math.min(((summary?.total_fat || 0) / (summary?.fat_goal || 65)) * 100, 100)}%`, backgroundColor: '#C7502F' }]} />
            </View>
          </View>
        </View>

        {/* Quick Log Meal Section */}
        {isToday && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>✍️ Quick Log Meal</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 2 eggs, 1 toast with butter"
              placeholderTextColor="#A79A85"
              value={rawInput}
              onChangeText={setRawInput}
            />

            {/* Meal Type Buttons */}
            <View style={styles.typeRow}>
              {['breakfast', 'lunch', 'snack', 'dinner'].map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeBtn, mealType === t && styles.typeBtnActive]}
                  onPress={() => setMealType(t)}
                >
                  <Text style={[styles.typeBtnText, mealType === t && styles.typeBtnTextActive]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.actionBtnRow}>
              <TouchableOpacity style={styles.submitBtn} onPress={handleLogMeal} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#221803" /> : <Text style={styles.submitBtnText}>Log Meal</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.scanBtn} onPress={() => navigation.navigate('Scan', { mealDate: formatDateStr(selectedDate) })}>
                <Text style={styles.scanBtnText}>📸 Scan Photo</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Logged Meals List */}
        <View style={styles.card}>
          <View style={styles.mealsHeader}>
            <Text style={styles.cardTitle}>🍽️ Logged Meals</Text>
            <Text style={styles.mealCountBadge}>{summary?.meal_count || 0} meals</Text>
          </View>

          {summary?.meals?.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>🍽️</Text>
              <Text style={styles.emptyText}>No meals logged for this date</Text>
            </View>
          ) : (
            summary?.meals?.map((m) => (
              <View key={m.id} style={styles.mealItem}>
                <View style={styles.mealItemHeader}>
                  <Text style={styles.mealTypeBadge}>{m.meal_type.toUpperCase()}</Text>
                  <Text style={styles.mealCals}>{m.total_calories} kcal</Text>
                </View>
                <Text style={styles.mealInputText}>{m.raw_input}</Text>
                <Text style={styles.mealMacroSub}>
                  P: {m.total_protein}g | C: {m.total_carbs}g | F: {m.total_fat}g
                </Text>
                {isToday && (
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteMeal(m.id)}>
                    <Text style={styles.deleteText}>🗑️ Delete</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>
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
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#221D17',
    borderBottomWidth: 1,
    borderBottomColor: '#3A3128',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logoIcon: {
    fontSize: 22,
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#E8A020',
  },
  dateLabel: {
    fontSize: 12,
    color: '#A79A85',
    marginTop: 2,
  },
  navRow: {
    flexDirection: 'row',
    gap: 8,
  },
  navBtn: {
    backgroundColor: '#2C251D',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  navBtnText: {
    color: '#F4ECDD',
    fontSize: 12,
    fontWeight: '600',
  },
  scroll: {
    padding: 16,
  },
  card: {
    backgroundColor: '#221D17',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F4ECDD',
    marginBottom: 14,
  },
  calsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  calCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#181410',
    borderWidth: 4,
    borderColor: '#E8A020',
    justifyContent: 'center',
    alignItems: 'center',
  },
  calCircleVal: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#F4ECDD',
  },
  calCircleSub: {
    fontSize: 10,
    color: '#A79A85',
  },
  calsDetails: {
    flex: 1,
    marginLeft: 20,
    gap: 12,
  },
  calStatBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calStatVal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F4ECDD',
  },
  calStatLbl: {
    fontSize: 13,
    color: '#A79A85',
  },
  barBg: {
    height: 8,
    backgroundColor: '#2C251D',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#E8A020',
    borderRadius: 4,
  },
  macroBlock: {
    marginBottom: 12,
  },
  macroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  macroName: {
    fontSize: 13,
    color: '#F4ECDD',
  },
  macroValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F4ECDD',
  },
  input: {
    backgroundColor: '#2C251D',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3A3128',
    color: '#F4ECDD',
    padding: 12,
    fontSize: 14,
    marginBottom: 12,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  typeBtn: {
    flex: 1,
    backgroundColor: '#2C251D',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  typeBtnActive: {
    backgroundColor: '#E8A020',
    borderColor: '#E8A020',
  },
  typeBtnText: {
    color: '#A79A85',
    fontSize: 11,
    fontWeight: '600',
  },
  typeBtnTextActive: {
    color: '#221803',
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  submitBtn: {
    flex: 1,
    backgroundColor: '#E8A020',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#221803',
    fontSize: 14,
    fontWeight: 'bold',
  },
  scanBtn: {
    backgroundColor: '#2C251D',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  scanBtnText: {
    color: '#F4ECDD',
    fontSize: 14,
    fontWeight: '600',
  },
  weightRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  weightBtn: {
    backgroundColor: '#E8A020',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  weightBtnText: {
    color: '#221803',
    fontSize: 14,
    fontWeight: 'bold',
  },
  mealsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  mealCountBadge: {
    fontSize: 12,
    color: '#A79A85',
    backgroundColor: '#2C251D',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyText: {
    color: '#A79A85',
    fontSize: 13,
  },
  mealItem: {
    backgroundColor: '#181410',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  mealItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  mealTypeBadge: {
    color: '#E8A020',
    fontSize: 11,
    fontWeight: 'bold',
  },
  mealCals: {
    color: '#7BA05B',
    fontSize: 13,
    fontWeight: 'bold',
  },
  mealInputText: {
    color: '#F4ECDD',
    fontSize: 14,
    marginBottom: 4,
  },
  mealMacroSub: {
    color: '#A79A85',
    fontSize: 12,
  },
  deleteBtn: {
    marginTop: 8,
    alignSelf: 'flex-end',
  },
  deleteText: {
    color: '#C7502F',
    fontSize: 12,
  },
});
