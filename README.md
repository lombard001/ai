# AI Soru-Cevap Cache API

Bu API, WebSocket Panel scripti için AI sorularını ve cevaplarını önbelleğe alır. Böylece aynı sorular tekrar sorulduğunda Gemini API limitini harcamadan önceki cevapları verir.

## Render.com'da Kurulum

1. Bu projeyi GitHub'a yükleyin
2. Render.com'da yeni Web Service oluşturun
3. GitHub repo'nuzu bağlayın
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Deploy edin

## API Endpoints

### GET /
API bilgileri ve mevcut endpoint'ler

### GET /search?q=soru
Benzer soru arar ve varsa cevabını döner
```
GET /search?q=nasılsın
```

### POST /save
Yeni soru-cevap kaydeder
```json
{
  "question": "nasılsın",
  "answer": "İyiyim teşekkürler!"
}
```

### GET /questions
Tüm kayıtlı soruları listeler

### GET /stats
İstatistikleri gösterir

### DELETE /clear
Tüm veritabanını temizler

### DELETE /question?q=soru
Belirli bir soruyu siler

## Özellikler

- ✅ Soru benzerliği analizi (%70 eşik)
- ✅ Kullanım sayısı takibi
- ✅ İstatistik sistemi
- ✅ CORS desteği
- ✅ Error handling
- ✅ Health check
- ✅ Memory-based storage (Render.com'da kalıcı)

## Script Entegrasyonu

WebSocket Panel scriptinizde AI Cache URL'ini ayarlayın:
```javascript
const AI_CACHE_URL = 'https://your-app.onrender.com';
```
