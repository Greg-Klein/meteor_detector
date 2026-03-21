#!/bin/bash
# setup_web.sh
# ─────────────────────────────────────────────────────
# Installe le tableau de bord météores Next.js sur le RPi.
# À exécuter en root (ou sudo) depuis /home/youruser/meteor_detector/
#
# Usage :
#   sudo bash setup_web.sh
# ─────────────────────────────────────────────────────

set -e

USER="youruser"
HOME_DIR="/home/${USER}"
APP_DIR="${HOME_DIR}/meteor-web"       # répertoire de l'app Next.js
METEORS_DIR="${HOME_DIR}/meteors"      # données (detections.json, images…)
PORT=3000                              # port interne Next.js

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║    AllSky Meteor Dashboard — Installation    ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ── 1. Node.js (via NodeSource LTS) ────────────────────────────────────────
echo "[1/6] Vérification de Node.js…"
if ! command -v node &>/dev/null; then
    echo "  → Installation de Node.js LTS…"
    curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
    apt-get install -y nodejs
else
    echo "  ✓ Node.js $(node -v) déjà installé"
fi

# ── 2. Nginx ────────────────────────────────────────────────────────────────
echo "[2/6] Installation de Nginx…"
apt-get install -y nginx
echo "  ✓ Nginx installé"

# ── 3. Copier l'app et installer les dépendances ────────────────────────────
echo "[3/6] Installation des dépendances Node…"
if [ ! -d "${APP_DIR}" ]; then
    echo "  ✗ Répertoire ${APP_DIR} introuvable."
    echo "    Copie le dossier meteor-web dans ${HOME_DIR}/ puis relance le script."
    exit 1
fi

cd "${APP_DIR}"
sudo -u "${USER}" npm install --production=false
echo "  ✓ Dépendances installées"

# ── 4. Build Next.js ────────────────────────────────────────────────────────
echo "[4/6] Build Next.js (peut prendre 1-2 min sur RPi)…"
sudo -u "${USER}" \
    DETECTIONS_LOG="${METEORS_DIR}/detections.json" \
    ANNOTATED_DIR="${METEORS_DIR}/annotated" \
    npm run build
echo "  ✓ Build terminé"

# ── 5. Service systemd ───────────────────────────────────────────────────────
echo "[5/6] Création du service systemd…"
cat > /etc/systemd/system/meteor-web.service << EOF
[Unit]
Description=AllSky Meteor Dashboard (Next.js)
After=network.target

[Service]
User=${USER}
WorkingDirectory=${APP_DIR}
Environment=NODE_ENV=production
Environment=PORT=${PORT}
Environment=DETECTIONS_LOG=${METEORS_DIR}/detections.json
Environment=ANNOTATED_DIR=${METEORS_DIR}/annotated
ExecStart=/usr/bin/node_modules/.bin/next start -p ${PORT}
ExecStart=$(which node) node_modules/.bin/next start -p ${PORT}
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Correction : utiliser le bon chemin next
cat > /etc/systemd/system/meteor-web.service << EOF
[Unit]
Description=AllSky Meteor Dashboard (Next.js)
After=network.target

[Service]
User=${USER}
WorkingDirectory=${APP_DIR}
Environment=NODE_ENV=production
Environment=PORT=${PORT}
Environment=DETECTIONS_LOG=${METEORS_DIR}/detections.json
Environment=ANNOTATED_DIR=${METEORS_DIR}/annotated
ExecStart=${APP_DIR}/node_modules/.bin/next start -p ${PORT}
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable meteor-web
systemctl restart meteor-web
echo "  ✓ Service meteor-web démarré"

# ── 6. Nginx reverse proxy ───────────────────────────────────────────────────
echo "[6/6] Configuration Nginx…"
cat > /etc/nginx/sites-available/meteors << EOF
server {
    listen 80;
    server_name _;          # répond sur toute IP du réseau local

    access_log /var/log/nginx/meteors_access.log;
    error_log  /var/log/nginx/meteors_error.log;

    # Tableau de bord Next.js
    location / {
        proxy_pass         http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 30s;
    }
}
EOF

ln -sf /etc/nginx/sites-available/meteors /etc/nginx/sites-enabled/meteors
rm -f /etc/nginx/sites-enabled/default

nginx -t && systemctl reload nginx
echo "  ✓ Nginx configuré"

# ── Répertoires et permissions ───────────────────────────────────────────────
mkdir -p "${METEORS_DIR}/annotated" "${METEORS_DIR}/processed" "${METEORS_DIR}/incoming"
chown -R "${USER}:${USER}" "${METEORS_DIR}" "${APP_DIR}"

# ── Résumé ───────────────────────────────────────────────────────────────────
IP=$(hostname -I | awk '{print $1}')
echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║  ✅  Tableau de bord installé avec succès !           ║"
echo "╠═══════════════════════════════════════════════════════╣"
printf  "║  🌐  http://%-43s║\n" "${IP}/"
echo "║                                                       ║"
echo "║  Commandes utiles :                                   ║"
echo "║    sudo systemctl status meteor-web                   ║"
echo "║    sudo journalctl -u meteor-web -f                   ║"
echo "║    sudo systemctl restart meteor-web                  ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""
