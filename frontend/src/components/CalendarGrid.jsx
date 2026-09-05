"use client";

import { useMemo } from "react";
import styles from "./CalendarGrid.module.css";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

export default function CalendarGrid({
  year,
  month,
  calendarData,
  selectedDate,
  calendarGoal,
  onDateSelect,
  onMonthChange,
}) {
  const today = useMemo(() => new Date(), []);

  // Map calendar data for quick lookup
  const dataMap = useMemo(() => {
    const map = {};
    if (calendarData?.days) {
      calendarData.days.forEach((d) => {
        map[d.date] = d;
      });
    }
    return map;
  }, [calendarData]);

  // Generate calendar grid (6 weeks max)
  const gridDays = useMemo(() => {
    const firstDay = new Date(year, month - 1, 1);
    // getDay: 0=Sun, we want Mon=0
    let startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month, 0).getDate();

    const days = [];

    // Previous month padding
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, -i);
      days.push({ date: d, isCurrentMonth: false });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month - 1, i);
      days.push({ date: d, isCurrentMonth: true });
    }

    // Next month padding (fill to 42 = 6 rows)
    while (days.length < 42) {
      const d = new Date(year, month - 1, daysInMonth + (days.length - startOffset - daysInMonth + 1));
      days.push({ date: d, isCurrentMonth: false });
    }

    return days;
  }, [year, month]);

  const prevMonth = () => {
    if (month === 1) onMonthChange(year - 1, 12);
    else onMonthChange(year, month - 1);
  };

  const nextMonth = () => {
    if (month === 12) onMonthChange(year + 1, 1);
    else onMonthChange(year, month + 1);
  };

  const getStatusColor = (dayData) => {
    if (!dayData || !calendarGoal) return null;
    const pct = dayData.total_calories / calendarGoal;
    if (pct > 1) return "over";   // red
    if (pct > 0.7) return "good";  // yellow-green
    return "light";                // light
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.navBtn} onClick={prevMonth}>‹</button>
        <span className={styles.monthLabel}>{MONTH_NAMES[month - 1]} {year}</span>
        <button className={styles.navBtn} onClick={nextMonth}>›</button>
      </div>

      <div className={styles.dayHeaders}>
        {DAY_HEADERS.map((d) => (
          <span key={d} className={styles.dayHeader}>{d}</span>
        ))}
      </div>

      <div className={styles.grid}>
        {gridDays.map(({ date: d, isCurrentMonth }, idx) => {
          const dateStr = formatDateStr(d);
          const dayData = dataMap[dateStr];
          const isSelected = selectedDate && isSameDay(d, selectedDate);
          const isToday = isSameDay(d, today);
          const status = getStatusColor(dayData);

          return (
            <button
              key={idx}
              className={`
                ${styles.cell}
                ${!isCurrentMonth ? styles.faded : ""}
                ${isSelected ? styles.selected : ""}
                ${isToday ? styles.today : ""}
                ${status ? styles[status] : ""}
              `}
              onClick={() => onDateSelect(d)}
            >
              <span className={styles.cellNum}>{d.getDate()}</span>
              {dayData && isCurrentMonth && (
                <span className={styles.cellCalories}>{dayData.total_calories}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
