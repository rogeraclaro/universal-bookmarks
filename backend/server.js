const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const https = require('https');

const app = express();
const PORT = 3003;
const DB_FILE = path.join(__dirname, 'db.json');

// --- CONFIGURACIÓ ---
const API_SECRET = process.env.API_SECRET || '4eb6fd03128af657e3b37c1467d00823';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Auth Middleware
const checkAuth = (req, res, next) => {
    const secret = req.headers['x-api-secret'];
    if (secret !== API_SECRET) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    next();
};

app.use(checkAuth);

// Helper DB functions
const readDB = () => {
    if (!fs.existsSync(DB_FILE)) {
        return { bookmarks: [], categories: [], deletedIds: [] };
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
};

const writeDB = (data) => {
    const current = readDB();
    const newData = { ...current, ...data };
    fs.writeFileSync(DB_FILE, JSON.stringify(newData, null, 2));
};

// --- ENDPOINTS DADES ---

app.get('/bookmarks', (req, res) => {
    const db = readDB();
    res.json({ data: db.bookmarks || [] });
});

app.post('/bookmarks', (req, res) => {
    const { data } = req.body;
    writeDB({ bookmarks: data });
    res.json({ success: true });
});

app.get('/categories', (req, res) => {
    const db = readDB();
    res.json({ data: db.categories || [] });
});

app.post('/categories', (req, res) => {
    const { data } = req.body;
    writeDB({ categories: data });
    res.json({ success: true });
});

app.get('/deleted', (req, res) => {
    const db = readDB();
    res.json({ data: db.deletedIds || [] });
});

app.post('/deleted', (req, res) => {
    const { data } = req.body;
    writeDB({ deletedIds: data });
    res.json({ success: true });
});

app.post('/reset', (req, res) => {
    fs.writeFileSync(DB_FILE, JSON.stringify({ bookmarks: [], categories: [], deletedIds: [] }));
    res.json({ success: true });
});

// --- GROQ HELPER ---

function callGroq(messages, timeoutMs = 30000) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY not set');

    const body = JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        response_format: { type: 'json_object' },
        temperature: 0.2,
    });

    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.groq.com',
            path: '/openai/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'Content-Length': Buffer.byteLength(body),
            },
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
        });

        req.on('error', reject);
        req.setTimeout(timeoutMs, () => { req.destroy(new Error('Groq timeout')); });
        req.write(body);
        req.end();
    });
}

function isTweetUrl(url) {
    return /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/.+\/status\/\d+/i.test(url || '');
}

function isShortUrl(url) {
    try {
        return new URL(url).hostname === 't.co';
    } catch {
        return false;
    }
}

// Follows t.co redirects to the real destination (X app shares only give the
// shortened link). HEAD-only, bounded hops, fails soft to the original URL.
function resolveShortUrl(url, maxHops = 3) {
    return new Promise((resolve) => {
        let hops = 0;
        function follow(currentUrl) {
            if (hops++ >= maxHops) return resolve(currentUrl);
            let parsed;
            try {
                parsed = new URL(currentUrl);
            } catch {
                return resolve(currentUrl);
            }
            const req = https.request({
                hostname: parsed.hostname,
                path: parsed.pathname + parsed.search,
                method: 'HEAD',
                headers: { 'User-Agent': 'Mozilla/5.0' },
            }, (res) => {
                res.resume();
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    follow(new URL(res.headers.location, currentUrl).toString());
                } else {
                    resolve(currentUrl);
                }
            });
            req.on('error', () => resolve(currentUrl));
            req.setTimeout(3000, () => { req.destroy(); resolve(currentUrl); });
            req.end();
        }
        follow(url);
    });
}

function fetchTweetText(tweetUrl) {
    const encoded = encodeURIComponent(tweetUrl);
    const oembedPath = '/oembed?url=' + encoded + '&omit_script=true';
    return new Promise((resolve) => {
        const options = {
            hostname: 'publish.x.com',
            path: oembedPath,
            method: 'GET',
            headers: { 'User-Agent': 'Mozilla/5.0' },
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    const html = parsed.html || '';
                    const match = html.match(/<p[^>]*>([\s\S]*?)<\/p>/);
                    if (match) {
                        const text = match[1]
                            .replace(/<br\s*\/?>/gi, ' ')
                            .replace(/<[^>]+>/g, '')
                            .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                            .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&mdash;/g, '-')
                            .replace(/\s+/g, ' ').trim();
                        resolve(text);
                    } else {
                        resolve('');
                    }
                } catch { resolve(''); }
            });
        });
        req.on('error', () => resolve(''));
        req.setTimeout(8000, () => { req.destroy(); resolve(''); });
        req.end();
    });
}

function sanitizeText(text) {
    return (text || '')
        .replace(/#\w+/g, '')
        .replace(/@\w+/g, '')
        .replace(/[\r\n]+/g, ' ')
        .replace(/\t/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 700);
}

// --- ENDPOINT: /categorize (extensió Chrome + mobile PWA) ---

app.post('/categorize', async (req, res) => {
    const { title, description, categories: availableCategories } = req.body;
    let { url } = req.body;
    const originalUrl = url;
    console.log('[categorize] url:', url, '| title:', title, '| desc:', (description || '').slice(0, 80));

    if (!process.env.GROQ_API_KEY) {
        console.error('[categorize] GROQ_API_KEY not set');
        return res.json({ categories: [], title: '', description: '' });
    }

    // X app shares only give a t.co shortened link — resolve it to the real
    // status URL so isTweetUrl() and the AI prompt get something usable.
    if (isShortUrl(url)) {
        const resolved = await resolveShortUrl(url);
        console.log('[categorize] resolved short url:', url, '->', resolved);
        url = resolved;
    }

    const categoriesStr = Array.isArray(availableCategories) && availableCategories.length > 0
        ? `CATEGORIES VÀLIDES: ${availableCategories.map((c, i) => `${i + 1}. "${c}"`).join(', ')}\nIMPORTANT: Copia els strings EXACTAMENT com apareixen a la llista (accents, majúscules, espais, punts, caràcters especials inclosos). Cap variació acceptada.`
        : 'Usa "Altres" si no encaixa en cap categoria.';

    let tweetText = description || title || '';
    // If tweet URL but no text: call oEmbed to fetch the actual tweet content.
    if (isTweetUrl(url) && tweetText.length === 0) {
        const oembed = await fetchTweetText(url);
        if (oembed) {
            console.log('[categorize] oembed text:', oembed.slice(0, 100));
            tweetText = oembed;
        }
    }
    const isTweet = isTweetUrl(url) && tweetText.length > 0;

    const systemPrompt = 'Ets un assistent de categorització en català. Retorna SEMPRE JSON vàlid amb les claus demanades, sense text addicional. Tots els camps de text (title, description) han d\'estar SEMPRE escrits en català, independentment de l\'idioma de la font.';

    const userPrompt = isTweet
        ? `Analitza aquest tweet i retorna JSON amb:
- title: títol curt i descriptiu EN CATALÀ (màx 80 cars)
- description: resum breu EN CATALÀ (màx 200 cars)
- categories: array d'1-2 categories de la llista vàlida

${categoriesStr}
URL: ${url}
Text del tweet: ${tweetText}`
        : `Categoritza aquest bookmark i retorna JSON amb:
- title: títol descriptiu EN CATALÀ (màx 80 cars) — tradueix si cal
- description: 2-3 frases resumint la pàgina EN CATALÀ
- categories: array d'1-2 categories de la llista vàlida

${categoriesStr}
URL: ${url}
Títol original: ${title || ''}`;

    try {
        const groqRes = await callGroq([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ]);

        if (groqRes.status !== 200) {
            console.error('[categorize] Groq error:', groqRes.status, groqRes.body.slice(0, 200));
            return res.json({ categories: [], title: '', description: '' });
        }

        const data = JSON.parse(groqRes.body);
        const parsed = JSON.parse(data.choices[0].message.content);

        res.json({
            categories: parsed.categories || [],
            title: parsed.title || '',
            description: parsed.description || '',
            resolvedUrl: url !== originalUrl ? url : undefined,
        });
    } catch (err) {
        console.error('[categorize] failed:', err.message);
        res.json({ categories: [], title: '', description: '' });
    }
});

// --- ENDPOINT: /process-tweet (app web — importació massiva de tweets) ---

app.post('/process-tweet', async (req, res) => {
    const { tweet, categories } = req.body;
    const sanitized = sanitizeText(tweet.text || '');
    const categoriesStr = (categories || []).join(', ');

    if (!process.env.GROQ_API_KEY) {
        console.error('[process-tweet] GROQ_API_KEY not set');
        return res.json({
            originalId: tweet.id,
            isAI: false,
            title: sanitized.substring(0, 77) + '...',
            categories: ['Altres'],
            externalLinks: [],
        });
    }

    const systemPrompt = 'Ets un assistent de categorització en català. Retorna SEMPRE JSON vàlid, sense text addicional.';
    const userPrompt = `Analitza aquest tweet i retorna JSON amb:
- originalId: "${tweet.id}"
- isAI: true si el tweet tracta sobre intel·ligència artificial, LLMs, machine learning o eines d'IA, false en cas contrari
- title: títol curt i descriptiu en català (màx 80 cars), NO copiar el text literalment
- description: resum breu (màx 200 cars), opcional
- categories: array d'1-2 categories d'aquesta llista: ${categoriesStr}
- externalLinks: array amb les URLs externes (no twitter.com ni x.com)

Text del tweet: ${sanitized}
URLs: ${(tweet.urls || []).join(', ')}`;

    try {
        const groqRes = await callGroq([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ]);

        if (groqRes.status !== 200) {
            throw new Error(`Groq HTTP ${groqRes.status}`);
        }

        const data = JSON.parse(groqRes.body);
        const parsed = JSON.parse(data.choices[0].message.content);

        res.json({
            originalId: tweet.id,
            isAI: parsed.isAI ?? false,
            title: parsed.title || sanitized.substring(0, 77),
            description: parsed.description || '',
            categories: parsed.categories?.length ? parsed.categories : ['Altres'],
            externalLinks: parsed.externalLinks || (tweet.urls || []).filter(
                u => !u.includes('twitter.com') && !u.includes('x.com')
            ),
        });
    } catch (err) {
        console.error('[process-tweet] failed:', err.message);
        const rawText = tweet.text || '';
        res.json({
            originalId: tweet.id,
            isAI: false,
            title: rawText.length > 80 ? rawText.substring(0, 77) + '...' : rawText || 'Tweet',
            categories: ['Altres'],
            externalLinks: (tweet.urls || []).filter(
                u => !u.includes('twitter.com') && !u.includes('x.com')
            ),
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
