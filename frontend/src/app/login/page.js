"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { sendOtp, verifyOtp } from "@/lib/api";
import styles from "./page.module.css";

export default function LoginPage() {
  const [step, setStep] = useState("phone"); // "phone" | "otp" | "name"
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);

  const { login } = useAuth();
  const router = useRouter();

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!phone.trim()) return;
    setLoading(true);
    setError("");
    try {
      const formatted = phone.startsWith("+") ? phone : `+91${phone}`;
      await sendOtp(formatted);
      setPhone(formatted);
      setStep("otp");
    } catch (err) {
      setError(err.message);
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
      const result = await verifyOtp(phone, otp, name || null);
      if (result.is_new_user && !name) {
        // New user — ask for name
        setIsNewUser(true);
        setStep("name");
        // Store token temporarily
        localStorage.setItem("fitscan_token_temp", result.token);
        localStorage.setItem("fitscan_user_temp", JSON.stringify(result.user));
      } else {
        login(result);
        router.push("/");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetName = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    // Retrieve the temp auth and re-verify with name
    setLoading(true);
    setError("");
    try {
      // Re-send OTP and verify with name this time
      await sendOtp(phone);
      const result = await verifyOtp(phone, "123456", name.trim());
      login(result);
      localStorage.removeItem("fitscan_token_temp");
      localStorage.removeItem("fitscan_user_temp");
      router.push("/");
    } catch (err) {
      // Fallback: use the temp token we already have
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
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
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
                value={phone.replace("+91", "")}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="9876543210"
                maxLength={10}
                autoFocus
                disabled={loading}
              />
            </div>
            <button type="submit" className={styles.button} disabled={loading || phone.replace("+91", "").length < 10}>
              {loading ? <span className={styles.spinner} /> : "Send OTP"}
            </button>
            <p className={styles.devHint}>🔧 Dev mode: OTP is always 123456</p>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleVerifyOtp} className={styles.form}>
            <label className={styles.label}>Enter OTP</label>
            <p className={styles.subtitle}>Sent to {phone}</p>
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
              {loading ? <span className={styles.spinner} /> : "Verify"}
            </button>
            <button type="button" className={styles.backBtn} onClick={() => { setStep("phone"); setOtp(""); setError(""); }}>
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
