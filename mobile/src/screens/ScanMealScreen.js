import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { logMeal, scanMealImage, scanMealImageBase64, getSettings } from '../services/api';
import { uploadMealImageToFirebase, auth } from '../services/firebase';
import { ScreenHeader, Button } from '../components/ui';
import { colors, spacing, typography, radius } from '../theme';
import ProUpgradeModal from '../components/ProUpgradeModal';
import OnboardingModal from '../components/OnboardingModal';
import useSubscription from '../hooks/useSubscription';

export default function ScanMealScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const {
    isPro,
    trialDaysRemaining,
    hasAccess,
    refreshSubscription,
    openPaywall,
    closePaywall,
    isPaywallOpen,
  } = useSubscription();

  const [userSettings, setUserSettings] = useState(null);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [imageUri, setImageUri] = useState(null);
  const [photoBase64, setPhotoBase64] = useState(null);
  const [rawInput, setRawInput] = useState('');
  const [mealType, setMealType] = useState('lunch');
  const [loading, setLoading] = useState(false);

  const mealDate = route?.params?.mealDate || null;

  useEffect(() => {
    let isMounted = true;
    getSettings()
      .then((settings) => {
        if (isMounted && settings) {
          setUserSettings(settings);
          if (!settings?.height_cm || !settings?.weight_kg) {
            setGoalModalOpen(true);
          }
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const hasGoals = Boolean(userSettings?.height_cm && userSettings?.weight_kg);

  const pickImage = async () => {
    if (!hasAccess) {
      openPaywall('scan_meal');
      return;
    }
    if (!hasGoals) {
      Alert.alert(
        'Goal Required',
        'Please set your fitness and calorie goal before scanning meals.',
        [
          { text: 'Set Goal', onPress: () => setGoalModalOpen(true) },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera roll access is needed to upload meal photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setImageUri(asset.uri);
        if (asset.base64) {
          setPhotoBase64(asset.base64);
        }
      }
    } catch (err) {
      if (__DEV__) {
        console.warn('Image picker error:', err);
      }
      Alert.alert('Error', err.message || 'Unable to select image. Please try again.');
    }
  };

  const takePhoto = async () => {
    if (!hasAccess) {
      openPaywall('scan_meal');
      return;
    }
    if (!hasGoals) {
      Alert.alert(
        'Goal Required',
        'Please set your fitness and calorie goal before scanning meals.',
        [
          { text: 'Set Goal', onPress: () => setGoalModalOpen(true) },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera access is needed to take meal photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setImageUri(asset.uri);
        if (asset.base64) {
          setPhotoBase64(asset.base64);
        }
      }
    } catch (err) {
      if (__DEV__) {
        console.warn('Camera capture error:', err);
      }
      Alert.alert('Error', err.message || 'Unable to take photo. Please try again.');
    }
  };

  const handleLogMeal = async () => {
    if (!hasAccess) {
      openPaywall('scan_meal');
      return;
    }
    if (!hasGoals) {
      Alert.alert(
        'Goal Required',
        'Please set your fitness and calorie goal before logging meals.',
        [
          { text: 'Set Goal', onPress: () => setGoalModalOpen(true) },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    if (!rawInput.trim() && !imageUri && !photoBase64) {
      if (Platform.OS === 'web') {
        alert('Please describe your meal or select an image.');
      } else {
        Alert.alert('Empty Input', 'Please describe your meal or select an image.');
      }
      return;
    }

    setLoading(true);
    try {
      let uploadedImageUrl = null;
      const currentUid = auth?.currentUser?.uid || 'user';

      let createdMeal = null;
      if (photoBase64) {
        try {
          const uploadSource = imageUri || photoBase64;
          const isB64Flag = !imageUri;
          uploadedImageUrl = await uploadMealImageToFirebase(uploadSource, isB64Flag, currentUid);
        } catch (uploadErr) {
          console.warn('Firebase photo upload failed, proceeding with scan:', uploadErr);
        }
        createdMeal = await scanMealImageBase64(photoBase64, rawInput.trim(), mealType, mealDate, uploadedImageUrl);
      } else if (imageUri) {
        try {
          uploadedImageUrl = await uploadMealImageToFirebase(imageUri, false, currentUid);
        } catch (uploadErr) {
          console.warn('Firebase photo upload failed, proceeding with scan:', uploadErr);
        }
        createdMeal = await scanMealImage(imageUri, rawInput.trim(), mealType, mealDate, uploadedImageUrl);
      } else {
        createdMeal = await logMeal(rawInput.trim(), mealType, mealDate);
      }

      // If an image was taken/picked, cache its local URI for this meal ID so it displays immediately in Logged Meals
      if (createdMeal?.id && (imageUri || photoBase64)) {
        try {
          const cacheUri = imageUri || `data:image/jpeg;base64,${photoBase64}`;
          await AsyncStorage.setItem(`fitscan_local_meal_img_${createdMeal.id}`, cacheUri);
        } catch (cacheErr) {
          if (__DEV__) console.warn('Failed to cache local meal image URI:', cacheErr);
        }
      }

      if (Platform.OS === 'web') {
        alert('Meal Logged! AI calorie analysis completed.');
      } else {
        Alert.alert('Meal Logged', 'AI calorie analysis completed.');
      }
      navigation.goBack();
    } catch (err) {
      if (err.status === 402 || err.code === 'TRIAL_EXPIRED') {
        openPaywall('scan_meal');
        return;
      }
      if (Platform.OS === 'web') {
        alert('Error: ' + (err.message || 'Failed to log meal'));
      } else {
        Alert.alert('Error', err.message || 'Failed to log meal');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Header: ScreenHeader handles insets.top cleanly with seamless surface color */}
      <ScreenHeader
        title="Log & Scan Meal"
        subtitle="AI Calorie & Macro Scanner"
        onBack={() => navigation.goBack()}
        safeArea={true}
        backgroundColor={colors.surface || '#221D17'}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 24) + 16 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Goal Warning Banner if goals not configured */}
          {!hasGoals && userSettings && (
            <View style={styles.goalBanner}>
              <Text style={styles.goalBannerTitle}>Goal Setup Required</Text>
              <Text style={styles.goalBannerDesc}>
                Set your fitness and calorie goal to enable AI photo scanning and personalized macro tracking.
              </Text>
              <TouchableOpacity
                style={styles.goalBannerBtn}
                onPress={() => setGoalModalOpen(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.goalBannerBtnText}>Set Goals Now</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Image Preview Box */}
          <TouchableOpacity style={styles.imageBox} onPress={pickImage} activeOpacity={0.8}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
            ) : (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderText}>Tap to select or take meal photo</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Action Buttons for Camera / Gallery */}
          <View style={styles.mediaRow}>
            <TouchableOpacity style={styles.mediaBtn} onPress={takePhoto} activeOpacity={0.75}>
              <Text style={styles.mediaBtnText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.mediaBtn} onPress={pickImage} activeOpacity={0.75}>
              <Text style={styles.mediaBtnText}>Choose from Gallery</Text>
            </TouchableOpacity>
          </View>

          {/* Text Input for meal description */}
          <Text style={styles.label}>Meal Description (Optional)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. 2 eggs, 1 slice toast with butter"
            placeholderTextColor={colors.textSecondary || '#A79A85'}
            value={rawInput}
            onChangeText={setRawInput}
          />

          {/* Meal Type selector */}
          <Text style={styles.label}>Meal Type</Text>
          <View style={styles.typeRow}>
            {['breakfast', 'lunch', 'snack', 'dinner'].map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.typeBtn, mealType === type && styles.typeBtnActive]}
                onPress={() => setMealType(type)}
                activeOpacity={0.75}
              >
                <Text style={[styles.typeText, mealType === type && styles.typeTextActive]}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Submit Action */}
          <Button
            title="Analyze & Log Meal"
            onPress={handleLogMeal}
            loading={loading}
            fullWidth
            size="lg"
            style={styles.submitBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Onboarding Goal Setup Modal */}
      <OnboardingModal
        visible={goalModalOpen}
        initialSettings={userSettings}
        onClose={() => setGoalModalOpen(false)}
        onComplete={(updated) => {
          setUserSettings(updated);
          setGoalModalOpen(false);
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background || '#181410',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.screenPadding || 16,
  },
  goalBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: radius.md || 12,
    padding: 16,
    marginBottom: 16,
  },
  goalBannerTitle: {
    color: colors.primary || '#F59E0B',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  goalBannerDesc: {
    color: colors.textSecondary || '#A8A29E',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  goalBannerBtn: {
    backgroundColor: colors.primary || '#F59E0B',
    borderRadius: radius.sm || 8,
    paddingVertical: 9,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  goalBannerBtnText: {
    color: '#181410',
    fontSize: 12,
    fontWeight: '700',
  },
  imageBox: {
    height: 190,
    backgroundColor: colors.surface || '#221D17',
    borderRadius: radius.lg || 16,
    borderWidth: 1.5,
    borderColor: colors.border || '#3A3128',
    borderStyle: 'dashed',
    overflow: 'hidden',
    marginBottom: 16,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  placeholderText: {
    color: colors.textSecondary || '#A79A85',
    fontSize: typography?.sizes?.sm || 13,
  },
  mediaRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  mediaBtn: {
    flex: 1,
    minHeight: 48, // Guaranteed >= 48dp touch target
    backgroundColor: colors.surfaceElevated || '#2C251D',
    borderRadius: radius.md || 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border || '#3A3128',
  },
  mediaBtnText: {
    color: colors.primary || '#E8A020',
    fontSize: typography?.sizes?.sm || 13,
    fontWeight: '600',
  },
  label: {
    fontSize: typography?.sizes?.sm || 13,
    fontWeight: '600',
    color: colors.textPrimary || '#F4ECDD',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: colors.surfaceElevated || '#2C251D',
    borderRadius: radius.md || 10,
    borderWidth: 1,
    borderColor: colors.border || '#3A3128',
    color: colors.textPrimary || '#F4ECDD',
    fontSize: typography?.sizes?.base || 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48, // Guaranteed >= 48dp touch target
    marginBottom: 18,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  typeBtn: {
    flex: 1,
    minHeight: 48, // Upgraded to >= 48dp touch target
    backgroundColor: colors.surfaceElevated || '#2C251D',
    borderRadius: radius.md || 10,
    borderWidth: 1,
    borderColor: colors.border || '#3A3128',
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeBtnActive: {
    backgroundColor: colors.primary || '#E8A020',
    borderColor: colors.primary || '#E8A020',
  },
  typeText: {
    color: colors.textSecondary || '#A79A85',
    fontSize: typography?.sizes?.xs || 12,
    fontWeight: '600',
  },
  typeTextActive: {
    color: colors.textOnPrimary || '#221803',
  },
  submitBtn: {
    marginTop: 8,
  },
});
