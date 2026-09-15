"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { sendOtp, verifyOtp, verifyFirebaseToken } from "@/lib/api";
import { auth, RecaptchaVerifier, signInWithPhoneNumber, isFirebaseConfigured } from "@/lib/firebase";
import styles from "./page.module.css";

function cleanPhoneNumber(val) {
  let digits = (val || "").replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("91")) {
    digits = digits.slice(2);
  }
  return digits.slice(0, 10);
}

export default function LoginPage() {
  const [step, setStep] = useState("phone"); // "phone" | "otp" | "name"
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [isFirebaseMode, setIsFirebaseMode] = useState(false);

  const { login } = useAuth();
  const router = useRouter();

  const setupRecaptcha = () => {
    if (typeof window !== "undefined" && auth) {
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
        } catch (e) {}
        window.recaptchaVerifier = null;
      }
      const container = document.getElementById("recaptcha-container");
      if (container) {
        container.innerHTML = "";
      }
      window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "normal",
        callback: () => {},
        "expired-callback": () => {
          setError("reCAPTCHA session expired. Please try sending OTP again.");
        },
      });
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    const clean = cleanPhoneNumber(phone);
    if (clean.length < 10) return;
    setLoading(true);
    setError("");

    const formatted = `+91${clean}`;

    // 1. Try Firebase Phone Auth (Blaze Project fitscan-54e95)
    if (isFirebaseConfigured()) {
      try {
        setupRecaptcha();
        const appVerifier = window.recaptchaVerifier;
        await appVerifier.render();
        const result = await signInWithPhoneNumber(auth, formatted, appVerifier);
        setConfirmationResult(result);
        setIsFirebaseMode(true);
        setPhone(formatted);
        setStep("otp");
        setLoading(false);
        return;
      } catch (err) {
        console.error("Firebase Phone Auth error:", err);
        if (window.recaptchaVerifier) {
          try {
            window.recaptchaVerifier.clear();
          } catch (cErr) {}
          window.recaptchaVerifier = null;
        }
        setError(err.message || "Failed to send SMS via Firebase");
        setLoading(false);
        return;
      }
    }

    // 2. Fallback for Local Dev Mode
    try {
      await sendOtp(formatted);
      setIsFirebaseMode(false);
      setPhone(formatted);
      setStep("otp");
    } catch (err) {
      setError(err.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) return;
    setLoading(true);
    setError("");

    try {
      let result;

      if (isFirebaseMode && confirmationResult) {
        // Verify real Firebase SMS OTP
        const userCredential = await confirmationResult.confirm(otp);
        const idToken = await userCredential.user.getIdToken();
        result = await verifyFirebaseToken(idToken, phone, name || null);
      } else {
        // Dev mode verification
        result = await verifyOtp(phone, otp, name || null);
      }

      if (result.is_new_user && !name) {
        setStep("name");
        localStorage.setItem("fitscan_token_temp", result.token);
        localStorage.setItem("fitscan_user_temp", JSON.stringify(result.user));
      } else {
        login(result);
        router.push("/");
      }
    } catch (err) {
      setError(err.message || "Invalid or expired OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleSetName = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError("");

    const tempToken = localStorage.getItem("fitscan_token_temp");
    const tempUser = localStorage.getItem("fitscan_user_temp");

    if (tempToken && tempUser) {
      const user = JSON.parse(tempUser);
      user.name = name.trim();
      login({ token: tempToken, user });
      localStorage.removeItem("fitscan_token_temp");
      localStorage.removeItem("fitscan_user_temp");
      router.push("/");
    } else {
      setError("Session expired. Please sign in again.");
      setStep("phone");
    }
    setLoading(false);
  };

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <div className={styles.brand}>
          <span className={styles.brandIcon}>🏋️</span>
          <h1 className={styles.brandName}>FitScan</h1>
          <p className={styles.brandTagline}>Track your calories with AI</p>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {step === "phone" && (
          <form onSubmit={handleSendOtp} className={styles.form}>
            <label className={styles.label}>Phone Number</label>
            <div className={styles.phoneInput}>
              <span className={styles.countryCode}>+91</span>
              <input
                type="tel"
                className={styles.input}
                value={cleanPhoneNumber(phone)}
                onChange={(e) => setPhone(cleanPhoneNumber(e.target.value))}
                placeholder="9876543210"
                maxLength={10}
                autoFocus
                disabled={loading}
              />
            </div>
            <div id="recaptcha-container" style={{ margin: "1rem 0", display: "flex", justifyContent: "center" }}></div>
            <button type="submit" className={styles.button} disabled={loading || cleanPhoneNumber(phone).length !== 10}>
              {loading ? <span className={styles.spinner} /> : "Send OTP"}
            </button>
            <p className={styles.devHint}>
              {isFirebaseConfigured()
                ? "📲 Connected to Firebase fitscan-54e95 (SMS active)"
                : "🔧 Dev mode active: OTP is 123456"}
            </p>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleVerifyOtp} className={styles.form}>
            <label className={styles.label}>Enter 6-Digit OTP</label>
            <p className={styles.subtitle}>Sent via SMS to {phone}</p>
            <input
              type="text"
              className={styles.otpInput}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              maxLength={6}
              autoFocus
              disabled={loading}
            />
            <button type="submit" className={styles.button} disabled={loading || otp.length !== 6}>
              {loading ? <span className={styles.spinner} /> : "Verify & Sign In"}
            </button>
            <button
              type="button"
              className={styles.backBtn}
              onClick={() => {
                setStep("phone");
                setOtp("");
                setError("");
                setConfirmationResult(null);
              }}
            >
              ← Change number
            </button>
          </form>
        )}

        {step === "name" && (
          <form onSubmit={handleSetName} className={styles.form}>
            <label className={styles.label}>What should we call you?</label>
            <p className={styles.subtitle}>Welcome to FitScan! 🎉</p>
            <input
              type="text"
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              maxLength={100}
              autoFocus
              disabled={loading}
            />
            <button type="submit" className={styles.button} disabled={loading || !name.trim()}>
              {loading ? <span className={styles.spinner} /> : "Get Started"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
