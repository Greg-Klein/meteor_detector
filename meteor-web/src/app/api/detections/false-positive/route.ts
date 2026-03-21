// app/api/detections/false-positive/route.ts
// Marque une détection comme faux positif : retire du JSON et supprime l'image annotée

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import {
  loadDetections,
  saveDetections,
  ANNOTATED_DIR,
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

  const nextList = detections.filter((d) => d.timestamp !== timestamp);
  saveDetections(nextList);

  if (annotatedFile) {
    const filePath = path.join(ANNOTATED_DIR, path.basename(annotatedFile));
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error("Impossible de supprimer l'image annotée:", filePath, err);
        return NextResponse.json(
          { ok: true, warning: "Détection retirée mais fichier image non supprimé" },
          { status: 200 }
        );
      }
    }
  }

  return NextResponse.json({ ok: true });
}
