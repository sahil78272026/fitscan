"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import styles from "./BottomTabBar.module.css";

const TABS = [
  { href: "/", label: "Tracker", icon: "🍽️" },
  { href: "/meal-plan", label: "Meal Plan", icon: "📋" },
  { href: "/progress", label: "Progress", icon: "📊" },
  { href: "/profile", label: "Profile", icon: "👤" },
];

export default function BottomTabBar() {
  const pathname = usePathname();
  const { isAuthenticated, loading } = useAuth();

  // Hide tab bar on login or privacy pages, or if not logged in
  if (loading || !isAuthenticated || pathname === "/login" || pathname === "/privacy") {
    return null;
  }

  return (
    <nav className={styles.bottomNav} aria-label="Bottom Navigation">
      {TABS.map((tab) => {
        const isActive =
          tab.href === "/"
            ? pathname === "/"
            : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            <span className={styles.navIcon}>{tab.icon}</span>
            <span className={styles.navLabel}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
