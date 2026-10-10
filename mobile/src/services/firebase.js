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

import { getStorage, ref, uploadBytes, uploadString, getDownloadURL } from 'firebase/storage';

export const storage = getStorage(app);

export async function uploadMealImageToFirebase(imageUriOrBase64, isBase64 = false, userId = 'anonymous') {
  if (!isFirebaseConfigured()) return null;
  const filename = `meals/${userId}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.jpg`;
  const storageRef = ref(storage, filename);

  if (isBase64) {
    let cleanB64 = imageUriOrBase64;
    if (cleanB64.includes(',')) {
      cleanB64 = cleanB64.split(',')[1];
    }
    await uploadString(storageRef, cleanB64, 'base64', { contentType: 'image/jpeg' });
  } else {
    const response = await fetch(imageUriOrBase64);
    const blob = await response.blob();
    await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  }

  const downloadUrl = await getDownloadURL(storageRef);
  return downloadUrl;
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
  ref,
  uploadBytes,
  uploadString,
  getDownloadURL,
};
