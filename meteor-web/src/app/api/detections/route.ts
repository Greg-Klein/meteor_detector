// app/api/detections/route.ts
// Endpoint JSON pour le client (auto-refresh côté client)

import { NextResponse } from "next/server";
import { loadDetections, computeStats, computeNightSummaries } from "@/lib/data";
import { getNightKey } from "@/lib/nightUtils";

export const dynamic = "force-dynamic"; // pas de cache — toujours frais

export async function GET() {
  const raw = loadDetections();
  const detections = raw.map((d) => ({
    ...d,
    night: getNightKey(d.timestamp),
  }));
  const stats = computeStats(raw);
  const nights = computeNightSummaries(raw);

  return NextResponse.json({
    detections: [...detections].reverse(), // plus récent en premier
    stats,
    nights,
  });
}
