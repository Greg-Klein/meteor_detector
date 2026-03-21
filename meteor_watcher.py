#!/usr/bin/env python3
"""
meteor_watcher.py
-----------------
Watchdog temps réel : surveille le dossier incoming et déclenche le pipeline
dès qu'une nouvelle image arrive (via SCP depuis le Pi AllSky).

Installation :
    pip install watchdog

Lancement :
    python3 meteor_watcher.py --config config.json

Lancement en service systemd :
    voir meteor_watcher.service
"""

from __future__ import annotations

import argparse
import logging
import time
from pathlib import Path

from watchdog.events import FileCreatedEvent, FileSystemEventHandler
from watchdog.observers import Observer

from meteor_pipeline import load_config, process_image

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png"}


class MeteorHandler(FileSystemEventHandler):
    def __init__(self, cfg: dict) -> None:
        super().__init__()
        self.cfg = cfg

    def on_created(self, event: FileCreatedEvent) -> None:
        if event.is_directory:
            return

        path = Path(event.src_path)
        if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            return

        # Attendre que le fichier soit complètement écrit (SCP)
        self._wait_for_file(path)

        # Vérifier que le JPEG est complet avant traitement
        if path.suffix.lower() in {".jpg", ".jpeg"} and not self._is_valid_jpeg(path):
            log.warning(f"JPEG tronqué ou corrompu, ignoré : {path.name}")
            path.unlink(missing_ok=True)
            return

        try:
            process_image(path, self.cfg, move_processed=True)
        except Exception as e:
            log.error(f"Erreur pipeline sur {path.name} : {e}")

    def _is_valid_jpeg(self, path: Path) -> bool:
        """Vérifie que le fichier JPEG est complet (marqueur EOI 0xFFD9 en fin de fichier)."""
        try:
            with open(path, "rb") as f:
                f.seek(-2, 2)
                return f.read(2) == b"\xff\xd9"
        except Exception:
            return False

    def _wait_for_file(self, path: Path, timeout: float = 30.0, interval: float = 0.5) -> None:
        """Attend que la taille du fichier soit stable (fin de SCP)."""
        elapsed = 0.0
        prev_size = -1
        while elapsed < timeout:
            try:
                current_size = path.stat().st_size
            except FileNotFoundError:
                time.sleep(interval)
                elapsed += interval
                continue
            if current_size == prev_size and current_size > 0:
                return
            prev_size = current_size
            time.sleep(interval)
            elapsed += interval
        log.warning(f"Timeout en attendant la stabilisation de {path.name}")


def main() -> int:
    ap = argparse.ArgumentParser(description="Watchdog détection météores temps réel")
    ap.add_argument("--config", type=Path, default=Path("config.json"))
    args = ap.parse_args()

    cfg = load_config(args.config)
    watch_dir = Path(cfg["watch_dir"])
    watch_dir.mkdir(parents=True, exist_ok=True)

    log.info(f"Surveillance de : {watch_dir}")

    handler = MeteorHandler(cfg)
    observer = Observer()
    observer.schedule(handler, str(watch_dir), recursive=False)
    observer.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        log.info("Arrêt du watchdog.")
        observer.stop()

    observer.join()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
