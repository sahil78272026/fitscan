import Link from "next/link";
import styles from "./page.module.css";

export const metadata = {
  title: "Privacy Policy | FitScan",
  description: "FitScan Privacy Policy - How we collect, use, and protect your data.",
};

export default function PrivacyPage() {
  return (
    <main className={styles.main}>
      <div className={styles.container}>
        {/* Navigation Header */}
        <header className={styles.header}>
          <Link href="/" className={styles.backBtn}>
            ← Back to App
          </Link>
          <div className={styles.brand}>
            <span className={styles.logoIcon}>🏋️</span>
            <span className={styles.logoText}>FitScan</span>
          </div>
        </header>

        {/* Hero Title */}
        <div className={styles.heroCard}>
          <h1 className={styles.title}>Privacy Policy</h1>
          <p className={styles.effectiveDate}>
            Last Updated: September 18, 2026 • Effective Immediately
          </p>
        </div>

        {/* Detailed Privacy Content */}
        <div className={styles.contentCard}>
          {/* Section 1 */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>1. Introduction</h2>
            <p className={styles.paragraph}>
              Welcome to <strong>FitScan</strong> ("we", "our", or "us"). FitScan provides an AI-powered calorie counter, step tracking, body weight log, and meal planning service accessible via our website and mobile application (package name: <code>com.fitscan.wellness</code>).
            </p>
            <p className={styles.paragraph}>
              We respect your privacy and are committed to protecting the personal information you share with us. This Privacy Policy explains how we collect, use, disclose, and safeguard your data when you use our services.
            </p>
          </section>

          {/* Section 2 */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>2. Information We Collect</h2>
            <p className={styles.paragraph}>
              To provide AI calorie analysis and fitness tracking, we collect the following types of information:
            </p>
            <ul className={styles.list}>
              <li className={styles.listItem}>
                <strong>Account Information:</strong> Your phone number and optional display name for secure account authentication via Firebase Auth.
              </li>
              <li className={styles.listItem}>
                <strong>Fitness & Health Metrics:</strong> Your body weight entries, daily step count logs, target calorie goals, protein/carbs/fat preferences, and activity level.
              </li>
              <li className={styles.listItem}>
                <strong>Meal Logs & Photos:</strong> Meal descriptions, meal types (breakfast, lunch, dinner, snack), and meal photos captured or uploaded for AI image scanning.
              </li>
              <li className={styles.listItem}>
                <strong>Technical & Usage Data:</strong> Device operating system, browser type, and log data necessary to maintain secure API endpoints.
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>3. How We Use Your Information</h2>
            <p className={styles.paragraph}>
              We use the collected information strictly to operate, improve, and personalize your experience:
            </p>
            <ul className={styles.list}>
              <li className={styles.listItem}>
                Analyze meal photos using Google Gemini AI to estimate nutritional content (calories, protein, carbs, fat).
              </li>
              <li className={styles.listItem}>
                Calculate daily calorie summaries, step history trends, and 7-day adherence streak scores.
              </li>
              <li className={styles.listItem}>
                Generate personalized AI meal plans aligned with your dietary goals and budget preferences.
              </li>
              <li className={styles.listItem}>
                Authenticate your user session securely via JWT tokens over encrypted HTTPS connections.
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <div className={styles.highlightBox}>
            🔒 <strong>Data Sharing Commitment:</strong> FitScan does NOT sell, rent, or trade your personal health data, phone numbers, or uploaded meal photos to third-party advertisers or data brokers.
          </div>

          {/* Section 5 */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>4. Third-Party Services</h2>
            <p className={styles.paragraph}>
              FitScan integrates with trusted third-party cloud services to power core app features:
            </p>
            <ul className={styles.list}>
              <li className={styles.listItem}>
                <strong>Firebase Authentication (Google):</strong> Processes phone numbers and SMS verification codes securely.
              </li>
              <li className={styles.listItem}>
                <strong>Google Gemini AI:</strong> Processes meal image data and text descriptions solely to return nutritional breakdowns.
              </li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>5. Data Security & Storage</h2>
            <p className={styles.paragraph}>
              We implement industry-standard encryption protocols (TLS/HTTPS) for all data in transit. Your authentication tokens are stored securely on your device using encrypted local storage.
            </p>
          </section>

          {/* Section 7 */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>6. Your Choices & Account Deletion</h2>
            <p className={styles.paragraph}>
              You have full control over your data within FitScan:
            </p>
            <ul className={styles.list}>
              <li className={styles.listItem}>
                You can delete individual meal entries or weight logs at any time directly from the app dashboard.
              </li>
              <li className={styles.listItem}>
                To request complete account or data deletion, you may log out or contact our support team at <code>privacy@fitscan.app</code>.
              </li>
            </ul>
          </section>

          {/* Section 8 */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>7. Contact Us</h2>
            <p className={styles.paragraph}>
              If you have any questions or concerns regarding this Privacy Policy or your data, please reach out to us at:
            </p>
            <p className={styles.paragraph}>
              <strong>FitScan Wellness Team</strong><br />
              Email: <code>privacy@fitscan.app</code><br />
              Web: <code>https://fitscan-zb5j.onrender.com</code>
            </p>
          </section>
        </div>

        {/* Footer */}
        <footer className={styles.footer}>
          © 2026 FitScan Wellness. All rights reserved.
        </footer>
      </div>
    </main>
  );
}
