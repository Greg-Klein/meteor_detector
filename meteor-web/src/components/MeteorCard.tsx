"use client";
// components/MeteorCard.tsx

import { Detection } from "@/types/meteor";
import { useState } from "react";
import styles from "./MeteorCard.module.css";
import Lightbox from "./Lightbox";
import ConfirmModal from "./ConfirmModal";

interface Props {
  detection: Detection;
  onFalsePositive?: () => void;
}

function formatTime(iso: string): string {
  return iso.replace("T", " ").slice(0, 19);
}

export default function MeteorCard({ detection, onFalsePositive }: Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const imgSrc = detection.annotated_filename
    ? `/api/images/${detection.annotated_filename}`
    : null;

  return (
    <>
      <div
        className={styles.card}
        onClick={() => imgSrc && setLightboxOpen(true)}
        style={{ cursor: imgSrc ? "pointer" : "default" }}
      >
        <div className={styles.imgWrap}>
          {imgSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgSrc}
              alt="Météore détecté"
              className={styles.img}
              loading="lazy"
            />
          ) : (
            <div className={styles.noImg}>🌠</div>
          )}
          <div className={styles.badge}>{detection.meteor_count} météore</div>
        </div>

        <div className={styles.body}>
          <div className={styles.time}>{formatTime(detection.timestamp)}</div>
          {detection.detections[0] && (
            <div className={styles.meta}>
              <span className={styles.chip}>
                {Math.round(detection.detections[0].length)} px
              </span>
              <span className={styles.chipMuted}>{detection.image}</span>
            </div>
          )}
          {onFalsePositive && (
            <button
              type="button"
              className={styles.falsePositiveBtn}
              onClick={(e) => {
                e.stopPropagation();
                if (removing) return;
                setConfirmOpen(true);
              }}
              disabled={removing}
            >
              {removing ? "…" : "Faux positif"}
            </button>
          )}
        </div>
      </div>

      {lightboxOpen && imgSrc && (
        <Lightbox
          src={imgSrc}
          caption={`${formatTime(detection.timestamp)}  ·  ${Math.round(detection.detections[0]?.length || 0)} px`}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      {confirmOpen && (
        <ConfirmModal
          message="Exclure cette détection (faux positif) ? Elle sera retirée des stats et l'image supprimée."
          confirmLabel="Exclure"
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => {
            setConfirmOpen(false);
            setRemoving(true);
            fetch("/api/detections/false-positive", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ timestamp: detection.timestamp }),
            })
              .then((res) => {
                if (res.ok) onFalsePositive?.();
              })
              .finally(() => setRemoving(false));
          }}
        />
      )}
    </>
  );
}
