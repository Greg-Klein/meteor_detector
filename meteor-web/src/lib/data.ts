// lib/data.ts
// Lit le fichier detections.json produit par meteor_pipeline.py
// Exécuté côté serveur uniquement (Next.js App Router server components)

import { Detection, NightSummary, Stats } from "@/types/meteor";
import fs from "fs";
import path from "path";
import { getCurrentNightKey, getNightKey } from "./nightUtils";

// Chemin vers le fichier JSON produit par le pipeline Python
// Peut être surchargé via la variable d'environnement DETECTIONS_LOG
const DETECTIONS_LOG =
  process.env.DETECTIONS_LOG || "/home/youruser/meteors/detections.json";

const METEORS_ROOT = path.dirname(DETECTIONS_LOG);

export const ANNOTATED_DIR =
  process.env.ANNOTATED_DIR || path.join(METEORS_ROOT, "annotated");

export const PROCESSED_DIR =
  process.env.PROCESSED_DIR || path.join(METEORS_ROOT, "processed");

export const FALSE_POSITIVE_DIR =
  process.env.FALSE_POSITIVE_DIR ||
  path.join(METEORS_ROOT, "dataset", "false_positives");

export const POSITIVE_DATASET_DIR =
  process.env.POSITIVE_DATASET_DIR ||
  path.join(METEORS_ROOT, "dataset", "positives");

function listJsonFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];

  const results: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".json")) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

function resolveAnnotatedFilenameFromArchive(
  archiveDir: string,
  fallbackImageName: string,
): string | null {
  const files = fs.readdirSync(archiveDir);
  const annotated = files.find((name) => name.endsWith("_annotated.jpg"));
  if (annotated) return annotated;

  const jpg = files.find((name) => name === fallbackImageName);
  return jpg || null;
}

export function loadArchivedDetections(rootDir: string): Detection[] {
  const jsonFiles = listJsonFiles(rootDir);

  return jsonFiles
    .map((jsonPath) => {
      try {
        const raw = fs.readFileSync(jsonPath, "utf-8");
        const parsed = JSON.parse(raw) as Partial<Detection>;
        const archiveDir = path.dirname(jsonPath);
        const imageName = path.basename(parsed.image || path.basename(jsonPath, ".json"));

        return {
          timestamp: parsed.timestamp || new Date(0).toISOString(),
          image: imageName,
          meteor_count: parsed.meteor_count ?? 0,
          detections: parsed.detections || [],
          annotated_filename:
            resolveAnnotatedFilenameFromArchive(archiveDir, imageName),
          night: parsed.night || path.basename(path.dirname(jsonPath)),
        } satisfies Detection;
      } catch {
        return null;
      }
    })
    .filter((item): item is Detection => item !== null)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

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
