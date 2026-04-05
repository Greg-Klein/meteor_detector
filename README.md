# 🌠 Meteor Detection Pipeline — Pi 4b

Pipeline complet de détection de météores avec notification temps réel, bilan nocturne et tableau de bord web.

---

## 📁 Structure des fichiers

```
/home/youruser/meteor_detector/
├── meteor_pipeline.py          # Cœur : détection + MQTT + Telegram + sauvegarde
├── meteor_watcher.py           # Watchdog temps réel (surveille incoming/)
├── meteor_nightly_report.py    # Bilan nocturne (cron)
├── meteor_cleanup.py           # Nettoyage des données anciennes (cron)
├── config.example.json         # Exemple de configuration (copier en config.json)
├── mask.png                    # Masque (zones à ignorer)
├── setup_web.sh                # Installation tableau de bord Next.js (sudo)
├── meteor_watcher.service      # Service systemd
└── meteor-web/                 # App Next.js (tableau de bord)

/home/youruser/meteors/
├── incoming/                   # Destination SCP depuis Pi AllSky
├── annotated/                  # Images annotées (météores détectés)
├── dataset/
│   ├── positives/              # Images brutes avec météore détecté (sans overlay)
│   └── false_positives/        # Faux positifs archivés pour entraînement
├── processed/                  # Sous-dossiers YYYY-MM-DD (images + JSON par nuit)
└── detections.json             # Log centralisé (alimente le dashboard)
```

---

## ⚙️ Installation

### 1) Dépendances Python

```bash
pip install opencv-python-headless paho-mqtt watchdog requests
```

### 2) Créer les dossiers

```bash
mkdir -p /home/youruser/meteors/{incoming,annotated,processed}
mkdir -p /home/youruser/meteor_detector
```

### 3) Copier les fichiers

```bash
cp meteor_pipeline.py meteor_watcher.py meteor_nightly_report.py meteor_cleanup.py config.example.json mask.png meteor_watcher.service /home/youruser/meteor_detector/
cp config.example.json /home/youruser/meteor_detector/config.json
cp -r meteor-web /home/youruser/
```

### 4) Éditer config.json

Copier l’exemple puis éditer (tokens, chemins, MQTT, etc.) :

```bash
# Si pas déjà fait à l’étape 3
cp config.example.json config.json
```

Voir `config.example.json` pour toutes les options. Exemples : `mqtt_host`, `mqtt_port`, `telegram_token`, `telegram_chat_id`, `watch_dir`, `annotated_dir`, `positive_dataset_dir`, `processed_dir`, `false_positive_dir`, `mask`, `detections_log`, `min_length`, `max_length`, `cloud_area_threshold`, `telegram_send_image`, `max_log_entries`.

---

## 🌐 Tableau de bord web (Next.js)

Le dashboard affiche les détections récentes et les images annotées. Installation sur le RPi :

```bash
cd /home/youruser/meteor_detector
sudo bash setup_web.sh
```

Prérequis : le dossier `meteor-web` doit être présent dans `/home/youruser/` (ou copier depuis ce repo). Le script installe Node.js LTS, Nginx, build Next.js, crée le service `meteor-web` et configure le reverse proxy. Accès : `http://<IP_RPi>/`.

```bash
# Commandes utiles
sudo systemctl status meteor-web
sudo journalctl -u meteor-web -f
sudo systemctl restart meteor-web
```

---

## 🔁 SCP depuis le Pi AllSky

Sur le Pi AllSky, configurer l’upload SCP des images vers le Pi 4b :

```bash
# Exemple : après chaque capture AllSky
scp /chemin/image.jpg youruser@192.168.0.1:/home/youruser/meteors/incoming/
```

Ou via le module AllSky "Upload" en pointant vers `/home/youruser/meteors/incoming/`.

Recommandé : authentification par clé SSH :

```bash
ssh-keygen -t ed25519
ssh-copy-id youruser@192.168.0.1
```

---

## 🚀 Watchdog temps réel (systemd)

```bash
sudo cp /home/youruser/meteor_detector/meteor_watcher.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable meteor_watcher
sudo systemctl start meteor_watcher

# Vérifier le statut
sudo systemctl status meteor_watcher
journalctl -u meteor_watcher -f
```

---

## 🌙 Bilan nocturne (cron)

```bash
crontab -e
```

Ajouter (bilan chaque matin à 6h00) :

```
0 6 * * * /usr/bin/python3 /home/youruser/meteor_detector/meteor_nightly_report.py --config /home/youruser/meteor_detector/config.json
```

---

## 🧹 Nettoyage automatique (cron)

`meteor_cleanup.py` supprime les données de plus de 14 nuits : sous-dossiers `processed/<YYYY-MM-DD>/` et images dans `annotated/`. À lancer après le bilan nocturne (ex. 7h00) :

```
0 7 * * * /usr/bin/python3 /home/youruser/meteor_detector/meteor_cleanup.py --config /home/youruser/meteor_detector/config.json
```

Options : `--keep-days 14` (défaut), `--dry-run` pour simuler sans supprimer.

---

## 📊 Intégration InfluxDB / Grafana

### Topics MQTT publiés

| Topic                           | Contenu                         |
| ------------------------------- | ------------------------------- |
| `observatory/meteors/detection` | Résultat image par image (JSON) |
| `observatory/meteors/nightly`   | Bilan nocturne (JSON)           |

### Telegraf — ajouter dans telegraf.conf

```toml
[[inputs.mqtt_consumer]]
  servers = ["tcp://192.168.0.1:1883"]
  topics = [
    "observatory/meteors/detection",
    "observatory/meteors/nightly"
  ]
  data_format = "json"
  json_time_key = "timestamp"
  json_time_format = "2006-01-02T15:04:05"
  name_override = "meteors"
```

### Dashboard Grafana suggéré

- Compteur météores par nuit (bilan nocturne)
- Heatmap horaire des détections (temps réel)
- Galerie des images annotées (via Grafana Image Panel ou lien externe)

---

## 🧪 Test manuel

```bash
# Tester le pipeline sur une image
python3 meteor_pipeline.py /chemin/image.jpg --config config.json --no-move

# Tester le bilan nocturne
python3 meteor_nightly_report.py --config config.json --hours 24

# Simuler le nettoyage (sans supprimer)
python3 meteor_cleanup.py --config config.json --dry-run
```

---

## 🧠 Constitution du dataset

Le tableau de bord permet maintenant de constituer un dataset d'entraînement directement depuis les détections affichées.

### Images positives

- Quand le pipeline détecte un météore, l'image source est copiée sans overlay vert dans `dataset/positives/<YYYY-MM-DD>/`.
- Depuis l'interface web, le bouton `Valider` permet aussi de marquer manuellement une détection comme positive.
- Cette action archive :
  - l'image source depuis `processed/<YYYY-MM-DD>/`
  - l'image annotée si elle existe
  - un fichier JSON de métadonnées avec `timestamp`, `image`, `detections`, etc.

### Faux positifs

- Le bouton `Faux positif` retire la détection du site.
- En même temps, l'image n'est plus supprimée : elle est archivée dans `dataset/false_positives/<YYYY-MM-DD>/`.
- Cette archive contient :
  - l'image source
  - l'image annotée si elle existe
  - un JSON de métadonnées

### Structure obtenue

```text
/home/youruser/meteors/dataset/
├── positives/
│   └── 2026-04-05/
│       ├── frame_001.jpg
│       ├── frame_001_20260405_221530_annotated.jpg
│       └── frame_001.json
└── false_positives/
    └── 2026-04-05/
        ├── frame_002.jpg
        ├── frame_002_20260405_221742_annotated.jpg
        └── frame_002.json
```

Ce mécanisme permet de construire progressivement un dataset supervisé directement à partir de l'exploitation réelle du système, sans passer tout de suite par un outil d'annotation séparé.

---

## 🔧 Tuning

| Paramètre              | Défaut | Effet                                                              |
| ---------------------- | ------ | ------------------------------------------------------------------ |
| `min_length`           | 100    | Longueur minimale en px — augmenter pour réduire les faux positifs |
| `max_length`           | 2500   | Longueur max en px — segments plus longs ignorés (satellites, etc.) |
| `cloud_area_threshold` | 1550   | Seuil contours nuages — adapter à ta résolution caméra             |
| `telegram_send_image`  | true   | Envoyer l’image annotée sur Telegram                               |
| `max_log_entries`      | 2000   | Nombre max d’entrées dans detections.json (dashboard)              |
| `--hours`              | 12     | Fenêtre du bilan nocturne                                          |
