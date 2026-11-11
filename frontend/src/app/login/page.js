"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { verifyFirebaseToken, loginWithEmail } from "@/lib/api";
import {
  auth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  isFirebaseConfigured,
} from "@/lib/firebase";
import styles from "./page.module.css";

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { login } = useAuth();
  const router = useRouter();

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");

    try {
      if (isFirebaseConfigured() && auth) {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        const userCred = await signInWithPopup(auth, provider);
        const idToken = await userCred.user.getIdToken();
        const res = await verifyFirebaseToken(
          idToken,
          userCred.user.email,
          userCred.user.displayName,
          userCred.user.photoURL
        );
        login(res);
        router.push("/");
      } else {
        if (process.env.NODE_ENV === "production") {
          setError("Authentication service is unavailable. Please check your internet connection or app configuration.");
          return;
        }
        // Local dev fallback
        const res = await loginWithEmail("demo@corecontrol.app", "CoreControl User");
        login(res);
        router.push("/");
      }
    } catch (err) {
      console.error("Google sign in error:", err);
      setError(err.message || "Failed to sign in with Google");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError("");

    try {
      if (isFirebaseConfigured() && auth) {
        let userCred;
        if (isSignUp) {
          userCred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        } else {
          userCred = await signInWithEmailAndPassword(auth, email.trim(), password);
        }
        const idToken = await userCred.user.getIdToken();
        const res = await verifyFirebaseToken(
          idToken,
          userCred.user.email,
          name.trim() || userCred.user.displayName || email.split("@")[0],
          userCred.user.photoURL
        );
        login(res);
        router.push("/");
      } else {
        if (process.env.NODE_ENV === "production") {
          setError("Authentication service is unavailable. Please check your internet connection or app configuration.");
          return;
        }
        // Local dev fallback
        const res = await loginWithEmail(
          email.trim(),
          name.trim() || email.split("@")[0]
        );
        login(res);
        router.push("/");
      }
    } catch (err) {
      console.error("Email auth error:", err);
      let msg = err.message || "Authentication failed";
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
        msg = "Invalid email or password.";
      } else if (err.code === "auth/email-already-in-use") {
        msg = "An account with this email already exists. Please sign in.";
      } else if (err.code === "auth/weak-password") {
        msg = "Password should be at least 6 characters.";
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.main}>
      <div className={styles.layoutWrapper}>
        {/* Left / Middle: Story & Habit Philosophy */}
        <div className={styles.storySide}>
          <div className={styles.brandRow}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/corecontrol_logo.png"
              alt="FitScan Logo"
              className={styles.brandLogo}
            />
            <div>
              <h1 className={styles.brandName}>FitScan</h1>
              <p className={styles.brandTagline}>Mindful meal logging & daily habits</p>
            </div>
          </div>

          <div className={styles.heroContent}>
            <h2 className={styles.heroHeadline}>
              Build a healthy, peaceful rhythm with your food.
            </h2>
            <p className={styles.heroDescription}>
              Smart nutrition tracking without restrictions. Build lasting habits with simple awareness.
            </p>

            <div className={styles.valuePillars}>
              <div className={styles.pillarItem}>
                <div className={styles.pillarIconBox}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
                    <path d="M7 2v20"/>
                    <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
                  </svg>
                </div>
                <div className={styles.pillarText}>
                  <h3 className={styles.pillarTitle}>Effortless Meal Logging</h3>
                  <p className={styles.pillarDesc}>
                    Log dishes instantly via natural text or photo.
                  </p>
                </div>
              </div>

              <div className={styles.pillarItem}>
                <div className={styles.pillarIconBox}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                  </svg>
                </div>
                <div className={styles.pillarText}>
                  <h3 className={styles.pillarTitle}>Habits Over Perfection</h3>
                  <p className={styles.pillarDesc}>
                    Build daily streaks and track eating patterns.
                  </p>
                </div>
              </div>

              <div className={styles.pillarItem}>
                <div className={styles.pillarIconBox}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>
                    <path d="M22 12A10 10 0 0 0 12 2v10z"/>
                  </svg>
                </div>
                <div className={styles.pillarText}>
                  <h3 className={styles.pillarTitle}>Balanced Macro Clarity</h3>
                  <p className={styles.pillarDesc}>
                    Clear daily breakdown of protein, carbs, and fats.
                  </p>
                </div>
              </div>
            </div>

            <div className={styles.humanNote}>
              <span className={styles.humanNoteIcon}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
                </svg>
              </span>
              <p className={styles.humanNoteText}>
                No high-pressure targets or complicated rules. Just honest daily awareness to help you feel your best.
              </p>
            </div>
          </div>
        </div>

        {/* Right Side: Login & Sign Up Gate */}
        <div className={styles.authSide}>
          <div className={styles.authCard}>
            <div className={styles.authHeader}>
              <h2 className={styles.authTitle}>
                {isSignUp ? "Create your account" : "Welcome back"}
              </h2>
              <p className={styles.authSubtitle}>
                {isSignUp
                  ? "Start logging your meals and building lifelong healthy habits today."
                  : "Sign in to pick up right where you left off."}
              </p>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            {/* Google SSO Button */}
            <button
              type="button"
              className={styles.googleButton}
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              <svg className={styles.googleIcon} viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Continue with Google
            </button>

            <div className={styles.divider}>or continue with email</div>

            {/* Email + Password Form */}
            <form onSubmit={handleEmailAuth} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {isSignUp && (
                <div>
                  <label className={styles.label}>Your Name</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Sahil Garg"
                    disabled={loading}
                  />
                </div>
              )}

              <div>
                <label className={styles.label}>Email Address</label>
                <input
                  type="email"
                  className={styles.input}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label className={styles.label}>Password</label>
                <input
                  type="password"
                  className={styles.input}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  disabled={loading}
                />
              </div>

              <button type="submit" className={styles.button} disabled={loading || !email.trim() || !password}>
                {loading ? (
                  <span className={styles.spinner} />
                ) : isSignUp ? (
                  "Create Account"
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            {/* Mode Switcher */}
            <div className={styles.toggleContainer}>
              <span style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>
                {isSignUp ? "Already have an account?" : "Don't have an account?"}
              </span>{" "}
              <button
                type="button"
                className={styles.toggleBtn}
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError("");
                }}
              >
                {isSignUp ? "Sign In" : "Sign Up"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
