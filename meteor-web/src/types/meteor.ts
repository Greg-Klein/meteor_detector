// Types partagés pour les données de détection

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  length: number;
}

export interface Detection {
  timestamp: string;          // ISO 8601, ex: "2025-08-14T23:04:11.234"
  image: string;              // nom du fichier source
  meteor_count: number;       // toujours 0 ou 1 (1 météore max par image)
  detections: Segment[];      // segments détectés (max 1)
  annotated_filename: string | null; // nom du fichier image annoté
  night: string;              // "YYYY-MM-DD"
}

export interface NightSummary {
  date: string;
  count: number;
}

export interface Stats {
  totalMeteors: number;
  totalImages: number;
  tonight: number;
  totalNights: number;
  bestNightCount: number;
  bestNightDate: string;
}
