const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const app = express();
const PORT = 3003;
const DB_FILE = path.join(__dirname, 'db.json');

// --- CONFIGURACIÓ ---
const API_SECRET = process.env.API_SECRET;
if (!API_SECRET) {
    // Without it the auth check below would compare undefined === undefined and let everything through.
    console.error('API_SECRET not set: refusing to start');
    process.exit(1);
}

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
const BACKUP_FILE = `${DB_FILE}.bak`;
const emptyDB = () => ({ bookmarks: [], categories: [], deletedIds: [] });

// Write to a temp file, fsync, then rename: rename is atomic on the same filesystem, so a crash
// can never leave a half-written db.json. The previous good copy is kept as db.json.bak.
const atomicWrite = (data, { backup = true } = {}) => {
    const tmp = `${DB_FILE}.tmp-${process.pid}`;
    const fd = fs.openSync(tmp, 'w');
    try {
        fs.writeFileSync(fd, JSON.stringify(data, null, 2));
        fs.fsyncSync(fd);
    } finally {
        fs.closeSync(fd);
    }
    if (backup && fs.existsSync(DB_FILE)) {
        fs.copyFileSync(DB_FILE, `${BACKUP_FILE}.tmp`);
        fs.renameSync(`${BACKUP_FILE}.tmp`, BACKUP_FILE);
    }
    // rename swaps the inode, so keep the owner/mode of the existing file (other users/scripts rely on them)
    if (fs.existsSync(DB_FILE)) {
        const { mode, uid, gid } = fs.statSync(DB_FILE);
        fs.chmodSync(tmp, mode & 0o777);
        try { fs.chownSync(tmp, uid, gid); } catch { /* not root: keep the current owner */ }
    }
    fs.renameSync(tmp, DB_FILE);
};

// If db.json is unreadable (truncated by an old crash, hand edit...), fall back to the last good
// backup instead of failing every request. The broken file is kept aside for inspection.
const readDB = () => {
    if (!fs.existsSync(DB_FILE)) return emptyDB();
    try {
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (err) {
        console.error('[db] db.json unreadable:', err.message);
        if (!fs.existsSync(BACKUP_FILE)) throw err;
        const recovered = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
        fs.copyFileSync(DB_FILE, `${DB_FILE}.corrupt-${Date.now()}`);
        atomicWrite(recovered, { backup: false });
        console.error('[db] recovered from db.json.bak');
        return recovered;
    }
};

const writeDB = (data) => {
    atomicWrite({ ...readDB(), ...data });
};

// --- BOOKMARK OPERATIONS (pure, operate on an array and return a new one) ---

const isValidNewBookmark = (b) =>
    !!b && typeof b.originalLink === 'string' && b.originalLink.trim() !== '' && typeof b.title === 'string';

// Adds one bookmark unless its originalLink is already present (idempotent for retries).
const addBookmark = (list, incoming) => {
    const existing = list.find((b) => b.originalLink === incoming.originalLink);
    if (existing) return { list, id: existing.id, duplicate: true };
    const idTaken = typeof incoming.id === 'string' && list.some((b) => b.id === incoming.id);
    const bookmark = {
        description: '',
        author: '',
        externalLinks: [],
        categories: [],
        ...incoming,
        id: typeof incoming.id === 'string' && incoming.id && !idTaken ? incoming.id : crypto.randomUUID(),
        createdAt: Number.isFinite(incoming.createdAt) ? incoming.createdAt : Date.now(),
    };
    return { list: [...list, bookmark], id: bookmark.id, duplicate: false };
};

// --- ENDPOINTS DADES ---

app.get('/bookmarks', (req, res) => {
    const db = readDB();
    res.json({ data: db.bookmarks || [] });
});

// LEGACY replace-all endpoint, kept so old cached clients do not break. It is now UPSERT-ONLY:
// bookmarks it sends are added/updated by id, but bookmarks it does NOT send are never removed.
// A stale tab or old client can therefore no longer wipe what other clients saved. Deletions go
// through POST /bookmarks/ops.
app.post('/bookmarks', (req, res) => {
    const { data } = req.body;
    if (!Array.isArray(data)) {
        return res.status(400).json({ error: 'data must be an array' });
    }
    const stored = readDB().bookmarks || [];
    const sent = new Map(data.filter((b) => b && typeof b.id === 'string').map((b) => [b.id, b]));
    const storedIds = new Set(stored.map((b) => b.id));
    const merged = [
        ...stored.map((b) => (sent.has(b.id) ? sent.get(b.id) : b)),
        ...[...sent.values()].filter((b) => !storedIds.has(b.id)),
    ];
    console.warn(`[bookmarks] legacy POST /bookmarks (upsert only): sent=${data.length} stored=${stored.length} now=${merged.length}`);
    writeDB({ bookmarks: merged });
    res.json({ success: true });
});

// Append ONE bookmark without the client having to send (and risk overwriting) the whole list.
// readDB/writeDB are synchronous, so this read-modify-write cannot interleave with another
// request handled by this process. Idempotent: a repeated originalLink is not added twice.
app.post('/bookmarks/add', (req, res) => {
    const incoming = req.body && req.body.bookmark;
    if (!isValidNewBookmark(incoming)) {
        return res.status(400).json({ error: 'bookmark.originalLink and bookmark.title are required' });
    }
    const result = addBookmark(readDB().bookmarks || [], incoming);
    if (!result.duplicate) writeDB({ bookmarks: result.list });
    res.status(result.duplicate ? 200 : 201).json({ success: true, duplicate: result.duplicate, id: result.id });
});

// Apply several changes atomically in ONE read-modify-write: { add: [bookmark], update: [{id, ...fields}],
// remove: [id] }. Only the bookmarks named here are touched; everything else is left as stored.
app.post('/bookmarks/ops', (req, res) => {
    const { add = [], update = [], remove = [], force = false } = req.body || {};
    if (![add, update, remove].every(Array.isArray)) {
        return res.status(400).json({ error: 'add, update and remove must be arrays' });
    }
    if (!add.every(isValidNewBookmark)
        || !update.every((u) => u && typeof u.id === 'string')
        || !remove.every((id) => typeof id === 'string')) {
        return res.status(400).json({ error: 'invalid add/update/remove entry' });
    }
    let list = readDB().bookmarks || [];
    // Seatbelt against a client bug (e.g. one that believes the list is empty): removing more than
    // 10 bookmarks AND more than 30% of the stored list must be explicitly confirmed with force:true.
    if (force !== true && remove.length > 10 && remove.length > list.length * 0.3) {
        return res.status(409).json({
            error: `refusing to remove ${remove.length} of ${list.length} bookmarks without force:true`,
        });
    }
    const removeIds = new Set(remove);
    const before = list.length;
    list = list.filter((b) => !removeIds.has(b.id));
    const removed = before - list.length;

    let updated = 0;
    let missing = 0;
    for (const change of update) {
        const index = list.findIndex((b) => b.id === change.id);
        if (index === -1) {
            missing++;
            continue;
        }
        list = list.map((b, i) => (i === index ? { ...b, ...change, id: b.id } : b));
        updated++;
    }

    let added = 0;
    let duplicates = 0;
    for (const bookmark of add) {
        const result = addBookmark(list, bookmark);
        list = result.list;
        if (result.duplicate) duplicates++;
        else added++;
    }

    if (added || updated || removed) writeDB({ bookmarks: list });
    res.json({ success: true, added, updated, removed, duplicates, missing });
});

app.get('/categories', (req, res) => {
    const db = readDB();
    res.json({ data: db.categories || [] });
});

// Merge instead of replace: a client with a stale/partial category list
// (e.g. falling back to defaults after a fetch error) must never wipe out
// categories other clients already added.
app.post('/categories', (req, res) => {
    const { data } = req.body;
    const db = readDB();
    const merged = Array.from(new Set([...(db.categories || []), ...(data || [])])).sort();
    writeDB({ categories: merged });
    res.json({ success: true });
});

app.get('/deleted', (req, res) => {
    const db = readDB();
    res.json({ data: db.deletedIds || [] });
});

// Merge instead of replace (same reason as /categories): a stale client must not drop ids that
// other clients blacklisted. The only way to clear everything is the explicit /reset below.
// replace:true is the explicit "clear / overwrite the blacklist" intent (used by the web app's reset).
app.post('/deleted', (req, res) => {
    const { data, replace } = req.body;
    const db = readDB();
    const ids = replace === true
        ? (data || [])
        : Array.from(new Set([...(db.deletedIds || []), ...(data || [])]));
    writeDB({ deletedIds: ids });
    res.json({ success: true });
});

// Explicit "wipe everything" (the web app asks the user to confirm). The previous state stays in db.json.bak.
app.post('/reset', (req, res) => {
    atomicWrite(emptyDB());
    res.json({ success: true });
});

// --- LLM HELPER (DeepSeek, OpenAI-compatible) ---

function callLLM(messages, timeoutMs = 30000) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY not set');

    const body = JSON.stringify({
        model: 'deepseek-flash',
        messages,
        response_format: { type: 'json_object' },
        temperature: 0.2,
    });

    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.deepseek.com',
            path: '/chat/completions',
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
        req.setTimeout(timeoutMs, () => { req.destroy(new Error('LLM timeout')); });
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

    if (!process.env.DEEPSEEK_API_KEY) {
        console.error('[categorize] DEEPSEEK_API_KEY not set');
        return res.json({ categories: [], title: '', description: '', error: true });
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
        const llmRes = await callLLM([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ]);

        if (llmRes.status !== 200) {
            console.error('[categorize] LLM error:', llmRes.status, llmRes.body.slice(0, 200));
            return res.json({ categories: [], title: '', description: '', error: true });
        }

        const data = JSON.parse(llmRes.body);
        const parsed = JSON.parse(data.choices[0].message.content);

        res.json({
            categories: parsed.categories || [],
            title: parsed.title || '',
            description: parsed.description || '',
            resolvedUrl: url !== originalUrl ? url : undefined,
        });
    } catch (err) {
        console.error('[categorize] failed:', err.message);
        res.json({ categories: [], title: '', description: '', error: true });
    }
});

// --- ENDPOINT: /process-tweet (app web — importació massiva de tweets) ---

app.post('/process-tweet', async (req, res) => {
    const { tweet, categories } = req.body;
    const sanitized = sanitizeText(tweet.text || '');
    const categoriesStr = (categories || []).join(', ');

    if (!process.env.DEEPSEEK_API_KEY) {
        console.error('[process-tweet] DEEPSEEK_API_KEY not set');
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
        const llmRes = await callLLM([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ]);

        if (llmRes.status !== 200) {
            throw new Error(`LLM HTTP ${llmRes.status}`);
        }

        const data = JSON.parse(llmRes.body);
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
