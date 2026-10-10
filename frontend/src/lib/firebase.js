import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};

export const isFirebaseConfigured = () => {
  return (
    !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== "" &&
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== "YOUR_FIREBASE_API_KEY"
  );
};

import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

let app;
let auth;
let storage;

if (typeof window !== "undefined") {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  storage = getStorage(app);
}

export async function uploadMealImageToFirebase(file, userId = "anonymous") {
  if (!isFirebaseConfigured() || !storage) return null;
  const filename = `meals/${userId}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${file.name || "meal.jpg"}`;
  const storageRef = ref(storage, filename);
  await uploadBytes(storageRef, file, { contentType: file.type || "image/jpeg" });
  return await getDownloadURL(storageRef);
}

export {
  app,
  auth,
  storage,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  RecaptchaVerifier,
  signInWithPhoneNumber,
};
