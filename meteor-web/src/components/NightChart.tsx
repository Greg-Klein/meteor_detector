"use client";
// components/NightChart.tsx
// Graphique en barres interactif — une barre par nuit

import { NightSummary } from "@/types/meteor";
import styles from "./NightChart.module.css";

interface Props {
  nights: NightSummary[];
  activeNight: string | null;
  onSelectNight: (night: string | null) => void;
}

export default function NightChart({ nights, activeNight, onSelectNight }: Props) {
  if (nights.length === 0) return null;

  const last30 = nights.slice(-30);
  const maxCount = Math.max(...last30.map((n) => n.count), 1);

  return (
    <div className={styles.wrap}>
      {last30.map((n) => {
        const heightPct = Math.max((n.count / maxCount) * 100, 4);
        const isActive = activeNight === n.date;
        const label = n.date.slice(5); // "MM-DD"
        return (
          <button
            key={n.date}
            className={`${styles.barWrap} ${isActive ? styles.active : ""}`}
            onClick={() => onSelectNight(isActive ? null : n.date)}
            title={`${n.date} — ${n.count} météore(s)`}
          >
            <span className={styles.count}>{n.count}</span>
            <span
              className={styles.bar}
              style={{ height: `${heightPct}%` }}
            />
            <span className={styles.label}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
