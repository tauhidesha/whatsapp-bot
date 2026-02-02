#!/bin/bash

# Script Helper untuk Push Update Admin UI ke Vercel

echo "🚀 Memulai Push Update Admin UI ke Vercel..."

cd admin-ui || { echo "❌ Folder 'admin-ui' tidak ditemukan."; exit 1; }

# Deploy ke production (akan menggunakan project yang sudah dilink sebelumnya)
npx vercel --prod

echo "✅ Selesai."