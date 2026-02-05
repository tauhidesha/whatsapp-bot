# 🚀 Tutorial Deploy WhatsApp AI Chatbot ke AWS

Tutorial lengkap untuk deploy aplikasi WhatsApp AI Chatbot ke AWS menggunakan EC2 dengan Docker.

## 📋 Daftar Isi

1. [Persiapan](#persiapan)
2. [Setup AWS EC2](#setup-aws-ec2)
3. [Setup Server](#setup-server)
4. [Deploy Aplikasi](#deploy-aplikasi)
5. [Setup Environment Variables](#setup-environment-variables)
6. [Setup WhatsApp Session](#setup-whatsapp-session)
7. [Monitoring & Maintenance](#monitoring--maintenance)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 Persiapan

### 1. Yang Diperlukan

- **AWS Account** dengan akses ke EC2
- **SSH Key Pair** untuk akses EC2
- **Domain/Subdomain** (opsional, untuk webhook)
- **Google Gemini API Key**
- **Firebase Service Account** (opsional)

### 2. Install Tools Lokal

```bash
# AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Docker (untuk build image lokal, opsional)
# Install sesuai OS Anda
```

---

## 🖥️ Setup AWS EC2

### 1. Launch EC2 Instance

**Via AWS Console:**

1. Login ke [AWS Console](https://console.aws.amazon.com)
2. Pilih **EC2** → **Launch Instance**
3. **Name**: `whatsapp-ai-chatbot`
4. **AMI**: Ubuntu Server 22.04 LTS (atau Amazon Linux 2023)
5. **Instance Type**: 
   - Minimum: `t3.medium` (2 vCPU, 4 GB RAM)
   - Recommended: `t3.large` (2 vCPU, 8 GB RAM) untuk performa lebih baik
6. **Key Pair**: Pilih atau buat SSH key pair baru
7. **Network Settings**: 
   - VPC: Default atau custom
   - Auto-assign Public IP: Enable
   - Security Group: Buat baru dengan rules:
     - **SSH (22)**: Your IP only
     - **HTTP (80)**: 0.0.0.0/0 (untuk webhook)
     - **HTTPS (443)**: 0.0.0.0/0 (untuk webhook)
     - **Custom TCP (4000)**: 0.0.0.0/0 (untuk health check)
8. **Storage**: Minimum 20 GB (recommended 30 GB)
9. **Launch Instance**

**Via AWS CLI:**

```bash
# Buat security group
aws ec2 create-security-group \
    --group-name whatsapp-ai-sg \
    --description "Security group for WhatsApp AI Chatbot" \
    --vpc-id vpc-xxxxx

# Tambah rules
aws ec2 authorize-security-group-ingress \
    --group-id sg-xxxxx \
    --protocol tcp \
    --port 22 \
    --cidr YOUR_IP/32

aws ec2 authorize-security-group-ingress \
    --group-id sg-xxxxx \
    --protocol tcp \
    --port 4000 \
    --cidr 0.0.0.0/0

# Launch instance
aws ec2 run-instances \
    --image-id ami-0c55b159cbfafe1f0 \
    --instance-type t3.medium \
    --key-name your-key-pair \
    --security-group-ids sg-xxxxx \
    --subnet-id subnet-xxxxx \
    --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=whatsapp-ai-chatbot}]'
```

### 2. Connect ke EC2

```bash
# Via SSH
ssh -i /path/to/your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP

# Atau untuk Amazon Linux
ssh -i /path/to/your-key.pem ec2-user@YOUR_EC2_PUBLIC_IP
```

---

## 🛠️ Setup Server

### 1. Update System

```bash
# Ubuntu
sudo apt update && sudo apt upgrade -y

# Amazon Linux
sudo yum update -y
```

### 2. Install Node.js

**Ubuntu:**

```bash
# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Chrome/Puppeteer dependencies
sudo apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils

# Verify installation
node --version
npm --version
```

**Amazon Linux:**

```bash
# Install Node.js 18.x
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Install Chrome/Puppeteer dependencies
sudo yum install -y \
    alsa-lib \
    atk \
    cups-libs \
    gtk3 \
    ipa-gothic-fonts \
    libXcomposite \
    libXcursor \
    libXdamage \
    libXext \
    libXi \
    libXrandr \
    libXScrnSaver \
    libXtst \
    pango \
    xorg-x11-fonts-100dpi \
    xorg-x11-fonts-75dpi \
    xorg-x11-utils \
    xorg-x11-fonts-cyrillic \
    xorg-x11-fonts-Type1 \
    xorg-x11-fonts-misc

# Verify installation
node --version
npm --version
```

### 3. Install Ngrok (Opsional - untuk Webhook)

```bash
# Cara 1: Untuk Ubuntu (APT)
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
sudo apt update && sudo apt install ngrok

# Cara 2: Untuk Amazon Linux / Manual Download (Recommended)
cd ~
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
tar -xzf ngrok-v3-stable-linux-amd64.tgz
sudo mv ngrok /usr/local/bin/

# Verify
ngrok version
```

### 4. Install Git

```bash
# Ubuntu
sudo apt install git -y

# Amazon Linux
sudo yum install git -y

# Node.js (jika perlu build di server)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 5. Setup Firewall (jika menggunakan UFW)

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 4000/tcp
sudo ufw enable
```

---

## 📦 Deploy Aplikasi

### 1. Clone Repository

```bash
# Buat direktori aplikasi
mkdir -p ~/whatsapp-bot
cd ~/whatsapp-bot

# Clone repository
git clone https://github.com/tauhidesha/whatsapp-bot.git .

# Atau jika sudah ada, pull latest
git pull origin main
```

### 2. Setup Environment Variables

```bash
# Buat file .env
nano .env
```

**Isi file `.env`:**

```env
# Server
NODE_ENV=production
PORT=4000

# Google Gemini API
GOOGLE_API_KEY=your_google_api_key_here
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# AI Configuration
AI_MODEL=gemini-1.5-flash
AI_TEMPERATURE=0.7
AI_MAX_TOKENS=1000

# WhatsApp Configuration
WHATSAPP_SESSION=ai-chatbot
WHATSAPP_HEADLESS=true
WHATSAPP_AUTO_CLOSE=false  # ⚠️ PENTING: Harus false untuk production, jika true browser akan auto close

# Firebase (Optional)
FIREBASE_SERVICE_ACCOUNT_BASE64=your_firebase_base64_key_here

# Studio Coordinates (untuk home service)
STUDIO_LATITUDE=-6.371583
STUDIO_LONGITUDE=106.853917
HOME_SERVICE_FREE_RADIUS_KM=5
HOME_SERVICE_FEE_PER_KM=10000
HOME_SERVICE_BASE_FEE=0

# Admin Configuration
BOSMAT_ADMIN_NUMBER=6281234567890
ADMIN_WHATSAPP_NUMBER=6281234567890
NOTIFY_BOOKING_CREATION=true

# Debouncing
DEBOUNCE_DELAY_MS=15000

# Memory Configuration
MEMORY_MAX_MESSAGES=10
MEMORY_MAX_AGE_HOURS=24

# Booking Reminders
BOOKING_REMINDER_ENABLED=true
BOOKING_REMINDER_HOUR=8
APP_TIMEZONE=Asia/Jakarta

# Meta Webhook (jika menggunakan)
META_WEBHOOK_VERIFY_TOKEN=your_verify_token
META_PAGE_ACCESS_TOKEN=your_page_access_token
META_INSTAGRAM_ACCESS_TOKEN=your_ig_access_token

# Ngrok (untuk expose aplikasi ke internet)
NGROK_AUTHTOKEN=your_ngrok_authtoken_here
NGROK_DOMAIN=your-ngrok-domain.ngrok-free.app
```

**Simpan dengan `Ctrl+O`, `Enter`, `Ctrl+X`**

### 3. Setup Ngrok (Opsional - untuk Webhook)

Ngrok digunakan untuk expose aplikasi ke internet, terutama untuk webhook Meta (Facebook/Instagram Messenger).

#### 3.1. Dapatkan Ngrok Auth Token

1. Daftar/Login di [ngrok.com](https://ngrok.com)
2. Buka [Dashboard](https://dashboard.ngrok.com/get-started/your-authtoken)
3. Copy **Authtoken** Anda
4. Tambahkan ke `.env`: `NGROK_AUTHTOKEN=your_authtoken_here`

#### 3.2. Setup Ngrok Domain (Opsional - untuk Static URL)

**Gratis (Random URL setiap restart):**
- Tidak perlu setup domain, ngrok akan generate random URL
- Hapus `NGROK_DOMAIN` dari `.env` atau biarkan kosong

**Paid Plan (Static Domain):**
1. Buka [ngrok Dashboard → Domains](https://dashboard.ngrok.com/cloud-edge/domains)
2. Reserve domain (contoh: `your-app.ngrok-free.app`)
3. Tambahkan ke `.env`: `NGROK_DOMAIN=your-app.ngrok-free.app`

**Note:** 
- Domain gratis akan berubah setiap restart container
- Untuk production, gunakan paid plan untuk static domain
- Atau gunakan domain sendiri dengan custom domain di ngrok

#### 3.3. Verify Ngrok Setup

Setelah service running, cek ngrok URL:

```bash
# Check ngrok logs untuk melihat public URL
sudo journalctl -u ngrok -f

# Atau check ngrok dashboard
# https://dashboard.ngrok.com/status/tunnels

# Atau check ngrok local API
curl http://localhost:4040/api/tunnels
```

**Ngrok URL akan digunakan untuk:**
- Webhook Meta: `https://your-ngrok-domain.ngrok-free.app/webhooks/meta`
- Health check: `https://your-ngrok-domain.ngrok-free.app/health`
- API endpoints: `https://your-ngrok-domain.ngrok-free.app/api/...`

### 4. Setup Direktori untuk Session & Logs

```bash
# Buat direktori untuk WhatsApp session tokens
mkdir -p ~/whatsapp-bot/tokens
mkdir -p ~/whatsapp-bot/logs

# Set permissions
chmod 755 ~/whatsapp-bot/tokens
chmod 755 ~/whatsapp-bot/logs
```

### 5. Install Dependencies

```bash
cd ~/whatsapp-bot

# Install Node.js dependencies
npm install --production
```

### 6. Setup Systemd Service

```bash
cd ~/whatsapp-bot

# Cek username yang sedang digunakan (bukan hostname!)
whoami
# Output: ubuntu (untuk Ubuntu) atau ec2-user (untuk Amazon Linux)

# Cek home directory
echo $HOME
# Output: /home/ubuntu atau /home/ec2-user

# Copy service file ke systemd
sudo cp whatsapp-ai.service /etc/systemd/system/

# Edit service file - SESUAIKAN USER DAN PATH!
sudo nano /etc/systemd/system/whatsapp-ai.service

# Reload systemd
sudo systemctl daemon-reload

# Enable service (auto-start on boot)
sudo systemctl enable whatsapp-ai

# Start service
sudo systemctl start whatsapp-ai

# Check status
sudo systemctl status whatsapp-ai

# View logs
sudo journalctl -u whatsapp-ai -f
```

### 7. Setup Ngrok Service (Opsional)

Jika menggunakan ngrok:

```bash
cd ~/whatsapp-bot

# Copy ngrok service file
sudo cp ngrok.service /etc/systemd/system/

# Edit service file jika perlu
sudo nano /etc/systemd/system/ngrok.service

# Reload dan enable
sudo systemctl daemon-reload
sudo systemctl enable ngrok
sudo systemctl start ngrok

# Check status
sudo systemctl status ngrok

# View logs
sudo journalctl -u ngrok -f
```

---

## 🔐 Setup Environment Variables dengan AWS Systems Manager (Opsional)

Untuk keamanan lebih baik, gunakan AWS Systems Manager Parameter Store:

```bash
# Install AWS CLI di server (jika belum)
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configure AWS credentials
aws configure

# Store secrets
aws ssm put-parameter \
    --name "/whatsapp-ai/google-api-key" \
    --value "your-api-key" \
    --type "SecureString" \
    --region us-east-1

aws ssm put-parameter \
    --name "/whatsapp-ai/firebase-service-account" \
    --value "your-base64-key" \
    --type "SecureString" \
    --region us-east-1

# Update docker-compose.yml untuk menggunakan SSM
# Atau gunakan script untuk fetch secrets sebelum start
```

---

## 📱 Setup WhatsApp Session

### 1. Scan QR Code

Setelah service running, QR code akan muncul di logs:

```bash
# View logs real-time untuk QR code
sudo journalctl -u whatsapp-ai -f

# Atau view last 100 lines
sudo journalctl -u whatsapp-ai -n 100

# Filter untuk mencari QR code
sudo journalctl -u whatsapp-ai | grep -i "qr\|whatsapp"

# Atau cek semua logs dengan format yang lebih readable
sudo journalctl -u whatsapp-ai --no-pager | tail -50
```

**Jika QR code tidak muncul:**

1. **Cek apakah service sudah fully started:**
   ```bash
   sudo systemctl status whatsapp-ai
   # Pastikan status: active (running)
   ```

2. **Cek apakah session sudah ada (jika sudah ada, tidak perlu QR):**
   ```bash
   ls -la ~/whatsapp-bot/tokens/
   # Jika ada folder session, hapus untuk force QR baru:
   rm -rf ~/whatsapp-bot/tokens/ai-chatbot
   sudo systemctl restart whatsapp-ai
   ```

3. **Cek apakah WhatsApp client sudah initialize:**
   ```bash
   sudo journalctl -u whatsapp-ai | grep -i "whatsapp\|initialized\|error"
   ```

4. **Cek apakah ada error di initialization:**
   ```bash
   sudo journalctl -u whatsapp-ai | grep -i "error\|failed"
   ```

5. **Test run manual untuk lihat QR code:**
   ```bash
   cd ~/whatsapp-bot
   # Stop service dulu
   sudo systemctl stop whatsapp-ai
   # Run manual
   node app.js
   # QR code akan muncul di terminal
   ```

### 2. Scan QR Code dengan WhatsApp

1. Buka WhatsApp di HP
2. Settings → Linked Devices → Link a Device
3. Scan QR code yang muncul di terminal/logs
4. Tunggu sampai terhubung

### 3. Verify Connection

```bash
# Check health endpoint (local)
curl http://localhost:4000/health

# Check health endpoint (via ngrok)
curl https://unblissful-unverdantly-stan.ngrok-free.dev/health

# Atau dari luar server (tanpa ngrok)
curl http://YOUR_EC2_PUBLIC_IP:4000/health
```

## 🔗 Setup Meta Webhook (Facebook/Instagram Messenger)

Jika menggunakan Meta Webhook untuk Facebook Messenger atau Instagram, setup webhook dengan ngrok URL:

### 1. Dapatkan Ngrok URL

```bash
# Check ngrok logs untuk melihat public URL
sudo journalctl -u ngrok | grep "started tunnel"

# Atau check ngrok local API
curl http://localhost:4040/api/tunnels | jq '.tunnels[0].public_url'

# Atau check di ngrok dashboard
# https://dashboard.ngrok.com/status/tunnels
```

URL akan terlihat seperti: `https://xxxx-xxxx-xxxx.ngrok-free.app`

### 2. Setup Webhook di Meta Developer Console

1. Buka [Meta for Developers](https://developers.facebook.com/)
2. Pilih App Anda
3. Settings → Basic → Add Platform → Webhooks
4. **Callback URL**: `https://your-ngrok-domain.ngrok-free.app/webhooks/meta`
5. **Verify Token**: Sama dengan `META_WEBHOOK_VERIFY_TOKEN` di `.env`
6. Subscribe to events yang diperlukan (messages, messaging_postbacks, dll)

### 3. Verify Webhook

Setelah setup, Meta akan mengirim GET request ke webhook URL untuk verifikasi. Pastikan:
- Container sudah running
- Ngrok tunnel aktif
- `META_WEBHOOK_VERIFY_TOKEN` di `.env` sesuai dengan yang di-set di Meta Console

### 4. Test Webhook

```bash
# Test webhook endpoint
curl https://your-ngrok-domain.ngrok-free.app/webhooks/meta?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test123

# Should return: test123
```

**Note:** 
- Jika menggunakan ngrok free plan, URL akan berubah setiap restart container
- Update webhook URL di Meta Console setiap kali restart
- Untuk production, gunakan ngrok paid plan dengan static domain

---

## 🔄 Management Service

### Start/Stop/Restart Service

```bash
# Start service
sudo systemctl start whatsapp-ai

# Stop service
sudo systemctl stop whatsapp-ai

# Restart service


# Check status
sudo systemctl status whatsapp-ai

# Enable auto-start on boot (sudah dilakukan di step 6)
sudo systemctl enable whatsapp-ai

# Disable auto-start

sudo systemctl disable whatsapp-ai
```

### View Logs

```bash
# Real-time logs
sudo systemctl restart whatsapp-ai
sudo journalctl -u whatsapp-ai -f

# Last 100 lines
sudo journalctl -u whatsapp-ai -n 100

# Logs dengan timestamp
sudo journalctl -u whatsapp-ai --since "1 hour ago"

# Ngrok logs
sudo journalctl -u ngrok -f
```

---

## 📊 Monitoring & Maintenance

### 1. View Logs

```bash
# Real-time logs
sudo journalctl -u whatsapp-ai -f

# Last 100 lines
sudo journalctl -u whatsapp-ai -n 100

# Logs dengan filter
sudo journalctl -u whatsapp-ai --since "1 hour ago" | grep ERROR
```

### 2. Check Service Status

```bash
# Check service status
sudo systemctl status whatsapp-ai

# Check if running
systemctl is-active whatsapp-ai

# Check if enabled
systemctl is-enabled whatsapp-ai
```

### 3. Restart Service

```bash
# Restart service
sudo systemctl restart whatsapp-ai

# Reload service (jika config berubah)
sudo systemctl daemon-reload
sudo systemctl restart whatsapp-ai
```

### 4. Update Application

```bash
cd ~/whatsapp-bot

# Pull latest code
git pull origin main

# Install dependencies (jika ada perubahan)
npm install --production

# Restart service
sudo systemctl restart whatsapp-ai

# Check status
sudo systemctl status whatsapp-ai
```

### 5. Monitor Resources

```bash
# CPU & Memory usage
top -p $(pgrep -f "node.*app.js")

# Atau gunakan htop (install: sudo apt install htop)
htop

# Disk usage
df -h
du -sh ~/whatsapp-bot/tokens
du -sh ~/whatsapp-bot/node_modules

# Process info
ps aux | grep node
```

### 6. Setup CloudWatch Logs (Opsional)

```bash
# Install CloudWatch agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i -E ./amazon-cloudwatch-agent.deb

# Configure (akan membuka editor)
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-config-wizard
```

---

## 🐛 Troubleshooting

### 1. Service Tidak Start

```bash
# Check logs untuk error
sudo journalctl -u whatsapp-ai -n 50

# Check service status
sudo systemctl status whatsapp-ai

# Check jika port sudah digunakan
sudo netstat -tulpn | grep 4000

# Check permissions
ls -la ~/whatsapp-bot/
ls -la ~/whatsapp-bot/.env
```

### 2. WhatsApp Tidak Connect

```bash
# Check session tokens
ls -la ~/whatsapp-bot/tokens/

# Delete session dan restart (akan minta scan QR lagi)
rm -rf ~/whatsapp-bot/tokens/*
sudo systemctl restart whatsapp-ai

# Check logs untuk QR code
sudo journalctl -u whatsapp-ai -f
```

### 3. Port 4000 Tidak Accessible

```bash
# Check security group rules di AWS Console
# Pastikan port 4000 terbuka untuk 0.0.0.0/0 atau IP tertentu

# Check firewall
sudo ufw status
sudo ufw allow 4000/tcp
```

### 4. Out of Memory

```bash
# Check memory usage
free -h
docker stats

# Upgrade instance type di AWS Console
# Atau tambah swap space
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### 5. Disk Space Full

```bash
# Check disk usage
df -h

# Clean old logs
sudo journalctl --vacuum-time=7d

# Clean npm cache
npm cache clean --force

# Remove old node_modules dan reinstall
rm -rf node_modules
npm install --production
```

### 6. Health Check Failed

```bash
# Check apakah aplikasi running
curl http://localhost:4000/health

# Check port binding
netstat -tulpn | grep 4000

# Check container logs
docker logs whatsapp-ai-chatbot
```

### 7. Ngrok Tidak Connect

```bash
# Check ngrok logs
sudo journalctl -u ngrok -n 50

# Check apakah ngrok service running
sudo systemctl status ngrok

# Verify NGROK_AUTHTOKEN di .env
grep NGROK_AUTHTOKEN ~/whatsapp-bot/.env

# Verify ngrok installed
which ngrok
ngrok version

# Restart ngrok service
sudo systemctl restart ngrok

# Check ngrok URL
curl http://localhost:4040/api/tunnels
```

### 8. Ngrok URL Berubah Setiap Restart

**Masalah:** Dengan ngrok free plan, URL berubah setiap restart.

**Solusi:**
1. **Gunakan ngrok paid plan** dengan static domain
2. **Atau update webhook URL** di Meta Console setiap restart
3. **Atau gunakan script** untuk auto-update webhook URL

```bash
# Script untuk get ngrok URL dan update webhook
NGROK_URL=$(docker-compose logs ngrok | grep -oP 'https://[a-z0-9-]+\.ngrok-free\.app' | head -1)
echo "Ngrok URL: $NGROK_URL"
# Gunakan URL ini untuk update webhook di Meta Console
```

### 9. Webhook Meta Tidak Menerima Request

```bash
# Check webhook endpoint
curl https://your-ngrok-domain.ngrok-free.app/webhooks/meta

# Check ngrok tunnel status
curl http://localhost:4040/api/tunnels

# Check if app is running
curl http://localhost:4000/health

# Check ngrok service
sudo systemctl status ngrok

# Verify webhook di Meta Console
# Settings → Webhooks → Test webhook
```

---

## 🔒 Security Best Practices

1. **Jangan commit `.env` file** ke Git
2. **Gunakan AWS Secrets Manager** untuk sensitive data
3. **Restrict SSH access** hanya dari IP tertentu
4. **Update sistem** secara berkala: `sudo apt update && sudo apt upgrade`
5. **Setup CloudWatch Alarms** untuk monitoring
6. **Enable AWS CloudTrail** untuk audit
7. **Gunakan HTTPS** dengan Let's Encrypt jika ada domain

---

## 📝 Checklist Deploy

- [ ] EC2 instance created
- [ ] Security group configured
- [ ] Node.js 18+ installed
- [ ] Ngrok installed (jika menggunakan webhook)
- [ ] Repository cloned
- [ ] `.env` file configured (termasuk NGROK_AUTHTOKEN)
- [ ] Ngrok authtoken obtained dan ditambahkan ke `.env`
- [ ] Ngrok domain setup (jika menggunakan paid plan)
- [ ] Dependencies installed (`npm install`)
- [ ] Directories created (tokens, logs)
- [ ] Systemd service configured dan enabled
- [ ] Service started dan running
- [ ] Ngrok service started (jika menggunakan)
- [ ] Ngrok tunnel active (check logs)
- [ ] QR code scanned
- [ ] Health check passed (local & via ngrok)
- [ ] Meta webhook configured (jika menggunakan)
- [ ] Webhook verified di Meta Console
- [ ] Logs monitored
- [ ] Monitoring setup (optional)

---

## 🎉 Selesai!

Aplikasi WhatsApp AI Chatbot sudah berjalan di AWS EC2!

**Next Steps:**
- Setup domain dan SSL (jika perlu webhook)
- Configure CloudWatch alarms
- Setup backup untuk session tokens
- Monitor costs di AWS Cost Explorer

**Support:**
- Check logs: `docker-compose logs -f`
- Health check: `curl http://localhost:4000/health`
- Restart: `docker-compose restart`

---

## 📚 Referensi

- [AWS EC2 Documentation](https://docs.aws.amazon.com/ec2/)
- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
