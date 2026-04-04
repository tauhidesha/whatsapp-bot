# 🚀 GCP Server Management Guide

Panduan cepat command untuk akses dan maintenance server **MotoAssist** di Google Cloud Platform.

---

## 🔑 1. Akses SSH Ke Server
Gunakan command ini dari terminal laptop lokal Anda:

### Via GCloud CLI (Direkomendasikan)
```bash
gcloud compute ssh instance-zoya-v3-4gb --project=motoassist-7mz1e --zone=us-central1-c
```

### Via Terminal Standard (Jika sudah setup key)
```bash
ssh ubuntu@34.63.72.95
```

---

## 📂 2. Navigasi & Update Kode
Setelah masuk ke server, gunakan command ini:

### Masuk ke folder project
```bash
cd ~/whatsapp-bot
```

### Update kode dari GitHub
```bash
git pull origin main
```

### Install ulang dependencies (Jika ada perubahan package.json)
```bash
npm install --production
```

---

## 🔄 3. Restart Aplikasi
Tergantung server Anda menggunakan **Systemd** (sesuai `.service` file) atau **PM2**.

### Opsi A: Menggunakan Systemd (Rekomendasi SETUP_SERVICE.md)
```bash
# Restart service
sudo systemctl restart whatsapp-ai

# Cek status service
sudo systemctl status whatsapp-ai

# Stop service
sudo systemctl stop whatsapp-ai
```

### Opsi B: Menggunakan PM2 (Jika Anda menginstalnya)
```bash
# Restart aplikasi (khusus whatsapp)
pm2 restart whatsapp-ai

# Restart semua aplikasi
pm2 restart all

# Cek daftar aplikasi
pm2 list

# Stop aplikasi
pm2 stop whatsapp-ai
```

---

## 📝 4. Cek Logs (Monitoring)
Sangat berguna untuk melihat QR Code atau pesan error.

### Logs Systemd (Real-time)
```bash
sudo journalctl -u whatsapp-ai -f
```

### Logs PM2 — Standard (real-time, out + error)
```bash
pm2 logs whatsapp-ai
```

### Logs PM2 — Error ONLY (real-time)
```bash
pm2 logs whatsapp-ai --err --raw
```

### Logs PM2 — N baris terakhir (out + error)
```bash
pm2 logs whatsapp-ai --lines 100
```

### Logs PM2 — N baris error saja
```bash
pm2 logs whatsapp-ai --lines 200 --err
```

### Baca file error log langsung (paling lengkap)
```bash
# 200 baris terakhir
tail -n 200 ~/.pm2/logs/whatsapp-ai-error.log

# Full log (semua isi file)
cat ~/.pm2/logs/whatsapp-ai-error.log

# Cari error spesifik + konteks sekitarnya
grep -n "ERROR_KEYWORD" ~/.pm2/logs/whatsapp-ai-error.log -B 20 -A 5
```

### Clear semua log PM2 (reset log file)
```bash
pm2 flush whatsapp-ai
```

---

## 🛠️ 5. Utility & Health Check

### Cek penggunaan RAM & CPU
```bash
# Versi interaktif
top

# Versi ringkas
free -m
```

### Cek penggunaan Storage (Disk)
```bash
df -h
```

### Hapus session WhatsApp (Jika bot stuck/corrupt)
```bash
rm -rf ~/whatsapp-bot/tokens/ai-chatbot
sudo systemctl restart whatsapp-ai
```

---

> [!TIP]
> **Pro Tip:** Simpan alias `konek-server` di laptop lokal Anda agar tidak perlu menghafal command gcloud yang panjang. 
> 
> Tambahkan ini di `~/.zshrc`: 
> `alias konek-server='gcloud compute ssh instance-zoya-v3-4gb --project=motoassist-7mz1e --zone=us-central1-c'`
