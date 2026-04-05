// app/api/detections/false-positive/route.ts
// Archive un faux positif pour le dataset, puis le retire du JSON centralisé

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import {
  loadDetections,
  saveDetections,
  ANNOTATED_DIR,
  FALSE_POSITIVE_DIR,
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
  const index = detections.findIndex((d) => d.timestamp === timestamp);
  if (index === -1) {
    return NextResponse.json(
      { error: "Détection non trouvée" },
      { status: 404 }
    );
  }

  const removed = detections[index];
  const annotatedFile = removed.annotated_filename;
  const archiveDir = path.join(FALSE_POSITIVE_DIR, removed.night || "unknown");
  fs.mkdirSync(archiveDir, { recursive: true });

  const sourceImagePath = path.join(
    PROCESSED_DIR,
    removed.night || "unknown",
    path.basename(removed.image),
  );
  const archivedImagePath = path.join(archiveDir, path.basename(removed.image));

  if (fs.existsSync(sourceImagePath) && !fs.existsSync(archivedImagePath)) {
    fs.copyFileSync(sourceImagePath, archivedImagePath);
  }

  const nextList = detections.filter((d) => d.timestamp !== timestamp);
  saveDetections(nextList);

  if (annotatedFile) {
    const filePath = path.join(ANNOTATED_DIR, path.basename(annotatedFile));
    if (fs.existsSync(filePath)) {
      try {
        const archivedAnnotatedPath = path.join(archiveDir, path.basename(annotatedFile));
        if (!fs.existsSync(archivedAnnotatedPath)) {
          fs.copyFileSync(filePath, archivedAnnotatedPath);
        }
      } catch (err) {
        console.error("Impossible d'archiver l'image annotée:", filePath, err);
        return NextResponse.json(
          { ok: true, warning: "Détection retirée mais image annotée non archivée" },
          { status: 200 }
        );
      }
    }
  }

  const metadataPath = path.join(
    archiveDir,
    `${path.parse(path.basename(removed.image)).name}.json`,
  );
  fs.writeFileSync(metadataPath, JSON.stringify(removed, null, 2), "utf-8");

  return NextResponse.json({ ok: true });
}
