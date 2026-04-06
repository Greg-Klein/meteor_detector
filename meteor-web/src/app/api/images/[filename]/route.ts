// app/api/images/[filename]/route.ts
// Sert les images annotées depuis le répertoire disk
// (Nginx peut aussi les servir directement en prod pour de meilleures performances)

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  ANNOTATED_DIR,
  POSITIVE_DATASET_DIR,
  FALSE_POSITIVE_DIR,
} from "@/lib/data";

function findImagePath(filename: string): string | null {
  const directCandidates = [
    path.join(ANNOTATED_DIR, filename),
    path.join(POSITIVE_DATASET_DIR, filename),
    path.join(FALSE_POSITIVE_DIR, filename),
  ];

  for (const candidate of directCandidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  const roots = [POSITIVE_DATASET_DIR, FALSE_POSITIVE_DIR];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const stack = [root];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) continue;
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(fullPath);
        } else if (entry.isFile() && entry.name === filename) {
          return fullPath;
        }
      }
    }
  }

  return null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { filename: string } }
) {
  // Sécurité : pas de path traversal
  const filename = path.basename(params.filename);
  const filePath = findImagePath(filename);

  if (!filePath || !fs.existsSync(filePath)) {
    return new NextResponse("Image non trouvée", { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
