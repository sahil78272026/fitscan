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
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { verifyFirebaseToken, loginWithEmail } from '../services/api';
import {
  auth,
  isFirebaseConfigured,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
} from '../services/firebase';

try {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });
} catch (e) {
  // Fallback if native module not available (e.g. web)
}

export default function LoginScreen({ onLoginSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleIconFailed, setGoogleIconFailed] = useState(false);
  const isAuthInProgress = useRef(false);

  const handleGoogleSuccess = async (idToken) => {
    if (isAuthInProgress.current) return;
    isAuthInProgress.current = true;
    setLoading(true);
    try {
      if (isFirebaseConfigured() && auth) {
        const credential = GoogleAuthProvider.credential(idToken);
        const userCred = await signInWithCredential(auth, credential);
        const firebaseIdToken = await userCred.user.getIdToken();
        const res = await verifyFirebaseToken(
          firebaseIdToken,
          userCred.user.email,
          userCred.user.displayName,
          userCred.user.photoURL
        );
        await AsyncStorage.setItem('fitscan_token', res.token);
        await AsyncStorage.setItem('fitscan_user', JSON.stringify(res.user));
        onLoginSuccess(res.user);
      } else {
        const res = await verifyFirebaseToken(idToken);
        await AsyncStorage.setItem('fitscan_token', res.token);
        await AsyncStorage.setItem('fitscan_user', JSON.stringify(res.user));
        onLoginSuccess(res.user);
      }
    } catch (err) {
      console.warn('Google auth error:', err);
      Alert.alert('Google Sign-In Failed', err.message || 'Failed to authenticate');
    } finally {
      setLoading(false);
      setGoogleLoading(false);
      isAuthInProgress.current = false;
    }
  };

  const handleEmailAuth = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 6) {
      Alert.alert('Invalid Password', 'Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (isFirebaseConfigured() && auth) {
        let userCred;
        if (isSignUp) {
          userCred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        } else {
          userCred = await signInWithEmailAndPassword(auth, cleanEmail, password);
        }
        const idToken = await userCred.user.getIdToken();
        const res = await verifyFirebaseToken(
          idToken,
          cleanEmail,
          name.trim() || userCred.user.displayName || cleanEmail.split('@')[0],
          userCred.user.photoURL
        );
        await AsyncStorage.setItem('fitscan_token', res.token);
        await AsyncStorage.setItem('fitscan_user', JSON.stringify(res.user));
        onLoginSuccess(res.user);
      } else {
        // Local dev fallback
        const res = await loginWithEmail(
          cleanEmail,
          name.trim() || cleanEmail.split('@')[0]
        );
        await AsyncStorage.setItem('fitscan_token', res.token);
        await AsyncStorage.setItem('fitscan_user', JSON.stringify(res.user));
        onLoginSuccess(res.user);
      }
    } catch (err) {
      console.warn('Email auth error:', err);
      let msg = err.message || 'Authentication failed';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        msg = 'Invalid email or password.';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'An account with this email already exists. Please sign in.';
      } else if (err.code === 'auth/user-not-found') {
        msg = 'No account found with this email. Please sign up.';
      }
      Alert.alert('Sign In Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setGoogleLoading(true);
    try {
      if (Platform.OS === 'web' && isFirebaseConfigured() && auth) {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const userCred = await signInWithPopup(auth, provider);
        const idToken = await userCred.user.getIdToken();
        const res = await verifyFirebaseToken(
          idToken,
          userCred.user.email,
          userCred.user.displayName,
          userCred.user.photoURL
        );
        await AsyncStorage.setItem('fitscan_token', res.token);
        await AsyncStorage.setItem('fitscan_user', JSON.stringify(res.user));
        onLoginSuccess(res.user);
      } else {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        const response = await GoogleSignin.signIn();
        const idToken = response.data?.idToken || response.idToken;
        if (!idToken) {
          throw new Error('No ID token received from Google');
        }
        await handleGoogleSuccess(idToken);
      }
    } catch (err) {
      console.warn('Google auth error:', err);
      if (err.code === statusCodes?.SIGN_IN_CANCELLED) {
        // User cancelled the prompt
      } else if (err.code === statusCodes?.IN_PROGRESS) {
        // Sign in already in progress
      } else if (err.code === statusCodes?.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Google Play Services', 'Google Play Services are not available on this device.');
      } else if (
        err.message &&
        (err.message.includes('RNGoogleSignin') ||
          err.message.includes('TurboModuleRegistry') ||
          err.message.includes('null is not an object'))
      ) {
        Alert.alert(
          'Development Build Required',
          'Native Google Sign-In requires an Android Development Build because standard Expo Go cannot run native Google Play libraries. Use Email/Password in Expo Go or run a development build.'
        );
      } else {
        Alert.alert('Google Sign-In Error', err.message || 'Failed to sign in with Google');
      }
    } finally {
      setLoading(false);
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <Text style={styles.brandIcon}>🏋️</Text>
            <Text style={styles.brandTitle}>CoreControl Mobile</Text>
            <Text style={styles.brandSubtitle}>AI Calorie & Step Tracker</Text>
          </View>

          <View style={styles.card}>
            {/* Google SSO Button */}
            <TouchableOpacity
              style={styles.googleButton}
              onPress={handleGoogleAuth}
              disabled={loading}
              activeOpacity={0.85}
            >
              {googleLoading ? (
                <View style={styles.googleLoadingRow}>
                  <ActivityIndicator size="small" color="#1F1F1F" />
                  <Text style={styles.googleLoadingText}>Signing in with Google...</Text>
                </View>
              ) : (
                <>
                  <View style={styles.googleIconWrapper}>
                    {googleIconFailed ? (
                      <Text style={styles.fallbackGoogleText}>G</Text>
                    ) : (
                      <Image
                        source={{ uri: 'https://developers.google.com/identity/images/g-logo.png' }}
                        style={styles.googleLogo}
                        resizeMode="contain"
                        onError={() => setGoogleIconFailed(true)}
                      />
                    )}
                  </View>
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Email + Password Form */}
            {isSignUp && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Your Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Sahil Garg"
                  placeholderTextColor="#6e7681"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  disabled={loading}
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="name@example.com"
                placeholderTextColor="#6e7681"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                disabled={loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#6e7681"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                disabled={loading}
              />
            </View>

            <TouchableOpacity
              style={styles.button}
              onPress={handleEmailAuth}
              disabled={loading || !email.trim() || !password}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#221803" />
              ) : (
                <Text style={styles.buttonText}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>
              )}
            </TouchableOpacity>

            {/* Switch Sign In / Sign Up */}
            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => setIsSignUp(!isSignUp)}
              disabled={loading}
            >
              <Text style={styles.switchText}>
                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                <Text style={styles.switchHighlight}>{isSignUp ? 'Sign In' : 'Sign Up'}</Text>
              </Text>
            </TouchableOpacity>

            <Text style={styles.devHint}>
              {isFirebaseConfigured()
                ? '🔒 Secured with Firebase Authentication'
                : '🔧 Dev mode active: instant local sign in'}
            </Text>
          </View>
        </ScrollView>
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
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  brand: {
    alignItems: 'center',
    marginBottom: 28,
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
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  googleIconWrapper: {
    width: 22,
    height: 22,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleLogo: {
    width: 20,
    height: 20,
  },
  fallbackGoogleText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4285F4',
  },
  googleButtonText: {
    color: '#1F1F1F',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  googleLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  googleLoadingText: {
    color: '#4B5563',
    fontSize: 14,
    fontWeight: '500',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#3A3128',
  },
  dividerText: {
    color: '#A79A85',
    fontSize: 12,
    marginHorizontal: 12,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F4ECDD',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#181410',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3A3128',
    color: '#F4ECDD',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  button: {
    backgroundColor: '#E8A020',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#221803',
    fontSize: 16,
    fontWeight: 'bold',
  },
  switchButton: {
    marginTop: 18,
    alignItems: 'center',
  },
  switchText: {
    color: '#A79A85',
    fontSize: 13,
  },
  switchHighlight: {
    color: '#E8A020',
    fontWeight: 'bold',
  },
  devHint: {
    fontSize: 11,
    color: '#6e7681',
    textAlign: 'center',
    marginTop: 16,
  },
});
