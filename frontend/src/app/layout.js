import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import BottomTabBar from "@/components/BottomTabBar";

export const viewport = {
  themeColor: "#181410",
};

export const metadata = {
  title: "CoreControl — Calorie Tracker",
  description: "Track your daily calorie intake with AI-powered food analysis. Log meals, track progress, and hit your nutrition goals.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
          <BottomTabBar />
        </AuthProvider>
      </body>
    </html>
  );
}
