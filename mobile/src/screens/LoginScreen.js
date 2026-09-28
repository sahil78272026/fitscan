import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { verifyFirebaseToken, loginWithEmail } from '../services/api';
import {
  auth,
  isFirebaseConfigured,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from '../services/firebase';

export default function LoginScreen({ onLoginSuccess }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

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
    try {
      if (Platform.OS === 'web' && isFirebaseConfigured() && auth) {
        const provider = new GoogleAuthProvider();
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
        // Mobile / Dev Google One-Tap Login
        const res = await loginWithEmail('google.user@corecontrol.app', 'Google User');
        await AsyncStorage.setItem('fitscan_token', res.token);
        await AsyncStorage.setItem('fitscan_user', JSON.stringify(res.user));
        onLoginSuccess(res.user);
      }
    } catch (err) {
      console.warn('Google auth error:', err);
      Alert.alert('Google Sign-In', err.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
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
              activeOpacity={0.8}
            >
              <Text style={styles.googleIconText}>🌐</Text>
              <Text style={styles.googleButtonText}>Continue with Google</Text>
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
    backgroundColor: '#2D261F',
    borderWidth: 1,
    borderColor: '#4A3E33',
    borderRadius: 8,
    paddingVertical: 13,
    marginBottom: 16,
    gap: 10,
  },
  googleIconText: {
    fontSize: 18,
  },
  googleButtonText: {
    color: '#F4ECDD',
    fontSize: 15,
    fontWeight: '600',
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
