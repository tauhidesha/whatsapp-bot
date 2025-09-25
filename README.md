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
AI_MODEL=gemini-1.5-flash
AI_TEMPERATURE=0.7
AI_MAX_TOKENS=1000

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

# Vision model (opsional)
VISION_MODEL=gemini-2.5-flash          # Gemini multimodal untuk analisis gambar
VISION_FALLBACK_MODEL=gemini-1.5-flash-vision
```

### AI Model Options:
- `gemini-1.5-flash` - Fast and efficient
- `gemini-1.5-pro` - More capable
- `gemini-1.5-flash-8b` - Smaller model

## 🚀 AWS Deployment

### 1. EC2 Instance
```bash
# Launch EC2 instance (Ubuntu 22.04)
# Install Docker
sudo apt update
sudo apt install docker.io docker-compose

# Clone and deploy
git clone <your-repo>
cd whatsapp-ai-chatbot
docker-compose up -d
```

### 2. ECS (Elastic Container Service)
```bash
# Build and push to ECR
aws ecr create-repository --repository-name whatsapp-ai-chatbot
docker build -t whatsapp-ai-chatbot .
docker tag whatsapp-ai-chatbot:latest <account>.dkr.ecr.<region>.amazonaws.com/whatsapp-ai-chatbot:latest
docker push <account>.dkr.ecr.<region>.amazonaws.com/whatsapp-ai-chatbot:latest
```

### 3. Lambda (Serverless)
```bash
# Package for Lambda
npm run build
zip -r whatsapp-ai-chatbot.zip .
```

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
