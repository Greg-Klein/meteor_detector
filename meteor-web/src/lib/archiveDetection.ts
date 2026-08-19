import fs from "fs";
import path from "path";
import {
  ANNOTATED_DIR,
  FALSE_POSITIVE_DIR,
  POSITIVE_DATASET_DIR,
  PROCESSED_DIR,
  loadDetections,
  saveDetections,
} from "@/lib/data";

const DATASET_META_DIRNAME = "_meta";

export type ArchiveResult =
  | { ok: true; timestamp: string }
  | { ok: false; timestamp: string; error: string; status: number };

function copyIfPresent(sourcePath: string, destinationPath: string): void {
  if (fs.existsSync(sourcePath) && !fs.existsSync(destinationPath)) {
    fs.copyFileSync(sourcePath, destinationPath);
  }
}

function removeIfPresent(filePath: string): void {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

export function archivePositiveDetection(timestamp: string): ArchiveResult {
  const detections = loadDetections();
  const detection = detections.find((d) => d.timestamp === timestamp);
  if (!detection) {
    return { ok: false, timestamp, error: "Détection non trouvée", status: 404 };
  }

  const archiveDir = path.join(POSITIVE_DATASET_DIR, detection.night || "unknown");
  const metaDir = path.join(archiveDir, DATASET_META_DIRNAME);
  fs.mkdirSync(archiveDir, { recursive: true });
  fs.mkdirSync(metaDir, { recursive: true });

  const sourceImagePath = path.join(
    PROCESSED_DIR,
    detection.night || "unknown",
    path.basename(detection.image),
  );
  const archivedImagePath = path.join(archiveDir, path.basename(detection.image));
  copyIfPresent(sourceImagePath, archivedImagePath);

  if (detection.annotated_filename) {
    const annotatedPath = path.join(
      ANNOTATED_DIR,
      path.basename(detection.annotated_filename),
    );
    const archivedAnnotatedPath = path.join(
      metaDir,
      path.basename(detection.annotated_filename),
    );
    copyIfPresent(annotatedPath, archivedAnnotatedPath);
  }

  const metadataPath = path.join(
    metaDir,
    `${path.parse(path.basename(detection.image)).name}.json`,
  );
  fs.writeFileSync(metadataPath, JSON.stringify(detection, null, 2), "utf-8");

  saveDetections(detections.filter((d) => d.timestamp !== timestamp));
  return { ok: true, timestamp };
}

export function archiveFalsePositiveDetection(timestamp: string): ArchiveResult {
  const detections = loadDetections();
  const removed = detections.find((d) => d.timestamp === timestamp);
  if (!removed) {
    return { ok: false, timestamp, error: "Détection non trouvée", status: 404 };
  }

  const annotatedFile = removed.annotated_filename;
  const archiveDir = path.join(FALSE_POSITIVE_DIR, removed.night || "unknown");
  const positiveDir = path.join(POSITIVE_DATASET_DIR, removed.night || "unknown");
  const metaDir = path.join(archiveDir, DATASET_META_DIRNAME);
  const positiveMetaDir = path.join(positiveDir, DATASET_META_DIRNAME);
  fs.mkdirSync(archiveDir, { recursive: true });
  fs.mkdirSync(metaDir, { recursive: true });

  const sourceImagePath = path.join(
    PROCESSED_DIR,
    removed.night || "unknown",
    path.basename(removed.image),
  );
  const archivedImagePath = path.join(archiveDir, path.basename(removed.image));
  copyIfPresent(sourceImagePath, archivedImagePath);

  saveDetections(detections.filter((d) => d.timestamp !== timestamp));

  if (annotatedFile) {
    const filePath = path.join(ANNOTATED_DIR, path.basename(annotatedFile));
    const archivedAnnotatedMetaPath = path.join(metaDir, path.basename(annotatedFile));
    copyIfPresent(filePath, archivedAnnotatedMetaPath);
  }

  const metadataPath = path.join(
    metaDir,
    `${path.parse(path.basename(removed.image)).name}.json`,
  );
  fs.writeFileSync(metadataPath, JSON.stringify(removed, null, 2), "utf-8");

  const positiveArtifacts = [
    path.join(positiveDir, path.basename(removed.image)),
    path.join(
      positiveDir,
      `${path.parse(path.basename(removed.image)).name}.json`,
    ),
    path.join(
      positiveMetaDir,
      `${path.parse(path.basename(removed.image)).name}.json`,
    ),
  ];
  if (annotatedFile) {
    positiveArtifacts.push(path.join(positiveDir, path.basename(annotatedFile)));
    positiveArtifacts.push(path.join(positiveMetaDir, path.basename(annotatedFile)));
  }

  for (const artifactPath of positiveArtifacts) {
    try {
      removeIfPresent(artifactPath);
    } catch (err) {
      console.error("Impossible de retirer l'artefact du dataset positif:", artifactPath, err);
    }
  }

  return { ok: true, timestamp };
}
