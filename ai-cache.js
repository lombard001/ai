const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// In-memory storage
let qaDatabase = {};
let stats = {
  totalQuestions: 0,
  cacheHits: 0,
  apiCalls: 0,
  lastUpdated: new Date().toISOString()
};

// Soru benzerliği kontrol fonksiyonu
function calculateSimilarity(str1, str2) {
  const s1 = str1.toLowerCase().trim().replace(/[^\w\s]/g, '');
  const s2 = str2.toLowerCase().trim().replace(/[^\w\s]/g, '');
  if (s1 === s2) return 1.0;

  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  const commonWords = words1.filter(word => words2.includes(word));
  return (commonWords.length * 2) / (words1.length + words2.length);
}

function findSimilarQuestion(question) {
  const threshold = 0.7;
  for (const [key, data] of Object.entries(qaDatabase)) {
    const similarity = calculateSimilarity(question, key);
    if (similarity >= threshold) {
      return {
        question: key,
        answer: data.answer,
        similarity: similarity,
        usageCount: data.usageCount || 0,
        createdAt: data.createdAt
      };
    }
  }
  return null;
}

// --- ENDPOINTLER ---

app.get('/', (req, res) => {
  res.json({
    message: 'AI Soru-Cevap Cache API',
    status: 'active',
    stats: stats,
    endpoints: {
      'GET /': 'API bilgileri',
      'GET /questions': 'Tüm sorular',
      'GET /search?q=soru': 'Soru ara',
      'POST /save': 'Soru-cevap kaydet',
      'DELETE /clear': 'Tüm verileri temizle',
      'GET /stats': 'İstatistikler',
      'GET /health': 'Sağlık kontrolü'
    }
  });
});

app.get('/search', (req, res) => {
  const question = req.query.q;
  if (!question) {
    return res.status(400).json({ success: false, error: 'Soru parametresi gerekli (?q=soru)' });
  }
  const result = findSimilarQuestion(question);
  if (result) {
    const originalKey = result.question;
    if (qaDatabase[originalKey]) {
      qaDatabase[originalKey].usageCount = (qaDatabase[originalKey].usageCount || 0) + 1;
      qaDatabase[originalKey].lastUsed = new Date().toISOString();
    }
    stats.cacheHits++;
    return res.json({
      success: true,
      found: true,
      data: { ...result, lastUsed: qaDatabase[originalKey].lastUsed }
    });
  }
  res.json({ success: true, found: false, message: 'Benzer soru bulunamadı' });
});

app.post('/save', (req, res) => {
  const { question, answer } = req.body;
  if (!question || !answer) {
    return res.status(400).json({ success: false, error: 'Soru ve cevap gerekli' });
  }
  const cleanQuestion = question.trim();
  const cleanAnswer = answer.trim();
  if (!qaDatabase[cleanQuestion]) stats.totalQuestions++;
  qaDatabase[cleanQuestion] = {
    answer: cleanAnswer,
    createdAt: qaDatabase[cleanQuestion]?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    usageCount: qaDatabase[cleanQuestion]?.usageCount || 0
  };
  stats.apiCalls++;
  stats.lastUpdated = new Date().toISOString();
  res.json({ success: true, message: 'Soru-cevap kaydedildi', data: { question: cleanQuestion, answer: cleanAnswer } });
});

app.get('/questions', (req, res) => {
  const questions = Object.entries(qaDatabase).map(([question, data]) => ({
    question,
    answer: data.answer.substring(0, 100) + (data.answer.length > 100 ? '...' : ''),
    createdAt: data.createdAt,
    usageCount: data.usageCount || 0,
    lastUsed: data.lastUsed || null
  }));
  questions.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
  res.json({ success: true, count: questions.length, questions });
});

app.get('/stats', (req, res) => {
  res.json({
    success: true,
    stats: {
      ...stats,
      databaseSize: Object.keys(qaDatabase).length,
      averageUsage: stats.totalQuestions > 0
        ? Object.values(qaDatabase).reduce((sum, item) => sum + (item.usageCount || 0), 0) / stats.totalQuestions
        : 0
    }
  });
});

app.delete('/clear', (req, res) => {
  const count = Object.keys(qaDatabase).length;
  qaDatabase = {};
  stats = { totalQuestions: 0, cacheHits: 0, apiCalls: 0, lastUpdated: new Date().toISOString() };
  res.json({ success: true, message: `${count} soru-cevap silindi`, clearedCount: count });
});

app.delete('/question', (req, res) => {
  const question = req.query.q;
  if (!question) return res.status(400).json({ success: false, error: 'Soru parametresi gerekli (?q=soru)' });
  if (qaDatabase[question]) {
    delete qaDatabase[question];
    stats.totalQuestions--;
    stats.lastUpdated = new Date().toISOString();
    return res.json({ success: true, message: 'Soru silindi' });
  }
  res.status(404).json({ success: false, error: 'Soru bulunamadı' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

// 404
app.use('*', (req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint bulunamadı' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('API Error:', err);
  res.status(500).json({ success: false, error: 'Sunucu hatası' });
});

// ❌ app.listen yok!
// ✅ sadece export
module.exports = app;
