#!/usr/bin/env python3
"""
meteor_nightly_report.py
------------------------
Bilan nocturne : à lancer via cron au lever du soleil.
Agrège tous les résultats JSON de la nuit, publie un résumé MQTT et envoie
une notification Telegram.

Cron example (6h00 chaque matin) :
    0 6 * * * /usr/bin/python3 /home/youruser/meteor_detector/meteor_nightly_report.py --config /home/youruser/meteor_detector/config.json

Les fichiers JSON de résultats sont produits par meteor_pipeline.py
et stockés dans processed_dir/<date>/*.json ou dans processed_dir/*.json.
"""

from __future__ import annotations

import argparse
import json
import logging
from datetime import datetime, timedelta
from pathlib import Path

from meteor_pipeline import load_config, notify_telegram_nightly, publish_mqtt

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)


def collect_results(processed_dir: Path, since: datetime) -> list[dict]:
    """Collecte tous les fichiers JSON de résultats produits depuis `since`."""
    results = []
    for json_file in processed_dir.rglob("*_meteor.json"):
        try:
            mtime = datetime.fromtimestamp(json_file.stat().st_mtime)
            if mtime >= since:
                data = json.loads(json_file.read_text(encoding="utf-8"))
                results.append(data)
        except Exception as e:
            log.warning(f"Impossible de lire {json_file} : {e}")
    return results


def build_report(results: list[dict], date_str: str) -> dict:
    total_meteors = sum(r.get("meteor_count", 0) for r in results)
    images_with_meteors = sum(1 for r in results if r.get("meteor_count", 0) > 0)
    return {
        "date": date_str,
        "images_processed": len(results),
        "images_with_meteors": images_with_meteors,
        "total_meteors": total_meteors,
        "detections": [
            {
                "image": Path(r["image"]).name,
                "timestamp": r.get("timestamp"),
                "meteor_count": r.get("meteor_count", 0),
            }
            for r in results
            if r.get("meteor_count", 0) > 0
        ],
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Bilan nocturne détection météores")
    ap.add_argument("--config", type=Path, default=Path("config.json"))
    ap.add_argument(
        "--hours",
        type=int,
        default=12,
        help="Fenêtre de temps en heures à remonter (défaut: 12h)",
    )
    args = ap.parse_args()

    cfg = load_config(args.config)
    processed_dir = Path(cfg["processed_dir"])
    since = datetime.now() - timedelta(hours=args.hours)
    date_str = since.strftime("%Y-%m-%d")

    log.info(f"Collecte des résultats depuis {since.isoformat()} dans {processed_dir}")
    results = collect_results(processed_dir, since)
    report = build_report(results, date_str)

    log.info(
        f"Bilan : {report['images_processed']} images, "
        f"{report['images_with_meteors']} avec météore(s), "
        f"{report['total_meteors']} total"
    )

    # Publier MQTT
    publish_mqtt(report, cfg, "mqtt_topic_nightly")

    # Notification Telegram
    try:
        notify_telegram_nightly(report, cfg)
    except Exception as e:
        log.error(f"Erreur Telegram bilan : {e}")

    # Sauvegarder le rapport JSON
    report_path = processed_dir / f"nightly_report_{date_str}.json"
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    log.info(f"Rapport sauvegardé : {report_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
