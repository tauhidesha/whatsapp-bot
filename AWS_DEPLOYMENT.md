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

### 2. Install Docker

**Ubuntu:**

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker-compose --version
```

**Amazon Linux:**

```bash
# Install Docker
sudo yum install docker -y
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Logout dan login lagi untuk apply group changes
```

### 3. Install Git & Node.js (untuk build, opsional)

```bash
# Ubuntu
sudo apt install git -y

# Amazon Linux
sudo yum install git -y

# Node.js (jika perlu build di server)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 4. Setup Firewall (jika menggunakan UFW)

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
WHATSAPP_AUTO_CLOSE=false

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
```

**Simpan dengan `Ctrl+O`, `Enter`, `Ctrl+X`**

### 3. Setup Direktori untuk Session & Logs

```bash
# Buat direktori untuk WhatsApp session tokens
mkdir -p ~/whatsapp-bot/tokens
mkdir -p ~/whatsapp-bot/logs

# Set permissions
chmod 755 ~/whatsapp-bot/tokens
chmod 755 ~/whatsapp-bot/logs
```

### 4. Build & Run dengan Docker Compose

```bash
cd ~/whatsapp-bot

# Build dan start containers
docker-compose up -d

# Check logs
docker-compose logs -f whatsapp-ai-chatbot

# Check status
docker-compose ps
```

### 5. Atau Build & Run dengan Docker Manual

```bash
cd ~/whatsapp-bot

# Build image
docker build -t whatsapp-ai-chatbot .

# Run container
docker run -d \
  --name whatsapp-ai-chatbot \
  --restart unless-stopped \
  -p 4000:4000 \
  --env-file .env \
  -v $(pwd)/tokens:/app/tokens \
  -v $(pwd)/logs:/app/logs \
  whatsapp-ai-chatbot

# Check logs
docker logs -f whatsapp-ai-chatbot
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

Setelah container running, QR code akan muncul di logs:

```bash
# View logs untuk QR code
docker-compose logs -f whatsapp-ai-chatbot

# Atau
docker logs -f whatsapp-ai-chatbot
```

### 2. Scan QR Code dengan WhatsApp

1. Buka WhatsApp di HP
2. Settings → Linked Devices → Link a Device
3. Scan QR code yang muncul di terminal/logs
4. Tunggu sampai terhubung

### 3. Verify Connection

```bash
# Check health endpoint
curl http://localhost:4000/health

# Atau dari luar server
curl http://YOUR_EC2_PUBLIC_IP:4000/health
```

---

## 🔄 Setup Auto-Restart dengan Systemd (Opsional)

Buat service untuk auto-restart:

```bash
sudo nano /etc/systemd/system/whatsapp-ai.service
```

**Isi:**

```ini
[Unit]
Description=WhatsApp AI Chatbot
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/ubuntu/whatsapp-bot
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Enable & Start:**

```bash
sudo systemctl daemon-reload
sudo systemctl enable whatsapp-ai
sudo systemctl start whatsapp-ai
sudo systemctl status whatsapp-ai
```

---

## 📊 Monitoring & Maintenance

### 1. View Logs

```bash
# Docker Compose
docker-compose logs -f whatsapp-ai-chatbot

# Docker
docker logs -f whatsapp-ai-chatbot

# Last 100 lines
docker logs --tail 100 whatsapp-ai-chatbot
```

### 2. Check Container Status

```bash
docker ps
docker-compose ps
```

### 3. Restart Container

```bash
# Docker Compose
docker-compose restart whatsapp-ai-chatbot

# Docker
docker restart whatsapp-ai-chatbot
```

### 4. Update Application

```bash
cd ~/whatsapp-bot

# Pull latest code
git pull origin main

# Rebuild dan restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### 5. Monitor Resources

```bash
# CPU & Memory usage
docker stats whatsapp-ai-chatbot

# Disk usage
df -h
du -sh ~/whatsapp-bot/tokens
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

### 1. Container Tidak Start

```bash
# Check logs
docker-compose logs whatsapp-ai-chatbot

# Check environment variables
docker-compose config

# Test build
docker-compose build --no-cache
```

### 2. WhatsApp Tidak Connect

```bash
# Check session tokens
ls -la ~/whatsapp-bot/tokens/

# Delete session dan restart (akan minta scan QR lagi)
rm -rf ~/whatsapp-bot/tokens/*
docker-compose restart whatsapp-ai-chatbot
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

# Clean Docker
docker system prune -a

# Clean old logs
docker-compose logs --tail=0 -f whatsapp-ai-chatbot > /dev/null
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
- [ ] Docker installed
- [ ] Repository cloned
- [ ] `.env` file configured
- [ ] Directories created (tokens, logs)
- [ ] Container built and running
- [ ] QR code scanned
- [ ] Health check passed
- [ ] Logs monitored
- [ ] Auto-restart configured (optional)
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
