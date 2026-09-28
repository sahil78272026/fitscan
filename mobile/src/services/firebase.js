import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getReactNativePersistence,
  signInWithPhoneNumber,
  PhoneAuthProvider,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithCredential,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
};

export const isFirebaseConfigured = () => {
  return (
    !!process.env.EXPO_PUBLIC_FIREBASE_API_KEY &&
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY !== '' &&
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY !== 'YOUR_FIREBASE_API_KEY'
  );
};

let app;
let auth;

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  const persistence = typeof getReactNativePersistence === 'function'
    ? getReactNativePersistence(AsyncStorage)
    : undefined;
  auth = initializeAuth(app, persistence ? { persistence } : undefined);
} catch (e) {
  // If auth was already initialized (hot reload), fall back to getAuth
  if (e.code === 'auth/already-initialized') {
    const { getAuth } = require('firebase/auth');
    auth = getAuth(app);
  } else {
    try {
      const { getAuth } = require('firebase/auth');
      auth = getAuth(app);
    } catch (fallbackErr) {
      console.warn('Firebase init error:', e);
    }
  }
}

export {
  app,
  auth,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithCredential,
  signInWithPhoneNumber,
  PhoneAuthProvider,
};
