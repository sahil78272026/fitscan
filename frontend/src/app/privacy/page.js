import Link from "next/link";
import styles from "./page.module.css";

export const metadata = {
  title: "Privacy Policy | CoreControl",
  description: "CoreControl Privacy Policy - How we collect, use, and protect your data.",
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
            <img src="/corecontrol_logo.webp" alt="CoreControl Logo" className={styles.logoImage} />
            <span className={styles.logoText}>CoreControl</span>
          </div>
        </header>

        {/* Hero Title */}
        <div className={styles.heroCard}>
          <h1 className={styles.title}>Privacy Policy</h1>
          <p className={styles.effectiveDate}>
            Last Updated: September 30, 2026 • Effective Immediately
          </p>
        </div>

        {/* Detailed Privacy Content */}
        <div className={styles.contentCard}>
          {/* Section 1 */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>1. Introduction</h2>
            <p className={styles.paragraph}>
              Welcome to <strong>CoreControl</strong> ("we", "our", or "us"). CoreControl provides an AI-powered calorie counter, step tracking, body weight log, and meal planning service accessible via our website and mobile application (package name: <code>com.fitscan.wellness</code>).
            </p>
            <p className={styles.paragraph}>
              We respect your privacy and are committed to protecting the personal information you share with us. This Privacy Policy explains how we collect, use, disclose, and safeguard your data, including how and why we access specific device permissions on your mobile device.
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
                <strong>Account Information:</strong> Your email address, display name, and profile picture (when signing in with Google SSO) or your email and encrypted password for secure authentication via Firebase Auth and JWT tokens.
              </li>
              <li className={styles.listItem}>
                <strong>Fitness & Health Metrics:</strong> Your body weight entries, daily step count logs, target calorie goals, protein/carbs/fat targets, and activity level.
              </li>
              <li className={styles.listItem}>
                <strong>Meal Logs & Photos:</strong> Meal descriptions, meal types (breakfast, lunch, dinner, snack), and meal photos captured with your camera or chosen from your library for AI nutritional analysis.
              </li>
              <li className={styles.listItem}>
                <strong>Technical & Usage Data:</strong> Device operating system version, app version, network connectivity status, and server access logs necessary to maintain secure API endpoints.
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

          {/* Section 4 - Device Permissions */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>4. Mobile Device Permissions & Why We Need Them</h2>
            <p className={styles.paragraph}>
              To deliver our mobile app features, CoreControl requests the following device permissions on Android and iOS:
            </p>
            <ul className={styles.list}>
              <li className={styles.listItem}>
                <strong>Camera Access (<code>android.permission.CAMERA</code> / <code>NSCameraUsageDescription</code>):</strong>
                <br />
                <em>Why needed:</em> Required to allow you to take real-time photos of meals, food plates, and nutrition labels directly inside the app.
                <br />
                <em>Data handling:</em> Photos you capture are sent over encrypted HTTPS to Google Gemini AI solely to analyze ingredients and estimate calories and macros. Camera photos are never used for facial recognition, biometric analysis, or advertising purposes.
              </li>
              <li className={styles.listItem}>
                <strong>Physical Activity & Step Tracking (<code>android.permission.ACTIVITY_RECOGNITION</code> / <code>NSMotionUsageDescription</code>):</strong>
                <br />
                <em>Why needed:</em> Required on Android and iOS to access your device's built-in pedometer and motion sensors to track your daily steps and active calorie expenditure.
                <br />
                <em>Data handling:</em> Step data is used exclusively to display your daily activity progress and adherence streaks inside the app. We do not track your GPS location or real-time travel movements.
              </li>
              <li className={styles.listItem}>
                <strong>Photo Library & Storage Access (<code>android.permission.READ_EXTERNAL_STORAGE</code> / <code>READ_MEDIA_IMAGES</code>):</strong>
                <br />
                <em>Why needed:</em> Allows you to select and upload an existing food photo from your photo gallery if you prefer not to take a live photo.
                <br />
                <em>Data handling:</em> The app only accesses the specific image files you explicitly choose to upload. We never access, index, or scan your broader photo library or personal files.
              </li>
              <li className={styles.listItem}>
                <strong>Internet & Network State (<code>android.permission.INTERNET</code>, <code>android.permission.ACCESS_NETWORK_STATE</code>):</strong>
                <br />
                <em>Why needed:</em> Required to verify your internet connection, authenticate your Google or email session, and sync your meal and workout data with our secure cloud servers.
                <br />
                <em>Data handling:</em> All data transmitted across the network is encrypted in transit using industry-standard TLS (HTTPS).
              </li>
            </ul>
          </section>

          {/* Section 5 - Data Sharing Commitment */}
          <div className={styles.highlightBox}>
            🔒 <strong>Data Sharing Commitment:</strong> CoreControl does NOT sell, rent, or trade your personal health data, email address, step counts, or uploaded meal photos to third-party advertisers, data brokers, or commercial marketing partners.
          </div>

          {/* Section 6 */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>5. Third-Party Services</h2>
            <p className={styles.paragraph}>
              CoreControl integrates with trusted third-party cloud services to power core app features:
            </p>
            <ul className={styles.list}>
              <li className={styles.listItem}>
                <strong>Google Sign-In & Firebase Authentication:</strong> Handles user authentication securely without storing plain-text credentials.
              </li>
              <li className={styles.listItem}>
                <strong>Google Gemini AI:</strong> Processes meal image data and text descriptions strictly to estimate nutritional values.
              </li>
            </ul>
          </section>

          {/* Section 7 */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>6. Data Security & Storage</h2>
            <p className={styles.paragraph}>
              We implement industry-standard encryption protocols (TLS/HTTPS) for all data in transit. Your authentication tokens are stored securely on your device using encrypted local storage.
            </p>
          </section>

          {/* Section 8 */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>7. Your Choices & Account Deletion</h2>
            <p className={styles.paragraph}>
              You have full control over your data within CoreControl:
            </p>
            <ul className={styles.list}>
              <li className={styles.listItem}>
                You can delete individual meal entries, step logs, or weight logs at any time directly from the app dashboard.
              </li>
              <li className={styles.listItem}>
                To request complete account or data deletion, you may log out or contact our support team at <code>privacy@corecontrol.fit</code>. Upon receiving your request, all personal data associated with your account will be permanently deleted from our servers within 30 days.
              </li>
            </ul>
          </section>

          {/* Section 9 */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>8. Contact Us</h2>
            <p className={styles.paragraph}>
              If you have any questions or concerns regarding this Privacy Policy or your data, please reach out to us at:
            </p>
            <p className={styles.paragraph}>
              <strong>CoreControl Wellness Team</strong><br />
              Email: <code>privacy@corecontrol.fit</code><br />
              Web: <code>https://corecontrol.fit</code>
            </p>
          </section>
        </div>

        {/* Footer */}
        <footer className={styles.footer}>
          © 2026 CoreControl Wellness. All rights reserved.
        </footer>
      </div>
    </main>
  );
}
