# WhatsApp AI Chatbot

WhatsApp AI Chatbot dengan LangChain dan Google Gemini. Arsitektur JavaScript yang konsisten dan siap deploy ke AWS.

## 🚀 Features

- ✅ **WhatsApp Integration** - Menggunakan wppconnect
- ✅ **AI Powered** - LangChain + Google Gemini (vision & tool-calling)
- ✅ **Message Debouncing** - Buffer pesan selama 15 detik
- ✅ **Firebase Integration** - Simpan chat history & booking data
- ✅ **Human Handover** - Trigger BosMat dengan notifikasi WA
- ✅ **Auto Reminders** - Pengingat booking H-0 jam 08:00
- ✅ **Media Support** - Handle gambar dan dokumen
- ✅ **REST API** - Endpoint untuk kontrol eksternal
- ✅ **Docker Ready** - Siap deploy ke AWS
- ✅ **Health Monitoring** - Built-in health checks
- ✅ **Admin Console** - UI Vercel dengan notifikasi real-time & penulisan ulang gaya pesan admin
- ✅ **Home Service Calculator** - Otomatis hitung jarak & biaya tambahan di atas 5 km (Google Distance Matrix)

## 📋 Prerequisites

- Node.js 18+
- Google Gemini API Key
- WhatsApp Business Account (optional)

## 🛠️ Installation

### 1. Clone & Install
```bash
git clone <your-repo>
cd whatsapp-ai-chatbot
npm install
```

### 2. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Edit .env file
nano .env
```

### 3. Get API Keys

#### Google Gemini API:
1. Visit: https://makersuite.google.com/app/apikey
2. Generate API key
3. Add to `.env`: `GOOGLE_API_KEY=your_key_here`

#### Firebase (Optional):
1. Create Firebase project
2. Generate service account key
3. Add to `.env`: `FIREBASE_SERVICE_ACCOUNT_BASE64=your_base64_key`

## 🧪 Testing

```bash
# Test AI connection
npm test

# Test specific functions
node -e "require('./test.js').testGeminiConnection()"
```

## 🚀 Running

### Development:
```bash
npm run dev
```

### Production:
```bash
npm start
```

### Docker:
```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

## 📱 WhatsApp Setup

1. **Start the server**: `npm start`
2. **Scan QR Code** yang muncul di terminal
3. **Send test message** ke nomor WhatsApp yang terhubung
4. **Check logs** untuk melihat AI responses

## 🔧 API Endpoints

### Health Check
```bash
GET /health
```

### Send Message
```bash
POST /send-message
Content-Type: application/json

{
  "number": "6281234567890",
  "message": "Hello from API!"
}
```

### Send Media
```bash
POST /send-media
Content-Type: application/json

{
  "number": "6281234567890",
  "base64": "base64_encoded_file",
  "mimetype": "image/jpeg",
  "filename": "photo.jpg",
  "caption": "Check this out!"
}
```

### Test AI
```bash
POST /test-ai
Content-Type: application/json

{
  "message": "Hello, who are you?"
}
```

## 🎯 Configuration

### Environment Variables:
```env
# WhatsApp
WHATSAPP_SESSION=ai-chatbot
WHATSAPP_HEADLESS=true
WHATSAPP_AUTO_CLOSE=false

# AI
GOOGLE_API_KEY=your_key_here
GOOGLE_MAPS_API_KEY=${GOOGLE_API_KEY}         # Bisa reuse key yang sama
AI_MODEL=gemini-1.5-flash
AI_TEMPERATURE=0.7
AI_MAX_TOKENS=1000

# Home service (opsional)
STUDIO_LATITUDE=-6.371583
STUDIO_LONGITUDE=106.853917
HOME_SERVICE_FREE_RADIUS_KM=5
HOME_SERVICE_FEE_PER_KM=10000
HOME_SERVICE_BASE_FEE=0

# Admin message rewrite
ADMIN_MESSAGE_REWRITE=true            # Ubah ke false jika tidak ingin AI menata ulang pesan admin

# Server
PORT=4000
NODE_ENV=development

# Debouncing
DEBOUNCE_DELAY_MS=15000

# Firebase (Optional)
FIREBASE_SERVICE_ACCOUNT_BASE64=your_base64_key

# Human handover & admin notifications
BOSMAT_ADMIN_NUMBER=6281234567890      # WA admin penerima notifikasi
NOTIFY_BOOKING_CREATION=true           # Kirim notifikasi saat booking dibuat

# Booking reminders
BOOKING_REMINDER_ENABLED=true          # Matikan dengan false jika tidak perlu
BOOKING_REMINDER_HOUR=8                # Jam (24h) pengiriman reminder H-0
BOOKING_REMINDER_WINDOW=30             # Batas menit setelah jam reminder
BOOKING_REMINDER_INTERVAL=15           # Interval scheduler (menit)
APP_TIMEZONE=Asia/Jakarta              # Timezone default aplikasi

# LangSmith tracing (opsional)
LANGSMITH_TRACING_V2=true              # Aktifkan tracing LangSmith
LANGSMITH_API_KEY=your_langsmith_key
LANGSMITH_PROJECT=WhatsApp AI Chatbot
# LANGSMITH_ENDPOINT=https://api.smith.langchain.com

# Vision model (opsional)
VISION_MODEL=gemini-2.5-flash          # Gemini multimodal untuk analisis gambar
VISION_FALLBACK_MODEL=gemini-1.5-flash-vision
```

### AI Model Options:
- `gemini-1.5-flash` - Fast and efficient
- `gemini-1.5-pro` - More capable
- `gemini-1.5-flash-8b` - Smaller model

## 🚚 Home Service Fee Calculation

- Bot otomatis menyimpan koordinat saat pelanggan mengirim *Share Location* di WhatsApp.
- Tool `calculateHomeServiceFee` akan:
  1. Menghitung jarak dari studio ke rumah pelanggan via Google Distance Matrix.
  2. Menambahkan biaya jika jarak > `HOME_SERVICE_FREE_RADIUS_KM` (default 5 km).
  3. Menyimpan ringkasan biaya ke Firestore agar admin bisa melihat di dashboard.
- Saat booking home service dibuat (`createBooking` tool), biaya tambahan langsung dihitung dan disertakan pada notifikasi admin.
- Sesuaikan tarif lewat environment variables:
  - `HOME_SERVICE_FREE_RADIUS_KM`
  - `HOME_SERVICE_FEE_PER_KM`
  - `HOME_SERVICE_BASE_FEE` (opsional biaya dasar di luar radius)


## 🚀 AWS Deployment

**📚 Tutorial Lengkap:** Lihat [AWS_DEPLOYMENT.md](./AWS_DEPLOYMENT.md) untuk panduan step-by-step lengkap.

### Quick Start dengan Script

```bash
# Setup EC2 dan deploy otomatis
./deploy-ec2.sh ec2-user@your-ec2-ip

# Atau manual:
# 1. Launch EC2 instance (Ubuntu 22.04 atau Amazon Linux)
# 2. Install Docker & Docker Compose
# 3. Clone repository
# 4. Setup .env file
# 5. Run: docker-compose up -d
```

### 1. EC2 Instance (Recommended)

Cara termudah untuk deploy WhatsApp bot karena perlu persistent session:

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Clone and deploy
git clone <your-repo>
cd whatsapp-ai-chatbot
cp .env.example .env  # Edit dengan credentials Anda
docker-compose up -d
```

**Lihat [AWS_DEPLOYMENT.md](./AWS_DEPLOYMENT.md) untuk tutorial lengkap.**

### 2. ECS (Elastic Container Service)

Untuk production dengan auto-scaling:

```bash
# Gunakan script yang sudah ada
./deploy-aws.sh

# Atau manual:
# Build and push to ECR
aws ecr create-repository --repository-name whatsapp-ai-chatbot
docker build -t whatsapp-ai-chatbot .
docker tag whatsapp-ai-chatbot:latest <account>.dkr.ecr.<region>.amazonaws.com/whatsapp-ai-chatbot:latest
docker push <account>.dkr.ecr.<region>.amazonaws.com/whatsapp-ai-chatbot:latest
```

**Note:** ECS Fargate tidak cocok untuk WhatsApp bot karena session tidak persistent. Gunakan EC2 dengan ECS atau standalone Docker.

## 📊 Monitoring

### Health Check:
```bash
curl http://localhost:4000/health
```

### Logs:
```bash
# Docker logs
docker-compose logs -f

# Application logs
tail -f logs/app.log
```

### Metrics:
- Response time
- Message count
- Error rate
- AI model performance

## 🤖 Built-in Tools

| Tool | Fungsi | Catatan |
|------|--------|---------|
| `getMotorSizeDetails` | Deteksi ukuran motor | Digunakan sebelum cek harga |
| `getSpecificServicePrice` | Ambil harga layanan | Memerlukan ukuran motor |
| `listServicesByCategory` | Daftar layanan per kategori | |
| `getStudioInfo` | Informasi alamat, jam, kontak | |
| `checkBookingAvailability` | Cek slot booking | Memperhitungkan kapasitas repaint/detailing |
| `createBooking` | Simpan booking baru | Mengirim notifikasi admin + reminder harian |
| `updateBooking` | Edit jadwal, layanan, status | Reset reminder bila jadwal berubah |
| `getCurrentDateTime` | Beri waktu aktual | Menjaga AI tetap sinkron dengan waktu server |
| `triggerBosMatTool` | Human handover ke BosMat | Log Firestore + WhatsApp ke admin |

> **Catatan:** AI diminta untuk selalu konfirmasi ulang ke user sebelum menjalankan `createBooking`, `updateBooking`, atau `triggerBosMatTool`.

## ⏰ Booking Reminder Workflow

- Scheduler berjalan otomatis saat WhatsApp client siap (`startBookingReminderScheduler`).
- Setiap hari pukul `BOOKING_REMINDER_HOUR` (default 08:00) bot mengecek booking hari ini.
- Reminder dikirim via WhatsApp ke pelanggan (`reminderSent` ditandai pada dokumen booking).
- Jika booking dibatalkan atau dijadwal ulang, flag reminder akan direset sehingga reminder tidak dikirim ke jadwal lama.

## 📣 Human Handover Flow

1. AI memanggil `triggerBosMatTool` saat tidak yakin menjawab.
2. Bot menulis entri pada `humanHandovers` & mengaktifkan snooze untuk nomor tersebut.
3. Notifikasi WhatsApp berisi detail pertanyaan dikirim ke `BOSMAT_ADMIN_NUMBER`.
4. Admin bisa lanjut menanggapi pelanggan secara manual.

## 📈 LangSmith Tracing

- Set environment `LANGSMITH_TRACING_V2=true` dan `LANGSMITH_API_KEY` untuk mengaktifkan tracing.
- Opsional: `LANGSMITH_PROJECT` dan `LANGSMITH_ENDPOINT` untuk menyesuaikan project/endpoint.
- Seluruh panggilan `ChatGoogleGenerativeAI.invoke` secara otomatis dikirim ke LangSmith sebagai run baru.
- Sampling dapat dimatikan kapan saja dengan `LANGSMITH_TRACING=false`.

## 🔍 Troubleshooting

### Common Issues:

1. **QR Code not showing**:
   - Check Puppeteer installation
   - Verify headless mode settings

2. **AI not responding**:
   - Check GOOGLE_API_KEY
   - Verify API quota
   - Check network connectivity

3. **Messages not sending**:
   - Check WhatsApp connection
   - Verify phone number format
   - Check rate limits

4. **Firebase errors**:
   - Check service account key
   - Verify Firebase project settings
   - Check permissions

## 🎨 Customization

### Custom AI Prompt:
Edit `app.js` line 45:
```javascript
const SYSTEM_PROMPT = `Your custom prompt here...`;
```

### Penulisan Ulang Pesan Admin:
```env
ADMIN_MESSAGE_REWRITE=true  # biarkan true agar pesan manual admin diselaraskan dengan gaya Zoya
```
Setel ke `false` bila ingin pesan admin dikirim apa adanya.

### Custom Debounce Time:
Edit `.env`:
```env
DEBOUNCE_DELAY_MS=10000  # 10 seconds
```

### Custom AI Model:
Edit `.env`:
```env
AI_MODEL=gemini-1.5-pro
AI_TEMPERATURE=0.9
```

## 📈 Performance

### Optimization Tips:
- Use `gemini-1.5-flash` for faster responses
- Adjust `DEBOUNCE_DELAY_MS` based on usage
- Monitor memory usage with large message buffers
- Use Firebase for persistent storage

### Scaling:
- Run multiple instances behind load balancer
- Use Redis for shared message buffers
- Implement message queuing for high volume

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- GitHub Issues: [Create issue](https://github.com/your-repo/issues)
- Documentation: [Wiki](https://github.com/your-repo/wiki)
- Community: [Discord](https://discord.gg/your-server)
