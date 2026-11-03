"use client";

import { useEffect } from "react";
import Image from "next/image";

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error("Top-level web application error:", error);
  }, [error]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "2rem",
        backgroundColor: "#181410",
        color: "#F4ECDD",
        textAlign: "center",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <Image
        src="/corecontrol_logo.png"
        alt="CoreControl"
        width={64}
        height={64}
        priority
        style={{
          borderRadius: "16px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          marginBottom: "1.5rem",
        }}
      />
      <h1 style={{ fontSize: "1.5rem", fontWeight: "700", marginBottom: "0.5rem", color: "#F4ECDD" }}>
        Something went wrong
      </h1>
      <p style={{ fontSize: "0.95rem", color: "#A79A85", maxWidth: "420px", marginBottom: "1.5rem", lineHeight: "1.5" }}>
        An unexpected error occurred while loading this view. You can retry to reload the page state.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        style={{
          backgroundColor: "#E8A020",
          color: "#181410",
          fontWeight: "600",
          fontSize: "0.95rem",
          padding: "0.75rem 1.75rem",
          borderRadius: "10px",
          border: "none",
          cursor: "pointer",
          transition: "opacity 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
      >
        Retry
      </button>
    </div>
  );
}
