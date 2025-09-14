# AI Cache API - Cloudflare Pages

AI destekli soru-cevap cache sistemi. Cloudflare Pages Functions kullanarak serverless API.

## 🚀 Özellikler

- ✅ Soru-cevap kaydetme ve arama
- ✅ Akıllı soru benzerliği algoritması (%70 eşik)
- ✅ İstatistik takibi ve kullanım analizi
- ✅ CORS desteği
- ✅ Serverless mimari
- ✅ Anlık test arayüzü

## 📡 API Endpoints

### GET /api
API bilgileri ve endpoint listesi

### GET /api/search?q=soru
Belirli bir soru için cache'de arama

**Örnek:**
```bash
curl "https://your-site.pages.dev/api/search?q=JavaScript nedir"
```

### POST /api/save
Yeni soru-cevap çiftini kaydet

**Örnek:**
```bash
curl -X POST "https://your-site.pages.dev/api/save" \
  -H "Content-Type: application/json" \
  -d '{"question": "JavaScript nedir?", "answer": "Web geliştirme için kullanılan programlama dili"}'
```

### GET /api/questions
Tüm kayıtlı soruları listele (kullanım sıklığına göre sıralı)

### GET /api/stats
Sistem istatistikleri (toplam soru, cache hits, API çağrıları)

### DELETE /api/clear
Tüm cache'i temizle

### DELETE /api/question?q=soru
Belirli bir soruyu sil

### GET /api/health
Sistem sağlık kontrolü

## 🏗️ Cloudflare Pages'e Deploy

1. GitHub'da repo oluşturun ve kodları push edin
2. [Cloudflare Dashboard](https://dash.cloudflare.com) → Pages
3. "Create a project" → "Connect to Git"
4. Repository seçin
5. Build ayarları:
   - **Build command:** (boş bırak)
   - **Build output directory:** (boş bırak veya `/`)
6. "Save and Deploy"

## 🧪 Yerel Test

Cloudflare Pages'in local development:

```bash
npx wrangler pages dev --compatibility-date=2024-01-01
```

## 🔧 Özellikler

- **Akıllı Arama:** Soru benzerliği %70+ olanları bulur
- **Memory Storage:** Cloudflare'in global memory'sinde saklanır
- **Auto CORS:** Tüm origin'lere otomatik izin
- **Error Handling:** Kapsamlı hata yönetimi
- **Usage Tracking:** Hangi soruların ne kadar kullanıldığını takip eder

## 💡 Kullanım Örnekleri

### Frontend entegrasyonu:
```javascript
// Soru arama
const response = await fetch('/api/search?q=React nedir');
const result = await response.json();

if (result.found) {
    console.log('Cevap:', result.data.answer);
} else {
    console.log('Yeni soru - AI\'dan cevap iste');
}

// Cevap kaydetme
await fetch('/api/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        question: 'React nedir?',
        answer: 'Modern web uygulamaları için JavaScript kütüphanesi'
    })
});
```

## 🔒 Güvenlik

- Rate limiting Cloudflare tarafından yapılır
- CORS tüm origin'lere açık (production'da kısıtlayın)
- Input validation ve sanitization

## ⚡ Performance

- Edge computing ile düşük latency
- Global cache replication
- Serverless auto-scaling
