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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing, radius, shadows } from '../theme';
import { ScreenHeader, Card, Button, Badge } from '../components/ui';
import { getSettings, updateMorningBriefingPreferences, deleteAccount, resetUserData } from '../services/api';
import { auth, EmailAuthProvider, reauthenticateWithCredential, deleteUser } from '../services/firebase';
import OnboardingModal from '../components/OnboardingModal';
import MealPlanSelectorModal from '../components/MealPlanSelectorModal';
import ConfirmPlanChangeModal from '../components/ConfirmPlanChangeModal';
import SafeActionModal from '../components/SafeActionModal';

export default function ProfileScreen({ navigation, user, onLogout }) {
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

  const handleOpenPlanSelector = () => {
    if (userSettings && userSettings.can_change_plan === false) {
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
            <Text style={styles.mealPlanBtnText}>📋 Schedule</Text>
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
            </View>
            <Text style={styles.userPhone}>{user?.email || user?.phone || 'Account Active'}</Text>
          </View>
        </Card>

        {/* Active Selected Meal Plan Section */}
        <Card variant="highlight" style={styles.activePlanCard}>
          <View style={styles.planBadgeRow}>
            <Badge label="Active Meal Plan" icon="✨" variant="primary" size="sm" />
            {userSettings?.can_change_plan === false && (
              <Badge
                label={`⏳ Cooldown: ${userSettings.hours_until_next_plan_change || 1}h left`}
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

        {/* Account Logout */}
        <Button
          title="Logout of Account"
          icon="🚪"
          variant="secondary"
          size="md"
          fullWidth
          onPress={onLogout}
          style={styles.logoutBtn}
        />

        {/* Danger Zone: Safe Data Reset & Account Deletion */}
        <View style={styles.dangerZoneCard}>
          <Text style={styles.dangerZoneTitle}>DANGER ZONE</Text>

          {/* Bulk Reset Logs */}
          <Button
            title="Reset Personal Activity Logs"
            icon="🔄"
            variant="outline"
            size="md"
            fullWidth
            loading={resetting}
            onPress={() => {
              setResetScope('all_logs');
              setResetDataModalOpen(true);
            }}
            style={styles.resetLogsBtn}
            textStyle={{ color: colors.warning || '#E8A020' }}
          />
          <Text style={styles.dangerZoneSubText}>
            Clear all meal logs, weights, and step counts while keeping your account and profile active.
          </Text>

          {/* Account Deletion */}
          <Button
            title="Delete Account & All Data"
            icon="🗑️"
            variant="outline"
            size="md"
            fullWidth
            loading={deleting}
            onPress={() => setDeleteAccountModalOpen(true)}
            style={styles.deleteAccountBtn}
            textStyle={{ color: colors.dangerText || '#E57453' }}
          />
          <Text style={styles.deleteWarningText}>
            Permanently erases your user profile, meal logs, weights, and health metrics.
          </Text>
        </View>
      </ScrollView>

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
          'All step tracking history and calorie burn records',
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
          'All step tracking and activity logs',
          'Note: Your account profile, login, and goals will be preserved',
        ]}
        requiredKeyword="RESET"
        confirmButtonText="Reset Log History"
        requiresPassword={true}
        userEmail={user?.email || auth?.currentUser?.email || ''}
        loading={resetting}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background || '#181410',
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
    backgroundColor: '#181410',
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
  logoutBtn: {
    backgroundColor: '#221D17',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C7502F',
    marginTop: 10,
    marginBottom: 8,
  },
  logoutBtnText: {
    color: '#C7502F',
    fontSize: 14,
    fontWeight: 'bold',
  },
  dangerZoneCard: {
    marginTop: 14,
    marginBottom: 30,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(199, 80, 47, 0.35)',
    backgroundColor: 'rgba(199, 80, 47, 0.05)',
  },
  dangerZoneTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.dangerText || '#E57453',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  resetLogsBtn: {
    borderColor: colors.warning || '#E8A020',
    marginBottom: 6,
  },
  dangerZoneSubText: {
    fontSize: 11,
    color: colors.textSecondary || '#A79A85',
    marginBottom: 14,
    lineHeight: 15,
  },
  deleteAccountBtn: {
    backgroundColor: 'rgba(248, 81, 73, 0.08)',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(248, 81, 73, 0.35)',
    marginTop: 6,
  },
  deleteAccountBtnText: {
    color: '#ff7b72',
    fontSize: 14,
    fontWeight: 'bold',
  },
  deleteWarningText: {
    color: '#8b949e',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 8,
  },
});

