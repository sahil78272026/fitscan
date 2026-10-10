"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { deleteAccount, requestPublicDataDeletion } from "@/lib/api";
import { auth } from "@/lib/firebase";
import { deleteUser } from "firebase/auth";
import styles from "./page.module.css";

export default function DeleteAccountPage() {
  const { user, isAuthenticated, logout } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [error, setError] = useState(null);

  // Authenticated user one-click delete
  const handleAuthDelete = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to permanently delete your CoreControl account?\n\nThis will immediately delete all your meal logs, weight records, food photos, step history, and targets. This action cannot be reversed."
    );
    if (!confirmed) return;

    setLoading(true);
    setError(null);
    try {
      const res = await deleteAccount();

      // Delete from Firebase Auth if current user session exists
      if (auth?.currentUser) {
        try {
          await deleteUser(auth.currentUser);
        } catch (fbErr) {
          console.warn("Firebase Auth deletion error:", fbErr);
        }
      }

      setStatusMessage(res?.message || "Your account and all associated personal data have been permanently deleted.");
      setTimeout(() => {
        logout();
      }, 2500);
    } catch (err) {
      setError(err.message || "Failed to delete account. Please try again or submit the request form below.");
    } finally {
      setLoading(false);
    }
  };

  // Public unauthenticated request form
  const handlePublicSubmit = async (e) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError("Please enter your registered email address or phone number.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await requestPublicDataDeletion(identifier.trim(), reason.trim() || null);
      setStatusMessage(
        res?.message ||
          `Deletion request processed. All personal data associated with ${identifier.trim()} has been permanently purged.`
      );
      setIdentifier("");
      setReason("");
    } catch (err) {
      setError(err.message || "Failed to process request. Please contact privacy@corecontrol.fit directly.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        {/* Navigation Header */}
        <header className={styles.header}>
          <Link href="/" className={styles.backBtn}>
            ← Back to App
          </Link>
          <div className={styles.brand}>
            <img src="/corecontrol_logo.webp" alt="CoreControl Logo" className={styles.logoImage} />
            <span className={styles.logoText}>CoreControl</span>
          </div>
        </header>

        {/* Hero Card */}
        <div className={styles.heroCard}>
          <span className={styles.badge}>⚠️ Data Privacy & Compliance</span>
          <h1 className={styles.title}>Account & Data Deletion</h1>
          <p className={styles.subtitle}>
            In compliance with Apple App Store Guideline 5.1.1 and Google Play Store Data Safety Policies, you may permanently delete your account and all associated personal health data at any time.
          </p>
        </div>

        {/* What gets deleted */}
        <div className={styles.card}>
          <h2 className={styles.sectionTitle}>What Data Gets Deleted?</h2>
          <p className={styles.paragraph}>
            When you delete your account or submit a deletion request, we immediately and permanently erase all personal and health-related records from our database storage:
          </p>
          <ul className={styles.list}>
            <li className={styles.listItem}>
              <strong>User Account Profile:</strong> Your name, email address, phone number, and avatar image.
            </li>
            <li className={styles.listItem}>
              <strong>Food & Nutrition Logs:</strong> All meal entries, AI food breakdowns, food photos captured with the scanner, and logged calorie/macro records.
            </li>
            <li className={styles.listItem}>
              <strong>Body Metrics & Progress:</strong> Historical body weight logs, target weights, and start benchmarks.
            </li>
            <li className={styles.listItem}>
              <strong>Activity & Step Counts:</strong> All daily pedometer logs and calories-burned estimates.
            </li>
            <li className={styles.listItem}>
              <strong>Preferences & Meal Plans:</strong> Active meal plans, custom calorie targets, dietary constraints, and budget preferences.
            </li>
          </ul>

          <div className={styles.noticeBox}>
            ℹ️ <strong>Subscription Notice:</strong> Deleting your CoreControl account permanently removes all stored data on our servers. If you have an active CoreControl Pro subscription billed through Apple App Store (Apple ID) or Google Play Store, please cancel your subscription in your device's Store settings to prevent future renewals.
          </div>
        </div>

        {/* Success or Error Messages */}
        {statusMessage && (
          <div className={styles.successAlert}>
            <h3 className={styles.successTitle}>✓ Deletion Completed</h3>
            <p className={styles.successText}>{statusMessage}</p>
          </div>
        )}

        {error && (
          <div className={styles.noticeBox} style={{ color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.4)" }}>
            ⚠️ {error}
          </div>
        )}

        {/* Option A: If Logged In */}
        {isAuthenticated && user && !statusMessage && (
          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>Delete Your Logged-In Account</h2>
            <div className={styles.actionBox}>
              <h3 className={styles.actionBoxTitle}>
                Signed in as: {user.email || user.phone || user.name || "CoreControl User"}
              </h3>
              <p className={styles.paragraph}>
                Clicking the button below will immediately delete your account and purge all personal data from our servers.
              </p>
              <button
                className={styles.deleteBtn}
                onClick={handleAuthDelete}
                disabled={loading}
              >
                {loading ? "Processing Deletion..." : "🗑️ Permanently Delete My Account & Data"}
              </button>
            </div>
          </div>
        )}

        {/* Option B: Public Request Form for users who uninstalled the app */}
        {!statusMessage && (
          <div className={styles.card}>
            <h2 className={styles.sectionTitle}>
              {isAuthenticated ? "Alternative: Request Deletion via Identifier" : "Request Account & Data Deletion"}
            </h2>
            <p className={styles.paragraph}>
              If you have already uninstalled the mobile app or cannot log in, enter your registered email address or phone number below to submit a deletion request:
            </p>

            <form onSubmit={handlePublicSubmit} className={styles.form}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Registered Email Address or Phone Number</label>
                <input
                  type="text"
                  required
                  placeholder="name@example.com or +919876543210"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className={styles.input}
                  disabled={loading}
                />
              </div>

              <div className={styles.inputGroup}>
                <label className={styles.label}>Reason for Deletion (Optional)</label>
                <textarea
                  placeholder="Tell us why you are leaving (optional)..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className={`${styles.input} ${styles.textarea}`}
                  disabled={loading}
                />
              </div>

              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? "Submitting Request..." : "Submit Deletion Request"}
              </button>
            </form>
          </div>
        )}

        {/* Contact info */}
        <div style={{ textAlign: "center", fontSize: "0.85rem", color: "#606078" }}>
          Need assistance? You can also email us directly at{" "}
          <a href="mailto:privacy@corecontrol.fit" style={{ color: "#58a6ff" }}>
            privacy@corecontrol.fit
          </a>
          .
        </div>
      </div>
    </main>
  );
}
