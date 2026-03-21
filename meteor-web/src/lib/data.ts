// lib/data.ts
// Lit le fichier detections.json produit par meteor_pipeline.py
// Exécuté côté serveur uniquement (Next.js App Router server components)

import { Detection, NightSummary, Stats } from "@/types/meteor";
import fs from "fs";
import { getCurrentNightKey, getNightKey } from "./nightUtils";

// Chemin vers le fichier JSON produit par le pipeline Python
// Peut être surchargé via la variable d'environnement DETECTIONS_LOG
const DETECTIONS_LOG =
  process.env.DETECTIONS_LOG || "/home/youruser/meteors/detections.json";

export const ANNOTATED_DIR =
  process.env.ANNOTATED_DIR || "/home/youruser/meteors/annotated";

export function loadDetections(): Detection[] {
  try {
    if (!fs.existsSync(DETECTIONS_LOG)) return [];
    const raw = fs.readFileSync(DETECTIONS_LOG, "utf-8");
    return JSON.parse(raw) as Detection[];
  } catch {
    console.error("Impossible de lire detections.json");
    return [];
  }
}

export function saveDetections(detections: Detection[]): void {
  fs.writeFileSync(
    DETECTIONS_LOG,
    JSON.stringify(detections, null, 2),
    "utf-8",
  );
}

export function computeStats(detections: Detection[]): Stats {
  const currentNight = getCurrentNightKey();
  const totalMeteors = detections.reduce((s, d) => s + d.meteor_count, 0);
  const totalImages = detections.length;
  const tonight = detections
    .filter((d) => getNightKey(d.timestamp) === currentNight)
    .reduce((s, d) => s + d.meteor_count, 0);

  const nightMap: Record<string, number> = {};
  for (const d of detections) {
    const key = getNightKey(d.timestamp);
    nightMap[key] = (nightMap[key] || 0) + d.meteor_count;
  }

  const nights = Object.entries(nightMap).map(([date, count]) => ({
    date,
    count,
  }));
  const best = nights.sort((a, b) => b.count - a.count)[0] || {
    date: "-",
    count: 0,
  };

  return {
    totalMeteors,
    totalImages,
    tonight,
    totalNights: nights.length,
    bestNightCount: best.count,
    bestNightDate: best.date,
  };
}

export function computeNightSummaries(detections: Detection[]): NightSummary[] {
  const nightMap: Record<string, number> = {};
  for (const d of detections) {
    const key = getNightKey(d.timestamp);
    nightMap[key] = (nightMap[key] || 0) + d.meteor_count;
  }
  return Object.entries(nightMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
