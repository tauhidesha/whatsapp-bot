# Groq API Fallback Configuration

## Overview
Sistem ini mendukung multiple API keys untuk Groq AI dengan automatic fallback. Jika API key pertama gagal (quota exceeded, rate limit, authentication error), sistem akan otomatis mencoba API key berikutnya.

## Configuration

### Environment Variables

Tambahkan API keys di file `.env`:

```env
# Primary API Key (Required)
GROQ_API_KEY=your_primary_api_key_here

# Fallback API Key (Optional)
GROQ_API_KEY_FALLBACK=your_fallback_api_key_here
```

### How It Works

1. **Primary Key**: Sistem akan selalu mencoba menggunakan `GOOGLE_API_KEY` terlebih dahulu
2. **Automatic Fallback**: Jika primary key gagal dengan error berikut, sistem otomatis switch ke fallback key:
   - Quota exceeded errors (429, RESOURCE_EXHAUSTED)
   - Authentication errors (401, API key not valid)
   - Response format errors

3. **Model Fallback**: Jika semua API keys gagal, sistem akan mencoba model yang lebih ringan (`gemini-2.5-flash`)

## Supported Scenarios

### ✅ Chat AI Processing
- Automatic fallback untuk semua chat requests
- Mencoba semua API keys sebelum mengembalikan error
- Logs menunjukkan API key mana yang berhasil

### ✅ Vision Analysis
- Fallback untuk analisis gambar motor
- Mencoba kombinasi model + API key
- Prioritas: model terbaik dengan API key tersedia

### ✅ Admin Message Rewrite
- Fallback untuk penulisan ulang pesan admin
- Transparent switching between API keys

## Example Logs

### Successful Primary Key
```
🚀 [AI_PROCESSING] Sending request to AI model... (iteration 1)
✅ [AI_PROCESSING] Response received
```

### Fallback to Secondary Key
```
🚀 [AI_PROCESSING] Sending request to AI model... (iteration 1)
❌ [AI_PROCESSING] Error with primary API key: Rate limit exceeded
🔄 [AI_PROCESSING] Trying fallback #1 API key...
✅ [AI_PROCESSING] fallback #1 API key succeeded!
```

### Vision Analysis Fallback
```
[VISION] 🔍 Analysing image using llama-3.2-90b-vision-preview...
[VISION] ❌ llama-3.2-90b-vision-preview failed: Rate limit exceeded
[VISION] 🔄 Trying llama-3.2-90b-vision-preview with fallback #1 API key...
[VISION] ✅ Analysis complete with llama-3.2-90b-vision-preview using fallback #1 API key
```

## Startup Logs

Saat aplikasi start, akan muncul informasi jumlah API keys yang dikonfigurasi:

```
🔑 [STARTUP] API Keys configured: 2 key(s) available
🔄 [STARTUP] Fallback API key configured - will auto-retry on failures
```

## Best Practices

1. **Gunakan API keys dari project yang berbeda** untuk menghindari shared quota
2. **Monitor logs** untuk melihat seberapa sering fallback terjadi
3. **Set up billing alerts** di Google Cloud Console untuk kedua API keys
4. **Jangan commit API keys** ke repository (gunakan `.env` file)

## Troubleshooting

### Semua API Keys Gagal
Jika semua API keys gagal, periksa:
- Rate limits di [Groq Console](https://console.groq.com/)
- Account status dan tier
- Validity dari API keys

### Fallback Tidak Berfungsi
Pastikan:
- `GROQ_API_KEY_FALLBACK` sudah di-set di `.env`
- Restart aplikasi setelah menambahkan fallback key
- Check startup logs untuk konfirmasi jumlah keys

## API Key Management

### Mendapatkan API Key Baru
1. Buka [Groq Console](https://console.groq.com/)
2. Sign up atau login
3. Navigate to API Keys section
4. Create new API key
5. Copy ke `.env` file

### Rotating Keys
Untuk mengganti API keys tanpa downtime:
1. Tambahkan key baru sebagai `GROQ_API_KEY_FALLBACK`
2. Restart aplikasi
3. Monitor logs untuk memastikan fallback berfungsi
4. Update `GROQ_API_KEY` dengan key baru
5. Restart aplikasi lagi
6. Hapus/rotate `GROQ_API_KEY_FALLBACK`

## Security Notes

⚠️ **PENTING**: 
- Jangan pernah commit API keys ke git repository
- Tambahkan `.env` ke `.gitignore`
- Gunakan environment variables untuk production deployment
- Rotate API keys secara berkala
- Monitor usage di Groq Console untuk mendeteksi anomali
