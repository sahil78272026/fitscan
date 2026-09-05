import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

export const metadata = {
  title: "FitScan — Calorie Tracker",
  description: "Track your daily calorie intake with AI-powered food analysis. Log meals, track progress, and hit your nutrition goals.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
