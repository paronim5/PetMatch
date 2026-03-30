# Deploy Guide — Weak Server (t3.micro / 1 GB RAM)

## One-time server setup (do this once after provisioning)

```bash
# 1. Add 2 GB swap — most important step
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 2. Lower swappiness so RAM is preferred over swap
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# 3. Install Docker
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-plugin
sudo usermod -aG docker ubuntu
newgrp docker
```

---

## First deploy (fresh server)

```bash
git clone https://github.com/paronim5/PetMatch.git
cd PetMatch

# Fill in secrets
cp backend/.env.example backend/.env
nano backend/.env

# Disable local dev override
mv docker-compose.override.yml docker-compose.override.yml.local

# Build one service at a time — prevents memory spikes overlapping
sudo docker compose -f docker-compose.yml build db
sudo docker compose -f docker-compose.yml build backend
sudo docker compose -f docker-compose.yml build frontend

# Get SSL certificate (DNS must point to this server first)
chmod +x init-letsencrypt.sh
sudo ./init-letsencrypt.sh

# Start everything
sudo docker compose -f docker-compose.yml up -d

# Verify
sudo docker compose -f docker-compose.yml ps
curl -I https://paroniim.xyz
```

---

## Redeploy after code changes

```bash
cd ~/PetMatch
git pull origin master

# Only rebuild the service(s) that changed
sudo docker compose -f docker-compose.yml build frontend   # if frontend changed
sudo docker compose -f docker-compose.yml build backend    # if backend changed

sudo docker compose -f docker-compose.yml up -d --no-build  # restart without rebuilding unchanged
```

> **Tip:** If only frontend changed, skip rebuilding backend (and vice versa).
> This cuts deploy time from ~10 min to ~2 min.

---

## Free disk space when it fills up

Docker leaves behind old images and build cache. Run this before rebuilding:

```bash
sudo docker system prune -f        # remove stopped containers + dangling images
sudo docker builder prune -f       # remove build cache
df -h                              # verify free space
```

---

## Memory limits per container (already configured)

| Container | RAM limit | What it does |
|---|---|---|
| db (PostgreSQL) | 192 MB | Stores all data |
| backend (FastAPI) | 384 MB | API + ONNX AI model |
| frontend (nginx) | 48 MB | Serves React app |
| nginx (proxy) | 32 MB | SSL, routing |
| stripe (CLI) | 64 MB | Webhook forwarding |
| **Total** | **720 MB** | + 2 GB swap as buffer |

---

## Key optimizations already in place

| Optimization | Impact |
|---|---|
| TensorFlow replaced with ONNX Runtime | ~550 MB less RAM at runtime |
| ONNX model pre-converted locally, committed to git | No TF download during build |
| Node.js heap capped at 1 GB (`NODE_OPTIONS`) | Prevents OOM during frontend build |
| Node.js 20 (required by Vite 7) | Fixes build failure on Node 18 |
| PostgreSQL tuned for 1 GB RAM | `shared_buffers=32MB`, `max_connections=20` |
| `backend/.dockerignore` excludes uploads/cache | Smaller build context, no disk overflow |
| Nginx gzip compression (level 5) | Less bandwidth, faster page loads |
| Static assets cached 30 days | Fewer requests to server |
| 2 GB swap space | Safety buffer for memory spikes |

---

## SSL certificate renewal

Certificates expire every 90 days. Renew manually:

```bash
sudo docker compose -f docker-compose.yml run --rm certbot renew
sudo docker compose -f docker-compose.yml exec nginx nginx -s reload
```

Or add to crontab for automatic renewal:

```bash
crontab -e
# Add this line:
0 3 1 * * cd /home/ubuntu/PetMatch && sudo docker compose -f docker-compose.yml run --rm certbot renew && sudo docker compose -f docker-compose.yml exec nginx nginx -s reload
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| nginx `Restarting` | SSL certs missing → run `./init-letsencrypt.sh` |
| `no space left on device` | Run `sudo docker system prune -f && sudo docker builder prune -f` |
| Build stuck / OOM | Ctrl+C, run `sudo docker system prune -f`, build one service at a time |
| Can't SSH into server | Connect via AWS Console, run `sudo systemctl restart ssh` |
| App accessible via IP but not domain | DNS not propagated yet, check with `nslookup paroniim.xyz` |
| `docker-compose.override.yml` loaded on server | Rename: `mv docker-compose.override.yml docker-compose.override.yml.local` |
| Certificate saved as `paroniim.xyz-0001` | `cd certbot/conf/live && sudo ln -s paroniim.xyz-0001 paroniim.xyz` |
