// app/api/detections/positive/route.ts
// Archive une détection validée dans le dataset des positifs

import { NextRequest, NextResponse } from "next/server";
import { archivePositiveDetection } from "@/lib/archiveDetection";

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

  const result = archivePositiveDetection(timestamp);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result);
}
