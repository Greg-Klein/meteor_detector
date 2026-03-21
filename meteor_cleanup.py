#!/usr/bin/env python3
"""
meteor_cleanup.py
-----------------
Nettoyage automatique : supprime les données de plus de 14 nuits.
Gère les deux répertoires :
  - processed/<YYYY-MM-DD>/   : images + JSON de résultats
  - annotated/                : images annotées (par date dans le nom de fichier)

Cron recommandé (chaque matin à 7h00, après le bilan nocturne) :
  0 7 * * * /usr/bin/python3 /home/youruser/meteor_detector/meteor_cleanup.py --config /home/youruser/meteor_detector/config.json
"""

from __future__ import annotations

import argparse
import logging
import shutil
from datetime import datetime, timedelta
from pathlib import Path

from meteor_pipeline import load_config

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)


def cleanup_processed(processed_dir: Path, keep_days: int) -> None:
    """
    Supprime les sous-dossiers YYYY-MM-DD plus vieux que keep_days jours.
    Les fichiers à la racine de processed/ (ex: nightly_report_*.json) sont ignorés.
    """
    if not processed_dir.exists():
        return

    cutoff = datetime.now() - timedelta(days=keep_days)
    removed = 0

    for entry in sorted(processed_dir.iterdir()):
        if not entry.is_dir():
            continue
        # Le dossier doit s'appeler YYYY-MM-DD
        try:
            night_date = datetime.strptime(entry.name, "%Y-%m-%d")
        except ValueError:
            continue  # dossier avec un autre nom → on ignore

        if night_date < cutoff:
            shutil.rmtree(entry)
            log.info(f"Supprimé : {entry}")
            removed += 1

    if removed:
        log.info(f"processed/ : {removed} nuit(s) supprimée(s)")
    else:
        log.info("processed/ : rien à supprimer")


def cleanup_annotated(annotated_dir: Path, keep_days: int) -> None:
    """
    Supprime les images annotées de plus de keep_days jours.
    Le nom de fichier contient la date sous la forme YYYYMMDD_HHMMSS.
    Exemple : allsky_20260210_233012_annotated.jpg
    """
    if not annotated_dir.exists():
        return

    cutoff = datetime.now() - timedelta(days=keep_days)
    removed = 0

    for f in annotated_dir.iterdir():
        if not f.is_file():
            continue
        # Extraire la date depuis le nom de fichier (cherche YYYYMMDD)
        date_found = False
        for part in f.stem.split("_"):
            if len(part) == 8 and part.isdigit():
                try:
                    file_date = datetime.strptime(part, "%Y%m%d")
                    if file_date < cutoff:
                        f.unlink()
                        log.info(f"Supprimé : {f.name}")
                        removed += 1
                    date_found = True
                    break
                except ValueError:
                    continue
        if not date_found:
            # Fallback : utiliser la date de modification du fichier
            mtime = datetime.fromtimestamp(f.stat().st_mtime)
            if mtime < cutoff:
                f.unlink()
                log.info(f"Supprimé (mtime) : {f.name}")
                removed += 1

    if removed:
        log.info(f"annotated/ : {removed} fichier(s) supprimé(s)")
    else:
        log.info("annotated/ : rien à supprimer")


def main() -> int:
    ap = argparse.ArgumentParser(description="Nettoyage automatique des données météores")
    ap.add_argument("--config", type=Path, default=Path("config.json"))
    ap.add_argument(
        "--keep-days",
        type=int,
        default=14,
        help="Nombre de nuits à conserver (défaut: 14)",
    )
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="Simuler sans supprimer (affiche ce qui serait supprimé)",
    )
    args = ap.parse_args()

    cfg = load_config(args.config)
    processed_dir = Path(cfg["processed_dir"])
    annotated_dir = Path(cfg["annotated_dir"])

    log.info(f"Nettoyage — conservation : {args.keep_days} jours")
    log.info(f"  processed : {processed_dir}")
    log.info(f"  annotated : {annotated_dir}")

    if args.dry_run:
        log.info("Mode DRY-RUN — aucune suppression effectuée")
        # En dry-run, on liste juste ce qui serait supprimé
        cutoff = datetime.now() - timedelta(days=args.keep_days)
        for entry in sorted(processed_dir.iterdir()) if processed_dir.exists() else []:
            if entry.is_dir():
                try:
                    if datetime.strptime(entry.name, "%Y-%m-%d") < cutoff:
                        log.info(f"  [DRY] Supprimerait processed/{entry.name}/")
                except ValueError:
                    pass
        for f in sorted(annotated_dir.iterdir()) if annotated_dir.exists() else []:
            mtime = datetime.fromtimestamp(f.stat().st_mtime)
            if mtime < cutoff:
                log.info(f"  [DRY] Supprimerait annotated/{f.name}")
        return 0

    cleanup_processed(processed_dir, args.keep_days)
    cleanup_annotated(annotated_dir, args.keep_days)

    log.info("Nettoyage terminé.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
