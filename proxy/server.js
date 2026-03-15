import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const DEFAULT_PORT = 3839;

// Strip Claude Code session env vars — prevents "already inside claude" errors
// Accepts explicit input object for testability (tests pass controlled env)
export function getChildEnv(input) {
  const env = { ...(input || process.env) };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;
  return env;
}

// Sanitize tweet text before sending to Claude
function sanitizeText(text) {
  return text
    .replace(/#\w+/g, '')
    .replace(/@\w+/g, '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 700);
}

// Invoke claude -p via spawn and return parsed structured_output
// stdin must be 'ignore' — keeping stdin open causes claude -p to hang
async function callClaude(claudeBin, prompt, schema, timeoutMs) {
  return new Promise((resolve, reject) => {
    const args = [
      '-p', prompt,
      '--model', 'claude-sonnet-4-6',
      '--output-format', 'json',
      '--json-schema', JSON.stringify(schema),
      '--no-session-persistence'
    ];

    const child = spawn(claudeBin, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: '/tmp',
      env: getChildEnv()
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`claude timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`claude exited with code ${code}: ${stderr}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout);
        resolve(parsed.structured_output);
      } catch (e) {
        reject(new Error(`Failed to parse claude output: ${e.message}`));
      }
    });

    child.on('error', reject);
  });
}

const categorizeSchema = {
  type: 'object',
  properties: {
    categories: { type: 'array', items: { type: 'string' } },
    title: { type: 'string', maxLength: 80 },
    description: { type: 'string', maxLength: 300 }
  },
  required: ['categories'],
  additionalProperties: false
};

const tweetSchema = {
  type: 'object',
  properties: {
    originalId: { type: 'string' },
    isAI: { type: 'boolean' },
    title: { type: 'string', maxLength: 80 },
    description: { type: 'string' },
    categories: { type: 'array', items: { type: 'string' } },
    externalLinks: { type: 'array', items: { type: 'string' } }
  },
  required: ['originalId', 'isAI'],
  additionalProperties: false
};

// Factory function — returns http.Server (already listening) for test teardown via server.close()
// port defaults to DEFAULT_PORT when not provided
export function createApp({ claudeBin = 'claude', claudeTimeout = 90000, port = DEFAULT_PORT } = {}) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.post('/categorize', async (req, res) => {
    const { url, title, description, categories: availableCategories } = req.body;
    // "Categorize this bookmark" must appear in prompt — mock-claude.sh detects it
    const categoriesSection = availableCategories && availableCategories.length > 0
      ? `\nAvailable categories (pick the most specific match from this list, use "Altres" only as last resort):\n${availableCategories.map(c => `- ${c}`).join('\n')}`
      : '';
    const prompt = `Categorize this bookmark and return categories, a clean title, and a short description — all in Catalan.${categoriesSection}

URL: ${url}
Title: ${title}
Page content: ${description || '(not available)'}

Rules:
- categories: pick 1-2 from the list above, use "Altres" only as last resort
- title: clean up the page title (max 80 chars), keep it in the original language if it's a proper name
- description: 2-3 sentences summarising what the page is about, in Catalan, based on the page content`;

    try {
      const result = await callClaude(claudeBin, prompt, categorizeSchema, claudeTimeout);
      res.json({
        categories: result?.categories || [],
        title: result?.title || '',
        description: result?.description || '',
      });
    } catch (err) {
      console.error('[proxy] /categorize error:', err.message);
      res.json({ categories: [], error: err.message });
    }
  });

  app.post('/process-tweet', async (req, res) => {
    const { tweet, categories } = req.body || {};
    if (!tweet) {
      return res.status(400).json({ error: 'Missing tweet in request body' });
    }
    const sanitized = sanitizeText(tweet.text || '');
    const categoriesStr = (categories || []).join(', ');
    const prompt = `Process this tweet in Catalan. Assign categories from: ${categoriesStr}.\nID: ${tweet.id}\nText: ${sanitized}\nExternal URLs: ${(tweet.urls || []).join(', ')}`;

    try {
      const result = await callClaude(claudeBin, prompt, tweetSchema, claudeTimeout);
      res.json(result);
    } catch (err) {
      console.error('[proxy] /process-tweet error:', err.message);
      const rawText = tweet.text || '';
      res.json({
        originalId: tweet.id,
        isAI: false,
        title: rawText.slice(0, 80),
        categories: ['Altres'],
        externalLinks: (tweet.urls || []).filter(u => !u.includes('twitter.com') && !u.includes('x.com'))
      });
    }
  });

  // Return http.Server so callers (tests) can call server.close()
  return app.listen(port, 'localhost');
}

// Only bind to port when run directly (not when imported in tests)
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  createApp({ port: DEFAULT_PORT });
  console.log(`Claude proxy listening on http://localhost:${DEFAULT_PORT}`);
}
