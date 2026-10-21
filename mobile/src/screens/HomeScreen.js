import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Animated,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Platform,
  StatusBar,
  Alert,
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getDailySummary,
  getCalendarMonth,
  getAdherenceStats,
  getMorningBriefing,
  logMeal,
  deleteMeal,
  getSettings,
  logWeight,
  getStepHistory,
  getDailySteps,
  logSteps,
} from '../services/api';
import {
  syncStepsToBackend,
  checkHealthConnectAvailable,
  requestHealthConnectPermissions,
  checkHealthConnectPermissionsGranted,
  getHealthConnectDailyMetrics,
} from '../services/pedometer';
import AdherenceCard from '../components/AdherenceCard';
import MorningBriefingCard from '../components/MorningBriefingCard';
import OnboardingModal from '../components/OnboardingModal';
import MealPlanSelectorModal from '../components/MealPlanSelectorModal';
import MissedMealBanner from '../components/MissedMealBanner';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const [previewImage, setPreviewImage] = useState(null);

  // Summary Tab & Health Connect State
  const [summaryTab, setSummaryTab] = useState('calories');
  const [stepData, setStepData] = useState({ step_count: 0, calories_burned: 0 });
  const [healthConnectAvailable, setHealthConnectAvailable] = useState(false);
  const [healthConnectConnected, setHealthConnectConnected] = useState(false);

  // Calendar State
  const [calendarData, setCalendarData] = useState(null);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth() + 1);

  // Adherence & Streak State
  const [adherenceStats, setAdherenceStats] = useState(null);

  // Morning Briefing State
  const [morningBriefing, setMorningBriefing] = useState(null);
  const [briefingDismissed, setBriefingDismissed] = useState(false);

  // Onboarding & Meal Plan State
  const [wizardOpen, setWizardOpen] = useState(false);
  const [planSelectorOpen, setPlanSelectorOpen] = useState(false);
  const [userSettings, setUserSettings] = useState(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const hasCheckedOnboarding = React.useRef(false);

  // Animated scroll tracking for buttery-smooth header streak transition
  const scrollY = useRef(new Animated.Value(0)).current;

  const headerStreakOpacity = scrollY.interpolate({
    inputRange: [25, 60],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const headerStreakTranslateY = scrollY.interpolate({
    inputRange: [25, 60],
    outputRange: [6, 0],
    extrapolate: 'clamp',
  });

  const headerStreakScale = scrollY.interpolate({
    inputRange: [25, 60],
    outputRange: [0.85, 1],
    extrapolate: 'clamp',
  });

  const handleScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const scrolled = offsetY > 25;
    if (scrolled !== isScrolled) {
      setIsScrolled(scrolled);
    }
  };

  const formatDateStr = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const isToday = formatDateStr(selectedDate) === formatDateStr(new Date());

  const fetchCalendar = useCallback(async (y, m) => {
    try {
      const res = await getCalendarMonth(y, m);
      setCalendarData(res);
    } catch (err) {
      console.warn('Calendar fetch error:', err);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const dateStr = formatDateStr(selectedDate);
      const sumData = await getDailySummary(dateStr);
      setSummary(sumData);
      
      const selYear = selectedDate.getFullYear();
      const selMonth = selectedDate.getMonth() + 1;
      setCalendarYear(selYear);
      setCalendarMonth(selMonth);

      // Fetch calendar, adherence streak stats, daily steps, and check onboarding status
      const promises = [
        fetchCalendar(selYear, selMonth),
        getAdherenceStats().then(setAdherenceStats).catch(() => null),
        (async () => {
          try {
            const hcAvail = await checkHealthConnectAvailable();
            setHealthConnectAvailable(hcAvail);
            if (hcAvail) {
              const hcGranted = await checkHealthConnectPermissionsGranted();
              setHealthConnectConnected(hcGranted);
              if (hcGranted) {
                const hcData = await getHealthConnectDailyMetrics(selectedDate);
                if (hcData && typeof hcData.steps === 'number') {
                  setStepData({
                    step_count: hcData.steps,
                    calories_burned: hcData.calories,
                  });
                  if (isToday && hcData.steps > 0) {
                    syncStepsToBackend(hcData.steps);
                  }
                  return;
                }
              }
            }
          } catch (hcErr) {
            console.warn('Health Connect load error:', hcErr);
          }

          // Fallback to backend recorded steps
          try {
            const res = await getDailySteps(dateStr);
            if (res) {
              setStepData({
                step_count: res.step_count || 0,
                calories_burned: res.calories_burned || 0,
              });
            }
          } catch (e) {
            // ignore
          }
        })(),
        getSettings().then((settings) => {
          setUserSettings(settings);
          // Until a user fixes their metrics, it reappears:
          if (!settings?.height_cm || !settings?.weight_kg) {
            setWizardOpen(true);
          } else if (!settings?.selected_meal_plan && !hasCheckedOnboarding.current) {
            hasCheckedOnboarding.current = true;
            setPlanSelectorOpen(true);
          }
        }).catch(() => null),
      ];

      if (isToday) {
        promises.push(
          (async () => {
            try {
              const todayStr = formatDateStr(new Date());
              const dismissed = await AsyncStorage.getItem('briefing_dismissed_date');
              if (dismissed === todayStr) {
                setBriefingDismissed(true);
                return;
              }
              const briefingRes = await getMorningBriefing();
              if (briefingRes && briefingRes.visible && briefingRes.briefing) {
                setMorningBriefing(briefingRes);
              }
            } catch (bErr) {
              // fail silently
            }
          })()
        );
      }

      await Promise.all(promises);
    } catch (err) {
      console.warn('Dashboard load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate, fetchCalendar]);

  const handleWizardComplete = (updatedSettings) => {
    setUserSettings(updatedSettings);
    setWizardOpen(false);
    setPlanSelectorOpen(true);
  };

  const handlePlanSelected = (updatedSettings) => {
    setUserSettings(updatedSettings);
    setPlanSelectorOpen(false);
    loadData();
  };

  const handleTriggerMealLog = (targetType, defaultDish) => {
    if (targetType) {
      setMealType(targetType.toLowerCase());
    }
    if (defaultDish) {
      setRawInput(defaultDish);
    }
  };

  // Automatically reload data whenever selectedDate changes
  useEffect(() => {
    loadData();
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
    if (!w || w < 25 || w > 300) {
      Alert.alert('Invalid Weight', 'Please enter a valid weight between 25 and 300 kg');
      return;
    }
    try {
      await logWeight(w);
      setNewWeight('');
      Alert.alert('Weight Saved', `Logged ${w} kg`);
      await loadData();
    } catch (err) {
      Alert.alert('Error', 'Failed to log weight');
    }
  };

  const handleConnectHealthConnect = async () => {
    try {
      const granted = await requestHealthConnectPermissions();
      if (granted) {
        setHealthConnectConnected(true);
        const hcData = await getHealthConnectDailyMetrics(selectedDate);
        if (hcData && typeof hcData.steps === 'number') {
          setStepData({
            step_count: hcData.steps,
            calories_burned: hcData.calories,
          });
          if (isToday && hcData.steps > 0) {
            syncStepsToBackend(hcData.steps);
          }
        }
        Alert.alert('Health Connect Connected! 🎉', 'CoreControl is now syncing 24/7 steps from Google Health Connect.');
      } else {
        Alert.alert('Permission Needed', 'Health Connect permissions were not granted. You can manage access in Android Settings > Security & Privacy > Health Connect.');
      }
    } catch (err) {
      Alert.alert('Health Connect', err.message || 'Could not connect to Health Connect.');
    }
  };

  const consumedCals = summary?.total_calories || 0;
  const goalCals = summary?.calorie_goal || 2000;
  const calPercent = Math.min((consumedCals / goalCals) * 100, 100).toFixed(0);

  const stepGoal = 10000;
  const currentSteps = stepData?.step_count || 0;
  const stepPercent = Math.min((currentSteps / stepGoal) * 100, 100).toFixed(0);
  const distanceKm = (((stepData?.step_count || 0) * 0.762) / 1000).toFixed(2);

  const dateLabel = selectedDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={[styles.topHeader, isScrolled && styles.topHeaderShadow]}>
        <View style={styles.logoRow}>
          <Text style={styles.logoIcon}>🏋️</Text>
          <Text style={styles.logoText}>CoreControl</Text>
        </View>

        {/* Smooth Animated Streak Pill moving to header when scrolling past banner */}
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.headerCenter,
            {
              opacity: headerStreakOpacity,
              transform: [
                { translateY: headerStreakTranslateY },
                { scale: headerStreakScale },
              ],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.streakHeaderPill}
            onPress={() => navigation.navigate('Progress')}
            activeOpacity={0.7}
          >
            <Text style={styles.streakHeaderIcon}>🔥</Text>
            <Text style={styles.streakHeaderText}>
              {adherenceStats?.current_streak ?? 0}d
            </Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={styles.headerRight}>
          <Text style={styles.dateLabel}>{dateLabel}</Text>
        </View>
      </View>

      <Animated.ScrollView
        contentContainerStyle={styles.scroll}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true, listener: handleScroll }
        )}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor="#E8A020" />}
      >

        {/* Compact Streak Banner matching Web (stable, non-jerking) */}
        <TouchableOpacity
          style={styles.streakBanner}
          onPress={() => navigation.navigate('Progress')}
          activeOpacity={0.8}
        >
          <Text style={styles.streakBannerText}>
            🔥 <Text style={styles.boldText}>{adherenceStats?.current_streak ?? 0}</Text> day streak
          </Text>
          <Text style={styles.streakDot}>•</Text>
          <Text style={styles.streakBannerSub}>
            {Math.round(adherenceStats?.weekly_adherence_score ?? 0)}% weekly
          </Text>
          <Text style={styles.streakArrow}>→</Text>
        </TouchableOpacity>

        {/* Calorie & Pedometer Summary Card (Google Fit Style) */}
        <View style={styles.card}>
          {/* Segmented Tab Switcher */}
          <View style={styles.summaryTabContainer}>
            <TouchableOpacity
              style={[
                styles.summaryTabBtn,
                summaryTab === 'calories' && styles.summaryTabBtnActiveCal,
              ]}
              onPress={() => setSummaryTab('calories')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.summaryTabText,
                  summaryTab === 'calories' && styles.summaryTabTextActive,
                ]}
              >
                🔥 Calories
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.summaryTabBtn,
                summaryTab === 'steps' && styles.summaryTabBtnActiveStep,
              ]}
              onPress={() => setSummaryTab('steps')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.summaryTabText,
                  summaryTab === 'steps' && styles.summaryTabTextActive,
                ]}
              >
                👟 Steps
              </Text>
            </TouchableOpacity>
          </View>

          {/* Centered Circular Progress Ring (Tappable -> Opens ActivityDetailScreen) */}
          <TouchableOpacity
            style={styles.fitRingContainer}
            onPress={() =>
              navigation.navigate('ActivityDetail', {
                selectedDate: formatDateStr(selectedDate),
                stepData,
                summary,
                calendarData,
                initialTab: summaryTab,
              })
            }
            activeOpacity={0.85}
          >
            {/* 3D Gauge Outer Casing & Shadow Well */}
            <View
              style={[
                styles.fitRingCasing3D,
                summaryTab === 'steps' ? styles.fitRingCasingSteps : styles.fitRingCasingCals,
              ]}
            >
              <View
                style={[
                  styles.fitRingOuter,
                  summaryTab === 'steps' ? styles.fitRingOuterSteps : styles.fitRingOuterCals,
                ]}
              >
                <View style={styles.fitRingInner}>
                  <Text style={styles.fitRingValue}>
                    {summaryTab === 'calories'
                      ? consumedCals.toLocaleString()
                      : (stepData?.step_count || 0).toLocaleString()}
                  </Text>
                  <Text style={styles.fitRingSub}>
                    {summaryTab === 'calories'
                      ? `of ${goalCals.toLocaleString()} kcal eaten`
                      : `of ${stepGoal.toLocaleString()} steps`}
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>

          {/* 3 Metric Stats Row (Google Fit Style: Cal Eaten • km • Move Min) */}
          <View style={styles.fitStatsRow}>
            <View style={styles.fitStatItem}>
              <Text style={styles.fitStatVal}>
                {consumedCals.toLocaleString()}
              </Text>
              <Text style={styles.fitStatLbl}>Cal Eaten</Text>
            </View>
            <View style={styles.fitStatDivider} />
            <View style={styles.fitStatItem}>
              <Text style={styles.fitStatVal}>{distanceKm}</Text>
              <Text style={styles.fitStatLbl}>km</Text>
            </View>
            <View style={styles.fitStatDivider} />
            <View style={styles.fitStatItem}>
              <Text style={styles.fitStatVal}>
                {Math.round((stepData?.step_count || 0) / 78) || 0}
              </Text>
              <Text style={styles.fitStatLbl}>Move Min</Text>
            </View>
          </View>

          {/* Tap-to-inspect Guidance & Sync Indicator */}
          <TouchableOpacity
            style={styles.fitCardFooter}
            onPress={() =>
              navigation.navigate('ActivityDetail', {
                selectedDate: formatDateStr(selectedDate),
                stepData,
                summary,
                calendarData,
                initialTab: summaryTab,
              })
            }
            activeOpacity={0.7}
          >
            <View style={styles.fitFooterLeft}>
              <View
                style={[
                  styles.fitStatusDot,
                  {
                    backgroundColor: healthConnectConnected ? '#4285F4' : '#A79A85',
                  },
                ]}
              />
              <Text style={styles.fitFooterHint}>
                {healthConnectConnected
                  ? 'Health Connect Synced'
                  : 'Tap ring for hourly breakdown & graphs'}
              </Text>
            </View>
            <Text style={styles.fitFooterArrow}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Macro Progress Bars */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Macronutrients</Text>
          
          {/* Protein */}
          <View style={styles.macroBlock}>
            <View style={styles.macroHeader}>
              <Text style={styles.macroName}>Protein</Text>
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
              <Text style={styles.macroName}>Carbs</Text>
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
              <Text style={styles.macroName}>Fat</Text>
              <Text style={styles.macroValue}>
                {summary?.total_fat || 0}g / {summary?.fat_goal || 65}g
              </Text>
            </View>
            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: `${Math.min(((summary?.total_fat || 0) / (summary?.fat_goal || 65)) * 100, 100)}%`, backgroundColor: '#C7502F' }]} />
            </View>
          </View>
        </View>

        {/* Morning Welcome Feedback & Improvements Card */}
        {isToday && morningBriefing && !briefingDismissed && (
          <MorningBriefingCard
            briefingData={morningBriefing}
            onDismiss={async () => {
              setBriefingDismissed(true);
              const todayStr = formatDateStr(new Date());
              await AsyncStorage.setItem('briefing_dismissed_date', todayStr);
            }}
            onLogBreakfast={() => {
              setMealType('breakfast');
            }}
          />
        )}

        {/* Missed Meal Alert Banner */}
        {isToday && (
          <MissedMealBanner
            user={user}
            userSettings={userSettings}
            summary={summary}
            isToday={isToday}
            onLogMeal={handleTriggerMealLog}
          />
        )}

        {/* Quick Log Meal Section */}
        {isToday && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Quick Log Meal</Text>
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
            <Text style={styles.cardTitle}>Logged Meals</Text>
            <Text style={styles.mealCountBadge}>{summary?.meal_count || 0} meals</Text>
          </View>

          {summary?.meals?.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>🍽️</Text>
              <Text style={styles.emptyText}>No meals logged for this date</Text>
            </View>
          ) : (
            summary?.meals?.map((m) => {
              const dateVal = m.logged_at || m.created_at;
              let mealTimeStr = '';
              if (dateVal) {
                const d = new Date(dateVal);
                if (!isNaN(d.getTime())) {
                  mealTimeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
                }
              }

              return (
                <View key={m.id} style={styles.mealItem}>
                  <View style={styles.mealContentRow}>
                    {m.image_url ? (
                      <TouchableOpacity
                        onPress={() => setPreviewImage(m.image_url)}
                        activeOpacity={0.8}
                        style={styles.mealThumbContainer}
                      >
                        <Image source={{ uri: m.image_url }} style={styles.mealThumb} resizeMode="cover" />
                      </TouchableOpacity>
                    ) : null}
                    <View style={styles.mealTextCol}>
                      <View style={styles.mealItemHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.mealTypeBadge}>{m.meal_type.toUpperCase()}</Text>
                          {mealTimeStr ? <Text style={styles.mealTimeText}>• {mealTimeStr}</Text> : null}
                        </View>
                        <Text style={styles.mealCals}>{m.total_calories} kcal</Text>
                      </View>
                      <Text style={styles.mealInputText}>{m.raw_input}</Text>
                      <Text style={styles.mealMacroSub}>
                        P: {m.total_protein}g | C: {m.total_carbs}g | F: {m.total_fat}g
                      </Text>
                    </View>
                  </View>
                  {isToday && (
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteMeal(m.id)}>
                      <Text style={styles.deleteText}>🗑️ Delete</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
        </View>
      </Animated.ScrollView>

      {/* Meal Image Full Preview Modal */}
      <Modal
        visible={!!previewImage}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}
      >
        <View style={styles.imageModalBg}>
          <TouchableOpacity
            style={styles.imageModalClose}
            onPress={() => setPreviewImage(null)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.imageModalCloseText}>✕ Close</Text>
          </TouchableOpacity>
          {previewImage && (
            <Image
              source={{ uri: previewImage }}
              style={styles.imageModalImg}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* Onboarding Wizard Modal for New Users */}
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
        onBackToWizard={() => {
          setPlanSelectorOpen(false);
          setWizardOpen(true);
        }}
      />

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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1C1712',
    borderBottomWidth: 1,
    borderBottomColor: '#251E17',
    zIndex: 20,
  },
  topHeaderShadow: {
    borderBottomColor: '#3A2E1F',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  headerRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  streakHeaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#271D12',
    borderWidth: 1,
    borderColor: '#E8A020',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 3,
    gap: 4,
    shadowColor: '#E8A020',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 3,
  },
  streakHeaderIcon: {
    fontSize: 12,
  },
  streakHeaderText: {
    color: '#E8A020',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  streakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#221D17',
    borderWidth: 1,
    borderColor: '#3A3128',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
    gap: 8,
  },
  streakBannerText: {
    color: '#F4ECDD',
    fontSize: 13,
  },
  boldText: {
    fontWeight: 'bold',
    color: '#E8A020',
  },
  streakDot: {
    color: '#A79A85',
  },
  streakBannerSub: {
    color: '#A79A85',
    fontSize: 12,
    flex: 1,
  },
  streakArrow: {
    color: '#E8A020',
    fontSize: 14,
    fontWeight: 'bold',
  },
  dateLabel: {
    fontSize: 12,
    color: '#A79A85',
  },
  calToggleBtn: {
    backgroundColor: '#181410',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  calToggleBtnActive: {
    backgroundColor: '#E8A020',
    borderColor: '#E8A020',
  },
  calToggleText: {
    color: '#F4ECDD',
    fontSize: 13,
    fontWeight: '600',
  },
  calToggleTextActive: {
    color: '#221803',
    fontWeight: 'bold',
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
  fitRingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  fitRingCasing3D: {
    width: 156,
    height: 156,
    borderRadius: 78,
    backgroundColor: '#130F0C',
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderTopColor: '#362A1D',
    borderLeftColor: '#281F15',
    borderRightColor: '#281F15',
    borderBottomColor: '#0E0A07',
    elevation: 7,
  },
  fitRingCasingCals: {
    shadowColor: '#E8A020',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  fitRingCasingSteps: {
    shadowColor: '#4285F4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  fitRingOuter: {
    width: 142,
    height: 142,
    borderRadius: 71,
    borderWidth: 7,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#17130E',
  },
  fitRingOuterCals: {
    borderTopColor: '#FFAE2E',
    borderLeftColor: '#E8A020',
    borderRightColor: '#D4860D',
    borderBottomColor: '#6B3E03',
  },
  fitRingOuterSteps: {
    borderTopColor: '#7AAEFF',
    borderLeftColor: '#4285F4',
    borderRightColor: '#2B6BD6',
    borderBottomColor: '#123072',
  },
  fitRingInner: {
    width: 114,
    height: 114,
    borderRadius: 57,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#14100C',
    borderWidth: 1.5,
    borderTopColor: '#090705',
    borderLeftColor: '#100D0A',
    borderRightColor: '#100D0A',
    borderBottomColor: '#2C2217',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 4,
    elevation: 3,
  },
  fitRingValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F4ECDD',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  fitRingSub: {
    fontSize: 11,
    color: '#A79A85',
    marginTop: 2,
    fontWeight: '500',
  },
  fitStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 10,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#2B2319',
  },
  fitStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  fitStatVal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F4ECDD',
    marginBottom: 2,
  },
  fitStatLbl: {
    fontSize: 11,
    color: '#A79A85',
  },
  fitStatDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#2E251B',
  },
  fitCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A1510',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#2B2218',
  },
  fitFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fitStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  fitFooterHint: {
    fontSize: 11,
    color: '#A79A85',
    fontWeight: '500',
  },
  fitFooterArrow: {
    fontSize: 13,
    color: '#E8A020',
    fontWeight: 'bold',
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
  mealTimeText: {
    color: '#A79A85',
    fontSize: 11,
    fontWeight: '500',
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
  mealContentRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  mealThumbContainer: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#2C251D',
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  mealThumb: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  mealTextCol: {
    flex: 1,
  },
  imageModalBg: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  imageModalClose: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 32,
    right: 20,
    zIndex: 10,
    backgroundColor: '#2C251D',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  imageModalCloseText: {
    color: '#F4ECDD',
    fontWeight: 'bold',
    fontSize: 14,
  },
  imageModalImg: {
    width: '100%',
    height: '80%',
    borderRadius: 12,
  },
  summaryTabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1E1914',
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2C251D',
  },
  summaryTabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  summaryTabBtnActiveCal: {
    backgroundColor: '#2C251D',
    borderWidth: 1,
    borderColor: '#E8A020',
  },
  summaryTabBtnActiveStep: {
    backgroundColor: '#2C251D',
    borderWidth: 1,
    borderColor: '#4285F4',
  },
  summaryTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#A79A85',
  },
  summaryTabTextActive: {
    color: '#F4ECDD',
    fontWeight: 'bold',
  },
  stepCircle: {
    borderColor: '#4285F4',
  },
  stepFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#2C251D',
  },
  stepStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepStatusText: {
    fontSize: 11,
    color: '#A79A85',
  },
  connectHcBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  connectHcBtnText: {
    fontSize: 11,
    color: '#60A5FA',
    fontWeight: '600',
  },
});
