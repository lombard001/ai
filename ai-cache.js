class AICacheSystem {
    constructor() {
        this.localCache = new Map();
        this.stats = {
            cacheHits: 0,
            apiCalls: 0,
            totalQuestions: 0
        };
        this.binId = null;
        this.loadLocalCache();
        this.loadStats();
        this.updateStatsDisplay();
        this.displayCachedQuestions();
    }

    // Soru normalizasyonu - benzer soruları aynı şekilde işlemek için
    normalizeQuestion(question) {
        return question
            .toLowerCase()
            .trim()
            .replace(/[^\w\sğüşıöçĞÜŞİÖÇ]/g, '') // Noktalama işaretlerini kaldır
            .replace(/\s+/g, ' ') // Çoklu boşlukları tek boşlukla değiştir
            .substring(0, 200); // İlk 200 karakteri al
    }

    // Soru benzerliği kontrolü (basit Levenshtein distance)
    calculateSimilarity(str1, str2) {
        const matrix = [];
        const len1 = str1.length;
        const len2 = str2.length;

        if (len1 === 0) return len2;
        if (len2 === 0) return len1;

        // Matrix oluştur
        for (let i = 0; i <= len2; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= len1; j++) {
            matrix[0][j] = j;
        }

        // Matrix doldur
        for (let i = 1; i <= len2; i++) {
            for (let j = 1; j <= len1; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        const distance = matrix[len2][len1];
        const maxLen = Math.max(len1, len2);
        return ((maxLen - distance) / maxLen) * 100; // Yüzde olarak benzerlik
    }

    // Benzer soru ara
    findSimilarQuestion(question) {
        const normalized = this.normalizeQuestion(question);
        const threshold = 85; // %85 benzerlik eşiği

        for (const [cachedQuestion, data] of this.localCache) {
            const similarity = this.calculateSimilarity(normalized, this.normalizeQuestion(cachedQuestion));
            if (similarity >= threshold) {
                console.log(`Benzer soru bulundu! Benzerlik: ${similarity.toFixed(1)}%`);
                return data;
            }
        }
        return null;
    }

    // Local storage'dan cache yükle
    loadLocalCache() {
        try {
            const cached = localStorage.getItem('aiCache');
            if (cached) {
                const data = JSON.parse(cached);
                this.localCache = new Map(data);
                console.log(`${this.localCache.size} cached question loaded from localStorage`);
            }
        } catch (error) {
            console.error('Error loading local cache:', error);
        }
    }

    // Local storage'a cache kaydet
    saveLocalCache() {
        try {
            const data = Array.from(this.localCache.entries());
            localStorage.setItem('aiCache', JSON.stringify(data));
            console.log('Cache saved to localStorage');
        } catch (error) {
            console.error('Error saving local cache:', error);
        }
    }

    // İstatistikleri yükle
    loadStats() {
        try {
            const stats = localStorage.getItem('aiCacheStats');
            if (stats) {
                this.stats = { ...this.stats, ...JSON.parse(stats) };
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    // İstatistikleri kaydet
    saveStats() {
        try {
            localStorage.setItem('aiCacheStats', JSON.stringify(this.stats));
        } catch (error) {
            console.error('Error saving stats:', error);
        }
    }

    // İstatistikleri güncelle
    updateStatsDisplay() {
        document.getElementById('cacheHits').textContent = this.stats.cacheHits;
        document.getElementById('apiCalls').textContent = this.stats.apiCalls;
        document.getElementById('totalQuestions').textContent = this.stats.totalQuestions;
    }

    // JSONBin.io'ya cache kaydet
    async saveToRemoteCache() {
        const apiKey = document.getElementById('cacheApiKey').value.trim();
        if (!apiKey) return;

        try {
            const data = Array.from(this.localCache.entries());
            const payload = {
                cache: data,
                lastUpdated: new Date().toISOString(),
                stats: this.stats
            };

            let url = 'https://api.jsonbin.io/v3/b';
            let method = 'POST';

            if (this.binId) {
                url = `https://api.jsonbin.io/v3/b/${this.binId}`;
                method = 'PUT';
            }

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': apiKey,
                    'X-Bin-Name': 'AI-Cache-System'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const result = await response.json();
                if (!this.binId) {
                    this.binId = result.metadata.id;
                    localStorage.setItem('aiCacheBinId', this.binId);
                }
                console.log('Cache saved to remote storage');
            }
        } catch (error) {
            console.error('Error saving to remote cache:', error);
        }
    }

    // JSONBin.io'dan cache yükle
    async loadFromRemoteCache() {
        const apiKey = document.getElementById('cacheApiKey').value.trim();
        if (!apiKey) return;

        try {
            const savedBinId = localStorage.getItem('aiCacheBinId');
            if (!savedBinId) return;

            const response = await fetch(`https://api.jsonbin.io/v3/b/${savedBinId}/latest`, {
                headers: {
                    'X-Master-Key': apiKey
                }
            });

            if (response.ok) {
                const result = await response.json();
                const data = result.record;
                
                if (data.cache) {
                    this.localCache = new Map(data.cache);
                    this.saveLocalCache();
                }
                
                if (data.stats) {
                    this.stats = { ...this.stats, ...data.stats };
                    this.saveStats();
                }

                this.updateStatsDisplay();
                this.displayCachedQuestions();
                console.log('Cache loaded from remote storage');
            }
        } catch (error) {
            console.error('Error loading from remote cache:', error);
        }
    }

    // Cache'den cevap al
    async getCachedAnswer(question) {
        // Önce tam eşleşme ara
        if (this.localCache.has(question)) {
            this.stats.cacheHits++;
            this.saveStats();
            this.updateStatsDisplay();
            return this.localCache.get(question);
        }

        // Sonra benzer soru ara
        const similarAnswer = this.findSimilarQuestion(question);
        if (similarAnswer) {
            this.stats.cacheHits++;
            this.saveStats();
            this.updateStatsDisplay();
            return similarAnswer;
        }

        return null;
    }

    // Gemini API'den cevap al
    async getGeminiAnswer(question, apiKey) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: question
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 600,
                    }
                })
            });

            if (!response.ok) {
                if (response.status === 429) {
                    throw new Error('API limit aşıldı. Lütfen daha sonra tekrar deneyin.');
                }
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();
            const answer = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

            if (answer) {
                // Cache'e kaydet
                const cacheData = {
                    answer: answer,
                    timestamp: new Date().toISOString(),
                    source: 'gemini'
                };
                
                this.localCache.set(question, cacheData);
                this.saveLocalCache();
                
                // Remote cache'e de kaydet
                await this.saveToRemoteCache();

                this.stats.apiCalls++;
                this.saveStats();
                this.updateStatsDisplay();
                this.displayCachedQuestions();

                return cacheData;
            }

            throw new Error('Geçerli cevap alınamadı');
        } catch (error) {
            throw error;
        }
    }

    // Ana soru sorma fonksiyonu
    async askQuestion(question, apiKey) {
        this.stats.totalQuestions++;
        this.saveStats();
        this.updateStatsDisplay();

        // Önce cache'den kontrol et
        const cachedAnswer = await this.getCachedAnswer(question);
        if (cachedAnswer) {
            return {
                answer: cachedAnswer.answer,
                fromCache: true,
                timestamp: cachedAnswer.timestamp
            };
        }

        // Cache'de yoksa API'den al
        const apiAnswer = await this.getGeminiAnswer(question, apiKey);
        return {
            answer: apiAnswer.answer,
            fromCache: false,
            timestamp: apiAnswer.timestamp
        };
    }

    // Cache'deki soruları göster
    displayCachedQuestions() {
        const container = document.getElementById('cacheList');
        container.innerHTML = '';

        if (this.localCache.size === 0) {
            container.innerHTML = '<p style="color: #666; text-align: center;">Henüz cache\'lenmiş soru yok.</p>';
            return;
        }

        // Son eklenenler önce gelsin
        const sortedEntries = Array.from(this.localCache.entries())
            .sort((a, b) => new Date(b[1].timestamp) - new Date(a[1].timestamp));

        sortedEntries.forEach(([question, data]) => {
            const item = document.createElement('div');
            item.className = 'cache-item';
            
            const questionDiv = document.createElement('div');
            questionDiv.className = 'cache-question';
            questionDiv.textContent = question;
            
            const answerDiv = document.createElement('div');
            answerDiv.className = 'cache-answer';
            answerDiv.textContent = data.answer.substring(0, 200) + (data.answer.length > 200 ? '...' : '');
            
            const dateDiv = document.createElement('div');
            dateDiv.className = 'cache-date';
            dateDiv.textContent = `Cached: ${new Date(data.timestamp).toLocaleString('tr-TR')}`;
            
            item.appendChild(questionDiv);
            item.appendChild(answerDiv);
            item.appendChild(dateDiv);
            container.appendChild(item);
        });
    }

    // Cache temizle
    clearCache() {
        this.localCache.clear();
        this.stats = { cacheHits: 0, apiCalls: 0, totalQuestions: 0 };
        
        localStorage.removeItem('aiCache');
        localStorage.removeItem('aiCacheStats');
        localStorage.removeItem('aiCacheBinId');
        
        this.updateStatsDisplay();
        this.displayCachedQuestions();
        
        console.log('Cache cleared');
    }
}

// Global instance
const aiCache = new AICacheSystem();

// Sayfa yüklendiğinde remote cache'i kontrol et
window.addEventListener('load', () => {
    aiCache.loadFromRemoteCache();
});

// Ana soru sorma fonksiyonu
async function askQuestion() {
    const question = document.getElementById('question').value.trim();
    const apiKey = document.getElementById('apiKey').value.trim();
    const responseDiv = document.getElementById('response');
    const askButton = document.getElementById('askButton');

    if (!question) {
        alert('Lütfen bir soru girin!');
        return;
    }

    if (!apiKey) {
        alert('Lütfen API anahtarınızı girin!');
        return;
    }

    askButton.disabled = true;
    askButton.textContent = 'Cevap aranıyor...';
    responseDiv.innerHTML = '<div class="response">🔍 Cevap aranıyor...</div>';

    try {
        const result = await aiCache.askQuestion(question, apiKey);
        
        const responseClass = result.fromCache ? 'response cache-info' : 'response api-info';
        const sourceText = result.fromCache ? '📋 Cache\'den alındı' : '🌐 API\'den alındı';
        const timeText = new Date(result.timestamp).toLocaleString('tr-TR');
        
        responseDiv.innerHTML = `
            <div class="${responseClass}">
                <strong>${sourceText}</strong> - ${timeText}
                <hr style="margin: 10px 0; border: none; border-top: 1px solid #ddd;">
                ${result.answer.replace(/\n/g, '<br>')}
            </div>
        `;

        // Soru alanını temizle
        document.getElementById('question').value = '';

    } catch (error) {
        responseDiv.innerHTML = `
            <div class="response error">
                <strong>❌ Hata:</strong> ${error.message}
            </div>
        `;
    } finally {
        askButton.disabled = false;
        askButton.textContent = 'Soru Sor';
    }
}

// Cache temizleme fonksiyonu
function clearCache() {
    if (confirm('Tüm cache\'i temizlemek istediğinizden emin misiniz?')) {
        aiCache.clearCache();
        alert('Cache temizlendi!');
    }
}

// Enter tuşu ile soru sorma
document.getElementById('question').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        askQuestion();
    }
});
