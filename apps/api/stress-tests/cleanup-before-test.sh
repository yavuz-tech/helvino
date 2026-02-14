#!/bin/bash
echo "🧹 Test öncesi temizlik..."

# Tüm next-server process'lerini durdur
pkill -f "next-server" 2>/dev/null && echo "next-server'lar kapatıldı" || echo "next-server bulunamadı"

# Tüm node process'lerini durdur (dikkatli)
pkill -f "node.*apps/api" 2>/dev/null && echo "API process'ler kapatıldı" || echo "API process bulunamadı"
pkill -f "node.*apps/web" 2>/dev/null && echo "Web process'ler kapatıldı" || echo "Web process bulunamadı"

# 3 saniye bekle
sleep 3

# RAM durumu göster
echo ""
echo "📊 RAM durumu:"
vm_stat | awk 'NR<=5 {print}'

# Sadece API'yi başlat (web'e gerek yok stress test için)
echo ""
echo "🚀 Sadece API başlatılıyor..."
cd /Users/yavuz/Desktop/helvino/apps/api && NODE_OPTIONS="--max-old-space-size=2048" pnpm dev &

sleep 5
echo ""
echo "✅ Temizlik tamam. Test için hazır!"
