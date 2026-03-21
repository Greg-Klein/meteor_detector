"use client";
// components/Lightbox.tsx

import { useEffect } from "react";
import styles from "./Lightbox.module.css";

interface Props {
  src: string;
  caption: string;
  onClose: () => void;
}

export default function Lightbox({ src, caption, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.inner} onClick={(e) => e.stopPropagation()}>
        <button className={styles.close} onClick={onClose}>×</button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Météore" className={styles.img} />
        <div className={styles.caption}>{caption}</div>
      </div>
    </div>
  );
}
