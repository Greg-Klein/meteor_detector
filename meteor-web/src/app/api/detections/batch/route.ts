// app/api/detections/batch/route.ts
// Archive plusieurs detections depuis le dashboard.

import { NextRequest, NextResponse } from "next/server";
import {
  archiveFalsePositiveDetection,
  archivePositiveDetection,
} from "@/lib/archiveDetection";

export const dynamic = "force-dynamic";

type BatchAction = "positive" | "false-positive";

export async function POST(req: NextRequest) {
  let body: { timestamps?: unknown; action?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Body JSON invalide" },
      { status: 400 },
    );
  }

  if (body.action !== "positive" && body.action !== "false-positive") {
    return NextResponse.json(
      { error: "action requise: positive ou false-positive" },
      { status: 400 },
    );
  }

  if (
    !Array.isArray(body.timestamps) ||
    body.timestamps.some((timestamp) => typeof timestamp !== "string")
  ) {
    return NextResponse.json(
      { error: "timestamps requis (string[])" },
      { status: 400 },
    );
  }

  const action = body.action as BatchAction;
  const timestamps = Array.from(new Set(body.timestamps as string[]));
  const archive =
    action === "positive"
      ? archivePositiveDetection
      : archiveFalsePositiveDetection;

  const results = timestamps.map((timestamp) => archive(timestamp));
  const failures = results.filter((result) => !result.ok);

  return NextResponse.json(
    {
      ok: failures.length === 0,
      processed: results.length - failures.length,
      failed: failures.length,
      results,
    },
    { status: failures.length === 0 ? 200 : 207 },
  );
}
