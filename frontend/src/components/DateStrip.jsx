"use client";

import { useState, useEffect, useMemo } from "react";
import styles from "./DateStrip.module.css";

function getWeekDates(referenceDate) {
  const d = new Date(referenceDate);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7)); // get Monday

  const dates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    dates.push(date);
  }
  return dates;
}

function formatDateStr(d) {
  return d.toISOString().split("T")[0];
}

function isSameDay(d1, d2) {
  return formatDateStr(d1) === formatDateStr(d2);
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function DateStrip({ selectedDate, onDateSelect, calendarData, onToggleCalendar, calendarOpen }) {
  const today = useMemo(() => new Date(), []);
  const [weekRef, setWeekRef] = useState(selectedDate || today);
  const weekDates = useMemo(() => getWeekDates(weekRef), [weekRef]);

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

  const prevWeek = () => {
    const d = new Date(weekRef);
    d.setDate(d.getDate() - 7);
    setWeekRef(d);
  };

  const nextWeek = () => {
    const d = new Date(weekRef);
    d.setDate(d.getDate() + 7);
    setWeekRef(d);
  };

  const goToToday = () => {
    setWeekRef(today);
    onDateSelect(today);
  };

  // Update week when selectedDate changes externally (from calendar grid)
  useEffect(() => {
    if (selectedDate) {
      setWeekRef(selectedDate);
    }
  }, [selectedDate]);

  const isToday = isSameDay(selectedDate || today, today);

  return (
    <div className={styles.container}>
      <div className={styles.strip}>
        <button className={styles.navBtn} onClick={prevWeek} title="Previous week">‹</button>

        <div className={styles.days}>
          {weekDates.map((d, i) => {
            const dateStr = formatDateStr(d);
            const isSelected = isSameDay(d, selectedDate || today);
            const isCurrentDay = isSameDay(d, today);
            const hasData = !!dataMap[dateStr];

            return (
              <button
                key={dateStr}
                className={`${styles.day} ${isSelected ? styles.selected : ""} ${isCurrentDay ? styles.today : ""}`}
                onClick={() => onDateSelect(d)}
              >
                <span className={styles.dayName}>{DAY_NAMES[i]}</span>
                <span className={styles.dayNum}>{d.getDate()}</span>
                {hasData && <span className={styles.dot} />}
              </button>
            );
          })}
        </div>

        <button className={styles.navBtn} onClick={nextWeek} title="Next week">›</button>
      </div>

      <div className={styles.actions}>
        {!isToday && (
          <button className={styles.todayBtn} onClick={goToToday}>Today</button>
        )}
        <button
          className={`${styles.calendarToggle} ${calendarOpen ? styles.calendarActive : ""}`}
          onClick={onToggleCalendar}
          title="Toggle calendar"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </button>
      </div>
    </div>
  );
}
