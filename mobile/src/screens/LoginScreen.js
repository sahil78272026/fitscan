import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendOtp, verifyOtp, verifyFirebaseToken } from '../services/api';
import { isFirebaseConfigured } from '../services/firebase';
import { FirebasePhoneAuthBridge } from '../services/recaptchaVerifier';

export default function LoginScreen({ onLoginSuccess }) {
  const [step, setStep] = useState('phone'); // 'phone' | 'otp' | 'name'
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFirebaseMode, setIsFirebaseMode] = useState(false);

  const firebaseBridge = useRef(null);

  const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  };

  const handleSendOtp = async () => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      Alert.alert('Invalid Phone', 'Please enter a 10-digit mobile number.');
      return;
    }
    setLoading(true);
    const formatted = `+91${cleanPhone.slice(-10)}`;

    // Try Firebase Phone Auth via WebView bridge
    if (isFirebaseConfigured() && firebaseBridge.current) {
      try {
        await firebaseBridge.current.sendOtp(formatted);
        setIsFirebaseMode(true);
        setPhone(formatted);
        setStep('otp');
      } catch (err) {
        console.error('Firebase Phone Auth error:', err);
        Alert.alert('OTP Failed', err.message || 'Failed to send SMS via Firebase');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Fallback: Dev mode backend OTP
    try {
      await sendOtp(formatted);
      setIsFirebaseMode(false);
      setPhone(formatted);
      setStep('otp');
    } catch (err) {
      Alert.alert('OTP Failed', err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter the 6-digit OTP code.');
      return;
    }
    setLoading(true);
    try {
      let res;

      if (isFirebaseMode && firebaseBridge.current) {
        // Verify via Firebase WebView bridge → get ID token → send to backend
        const { idToken } = await firebaseBridge.current.verifyOtp(otp);
        res = await verifyFirebaseToken(idToken, phone, name || null);
      } else {
        // Dev mode OTP verification
        res = await verifyOtp(phone, otp, name || null);
      }

      if (res.is_new_user && !name) {
        setStep('name');
        await AsyncStorage.setItem('fitscan_token_temp', res.token);
      } else {
        await AsyncStorage.setItem('fitscan_token', res.token);
        await AsyncStorage.setItem('fitscan_user', JSON.stringify(res.user));
        onLoginSuccess(res.user);
      }
    } catch (err) {
      Alert.alert('Verification Failed', err.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleSetName = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const tempToken = await AsyncStorage.getItem('fitscan_token_temp');
      if (tempToken) {
        await AsyncStorage.setItem('fitscan_token', tempToken);
        const user = { name: name.trim(), phone };
        await AsyncStorage.setItem('fitscan_user', JSON.stringify(user));
        await AsyncStorage.removeItem('fitscan_token_temp');
        onLoginSuccess(user);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to save profile name');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Hidden WebView bridge that handles Firebase Phone Auth */}
      {isFirebaseConfigured() && (
        <FirebasePhoneAuthBridge
          ref={firebaseBridge}
          firebaseConfig={firebaseConfig}
        />
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.inner}>
        <View style={styles.brand}>
          <Text style={styles.brandIcon}>🏋️</Text>
          <Text style={styles.brandTitle}>FitScan Mobile</Text>
          <Text style={styles.brandSubtitle}>AI Calorie & Step Tracker</Text>
        </View>

        {step === 'phone' && (
          <View style={styles.card}>
            <Text style={styles.label}>Enter Phone Number</Text>
            <View style={styles.phoneRow}>
              <Text style={styles.countryCode}>+91</Text>
              <TextInput
                style={styles.input}
                placeholder="9876543210"
                placeholderTextColor="#6e7681"
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={setPhone}
              />
            </View>

            <TouchableOpacity style={styles.button} onPress={handleSendOtp} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send OTP</Text>}
            </TouchableOpacity>

            <Text style={styles.devHint}>
              {isFirebaseConfigured()
                ? '📲 Firebase SMS active'
                : '🔧 Dev mode: OTP is 123456'}
            </Text>
          </View>
        )}

        {step === 'otp' && (
          <View style={styles.card}>
            <Text style={styles.label}>Enter 6-Digit OTP</Text>
            <Text style={styles.subtext}>Sent to {phone}</Text>

            <TextInput
              style={styles.otpInput}
              placeholder="123456"
              placeholderTextColor="#6e7681"
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={setOtp}
            />

            <TouchableOpacity style={styles.button} onPress={handleVerifyOtp} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify & Sign In</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.backButton} onPress={() => { setStep('phone'); setOtp(''); }}>
              <Text style={styles.backText}>← Change Phone Number</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'name' && (
          <View style={styles.card}>
            <Text style={styles.label}>What is your name?</Text>
            <TextInput
              style={styles.input}
              placeholder="Your Name"
              placeholderTextColor="#6e7681"
              value={name}
              onChangeText={setName}
            />

            <TouchableOpacity style={styles.button} onPress={handleSetName} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Get Started</Text>}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#181410',
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  brand: {
    alignItems: 'center',
    marginBottom: 36,
  },
  brandIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#E8A020',
  },
  brandSubtitle: {
    fontSize: 14,
    color: '#A79A85',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#221D17',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#3A3128',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F4ECDD',
    marginBottom: 12,
  },
  subtext: {
    fontSize: 12,
    color: '#A79A85',
    marginBottom: 16,
  },
  devHint: {
    fontSize: 12,
    color: '#6e7681',
    textAlign: 'center',
    marginTop: 12,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#181410',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3A3128',
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  countryCode: {
    fontSize: 16,
    color: '#E8A020',
    fontWeight: 'bold',
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: '#F4ECDD',
    fontSize: 16,
    paddingVertical: 12,
  },
  otpInput: {
    backgroundColor: '#181410',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3A3128',
    color: '#F4ECDD',
    fontSize: 24,
    textAlign: 'center',
    letterSpacing: 8,
    paddingVertical: 12,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#E8A020',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#221803',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  backText: {
    color: '#A79A85',
    fontSize: 14,
  },
});
