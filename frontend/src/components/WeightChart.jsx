"use client";

import { useState } from "react";
import styles from "./WeightChart.module.css";

export default function WeightChart({
  historyData,
  onLogWeight,
  onTimeframeChange,
  currentTimeframe = 30,
}) {
  const [weightInput, setWeightInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const logs = historyData?.logs || [];
  const startWeight = historyData?.start_weight;
  const currentWeight = historyData?.current_weight;
  const netChange = historyData?.net_change_kg;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!weightInput || isNaN(weightInput)) return;
    setSubmitting(true);
    try {
      await onLogWeight(parseFloat(weightInput));
      setWeightInput("");
    } finally {
      setSubmitting(false);
    }
  };

  // SVG Chart Geometry
  const width = 500;
  const height = 140;
  const padding = 25;

  let points = [];
  let pathD = "";
  let areaD = "";
  let minY = 0;
  let maxY = 100;

  if (logs.length > 0) {
    const weights = logs.map((l) => l.weight_kg);
    minY = Math.min(...weights) - 1.0;
    maxY = Math.max(...weights) + 1.0;
    if (minY === maxY) {
      minY -= 1;
      maxY += 1;
    }

    points = logs.map((log, index) => {
      const x =
        logs.length === 1
          ? width / 2
          : padding + (index / (logs.length - 1)) * (width - padding * 2);
      const y =
        height -
        padding -
        ((log.weight_kg - minY) / (maxY - minY)) * (height - padding * 2);
      return { x, y, weight: log.weight_kg, date: log.logged_date, id: log.id };
    });

    if (points.length === 1) {
      pathD = `M ${points[0].x} ${points[0].y}`;
      areaD = `M ${points[0].x} ${height - padding} L ${points[0].x} ${points[0].y} L ${points[0].x} ${height - padding} Z`;
    } else {
      pathD = points.reduce(
        (acc, p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`),
        ""
      );
      areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;
    }
  }

  return (
    <div className={styles.card}>
      {/* Header Row */}
      <div className={styles.headerRow}>
        <div className={styles.titleGroup}>
          <h3 className={styles.title}>📈 Weight & Body Trend</h3>
          <span className={styles.subtitle}>Track your body composition changes</span>
        </div>

        <div className={styles.timeframeSelector}>
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              className={`${styles.timeframeBtn} ${currentTimeframe === d ? styles.active : ""}`}
              onClick={() => onTimeframeChange(d)}
            >
              {d}D
            </button>
          ))}
        </div>
      </div>

      {/* Stats Row */}
      <div className={styles.statsRow}>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Start Weight</span>
          <span className={styles.statVal}>
            {startWeight ? `${startWeight} kg` : "--"}
          </span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Current</span>
          <span className={styles.statVal}>
            {currentWeight ? `${currentWeight} kg` : "--"}
          </span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Net Change</span>
          <span
            className={`${styles.statVal} ${
              netChange < 0 ? styles.loss : netChange > 0 ? styles.gain : ""
            }`}
          >
            {netChange !== null && netChange !== undefined
              ? `${netChange > 0 ? "+" : ""}${netChange} kg`
              : "--"}
          </span>
        </div>
      </div>

      {/* SVG Line Chart */}
      {logs.length === 0 ? (
        <div className={styles.emptyChart}>
          <span>⚖️ No weight logs recorded yet</span>
          <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>
            Log your current weight below to start plotting your trend line
          </span>
        </div>
      ) : (
        <div className={styles.chartContainer}>
          <svg className={styles.svg} viewBox={`0 0 ${width} ${height}`}>
            <defs>
              <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary, #6366f1)" stopOpacity="0.4" />
                <stop offset="100%" stopColor="var(--color-primary, #6366f1)" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid Line */}
            <line
              x1={padding}
              y1={height - padding}
              x2={width - padding}
              y2={height - padding}
              className={styles.gridLine}
            />

            {/* Area & Line */}
            <path d={areaD} className={styles.areaFill} />
            <path d={pathD} className={styles.linePath} />

            {/* Data Points */}
            {points.map((p) => (
              <g key={p.id}>
                <circle className={styles.point} cx={p.x} cy={p.y} r="5" />
                <title>{`${p.date}: ${p.weight} kg`}</title>
              </g>
            ))}

            {/* Min/Max Y Labels */}
            <text x={padding} y={padding - 5} className={styles.axisText}>
              {maxY.toFixed(1)} kg
            </text>
            <text x={padding} y={height - 5} className={styles.axisText}>
              {minY.toFixed(1)} kg
            </text>
          </svg>
        </div>
      )}

      {/* Quick Weight Input Form */}
      <form className={styles.inputForm} onSubmit={handleSubmit}>
        <div className={styles.inputGroup}>
          <input
            type="number"
            step="0.1"
            min="20"
            max="300"
            placeholder="e.g. 68.5"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            className={styles.input}
            required
          />
          <span className={styles.unit}>kg today</span>
        </div>
        <button type="submit" className={styles.logBtn} disabled={submitting}>
          {submitting ? "Saving..." : "Log Weight"}
        </button>
      </form>
    </div>
  );
}
