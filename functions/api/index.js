// In-memory storage (Cloudflare'de global olarak saklanır)
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
  const similarity = (commonWords.length * 2) / (words1.length + words2.length);
  
  return similarity;
}

// Benzer soru arama
function findSimilarQuestion(question) {
  const threshold = 0.7; // %70 benzerlik
  
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

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Ana handler fonksionu
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const method = request.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  try {
    // Ana sayfa
    if (url.pathname === '/api' && method === 'GET') {
      return new Response(JSON.stringify({
        message: 'AI Soru-Cevap Cache API',
        status: 'active',
        stats: stats,
        endpoints: {
          'GET /api': 'API bilgileri',
          'GET /api/questions': 'Tüm sorular',
          'GET /api/search?q=soru': 'Soru ara',
          'POST /api/save': 'Soru-cevap kaydet',
          'DELETE /api/clear': 'Tüm verileri temizle',
          'GET /api/stats': 'İstatistikler',
          'GET /api/health': 'Sağlık kontrolü'
        }
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Soru arama
    if (url.pathname === '/api/search' && method === 'GET') {
      const question = url.searchParams.get('q');
      
      if (!question) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Soru parametresi gerekli (?q=soru)'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      const result = findSimilarQuestion(question);
      
      if (result) {
        // Kullanım sayısını artır
        const originalKey = result.question;
        if (qaDatabase[originalKey]) {
          qaDatabase[originalKey].usageCount = (qaDatabase[originalKey].usageCount || 0) + 1;
          qaDatabase[originalKey].lastUsed = new Date().toISOString();
        }
        
        stats.cacheHits++;
        
        return new Response(JSON.stringify({
          success: true,
          found: true,
          data: {
            originalQuestion: result.question,
            answer: result.answer,
            similarity: result.similarity,
            usageCount: qaDatabase[originalKey].usageCount,
            createdAt: result.createdAt,
            lastUsed: qaDatabase[originalKey].lastUsed
          }
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      } else {
        return new Response(JSON.stringify({
          success: true,
          found: false,
          message: 'Benzer soru bulunamadı'
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
    }

    // Soru-cevap kaydetme
    if (url.pathname === '/api/save' && method === 'POST') {
      const body = await request.json();
      const { question, answer } = body;
      
      if (!question || !answer) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Soru ve cevap gerekli'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      const cleanQuestion = question.trim();
      const cleanAnswer = answer.trim();
      
      // Aynı soru varsa güncelle, yoksa yeni ekle
      const isNew = !qaDatabase[cleanQuestion];
      if (isNew) {
        stats.totalQuestions++;
      }
      
      qaDatabase[cleanQuestion] = {
        answer: cleanAnswer,
        createdAt: qaDatabase[cleanQuestion]?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        usageCount: qaDatabase[cleanQuestion]?.usageCount || 0
      };
      
      stats.apiCalls++;
      stats.lastUpdated = new Date().toISOString();
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Soru-cevap kaydedildi',
        data: {
          question: cleanQuestion,
          answer: cleanAnswer,
          isNew: isNew
        }
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Tüm soruları listeleme
    if (url.pathname === '/api/questions' && method === 'GET') {
      const questions = Object.entries(qaDatabase).map(([question, data]) => ({
        question,
        answer: data.answer.substring(0, 100) + (data.answer.length > 100 ? '...' : ''),
        createdAt: data.createdAt,
        usageCount: data.usageCount || 0,
        lastUsed: data.lastUsed || null
      }));
      
      // Kullanım sayısına göre sırala
      questions.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
      
      return new Response(JSON.stringify({
        success: true,
        count: questions.length,
        questions: questions
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // İstatistikler
    if (url.pathname === '/api/stats' && method === 'GET') {
      return new Response(JSON.stringify({
        success: true,
        stats: {
          ...stats,
          databaseSize: Object.keys(qaDatabase).length,
          averageUsage: stats.totalQuestions > 0 ? 
            Object.values(qaDatabase).reduce((sum, item) => sum + (item.usageCount || 0), 0) / stats.totalQuestions : 0
        }
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Veritabanını temizleme
    if (url.pathname === '/api/clear' && method === 'DELETE') {
      const count = Object.keys(qaDatabase).length;
      qaDatabase = {};
      stats = {
        totalQuestions: 0,
        cacheHits: 0,
        apiCalls: 0,
        lastUpdated: new Date().toISOString()
      };
      
      return new Response(JSON.stringify({
        success: true,
        message: `${count} soru-cevap silindi`,
        clearedCount: count
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Belirli soru silme
    if (url.pathname === '/api/question' && method === 'DELETE') {
      const question = url.searchParams.get('q');
      
      if (!question) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Soru parametresi gerekli (?q=soru)'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      if (qaDatabase[question]) {
        delete qaDatabase[question];
        stats.totalQuestions--;
        stats.lastUpdated = new Date().toISOString();
        
        return new Response(JSON.stringify({
          success: true,
          message: 'Soru silindi'
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      } else {
        return new Response(JSON.stringify({
          success: false,
          error: 'Soru bulunamadı'
        }), {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
    }

    // Health check
    if (url.pathname === '/api/health' && method === 'GET') {
      return new Response(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        platform: 'Cloudflare Pages'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // 404 handler
    return new Response(JSON.stringify({
      success: false,
      error: 'Endpoint bulunamadı',
      availableEndpoints: [
        'GET /api',
        'GET /api/questions',
        'GET /api/search?q=soru',
        'POST /api/save',
        'DELETE /api/clear',
        'DELETE /api/question?q=soru',
        'GET /api/stats',
        'GET /api/health'
      ]
    }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Sunucu hatası'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}
