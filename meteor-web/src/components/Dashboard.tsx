"use client";
// components/Dashboard.tsx
// Composant client principal — gère l'état, le filtrage par nuit et l'auto-refresh

import { useEffect, useState, useCallback } from "react";
import { Detection, NightSummary, Stats } from "@/types/meteor";
import StatCard from "./StatCard";
import NightChart from "./NightChart";
import MeteorCard from "./MeteorCard";
import styles from "./Dashboard.module.css";

const REFRESH_INTERVAL_MS = 60_000; // 60 secondes

interface ApiResponse {
  detections: Detection[];
  stats: Stats;
  nights: NightSummary[];
}

export default function Dashboard() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [activeNight, setActiveNight] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [clock, setClock] = useState("");

  // Fetch des données
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/detections", { cache: "no-store" });
      if (res.ok) {
        const json: ApiResponse = await res.json();
        setData(json);
        setLastUpdate(new Date());
      }
    } catch {
      console.error("Erreur fetch détections");
    }
  }, []);

  // Premier chargement + auto-refresh
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Horloge temps réel
  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleString("fr-FR", { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Filtrage des détections selon la nuit sélectionnée
  const visibleDetections = data
    ? activeNight
      ? data.detections.filter((d) => d.night === activeNight)
      : data.detections
    : [];

  return (
    <div className={styles.wrapper}>
      {/* ── HEADER ── */}
      <header className={styles.header}>
        <div>
          <span className={styles.logo}>AllSky Observatory</span>
          <h1 className={styles.h1}>
            Météo<span className={styles.accent}>res</span>
          </h1>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.clock}>{clock}</div>
          <div className={styles.nightCount}>
            {data ? `${data.stats.totalNights} nuit(s) archivée(s)` : "—"}
          </div>
          {lastUpdate && (
            <div className={styles.updated}>
              Màj {lastUpdate.toLocaleTimeString("fr-FR")}
            </div>
          )}
        </div>
      </header>

      {/* ── STATS ── */}
      {data && (
        <div className={styles.statsRow}>
          <StatCard
            label="Total météores"
            value={data.stats.totalMeteors}
            color="accent"
          />
          <StatCard
            label="Images détectées"
            value={data.stats.totalImages}
          />
          <StatCard
            label="Cette nuit"
            value={data.stats.tonight}
            color="green"
          />
          <StatCard
            label="Nuit record"
            value={data.stats.bestNightCount}
            color="orange"
            sub={data.stats.bestNightDate}
          />
        </div>
      )}

      {/* ── GRAPHIQUE ── */}
      {data && data.nights.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Activité par nuit</h2>
            {activeNight && (
              <button
                className={styles.resetBtn}
                onClick={() => setActiveNight(null)}
              >
                ✕ Toutes les nuits
              </button>
            )}
          </div>
          <NightChart
            nights={data.nights}
            activeNight={activeNight}
            onSelectNight={setActiveNight}
          />
        </section>
      )}

      {/* ── GALERIE ── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            {activeNight ? `Nuit du ${activeNight}` : "Tous les météores"}
          </h2>
          <span className={styles.count}>
            {visibleDetections.length} image(s)
          </span>
        </div>

        {!data && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>⏳</div>
            <p>Chargement…</p>
          </div>
        )}

        {data && visibleDetections.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🔭</div>
            <p>
              {activeNight
                ? "Aucun météore détecté cette nuit-là."
                : "Aucun météore détecté pour l'instant."}
            </p>
          </div>
        )}

        {visibleDetections.length > 0 && (
          <div className={styles.gallery}>
            {visibleDetections.map((d, i) => (
              <MeteorCard
                key={`${d.timestamp}-${i}`}
                detection={d}
                onMarkPositive={() => {}}
                onFalsePositive={fetchData}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── FOOTER ── */}
      <footer className={styles.footer}>
        AllSky Meteor Detector — Raspberry Pi — Auto-refresh 60 s
      </footer>
    </div>
  );
}
