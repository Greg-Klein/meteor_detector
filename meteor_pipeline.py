#!/usr/bin/env python3
"""
meteor_pipeline.py
------------------
Core pipeline : détection météores + publication MQTT + notification Telegram + sauvegarde image annotée.
Produit aussi :
  - detections.json      : log centralisé pour le tableau de bord Next.js
  - <stem>_meteor.json   : dans processed_dir, utilisé par meteor_nightly_report.py

Usage direct :
    python3 meteor_pipeline.py <image.jpg> [--config config.json]
"""

from __future__ import annotations

import argparse
import json
import logging
import math
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import paho.mqtt.client as mqtt
import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config par défaut — surchargeable via config.json
# ---------------------------------------------------------------------------
DEFAULT_CONFIG: dict[str, Any] = {
    # MQTT
    "mqtt_host": "192.168.0.1",
    "mqtt_port": 1883,
    "mqtt_username": "",
    "mqtt_password": "",
    "mqtt_topic_detection": "observatory/meteors/detection",
    "mqtt_topic_nightly": "observatory/meteors/nightly",

    # Telegram
    "telegram_token": "VOTRE_TOKEN",
    "telegram_chat_id": "VOTRE_CHAT_ID",
    "telegram_send_image": True,

    # Détection
    "min_length": 100,
    "max_length": 2500,
    "cloud_area_threshold": 1550,

    # Stockage
    "annotated_dir": "/home/youruser/meteors/annotated",
    "processed_dir": "/home/youruser/meteors/processed",
    "watch_dir": "/home/youruser/meteors/incoming",

    # Masque AllSky (zones à ignorer — fond noir = masqué, blanc = actif)
    "mask": "/home/youruser/meteor_detector/mask.png",

    # Rapport web — fichier JSON centralisé lu par le site Next.js
    "detections_log": "/home/youruser/meteors/detections.json",
    "max_log_entries": 2000,
}


def load_config(path: Path | None) -> dict[str, Any]:
    cfg = DEFAULT_CONFIG.copy()
    if path and path.exists():
        with open(path, encoding="utf-8") as f:
            cfg.update(json.load(f))
    return cfg


# ---------------------------------------------------------------------------
# Log JSON centralisé (pour le site Next.js)
# ---------------------------------------------------------------------------

def append_detection_log(result: dict[str, Any], cfg: dict[str, Any]) -> None:
    """Ajoute la détection dans detections.json (lu par le site web)."""
    log_path = Path(cfg.get("detections_log", "/home/youruser/meteors/detections.json"))
    log_path.parent.mkdir(parents=True, exist_ok=True)

    entries: list[dict] = []
    if log_path.exists():
        try:
            with open(log_path, encoding="utf-8") as f:
                entries = json.load(f)
        except (json.JSONDecodeError, OSError):
            entries = []

    annotated_path = result.get("annotated_path")
    ts = result["timestamp"]
    entry = {
        "timestamp": ts,
        "image": Path(result["image"]).name,
        "meteor_count": result["meteor_count"],
        "detections": result.get("detections", []),
        "annotated_filename": Path(annotated_path).name if annotated_path else None,
        "night": datetime.fromisoformat(ts).strftime("%Y-%m-%d"),
    }
    entries.append(entry)

    max_entries = int(cfg.get("max_log_entries", 2000))
    if len(entries) > max_entries:
        entries = entries[-max_entries:]

    with open(log_path, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)

    log.info(f"Détection loggée dans {log_path}")


# ---------------------------------------------------------------------------
# Détection météores (algorithme AllSky)
# ---------------------------------------------------------------------------

def detect_meteors(img_path: Path, cfg: dict[str, Any]) -> dict[str, Any]:
    img = cv2.imread(str(img_path), cv2.IMREAD_COLOR)
    if img is None:
        raise FileNotFoundError(f"Impossible de lire : {img_path}")

    h, w = img.shape[:2]
    min_length = int(cfg["min_length"])
    max_length = int(cfg.get("max_length", 850))

    # Rejeter les images tronquées (hauteur < 30% de la largeur = image incomplète)
    if h < w * 0.6:
        log.warning(f"Image tronquée détectée ({w}x{h}), ignorée : {img_path.name}")
        return {
            "image": str(img_path),
            "timestamp": datetime.now().isoformat(),
            "meteor_count": 0,
            "detections": [],
            "annotated_path": None,
        }

    # 1) Grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # 2) Canny
    canny = cv2.Canny(gray.astype(np.uint8), 100, 200, apertureSize=3).astype(np.uint8)

    # 3) Dilate + erode
    kernel = np.ones((3, 3), np.uint8)
    dilation = cv2.dilate(canny, kernel, iterations=2)
    dilation = cv2.erode(dilation, kernel, iterations=1)

    # 4) Masque nuages (contours > seuil)
    cloud_mask = np.zeros(dilation.shape, np.uint8)
    has_clouds = False
    contours, _ = cv2.findContours(dilation, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    for cnt in contours:
        if cv2.contourArea(cnt) > cfg["cloud_area_threshold"]:
            has_clouds = True
            cv2.drawContours(cloud_mask, [cnt], 0, 255, -1)

    if has_clouds:
        kernel7 = np.ones((7, 7), np.uint8)
        inv_cloud = cv2.bitwise_not(cloud_mask)
        dilation = np.clip(dilation * cv2.dilate(inv_cloud, kernel7, iterations=1), 0, 255).astype(np.uint8)

    # 5) Masque utilisateur (depuis config)
    mask_path = cfg.get("mask")
    if mask_path:
        mask_img = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
        if mask_img is not None:
            if mask_img.shape[:2] != (h, w):
                mask_img = cv2.resize(mask_img, (w, h), interpolation=cv2.INTER_NEAREST)
            dilation = cv2.bitwise_and(dilation, dilation, mask=mask_img)
        else:
            log.warning(f"Masque introuvable : {mask_path}")

    # 6) HoughLinesP
    lines = cv2.HoughLinesP(dilation, 3, np.pi / 180, 100, minLineLength=min_length, maxLineGap=20)

    segments: list[dict[str, Any]] = []
    if lines is not None:
        for line in lines:
            x1, y1, x2, y2 = line[0]
            length_px = float(math.hypot(x2 - x1, y2 - y1))
            segments.append({"x1": int(x1), "y1": int(y1), "x2": int(x2), "y2": int(y2), "length": round(length_px, 1)})

    # Une image = un seul météore possible — on garde uniquement le segment le plus long
    # et on vérifie qu'il respecte les limites min/max
    detections: list[dict[str, Any]] = []
    if segments:
        best = max(segments, key=lambda s: s["length"])
        if best["length"] > max_length:
            log.warning(f"Segment trop long ({best['length']} px > max {max_length} px), ignoré : {img_path.name}")
        else:
            detections.append(best)

    # 7) Image annotée si détection
    annotated_path: Path | None = None
    if detections:
        annotated_dir = Path(cfg["annotated_dir"])
        annotated_dir.mkdir(parents=True, exist_ok=True)
        annotated = img.copy()
        for d in detections:
            cv2.line(annotated, (d["x1"], d["y1"]), (d["x2"], d["y2"]), (0, 255, 0), 10)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        annotated_path = annotated_dir / f"{img_path.stem}_{ts}_annotated.jpg"
        cv2.imwrite(str(annotated_path), annotated, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
        log.info(f"Image annotée sauvegardée : {annotated_path}")

    return {
        "image": str(img_path),
        "timestamp": datetime.now().isoformat(),
        "meteor_count": len(detections),
        "detections": detections,
        "annotated_path": str(annotated_path) if annotated_path else None,
    }


# ---------------------------------------------------------------------------
# MQTT
# ---------------------------------------------------------------------------

def publish_mqtt(result: dict[str, Any], cfg: dict[str, Any], topic_key: str = "mqtt_topic_detection") -> None:
    client = mqtt.Client()
    if cfg.get("mqtt_username"):
        client.username_pw_set(cfg["mqtt_username"], cfg["mqtt_password"])
    try:
        client.connect(cfg["mqtt_host"], int(cfg["mqtt_port"]), keepalive=10)
        payload = json.dumps({k: v for k, v in result.items() if k != "annotated_path"})
        client.publish(cfg[topic_key], payload, qos=1, retain=False)
        client.disconnect()
        log.info(f"MQTT publié sur {cfg[topic_key]}")
    except Exception as e:
        log.error(f"Erreur MQTT : {e}")


# ---------------------------------------------------------------------------
# Telegram
# ---------------------------------------------------------------------------

def notify_telegram(result: dict[str, Any], cfg: dict[str, Any]) -> None:
    token = cfg["telegram_token"]
    chat_id = cfg["telegram_chat_id"]
    count = result["meteor_count"]
    ts = result["timestamp"]
    img_name = Path(result["image"]).name

    text = (
        f"🌠 *{count} météore(s) détecté(s)*\n"
        f"📷 `{img_name}`\n"
        f"🕐 `{ts}`"
    )

    annotated = result.get("annotated_path")
    if annotated and cfg.get("telegram_send_image") and Path(annotated).exists():
        url = f"https://api.telegram.org/bot{token}/sendPhoto"
        with open(annotated, "rb") as f:
            log.info(f"Envoi Telegram — token={token[:10]}... chat_id={chat_id}")
            resp = requests.post(url, data={"chat_id": chat_id, "caption": text, "parse_mode": "Markdown"}, files={"photo": f}, timeout=15)
    else:
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        resp = requests.post(url, json={"chat_id": chat_id, "text": text, "parse_mode": "Markdown"}, timeout=15)

    if resp.ok:
        log.info("Notification Telegram envoyée")
    else:
        log.error(f"Erreur Telegram : {resp.text}")


def notify_telegram_nightly(report: dict[str, Any], cfg: dict[str, Any]) -> None:
    token = cfg["telegram_token"]
    chat_id = cfg["telegram_chat_id"]
    date = report.get("date", "?")
    total = report.get("total_meteors", 0)
    images = report.get("images_processed", 0)
    detections = report.get("images_with_meteors", 0)

    text = (
        f"🌙 *Bilan nocturne — {date}*\n"
        f"🖼 Images traitées : `{images}`\n"
        f"🌠 Images avec météore(s) : `{detections}`\n"
        f"✨ Total météores : `{total}`"
    )
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    resp = requests.post(url, json={"chat_id": chat_id, "text": text, "parse_mode": "Markdown"}, timeout=15)
    if resp.ok:
        log.info("Bilan nocturne Telegram envoyé")
    else:
        log.error(f"Erreur Telegram bilan : {resp.text}")


# ---------------------------------------------------------------------------
# Pipeline complet
# ---------------------------------------------------------------------------

def process_image(img_path: Path, cfg: dict[str, Any], move_processed: bool = True) -> dict[str, Any]:
    log.info(f"Traitement : {img_path.name}")
    result = detect_meteors(img_path, cfg)

    # Toujours publier en MQTT (count=0 aussi utile pour Grafana)
    publish_mqtt(result, cfg, "mqtt_topic_detection")

    if result["meteor_count"] > 0:
        log.info(f"{result['meteor_count']} météore(s) détecté(s) !")

        # ── Log centralisé → tableau de bord Next.js ──
        append_detection_log(result, cfg)

        # ── Notification Telegram ──
        try:
            notify_telegram(result, cfg)
        except Exception as e:
            log.error(f"Erreur notification Telegram : {e}")

    # ── Déplacer l'image vers processed/<YYYY-MM-DD>/ ──
    if move_processed:
        night = datetime.fromisoformat(result["timestamp"]).strftime("%Y-%m-%d")
        processed_dir = Path(cfg["processed_dir"]) / night
        processed_dir.mkdir(parents=True, exist_ok=True)
        dest = processed_dir / img_path.name
        shutil.move(str(img_path), str(dest))
        log.info(f"Image déplacée vers {dest}")

        # Sauvegarder le JSON de résultat pour meteor_nightly_report.py
        result_for_json = {k: v for k, v in result.items() if k != "annotated_path"}
        result_for_json["image"] = str(dest)
        json_dest = processed_dir / f"{img_path.stem}_meteor.json"
        with open(json_dest, "w", encoding="utf-8") as f:
            json.dump(result_for_json, f, ensure_ascii=False, indent=2)

    return result


# ---------------------------------------------------------------------------
# CLI standalone
# ---------------------------------------------------------------------------

def main() -> int:
    ap = argparse.ArgumentParser(description="Pipeline détection météores")
    ap.add_argument("image", type=Path)
    ap.add_argument("--config", type=Path, default=Path("config.json"))
    ap.add_argument("--no-move", action="store_true", help="Ne pas déplacer l'image après traitement")
    args = ap.parse_args()

    cfg = load_config(args.config)
    result = process_image(args.image, cfg, move_processed=not args.no_move)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
