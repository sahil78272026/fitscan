import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getReactNativePersistence,
  signInWithPhoneNumber,
  PhoneAuthProvider,
  GoogleAuthProvider,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithCredential,
  sendPasswordResetEmail,
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

/**
 * Convert a local file URI (e.g. file:// or content://) to a native Blob in React Native.
 * Uses XMLHttpRequest with responseType="blob", which native React Native supports without
 * triggering the "Creating blobs from 'ArrayBuffer' and 'ArrayBufferView' are not supported" error.
 */
function uriToBlob(uri) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = function () {
      resolve(xhr.response);
    };
    xhr.onerror = function () {
      reject(new Error('Failed to read image URI into native blob'));
    };
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
}

export async function uploadMealImageToFirebase(imageUriOrBase64, isBase64 = false, userId = 'anonymous') {
  if (!isFirebaseConfigured()) return null;
  const filename = `meals/${userId}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.jpg`;
  const storageRef = ref(storage, filename);

  let blob = null;
  try {
    if (!isBase64 && typeof imageUriOrBase64 === 'string' && (imageUriOrBase64.startsWith('file://') || imageUriOrBase64.startsWith('content://') || imageUriOrBase64.startsWith('ph://') || imageUriOrBase64.startsWith('blob:') || imageUriOrBase64.startsWith('http'))) {
      blob = await uriToBlob(imageUriOrBase64);
      await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
    } else {
      // If we only have base64 or a data URI, convert data URI to native blob via uriToBlob
      let dataUri = imageUriOrBase64;
      if (!dataUri.startsWith('data:')) {
        dataUri = `data:image/jpeg;base64,${dataUri}`;
      }
      blob = await uriToBlob(dataUri);
      await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
    }

    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
  } finally {
    if (blob && typeof blob.close === 'function') {
      try {
        blob.close();
      } catch (_) {}
    }
  }
}

export {
  app,
  auth,
  GoogleAuthProvider,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithCredential,
  sendPasswordResetEmail,
  signInWithPhoneNumber,
  PhoneAuthProvider,
  ref,
  uploadBytes,
  uploadString,
  getDownloadURL,
};
