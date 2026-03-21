// app/api/images/[filename]/route.ts
// Sert les images annotées depuis le répertoire disk
// (Nginx peut aussi les servir directement en prod pour de meilleures performances)

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { ANNOTATED_DIR } from "@/lib/data";

export async function GET(
  _req: NextRequest,
  { params }: { params: { filename: string } }
) {
  // Sécurité : pas de path traversal
  const filename = path.basename(params.filename);
  const filePath = path.join(ANNOTATED_DIR, filename);

  if (!fs.existsSync(filePath)) {
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
