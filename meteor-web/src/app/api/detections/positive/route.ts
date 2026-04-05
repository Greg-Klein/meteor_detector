// app/api/detections/positive/route.ts
// Archive une détection validée dans le dataset des positifs

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import {
  loadDetections,
  ANNOTATED_DIR,
  POSITIVE_DATASET_DIR,
  PROCESSED_DIR,
} from "@/lib/data";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { timestamp: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Body JSON invalide" },
      { status: 400 }
    );
  }

  const { timestamp } = body;
  if (!timestamp || typeof timestamp !== "string") {
    return NextResponse.json(
      { error: "timestamp requis (string ISO)" },
      { status: 400 }
    );
  }

  const detections = loadDetections();
  const detection = detections.find((d) => d.timestamp === timestamp);
  if (!detection) {
    return NextResponse.json(
      { error: "Détection non trouvée" },
      { status: 404 }
    );
  }

  const archiveDir = path.join(POSITIVE_DATASET_DIR, detection.night || "unknown");
  fs.mkdirSync(archiveDir, { recursive: true });

  const sourceImagePath = path.join(
    PROCESSED_DIR,
    detection.night || "unknown",
    path.basename(detection.image),
  );
  const archivedImagePath = path.join(archiveDir, path.basename(detection.image));

  if (fs.existsSync(sourceImagePath) && !fs.existsSync(archivedImagePath)) {
    fs.copyFileSync(sourceImagePath, archivedImagePath);
  }

  if (detection.annotated_filename) {
    const annotatedPath = path.join(
      ANNOTATED_DIR,
      path.basename(detection.annotated_filename),
    );
    const archivedAnnotatedPath = path.join(
      archiveDir,
      path.basename(detection.annotated_filename),
    );

    if (fs.existsSync(annotatedPath) && !fs.existsSync(archivedAnnotatedPath)) {
      fs.copyFileSync(annotatedPath, archivedAnnotatedPath);
    }
  }

  const metadataPath = path.join(
    archiveDir,
    `${path.parse(path.basename(detection.image)).name}.json`,
  );
  fs.writeFileSync(metadataPath, JSON.stringify(detection, null, 2), "utf-8");

  return NextResponse.json({ ok: true });
}
