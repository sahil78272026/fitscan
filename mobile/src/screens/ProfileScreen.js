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
  Alert,
  Switch,
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect, Line } from 'react-native-svg';
import { colors, typography, spacing, radius, shadows } from '../theme';
import { ScreenHeader, Card, Button, Badge } from '../components/ui';
import {
  getSettings,
  updateMorningBriefingPreferences,
  deleteAccount,
  resetUserData,
  getNotificationPreferences,
  updateNotificationPreferences,
  testDispatchNotification,
} from '../services/api';
import { scheduleLocalNotification } from '../services/notifications';
import { auth, EmailAuthProvider, reauthenticateWithCredential, deleteUser } from '../services/firebase';
import OnboardingModal from '../components/OnboardingModal';
import MealPlanSelectorModal from '../components/MealPlanSelectorModal';
import ConfirmPlanChangeModal from '../components/ConfirmPlanChangeModal';
import SafeActionModal from '../components/SafeActionModal';
import ProUpgradeModal from '../components/ProUpgradeModal';
import useSubscription from '../hooks/useSubscription';

// Zero-Emoji Vector SVG Icons for Notifications & Settings
function BellIcon({ size = 18, color = colors.primary || '#F59E0B' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M13.73 21a2 2 0 0 1-3.46 0"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ClockIcon({ size = 14, color = colors.textSecondary || '#94A3B8' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.8" />
      <Path d="M12 6v6l4 2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CheckCircleIcon({ size = 14, color = colors.protein || '#10B981' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.8" />
      <Path d="M8 12l2.5 2.5L16 9" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function FlameIcon({ size = 14, color = colors.streakPurple || '#A855F7' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8.5 14.5A2.5 2.5 0 0 0 11 17c1.38 0 2.5-1.12 2.5-2.5 0-1.63-1.07-2.71-1.6-3.32-.42-.48-.9-.98-.9-1.68 0-.32.06-.63.17-.92-1.39.73-2.67 2.13-2.67 4.42z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 2c0 4-5 6.5-5 11a5 5 0 0 0 10 0c0-3.5-3-6-3-9 0-.7-.2-1.4-.5-2h-1.5z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function TargetIcon({ size = 14, color = colors.nutritionEmerald || '#10B981' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.8" />
      <Circle cx="12" cy="12" r="6" stroke={color} strokeWidth="1.8" />
      <Circle cx="12" cy="12" r="2" fill={color} />
    </Svg>
  );
}

function CloseIcon({ size = 16, color = colors.textSecondary || '#94A3B8' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 6L6 18M6 6l12 12" />
    </Svg>
  );
}

export default function ProfileScreen({ navigation, user, onLogout }) {
  const {
    isPro,
    trialDaysRemaining,
    isTrialActive,
    hasAccess,
    refreshSubscription,
    openPaywall,
    closePaywall,
    isPaywallOpen,
  } = useSubscription(user);

  const [userSettings, setUserSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [planSelectorOpen, setPlanSelectorOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [deleteAccountModalOpen, setDeleteAccountModalOpen] = useState(false);
  const [resetDataModalOpen, setResetDataModalOpen] = useState(false);
  const [resetScope, setResetScope] = useState('all_logs');
  const [dangerZoneModalOpen, setDangerZoneModalOpen] = useState(false);

  // Push Notification Preferences State
  const [notificationPrefs, setNotificationPrefs] = useState({
    notifications_enabled: true,
    meal_reminders_enabled: true,
    breakfast_reminder_time: '09:00',
    lunch_reminder_time: '13:30',
    dinner_reminder_time: '20:00',
    snack_reminder_time: '17:00',
    streak_reminders_enabled: true,
    streak_reminder_time: '21:30',
    macro_adherence_reminders_enabled: true,
    timezone: 'UTC',
  });
  const [testingDispatch, setTestingDispatch] = useState(false);
  const [testNotificationFeedback, setTestNotificationFeedback] = useState(null);
  const [editingTimeKey, setEditingTimeKey] = useState(null);
  const [timePickerValue, setTimePickerValue] = useState('');

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

  const fetchNotificationPrefs = async () => {
    try {
      const prefs = await getNotificationPreferences();
      if (prefs) {
        setNotificationPrefs(prefs);
      }
    } catch (err) {
      console.warn('Profile notification preferences fetch error:', err);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchNotificationPrefs();
    refreshSubscription();
  }, [refreshSubscription]);

  const handleTogglePref = async (key) => {
    const updatedValue = !notificationPrefs[key];
    const newPrefs = { ...notificationPrefs, [key]: updatedValue };
    setNotificationPrefs(newPrefs);
    try {
      await updateNotificationPreferences({ [key]: updatedValue });
    } catch (err) {
      console.warn('Failed to update notification preference:', err);
      setNotificationPrefs(notificationPrefs);
      Alert.alert('Error', 'Unable to update notification preference. Please check connection.');
    }
  };

  const handleOpenTimeModal = (key, currentVal) => {
    setEditingTimeKey(key);
    setTimePickerValue(currentVal || '09:00');
  };

  const handleSaveReminderTime = async () => {
    if (!editingTimeKey) return;
    const trimmed = (timePickerValue || '').trim();
    if (!/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(trimmed)) {
      Alert.alert('Invalid Time Format', 'Please enter a valid 24-hour time in HH:MM format (e.g. 09:00 or 13:30).');
      return;
    }
    const key = editingTimeKey;
    const newPrefs = { ...notificationPrefs, [key]: trimmed };
    setNotificationPrefs(newPrefs);
    setEditingTimeKey(null);
    try {
      await updateNotificationPreferences({ [key]: trimmed });
    } catch (err) {
      console.warn('Failed to save reminder time:', err);
      setNotificationPrefs(notificationPrefs);
      Alert.alert('Error', 'Failed to save updated reminder time.');
    }
  };

  const handleSendTestNotification = async () => {
    setTestingDispatch(true);
    setTestNotificationFeedback(null);
    try {
      // 1. Dispatch immediate local notification directly to the device tray
      await scheduleLocalNotification({
        title: 'CoreControl Reminder',
        body: 'Your custom nutrition reminders and streak alerts are active!',
        data: { screen: 'Today' },
      });

      // 2. Also trigger backend push notification dispatch
      try {
        await testDispatchNotification({
          title: 'CoreControl Push Reminder',
          body: 'Your custom nutrition reminders and streak alerts are active!',
          data: { screen: 'Today' },
        });
      } catch (backendErr) {
        console.warn('Backend push dispatch note:', backendErr);
      }

      setTestNotificationFeedback({
        type: 'success',
        message: 'Test notification sent! Check your device notification tray.',
      });
    } catch (err) {
      console.warn('Test notification dispatch error:', err);
      setTestNotificationFeedback({
        type: 'error',
        message: err.message || 'Unable to display test notification.',
      });
    } finally {
      setTestingDispatch(false);
      setTimeout(() => {
        setTestNotificationFeedback(null);
      }, 5000);
    }
  };

  const getPresetsForKey = (key) => {
    switch (key) {
      case 'breakfast_reminder_time':
        return ['07:30', '08:00', '08:30', '09:00', '09:30', '10:00'];
      case 'lunch_reminder_time':
        return ['12:00', '12:30', '13:00', '13:30', '14:00', '14:30'];
      case 'snack_reminder_time':
        return ['16:00', '16:30', '17:00', '17:30', '18:00'];
      case 'dinner_reminder_time':
        return ['19:00', '19:30', '20:00', '20:30', '21:00', '21:30'];
      case 'streak_reminder_time':
        return ['20:30', '21:00', '21:30', '22:00', '22:30'];
      default:
        return ['09:00', '13:00', '17:00', '20:00', '21:30'];
    }
  };

  const getLabelForKey = (key) => {
    switch (key) {
      case 'breakfast_reminder_time':
        return 'Breakfast Reminder Time';
      case 'lunch_reminder_time':
        return 'Lunch Reminder Time';
      case 'snack_reminder_time':
        return 'Snack Reminder Time';
      case 'dinner_reminder_time':
        return 'Dinner Reminder Time';
      case 'streak_reminder_time':
        return 'Streak Protection Alert Time';
      default:
        return 'Reminder Time';
    }
  };

  const handleOpenPlanSelector = () => {
    if (!hasAccess) {
      openPaywall('meal_plan_rotation');
      return;
    }
    if (userSettings && userSettings.can_change_plan === false && !isPro) {
      const hours = userSettings.hours_until_next_plan_change || 1;
      Alert.alert(
        'Daily Meal Plan Limit',
        `Meal plans can be updated once every 24 hours to optimize AI generation.\n\nNext update available in ${hours} hour(s).`,
        [{ text: 'OK' }]
      );
      return;
    }
    setConfirmModalOpen(true);
  };

  const handleConfirmPlanChange = () => {
    setConfirmModalOpen(false);
    setPlanSelectorOpen(true);
  };

  const handleOpenWizard = () => {
    if (!hasAccess) {
      openPaywall('meal_plan_wizard');
      return;
    }
    setWizardOpen(true);
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

  const handleConfirmDeleteAccount = async ({ confirmation, password }) => {
    if (confirmation !== 'DELETE') {
      throw new Error('Confirmation string must be "DELETE" in capital letters.');
    }

    setDeleting(true);
    try {
      let freshToken = null;
      // Re-authenticate with Firebase if currentUser exists and password provided
      if (auth && auth.currentUser) {
        if (password && auth.currentUser.email) {
          try {
            const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
            await reauthenticateWithCredential(auth.currentUser, credential);
          } catch (reauthErr) {
            console.warn('Firebase reauthentication failed:', reauthErr);
            throw new Error(
              reauthErr.code === 'auth/wrong-password' || reauthErr.code === 'auth/invalid-credential'
                ? 'Incorrect password. Verification failed.'
                : (reauthErr.message || 'Re-authentication failed. Please check your password.')
            );
          }
        }
        try {
          freshToken = await auth.currentUser.getIdToken(true);
        } catch (tokErr) {
          console.warn('Could not refresh ID token:', tokErr);
        }
      }

      // 1. Delete all personal logs and profile from PostgreSQL backend
      await deleteAccount(freshToken);

      // 2. Delete user authentication identity from Firebase Auth
      if (auth && auth.currentUser) {
        try {
          await deleteUser(auth.currentUser);
        } catch (fbErr) {
          console.warn('Firebase user deletion warning:', fbErr);
        }
      }

      setDeleteAccountModalOpen(false);
      Alert.alert('Account Deleted', 'Your account and personal data have been permanently removed.');
      if (onLogout) {
        await onLogout();
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleConfirmResetData = async ({ confirmation, password }) => {
    if (confirmation !== 'RESET') {
      throw new Error('Confirmation string must be "RESET" in capital letters.');
    }

    setResetting(true);
    try {
      let freshToken = null;
      if (auth && auth.currentUser) {
        if (password && auth.currentUser.email) {
          try {
            const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
            await reauthenticateWithCredential(auth.currentUser, credential);
          } catch (reauthErr) {
            console.warn('Firebase reauthentication failed:', reauthErr);
            throw new Error(
              reauthErr.code === 'auth/wrong-password' || reauthErr.code === 'auth/invalid-credential'
                ? 'Incorrect password. Verification failed.'
                : (reauthErr.message || 'Re-authentication failed. Please check your password.')
            );
          }
        }
        try {
          freshToken = await auth.currentUser.getIdToken(true);
        } catch (tokErr) {
          console.warn('Could not refresh ID token:', tokErr);
        }
      }

      await resetUserData(resetScope, 'RESET', freshToken);
      setResetDataModalOpen(false);
      Alert.alert(
        'Data Reset Successful',
        `Your ${resetScope === 'all_logs' ? 'all personal logs' : resetScope} have been erased. Your account remains active.`
      );
      await fetchSettings();
    } finally {
      setResetting(false);
    }
  };


  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#E8A020" />
          <Text style={styles.loaderText}>Loading Profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const selectedPlan = userSettings?.selected_meal_plan;

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      {/* Onboarding Wizard Modal */}
      <OnboardingModal
        visible={wizardOpen}
        initialSettings={userSettings}
        onClose={() => setWizardOpen(false)}
        onComplete={handleWizardComplete}
      />

      {/* Confirm Plan Change Warning Modal */}
      <ConfirmPlanChangeModal
        visible={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={handleConfirmPlanChange}
        currentPlan={selectedPlan}
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

      {/* Monetization Paywall Modal */}
      <ProUpgradeModal
        visible={isPaywallOpen}
        onClose={closePaywall}
        daysRemaining={trialDaysRemaining}
        currentTier={isPro ? 'pro' : 'free'}
        onSuccess={refreshSubscription}
      />

      {/* Navigation Header */}
      <ScreenHeader
        title="Profile & Goals"
        onBack={() => navigation.navigate('Today')}
        backTitle="Tracker"
        backIcon="←"
        rightAction={
          <TouchableOpacity
            style={styles.mealPlanBtn}
            onPress={() => navigation.navigate('Meals')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="View Meal Plan Schedule"
          >
            <Text style={styles.mealPlanBtnText}>Schedule</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* User Card */}
        <Card variant="default" style={styles.userCard}>
          <View style={styles.avatar}>
            {user?.avatar_url ? (
              <Image
                source={{ uri: user.avatar_url }}
                style={styles.avatarImage}
                resizeMode="cover"
              />
            ) : (
              <Text style={styles.avatarText}>
                {(user?.name || user?.email || user?.phone || 'U')[0].toUpperCase()}
              </Text>
            )}
          </View>
          <View style={styles.userInfo}>
            <View style={styles.userHeaderRow}>
              <Text style={styles.userName}>{user?.name || 'CoreControl User'}</Text>
              {isPro && (
                <View style={styles.proCrownBadge}>
                  <Text style={styles.proCrownBadgeText}>PRO</Text>
                </View>
              )}
            </View>
            <Text style={styles.userPhone}>{user?.email || user?.phone || 'Account Active'}</Text>

            {/* Subscription & Trial Status Badge */}
            <View style={styles.subStatusRow}>
              <View
                style={[
                  styles.subBadge,
                  isPro
                    ? styles.subBadgePro
                    : isTrialActive
                    ? styles.subBadgeTrial
                    : styles.subBadgeExpired,
                ]}
              >
                <Text
                  style={[
                    styles.subBadgeText,
                    isPro
                      ? styles.subBadgeTextPro
                      : isTrialActive
                      ? styles.subBadgeTextTrial
                      : styles.subBadgeTextExpired,
                  ]}
                >
                  {isPro
                    ? 'Pro Member'
                    : isTrialActive
                    ? `Free Trial: ${trialDaysRemaining} day${trialDaysRemaining === 1 ? '' : 's'} remaining`
                    : 'Trial Expired'}
                </Text>
              </View>

              {!isPro && (
                <TouchableOpacity
                  style={styles.upgradeBtnTrigger}
                  onPress={() => openPaywall('profile_badge')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.upgradeBtnTriggerText}>Upgrade →</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Card>

        {/* Active Selected Meal Plan Section */}
        <Card variant="highlight" style={styles.activePlanCard}>
          <View style={styles.planBadgeRow}>
            <Badge label="Active Meal Plan" variant="primary" size="sm" />
            {userSettings?.can_change_plan === false && (
              <Badge
                label={`Cooldown: ${userSettings.hours_until_next_plan_change || 1}h left`}
                variant="warning"
                size="sm"
              />
            )}
          </View>

          <Text style={styles.planTitle}>{selectedPlan?.title || 'No Meal Plan Selected'}</Text>
          <Text style={styles.planTagline}>
            {selectedPlan?.tagline || 'Set your physical metrics to generate AI daily meal plans'}
          </Text>

          {selectedPlan && (
            <View style={styles.macroPills}>
              <Badge label={`Target: ${userSettings?.calorie_goal || selectedPlan.daily_calories} kcal`} variant="neutral" size="sm" />
              <Badge label={`Protein: ${userSettings?.protein_goal || selectedPlan.protein_g}g`} variant="protein" size="sm" />
              <Badge label={`Carbs: ${userSettings?.carbs_goal || selectedPlan.carbs_g}g`} variant="carbs" size="sm" />
              <Badge label={`Fat: ${userSettings?.fat_goal || selectedPlan.fat_g}g`} variant="fat" size="sm" />
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionBtnStack}>
            {selectedPlan && (
              <Button
                variant="primary"
                size="md"
                fullWidth
                title="View Full Meal Plan Schedule →"
                onPress={() => navigation.navigate('Meals')}
              />
            )}

            <Button
              variant={selectedPlan ? 'secondary' : 'primary'}
              size="md"
              fullWidth
              title={
                selectedPlan
                  ? userSettings?.can_change_plan === false
                    ? `Change Plan (${userSettings.hours_until_next_plan_change || 1}h cooldown)`
                    : 'Change AI Meal Plan'
                  : 'Generate AI Meal Plans'
              }
              onPress={handleOpenPlanSelector}
            />

            <Button
              variant="outline"
              size="md"
              fullWidth
              title="Re-run Onboarding & Goals"
              onPress={handleOpenWizard}
            />
          </View>
        </Card>

        {/* Personal Metrics Grid */}
        <Text style={styles.sectionTitle}>Personal Metrics & Preferences</Text>
        <View style={styles.metricsGrid}>
          <Card variant="elevated" style={styles.metricCard}>
            <Text style={styles.metricLabel}>Goal Type</Text>
            <Text style={styles.metricValue}>
              {(userSettings?.goal_type || 'fat_loss').replace('_', ' ').toUpperCase()}
            </Text>
          </Card>

          <Card variant="elevated" style={styles.metricCard}>
            <Text style={styles.metricLabel}>Diet Type</Text>
            <Text style={styles.metricValue}>
              {(userSettings?.diet_type || 'veg').replace('_', ' ').toUpperCase()}
            </Text>
          </Card>

          <Card variant="elevated" style={styles.metricCard}>
            <Text style={styles.metricLabel}>Budget Tier</Text>
            <Text style={styles.metricValue}>
              {(userSettings?.budget_tier || 'moderate').replace('_', ' ').toUpperCase()}
            </Text>
          </Card>

          <Card variant="elevated" style={styles.metricCard}>
            <Text style={styles.metricLabel}>Current Weight</Text>
            <Text style={styles.metricValue}>
              {userSettings?.weight_kg ? `${userSettings.weight_kg} kg` : 'Not Set'}
            </Text>
          </Card>

          <Card variant="elevated" style={styles.metricCard}>
            <Text style={styles.metricLabel}>Height</Text>
            <Text style={styles.metricValue}>
              {userSettings?.height_cm ? `${userSettings.height_cm} cm` : 'Not Set'}
            </Text>
          </Card>

          <Card variant="elevated" style={styles.metricCard}>
            <Text style={styles.metricLabel}>Activity</Text>
            <Text style={styles.metricValue}>
              {(userSettings?.activity_level || 'moderate').replace('_', ' ').toUpperCase()}
            </Text>
          </Card>
        </View>

        {/* Push Notifications & Reminders Section */}
        <View style={styles.sectionHeaderRow}>
          <BellIcon size={18} color={colors.primary || '#F59E0B'} />
          <Text style={styles.sectionTitleWithIcon}>Push Notifications & Reminders</Text>
        </View>

        <Card variant="elevated" style={styles.notificationCard}>
          {/* Master Notification Toggle */}
          <View style={styles.settingRow}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>Push Notifications</Text>
              <Text style={styles.settingSubtitle}>
                Master switch for remote alerts, meal prompts, and streak reminders
              </Text>
            </View>
            <Switch
              value={Boolean(notificationPrefs.notifications_enabled)}
              onValueChange={() => handleTogglePref('notifications_enabled')}
              trackColor={{ false: '#222631', true: 'rgba(245, 158, 11, 0.45)' }}
              thumbColor={notificationPrefs.notifications_enabled ? (colors.primary || '#F59E0B') : '#94A3B8'}
            />
          </View>

          {notificationPrefs.notifications_enabled && (
            <>
              <View style={styles.settingDivider} />

              {/* Meal Reminders Toggle */}
              <View style={styles.settingRow}>
                <View style={styles.settingTextContainer}>
                  <View style={styles.settingHeaderWithIcon}>
                    <ClockIcon size={15} color={colors.primary || '#F59E0B'} />
                    <Text style={styles.settingTitle}>Meal Reminders</Text>
                  </View>
                  <Text style={styles.settingSubtitle}>
                    Smart alerts suppressed automatically once today's meal is logged
                  </Text>
                </View>
                <Switch
                  value={Boolean(notificationPrefs.meal_reminders_enabled)}
                  onValueChange={() => handleTogglePref('meal_reminders_enabled')}
                  trackColor={{ false: '#222631', true: 'rgba(245, 158, 11, 0.45)' }}
                  thumbColor={notificationPrefs.meal_reminders_enabled ? (colors.primary || '#F59E0B') : '#94A3B8'}
                />
              </View>

              {/* Meal Reminder Times Grid */}
              {notificationPrefs.meal_reminders_enabled && (
                <View style={styles.mealTimesContainer}>
                  <Text style={styles.subSectionTitle}>Custom Reminder Times (24H)</Text>

                  <View style={styles.mealTimeGrid}>
                    {/* Breakfast */}
                    <View style={styles.mealTimeItem}>
                      <View style={styles.mealTimeLabelRow}>
                        <View style={[styles.mealDot, { backgroundColor: '#F59E0B' }]} />
                        <Text style={styles.mealTimeName}>Breakfast</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.timePill}
                        onPress={() => handleOpenTimeModal('breakfast_reminder_time', notificationPrefs.breakfast_reminder_time)}
                        activeOpacity={0.7}
                      >
                        <ClockIcon size={12} color={colors.primary || '#F59E0B'} />
                        <Text style={styles.timePillText}>{notificationPrefs.breakfast_reminder_time || '09:00'}</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Lunch */}
                    <View style={styles.mealTimeItem}>
                      <View style={styles.mealTimeLabelRow}>
                        <View style={[styles.mealDot, { backgroundColor: '#10B981' }]} />
                        <Text style={styles.mealTimeName}>Lunch</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.timePill}
                        onPress={() => handleOpenTimeModal('lunch_reminder_time', notificationPrefs.lunch_reminder_time)}
                        activeOpacity={0.7}
                      >
                        <ClockIcon size={12} color={colors.protein || '#10B981'} />
                        <Text style={styles.timePillText}>{notificationPrefs.lunch_reminder_time || '13:30'}</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Snack */}
                    <View style={styles.mealTimeItem}>
                      <View style={styles.mealTimeLabelRow}>
                        <View style={[styles.mealDot, { backgroundColor: '#38BDF8' }]} />
                        <Text style={styles.mealTimeName}>Snack</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.timePill}
                        onPress={() => handleOpenTimeModal('snack_reminder_time', notificationPrefs.snack_reminder_time)}
                        activeOpacity={0.7}
                      >
                        <ClockIcon size={12} color={colors.hydrationSky || '#38BDF8'} />
                        <Text style={styles.timePillText}>{notificationPrefs.snack_reminder_time || '17:00'}</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Dinner */}
                    <View style={styles.mealTimeItem}>
                      <View style={styles.mealTimeLabelRow}>
                        <View style={[styles.mealDot, { backgroundColor: '#F43F5E' }]} />
                        <Text style={styles.mealTimeName}>Dinner</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.timePill}
                        onPress={() => handleOpenTimeModal('dinner_reminder_time', notificationPrefs.dinner_reminder_time)}
                        activeOpacity={0.7}
                      >
                        <ClockIcon size={12} color={colors.fat || '#F43F5E'} />
                        <Text style={styles.timePillText}>{notificationPrefs.dinner_reminder_time || '20:00'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}

              <View style={styles.settingDivider} />

              {/* Streak Protection Toggle & Time */}
              <View style={styles.settingRow}>
                <View style={styles.settingTextContainer}>
                  <View style={styles.settingHeaderWithIcon}>
                    <FlameIcon size={15} color={colors.streakPurple || '#A855F7'} />
                    <Text style={styles.settingTitle}>Streak Protection</Text>
                  </View>
                  <Text style={styles.settingSubtitle}>
                    Evening alert if no meals have been logged today to keep streak active
                  </Text>
                </View>
                <Switch
                  value={Boolean(notificationPrefs.streak_reminders_enabled)}
                  onValueChange={() => handleTogglePref('streak_reminders_enabled')}
                  trackColor={{ false: '#222631', true: 'rgba(245, 158, 11, 0.45)' }}
                  thumbColor={notificationPrefs.streak_reminders_enabled ? (colors.primary || '#F59E0B') : '#94A3B8'}
                />
              </View>

              {notificationPrefs.streak_reminders_enabled && (
                <View style={styles.streakTimeRow}>
                  <Text style={styles.streakTimeLabel}>Protection Alert Time</Text>
                  <TouchableOpacity
                    style={styles.timePill}
                    onPress={() => handleOpenTimeModal('streak_reminder_time', notificationPrefs.streak_reminder_time)}
                    activeOpacity={0.7}
                  >
                    <ClockIcon size={12} color={colors.streakPurple || '#A855F7'} />
                    <Text style={styles.timePillText}>{notificationPrefs.streak_reminder_time || '21:30'}</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.settingDivider} />

              {/* Test Notification Trigger & Feedback */}
              <View style={styles.testDispatchSection}>
                <Button
                  variant="secondary"
                  size="md"
                  fullWidth
                  title={testingDispatch ? 'Dispatching Test Alert...' : 'Send Test Notification'}
                  loading={testingDispatch}
                  onPress={handleSendTestNotification}
                  style={styles.testNotificationBtn}
                />
                <Text style={styles.testNotificationHint}>
                  Dispatches an immediate remote push to test token registration & routing.
                </Text>

                {testNotificationFeedback && (
                  <View
                    style={[
                      styles.feedbackBanner,
                      testNotificationFeedback.type === 'success' && styles.feedbackBannerSuccess,
                      testNotificationFeedback.type === 'error' && styles.feedbackBannerError,
                      testNotificationFeedback.type === 'info' && styles.feedbackBannerInfo,
                    ]}
                  >
                    <View style={styles.feedbackBannerContent}>
                      {testNotificationFeedback.type === 'success' && <CheckCircleIcon size={16} color="#10B981" />}
                      <Text
                        style={[
                          styles.feedbackBannerText,
                          testNotificationFeedback.type === 'success' && styles.feedbackBannerTextSuccess,
                          testNotificationFeedback.type === 'error' && styles.feedbackBannerTextError,
                          testNotificationFeedback.type === 'info' && styles.feedbackBannerTextInfo,
                        ]}
                      >
                        {testNotificationFeedback.message}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </>
          )}
        </Card>

        {/* Account Session & Management */}
        <View style={styles.accountSection}>
          <Button
            title="Logout of Account"
            variant="secondary"
            size="md"
            fullWidth
            onPress={onLogout}
            style={styles.logoutBtn}
            textStyle={styles.logoutBtnText}
          />

          <TouchableOpacity
            style={styles.dangerZoneTrigger}
            onPress={() => setDangerZoneModalOpen(true)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Open Data and Account Options"
          >
            <Text style={styles.dangerZoneTriggerText}>Data & Account Options (Danger Zone)</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Danger Zone Management Modal */}
      <Modal
        visible={dangerZoneModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDangerZoneModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.dangerModalContainer}>
            <View style={styles.dangerModalHeader}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.dangerModalTitle}>Data & Account Options</Text>
                <Text style={styles.dangerModalSubtitle}>
                  Manage sensitive data operations and permanent account deletion.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setDangerZoneModalOpen(false)}
                style={styles.dangerModalCloseBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Close Danger Zone options"
              >
                <CloseIcon size={16} color={colors.textSecondary || '#94A3B8'} />
              </TouchableOpacity>
            </View>

            <View style={styles.dangerActionBlock}>
              <Text style={styles.dangerActionTitle}>Reset Personal Activity Logs</Text>
              <Text style={styles.dangerActionDesc}>
                Clear all meal logs and weight history while keeping your login and profile active.
              </Text>
              <Button
                title="Reset Personal Activity Logs"
                variant="outline"
                size="md"
                fullWidth
                loading={resetting}
                onPress={() => {
                  setDangerZoneModalOpen(false);
                  setResetScope('all_logs');
                  setResetDataModalOpen(true);
                }}
                style={styles.resetLogsBtn}
                textStyle={{ color: colors.warning || '#F59E0B' }}
              />
            </View>

            <View style={styles.dangerDivider} />

            <View style={styles.dangerActionBlock}>
              <Text style={[styles.dangerActionTitle, { color: colors.error || '#F43F5E' }]}>
                Delete Account & All Data
              </Text>
              <Text style={styles.dangerActionDesc}>
                Permanently erases your user profile, meal photos, weights, and health metrics. This action is irreversible.
              </Text>
              <Button
                title="Delete Account & All Data"
                variant="outline"
                size="md"
                fullWidth
                loading={deleting}
                onPress={() => {
                  setDangerZoneModalOpen(false);
                  setDeleteAccountModalOpen(true);
                }}
                style={styles.deleteAccountBtn}
                textStyle={{ color: colors.error || '#F43F5E' }}
              />
            </View>

            <Button
              title="Close"
              variant="secondary"
              size="md"
              fullWidth
              onPress={() => setDangerZoneModalOpen(false)}
              style={styles.dangerModalDismissBtn}
            />
          </View>
        </View>
      </Modal>

      {/* Account Deletion Modal */}
      <SafeActionModal
        visible={deleteAccountModalOpen}
        onClose={() => setDeleteAccountModalOpen(false)}
        onConfirm={handleConfirmDeleteAccount}
        title="Permanently Delete Account"
        description="This will permanently delete your account, authentication identity, and all personal records. This action is irreversible."
        itemizedWarnings={[
          'All meal photos, nutrition logs, and food item breakdowns',
          'All weight logs, trajectory records, and trend curves',
          'Custom calorie and macro goals, and AI-generated meal plans',
          'Your authentication account and profile data will be permanently removed',
        ]}
        requiredKeyword="DELETE"
        confirmButtonText="Permanently Delete Account"
        requiresPassword={true}
        userEmail={user?.email || auth?.currentUser?.email || ''}
        loading={deleting}
      />

      {/* Bulk Data Reset Modal */}
      <SafeActionModal
        visible={resetDataModalOpen}
        onClose={() => setResetDataModalOpen(false)}
        onConfirm={handleConfirmResetData}
        title="Reset Personal Activity Logs"
        description="This will wipe your selected activity logs and restart your history from scratch. Your account and login credentials will remain active."
        itemizedWarnings={[
          'All logged meals, recipes, and food breakdown entries',
          'All weight entries and trend trajectory history',
          'Note: Your account profile, login, and goals will be preserved',
        ]}
        requiredKeyword="RESET"
        confirmButtonText="Reset Log History"
        requiresPassword={true}
        userEmail={user?.email || auth?.currentUser?.email || ''}
        loading={resetting}
      />

      {/* Time Picker Modal */}
      <Modal
        visible={editingTimeKey !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setEditingTimeKey(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.timeModalContainer}>
            <Text style={styles.timeModalTitle}>{getLabelForKey(editingTimeKey)}</Text>
            <Text style={styles.timeModalSubtitle}>
              Select a quick preset or enter a custom 24-hour time (HH:MM).
            </Text>

            {/* Quick Presets */}
            <View style={styles.presetsContainer}>
              {getPresetsForKey(editingTimeKey).map((preset) => {
                const isSelected = timePickerValue === preset;
                return (
                  <TouchableOpacity
                    key={preset}
                    style={[styles.presetPill, isSelected && styles.presetPillActive]}
                    onPress={() => setTimePickerValue(preset)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.presetPillText, isSelected && styles.presetPillTextActive]}>
                      {preset}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom Input */}
            <View style={styles.customInputContainer}>
              <Text style={styles.customInputLabel}>Custom Time (HH:MM)</Text>
              <TextInput
                style={styles.timeInput}
                value={timePickerValue}
                onChangeText={setTimePickerValue}
                placeholder="HH:MM"
                placeholderTextColor="#64748B"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                autoCapitalize="none"
              />
            </View>

            {/* Modal Action Buttons */}
            <View style={styles.modalBtnRow}>
              <Button
                variant="outline"
                size="md"
                title="Cancel"
                onPress={() => setEditingTimeKey(null)}
                style={styles.modalCancelBtn}
              />
              <Button
                variant="primary"
                size="md"
                title="Save Time"
                onPress={handleSaveReminderTime}
                style={styles.modalSaveBtn}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background || '#08090C',
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
    minHeight: 48,
    minWidth: 48,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: 4,
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
    paddingBottom: 120,
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
    overflow: 'hidden',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarText: {
    color: '#E8A020',
    fontSize: 20,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  userHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F4ECDD',
    flex: 1,
  },
  proBadgePill: {
    backgroundColor: 'rgba(232, 160, 32, 0.15)',
    borderWidth: 1,
    borderColor: '#E8A020',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  proBadgeText: {
    color: '#E8A020',
    fontSize: 11,
    fontWeight: 'bold',
  },
  freeBadgePill: {
    backgroundColor: '#2C251D',
    borderWidth: 1,
    borderColor: '#3A3128',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  freeBadgeText: {
    color: '#A79A85',
    fontSize: 11,
    fontWeight: '600',
  },
  proCrownBadge: {
    backgroundColor: '#E8A020',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  proCrownBadgeText: {
    color: '#221803',
    fontSize: 10,
    fontWeight: '800',
  },
  subStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  subBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  subBadgePro: {
    backgroundColor: 'rgba(232, 160, 32, 0.12)',
    borderColor: '#E8A020',
  },
  subBadgeTrial: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    borderColor: '#3B82F6',
  },
  subBadgeExpired: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: '#EF4444',
  },
  subBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  subBadgeTextPro: {
    color: '#E8A020',
  },
  subBadgeTextTrial: {
    color: '#60A5FA',
  },
  subBadgeTextExpired: {
    color: '#F87171',
  },
  upgradeBtnTrigger: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#E8A020',
  },
  upgradeBtnTriggerText: {
    color: '#221803',
    fontSize: 11,
    fontWeight: '700',
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
  planBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  planBadge: {
    backgroundColor: '#2C251D',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  planBadgeText: {
    color: '#E8A020',
    fontSize: 11,
    fontWeight: 'bold',
  },
  rotationBadgePro: {
    backgroundColor: 'rgba(232, 160, 32, 0.15)',
    borderWidth: 1,
    borderColor: '#E8A020',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  rotationBadgeTextPro: {
    color: '#E8A020',
    fontSize: 11,
    fontWeight: 'bold',
  },
  rotationBadgeReady: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  rotationBadgeTextReady: {
    color: '#4ADE80',
    fontSize: 11,
    fontWeight: 'bold',
  },
  rotationBadgeCooldown: {
    backgroundColor: 'rgba(234, 88, 12, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(234, 88, 12, 0.35)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  rotationBadgeTextCooldown: {
    color: '#FB923C',
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
    backgroundColor: '#08090C',
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
  cooldownHintBox: {
    backgroundColor: 'rgba(234, 88, 12, 0.08)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(234, 88, 12, 0.25)',
    marginTop: 4,
  },
  cooldownHintText: {
    color: '#D4C8B5',
    fontSize: 12,
    lineHeight: 17,
  },
  boldText: {
    fontWeight: 'bold',
    color: '#F4ECDD',
  },
  proPerksBtn: {
    backgroundColor: 'rgba(232, 160, 32, 0.12)',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8A020',
    marginTop: 4,
  },
  proPerksBtnText: {
    color: '#E8A020',
    fontSize: 13,
    fontWeight: 'bold',
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
    backgroundColor: '#08090C',
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
  briefingToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  briefingToggleTitle: {
    color: '#F4ECDD',
    fontSize: 14,
    fontWeight: '700',
  },
  briefingToggleSub: {
    color: '#A79A85',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  briefingOptions: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#3A3128',
  },
  briefingOptionLabel: {
    color: '#A79A85',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  frequencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  frequencyPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#08090C',
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  frequencyPillActive: {
    backgroundColor: 'rgba(232, 160, 32, 0.18)',
    borderColor: '#E8A020',
  },
  frequencyPillText: {
    color: '#A79A85',
    fontSize: 12,
    fontWeight: '600',
  },
  frequencyPillTextActive: {
    color: '#E8A020',
    fontWeight: '700',
  },
  accountSection: {
    marginTop: 20,
    gap: 12,
  },
  logoutBtn: {
    backgroundColor: colors.surfaceElevated || '#1A1D24',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border || '#222631',
  },
  logoutBtnText: {
    color: colors.textPrimary || '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  dangerZoneTrigger: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerZoneTriggerText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary || '#94A3B8',
    textDecorationLine: 'underline',
  },
  dangerModalContainer: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface || '#111318',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.35)',
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  dangerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  dangerModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary || '#F8FAFC',
  },
  dangerModalSubtitle: {
    fontSize: 12,
    color: colors.textSecondary || '#94A3B8',
    marginTop: 3,
    lineHeight: 16,
  },
  dangerModalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surfaceElevated || '#1A1D24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerModalCloseText: {
    color: colors.textSecondary || '#94A3B8',
    fontSize: 14,
    fontWeight: '700',
  },
  dangerActionBlock: {
    marginVertical: 4,
  },
  dangerActionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary || '#F8FAFC',
    marginBottom: 4,
  },
  dangerActionDesc: {
    fontSize: 11,
    color: colors.textSecondary || '#94A3B8',
    marginBottom: 10,
    lineHeight: 16,
  },
  dangerDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 12,
  },
  dangerModalDismissBtn: {
    marginTop: 14,
  },
  resetLogsBtn: {
    borderColor: colors.warning || '#F59E0B',
    marginBottom: 6,
  },
  deleteAccountBtn: {
    backgroundColor: 'rgba(244, 63, 94, 0.08)',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.35)',
    marginTop: 6,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 8,
    gap: 8,
  },
  sectionTitleWithIcon: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F4ECDD',
    letterSpacing: 0.3,
  },
  notificationCard: {
    backgroundColor: '#111318',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#222631',
    padding: 16,
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  settingTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  settingHeaderWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  settingSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 3,
    lineHeight: 16,
  },
  settingDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 14,
  },
  mealTimesContainer: {
    marginTop: 10,
    backgroundColor: '#1A1D24',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  subSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  mealTimeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  mealTimeItem: {
    width: '48%',
    backgroundColor: '#111318',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#222631',
  },
  mealTimeLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  mealDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  mealTimeName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#1A1D24',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  timePillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  streakTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#1A1D24',
    borderRadius: 8,
  },
  streakTimeLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  testDispatchSection: {
    marginTop: 4,
  },
  testNotificationBtn: {
    marginBottom: 6,
    backgroundColor: '#1A1D24',
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  testNotificationHint: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 15,
  },
  feedbackBanner: {
    marginTop: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  feedbackBannerSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: '#10B981',
  },
  feedbackBannerError: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: '#EF4444',
  },
  feedbackBannerInfo: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: '#38BDF8',
  },
  feedbackBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  feedbackBannerText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  feedbackBannerTextSuccess: {
    color: '#10B981',
  },
  feedbackBannerTextError: {
    color: '#F87171',
  },
  feedbackBannerTextInfo: {
    color: '#38BDF8',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(8, 9, 12, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  timeModalContainer: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#111318',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#222631',
    padding: 20,
  },
  timeModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  timeModalSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 16,
    lineHeight: 16,
  },
  presetsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  presetPill: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#1A1D24',
    borderWidth: 1,
    borderColor: '#222631',
  },
  presetPillActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderColor: '#F59E0B',
  },
  presetPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  presetPillTextActive: {
    color: '#F59E0B',
    fontWeight: '700',
  },
  customInputContainer: {
    marginBottom: 20,
  },
  customInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 6,
  },
  timeInput: {
    backgroundColor: '#1A1D24',
    borderWidth: 1,
    borderColor: '#222631',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
  },
  modalSaveBtn: {
    flex: 1,
  },
});

