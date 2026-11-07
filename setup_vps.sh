#!/usr/bin/env bash
# ================================================================
# VDAJ Services — New VPS Automated Production Setup
# Target OS: Ubuntu 24.04 / 22.04 LTS (x86_64)
# ================================================================

set -e

echo "=================================================="
echo "  🚀 Starting VDAJ Platform Installation on New VPS"
echo "=================================================="

export DEBIAN_FRONTEND=noninteractive

# 1. Update packages
echo "Updating apt packages..."
apt-get update && apt-get upgrade -y
apt-get install -y curl wget git nginx certbot python3-certbot-nginx redis-server postgresql postgresql-contrib ufw build-essential

# 2. Install Node.js 20 LTS & PM2
echo "Configuring Node.js 20 LTS..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
npm install -g pm2

# 3. Setup PostgreSQL
echo "Configuring PostgreSQL Database..."
systemctl start postgresql
systemctl enable postgresql

sudo -u postgres psql -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'vdaj_user') THEN CREATE ROLE vdaj_user WITH LOGIN PASSWORD 'vdaj_secure_2025'; END IF; END \$\$;"
sudo -u postgres psql -c "ALTER ROLE vdaj_user CREATEDB SUPERUSER;"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = 'vdaj_whatsapp_db'" | grep -q 1 || sudo -u postgres psql -c "CREATE DATABASE vdaj_whatsapp_db OWNER vdaj_user;"

# 4. Setup Redis
echo "Starting Redis Cache & Message Queue..."
systemctl start redis-server
systemctl enable redis-server

# 5. Clone or update repository
mkdir -p /var/www
if [ -d "/var/www/VDAJ-WA" ]; then
    echo "Updating existing repository..."
    cd /var/www/VDAJ-WA && git pull origin main
else
    echo "Cloning repository..."
    git clone https://github.com/imvnky/VDAJ-WA.git /var/www/VDAJ-WA
fi

cd /var/www/VDAJ-WA/backend

# 6. Create production .env
echo "Configuring backend environment variables..."
cat << 'EOF' > /var/www/VDAJ-WA/backend/.env
NODE_ENV=production
PORT=5000
APP_NAME=vdajservices
APP_VERSION=1.0.0

# ---- DATABASE ----
DB_HOST=localhost
DB_PORT=5432
DB_USER=vdaj_user
DB_PASSWORD=vdaj_secure_2025
DB_NAME=vdaj_whatsapp_db
DB_SSL=false
DB_POOL_MIN=2
DB_POOL_MAX=20

# ---- REDIS ----
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_TLS=false
REDIS_KEY_PREFIX=vdaj:

# ---- JWT ----
JWT_SECRET=vdaj_jwt_super_secret_64char_replace_in_production_2025_vdajservices
JWT_EXPIRES_IN=7d
JWT_COOKIE_NAME=vdaj_access_token
JWT_REFRESH_SECRET=vdaj_refresh_super_secret_64char_replace_in_production_2025_ok
JWT_REFRESH_EXPIRES_IN=30d

# ---- CORS ----
CORS_ORIGIN=https://wa.vdajservices.com,http://localhost:3000

# ---- META / WHATSAPP ----
META_APP_ID=1447754957201480
META_APP_SECRET=your_meta_app_secret
META_API_VERSION=v21.0
META_GRAPH_API_URL=https://graph.facebook.com
META_WEBHOOK_VERIFY_TOKEN=vdaj_webhook_verify_token_2025

# ---- RATE LIMITING ----
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=500

# ---- MESSAGE QUEUE ----
QUEUE_CHUNK_SIZE=50
QUEUE_DELAY_BETWEEN_CHUNKS_MS=1000
QUEUE_MAX_RETRIES=3
QUEUE_BACKOFF_DELAY_MS=5000
QUEUE_DEAD_LETTER_THRESHOLD=3

# ---- LOGGING ----
LOG_LEVEL=info
LOG_DIR=./logs

# ---- TENANT MODE ----
TENANT_MODE=multi
EOF

mkdir -p /var/www/VDAJ-WA/backend/logs
mkdir -p /var/www/VDAJ-WA/backend/public/uploads

# 7. Install dependencies & run migrations
echo "Installing dependencies..."
npm install --production=false
echo "Running database schema migrations..."
node src/database/migrate.js || true
node src/database/seed.js || true

# 8. Start PM2 process manager
echo "Starting backend and queue workers via PM2..."
pm2 delete all || true
pm2 start src/server.js --name vdaj-backend
pm2 start src/workers/messageWorker.js --name vdaj-worker
pm2 save
env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u root --hp /root || true

# 9. Configure Nginx
echo "Configuring Nginx Reverse Proxy..."
cat << 'EOF' > /etc/nginx/sites-available/vdaj
server {
    listen 80;
    server_name wa.vdajservices.com;

    client_max_body_size 64M;

    # Static frontend SPA
    root /var/www/VDAJ-WA/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket for real-time inbox & notifications
    location /ws/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }

    # Uploads
    location /uploads/ {
        alias /var/www/VDAJ-WA/backend/public/uploads/;
        expires 7d;
        add_header Cache-Control "public, no-transform";
    }

    # Webhook endpoint for Meta
    location /webhooks {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF

ln -sf /etc/nginx/sites-available/vdaj /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 10. Firewall rules
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "=================================================="
echo "✔ VDAJ Platform successfully deployed on New VPS!"
echo "=================================================="
