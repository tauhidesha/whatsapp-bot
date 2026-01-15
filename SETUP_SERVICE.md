# 🔧 Setup Systemd Service - Panduan Lengkap

## ⚠️ Penting: User di Service File

**User di service file BUKAN hostname!**

- ❌ **SALAH**: `User=ip-172-31-23-85` (ini hostname)
- ✅ **BENAR**: `User=ubuntu` atau `User=ec2-user` (ini username)

## 📋 Cara Cek Username yang Benar

```bash
# Cek username saat ini
whoami

# Output untuk Ubuntu: ubuntu
# Output untuk Amazon Linux: ec2-user

# Cek home directory
echo $HOME
# Output: /home/ubuntu atau /home/ec2-user
```

## 🔧 Edit Service File

Setelah copy service file, edit dengan:

```bash
sudo nano /etc/systemd/system/whatsapp-ai.service
```

**Yang perlu diubah:**

1. **User** - Sesuaikan dengan output `whoami`:
   ```ini
   User=ubuntu        # Untuk Ubuntu
   # atau
   User=ec2-user      # Untuk Amazon Linux
   ```

2. **WorkingDirectory** - Sesuaikan dengan lokasi aplikasi:
   ```ini
   WorkingDirectory=/home/ubuntu/whatsapp-bot
   # atau
   WorkingDirectory=/home/ec2-user/whatsapp-bot
   ```

3. **EnvironmentFile** - Sesuaikan path ke .env:
   ```ini
   EnvironmentFile=/home/ubuntu/whatsapp-bot/.env
   # atau
   EnvironmentFile=/home/ec2-user/whatsapp-bot/.env
   ```

4. **ExecStart** - Sesuaikan path node dan app.js:
   ```ini
   ExecStart=/usr/bin/node /home/ubuntu/whatsapp-bot/app.js
   # atau
   ExecStart=/usr/bin/node /home/ec2-user/whatsapp-bot/app.js
   ```

## ✅ Contoh Service File yang Benar

**Untuk Ubuntu:**
```ini
[Unit]
Description=WhatsApp AI Chatbot
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/whatsapp-bot
Environment="NODE_ENV=production"
EnvironmentFile=/home/ubuntu/whatsapp-bot/.env
ExecStart=/usr/bin/node /home/ubuntu/whatsapp-bot/app.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=whatsapp-ai

[Install]
WantedBy=multi-user.target
```

**Untuk Amazon Linux:**
```ini
[Unit]
Description=WhatsApp AI Chatbot
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/whatsapp-bot
Environment="NODE_ENV=production"
EnvironmentFile=/home/ec2-user/whatsapp-bot/.env
ExecStart=/usr/bin/node /home/ec2-user/whatsapp-bot/app.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=whatsapp-ai

[Install]
WantedBy=multi-user.target
```

## 🚀 Setup Langkah demi Langkah

```bash
# 1. Cek username
whoami

# 2. Cek path node
which node
# Output biasanya: /usr/bin/node

# 3. Copy service file
cd ~/whatsapp-bot
sudo cp whatsapp-ai.service /etc/systemd/system/

# 4. Edit service file
sudo nano /etc/systemd/system/whatsapp-ai.service
# Edit User, WorkingDirectory, EnvironmentFile, dan ExecStart

# 5. Reload systemd
sudo systemctl daemon-reload

# 6. Enable service
sudo systemctl enable whatsapp-ai

# 7. Start service
sudo systemctl start whatsapp-ai

# 8. Check status
sudo systemctl status whatsapp-ai

# 9. View logs
sudo journalctl -u whatsapp-ai -f
```

## 🐛 Troubleshooting

### Error: "Failed to start service" atau "Result: resources"

**Langkah 1: Cek detail error di logs**

```bash
# Check logs untuk error detail
sudo journalctl -u whatsapp-ai -n 50 --no-pager

# Atau dengan timestamp
sudo journalctl -u whatsapp-ai --since "5 minutes ago"
```

**Langkah 2: Cek common issues**

```bash
# 1. Cek apakah user ada
id ec2-user
# atau
id ubuntu

# 2. Cek apakah path node ada
which node
ls -la /usr/bin/node

# 3. Cek apakah app.js ada
ls -la ~/whatsapp-bot/app.js

# 4. Cek apakah .env file ada
ls -la ~/whatsapp-bot/.env

# 5. Cek apakah port 4000 sudah digunakan
sudo netstat -tulpn | grep 4000
# atau
sudo lsof -i :4000

# 6. Test run manual (sebagai user yang sama)
cd ~/whatsapp-bot
node app.js
```

**Common errors dan solusinya:**

1. **"User does not exist"**
   ```bash
   # Pastikan user sesuai dengan whoami
   whoami
   # Edit service file dengan user yang benar
   ```

2. **"No such file or directory"**
   ```bash
   # Cek semua path di service file
   ls -la /usr/bin/node
   ls -la ~/whatsapp-bot/app.js
   ls -la ~/whatsapp-bot/.env
   ```

3. **"Permission denied"**
   ```bash
   # Pastikan user punya akses
   chmod 644 ~/whatsapp-bot/.env
   chmod 644 ~/whatsapp-bot/app.js
   ```

4. **"Address already in use" (port 4000 digunakan)**
   ```bash
   # Kill process yang menggunakan port 4000
   sudo lsof -ti:4000 | xargs sudo kill -9
   # Atau restart service
   sudo systemctl restart whatsapp-ai
   ```

5. **"Cannot find module"**
   ```bash
   # Install dependencies
   cd ~/whatsapp-bot
   npm install --production
   ```

### Error: "Permission denied"

```bash
# Pastikan user punya akses ke direktori
ls -la ~/whatsapp-bot

# Pastikan .env file readable
chmod 644 ~/whatsapp-bot/.env

# Pastikan app.js executable (tidak perlu, tapi pastikan readable)
chmod 644 ~/whatsapp-bot/app.js
```

### Service tidak start setelah reboot

```bash
# Pastikan service enabled
sudo systemctl is-enabled whatsapp-ai

# Jika tidak enabled, enable lagi
sudo systemctl enable whatsapp-ai
```
