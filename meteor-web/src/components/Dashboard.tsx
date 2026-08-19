"use client";
// components/Dashboard.tsx
// Composant client principal — gère l'état, le filtrage par nuit et l'auto-refresh

import { useEffect, useState, useCallback } from "react";
import { Detection, NightSummary, Stats } from "@/types/meteor";
import StatCard from "./StatCard";
import NightChart from "./NightChart";
import MeteorCard from "./MeteorCard";
import ConfirmModal from "./ConfirmModal";
import styles from "./Dashboard.module.css";

const REFRESH_INTERVAL_MS = 60_000; // 60 secondes

interface ApiResponse {
  detections: Detection[];
  positives: Detection[];
  falsePositives: Detection[];
  stats: Stats;
  nights: NightSummary[];
}

type GalleryTab = "detections" | "positives" | "falsePositives";
type BatchAction = "positive" | "false-positive";

export default function Dashboard() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [activeNight, setActiveNight] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<GalleryTab>("detections");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [clock, setClock] = useState("");
  const [selectedTimestamps, setSelectedTimestamps] = useState<Set<string>>(
    () => new Set(),
  );
  const [batchAction, setBatchAction] = useState<BatchAction | null>(null);
  const [batchProcessing, setBatchProcessing] = useState(false);

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
  const tabDetections = data
    ? activeTab === "positives"
      ? data.positives
      : activeTab === "falsePositives"
        ? data.falsePositives
        : data.detections
    : [];

  const visibleDetections = data
    ? activeNight
      ? tabDetections.filter((d) => d.night === activeNight)
      : tabDetections
    : [];

  const visibleTimestamps = visibleDetections.map((d) => d.timestamp);
  const selectedVisibleTimestamps = visibleTimestamps.filter((timestamp) =>
    selectedTimestamps.has(timestamp),
  );
  const canUseSelection = activeTab === "detections" && visibleDetections.length > 0;
  const allVisibleSelected =
    canUseSelection &&
    visibleTimestamps.every((timestamp) => selectedTimestamps.has(timestamp));

  function switchTab(tab: GalleryTab) {
    setActiveTab(tab);
    setSelectedTimestamps(new Set());
  }

  function toggleSelected(timestamp: string) {
    setSelectedTimestamps((current) => {
      const next = new Set(current);
      if (next.has(timestamp)) {
        next.delete(timestamp);
      } else {
        next.add(timestamp);
      }
      return next;
    });
  }

  function toggleSelectAllVisible() {
    setSelectedTimestamps((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        visibleTimestamps.forEach((timestamp) => next.delete(timestamp));
      } else {
        visibleTimestamps.forEach((timestamp) => next.add(timestamp));
      }
      return next;
    });
  }

  async function confirmBatchAction() {
    if (!batchAction || selectedVisibleTimestamps.length === 0) return;

    setBatchProcessing(true);
    try {
      const res = await fetch("/api/detections/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: batchAction,
          timestamps: selectedVisibleTimestamps,
        }),
      });

      if (res.ok || res.status === 207) {
        setSelectedTimestamps(new Set());
        await fetchData();
      }
    } finally {
      setBatchProcessing(false);
      setBatchAction(null);
    }
  }

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
                onClick={() => {
                  setActiveNight(null);
                  setSelectedTimestamps(new Set());
                }}
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
        <div className={styles.tabs}>
          <button
            className={activeTab === "detections" ? styles.tabActive : styles.tab}
            onClick={() => switchTab("detections")}
          >
            Detections
          </button>
          <button
            className={activeTab === "positives" ? styles.tabActive : styles.tab}
            onClick={() => switchTab("positives")}
          >
            Positifs
          </button>
          <button
            className={activeTab === "falsePositives" ? styles.tabActive : styles.tab}
            onClick={() => switchTab("falsePositives")}
          >
            Faux positifs
          </button>
        </div>

        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            {activeNight
              ? `Nuit du ${activeNight}`
              : activeTab === "positives"
                ? "Images positives"
                : activeTab === "falsePositives"
                  ? "Images faux positifs"
                  : "Tous les météores"}
          </h2>
          <span className={styles.count}>
            {visibleDetections.length} image(s)
          </span>
        </div>

        {canUseSelection && (
          <div className={styles.bulkBar}>
            <label className={styles.selectAll}>
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleSelectAllVisible}
              />
              <span>
                {selectedVisibleTimestamps.length > 0
                  ? `${selectedVisibleTimestamps.length} sélectionnée(s)`
                  : "Sélection multiple"}
              </span>
            </label>
            <div className={styles.bulkActions}>
              <button
                type="button"
                className={styles.bulkPositiveBtn}
                disabled={selectedVisibleTimestamps.length === 0 || batchProcessing}
                onClick={() => setBatchAction("positive")}
              >
                Marquer comme météore
              </button>
              <button
                type="button"
                className={styles.bulkFalsePositiveBtn}
                disabled={selectedVisibleTimestamps.length === 0 || batchProcessing}
                onClick={() => setBatchAction("false-positive")}
              >
                Marquer faux positifs
              </button>
            </div>
          </div>
        )}

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
                : activeTab === "positives"
                  ? "Aucune image positive archivée pour l'instant."
                  : activeTab === "falsePositives"
                    ? "Aucun faux positif archivé pour l'instant."
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
                onMarkPositive={activeTab === "detections" ? fetchData : undefined}
                onFalsePositive={activeTab === "detections" ? fetchData : undefined}
                selectable={activeTab === "detections"}
                selected={selectedTimestamps.has(d.timestamp)}
                selectionDisabled={batchProcessing}
                onToggleSelected={() => toggleSelected(d.timestamp)}
              />
            ))}
          </div>
        )}
      </section>

      {batchAction && (
        <ConfirmModal
          message={
            batchAction === "positive"
              ? `Valider ${selectedVisibleTimestamps.length} détection(s) comme météore ? Les images sources seront archivées dans le dataset des positifs.`
              : `Exclure ${selectedVisibleTimestamps.length} détection(s) comme faux positif ? Elles seront archivées dans le dataset des faux positifs.`
          }
          confirmLabel={batchAction === "positive" ? "Valider" : "Exclure"}
          onCancel={() => setBatchAction(null)}
          onConfirm={confirmBatchAction}
        />
      )}

      {/* ── FOOTER ── */}
      <footer className={styles.footer}>
        AllSky Meteor Detector — Raspberry Pi — Auto-refresh 60 s
      </footer>
    </div>
  );
}
