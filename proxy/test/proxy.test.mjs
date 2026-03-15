// Wave 0 scaffold — tests intentionally fail until proxy/server.js is created in Plan 02
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROXY_DIR = path.join(__dirname, '..');
const MOCK_CLAUDE_BIN = path.join(__dirname, 'mock-claude.sh');
const TEST_PORT = 13838;

// ---------------------------------------------------------------------------
// getChildEnv() tests
// ---------------------------------------------------------------------------

describe('getChildEnv()', async () => {
  let getChildEnv;

  before(async () => {
    try {
      const mod = await import(`${PROXY_DIR}/server.js`);
      getChildEnv = mod.getChildEnv;
    } catch {
      getChildEnv = null;
    }
  });

  test('removes CLAUDECODE from child env', () => {
    if (!getChildEnv) throw new Error('server.js not found — implement in Plan 02');
    const input = { HOME: '/test', PATH: '/usr/bin', CLAUDECODE: '1' };
    const result = getChildEnv(input);
    assert.equal(result.CLAUDECODE, undefined, 'CLAUDECODE should be removed');
  });

  test('removes CLAUDE_CODE_ENTRYPOINT from child env', () => {
    if (!getChildEnv) throw new Error('server.js not found — implement in Plan 02');
    const input = { HOME: '/test', PATH: '/usr/bin', CLAUDE_CODE_ENTRYPOINT: 'claude' };
    const result = getChildEnv(input);
    assert.equal(result.CLAUDE_CODE_ENTRYPOINT, undefined, 'CLAUDE_CODE_ENTRYPOINT should be removed');
  });

  test('preserves HOME and PATH in child env', () => {
    if (!getChildEnv) throw new Error('server.js not found — implement in Plan 02');
    const input = { HOME: '/test', PATH: '/usr/bin', CLAUDECODE: '1', CLAUDE_CODE_ENTRYPOINT: 'claude' };
    const result = getChildEnv(input);
    assert.equal(result.HOME, '/test', 'HOME should be preserved');
    assert.equal(result.PATH, '/usr/bin', 'PATH should be preserved');
  });
});

// ---------------------------------------------------------------------------
// POST /categorize tests
// ---------------------------------------------------------------------------

describe('POST /categorize', async () => {
  let server;

  before(async () => {
    try {
      const mod = await import(`${PROXY_DIR}/server.js`);
      server = await mod.createApp({ claudeBin: MOCK_CLAUDE_BIN, port: TEST_PORT });
    } catch {
      server = null;
    }
  });

  after(async () => {
    if (server && typeof server.close === 'function') {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('returns {categories:[...]} when mock claude succeeds', async () => {
    if (!server) throw new Error('server.js not found — implement in Plan 02');
    const res = await fetch(`http://localhost:${TEST_PORT}/categorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://example.com',
        title: 'Test Bookmark',
        description: 'Categorize this bookmark',
      }),
    });
    assert.equal(res.status, 200, 'HTTP status should be 200');
    const body = await res.json();
    assert.ok(Array.isArray(body.categories), 'categories should be an array');
    assert.ok(body.categories.length > 0, 'categories should not be empty');
  });

  test('returns fallback {categories:[], error:...} when claude binary is missing (ENOENT)', async () => {
    // Create a separate server instance with a missing binary
    let enoentServer;
    try {
      const mod = await import(`${PROXY_DIR}/server.js`);
      enoentServer = await mod.createApp({ claudeBin: '/nonexistent/claude', port: TEST_PORT + 1 });
    } catch {
      throw new Error('server.js not found — implement in Plan 02');
    }

    try {
      const res = await fetch(`http://localhost:${TEST_PORT + 1}/categorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://example.com',
          title: 'Test Bookmark',
          description: 'Categorize this bookmark',
        }),
      });
      assert.equal(res.status, 200, 'HTTP status should be 200 even on ENOENT');
      const body = await res.json();
      assert.deepEqual(body.categories, [], 'categories should be empty on ENOENT');
      assert.ok(body.error, 'error field should be present on ENOENT');
    } finally {
      if (enoentServer && typeof enoentServer.close === 'function') {
        await new Promise((resolve) => enoentServer.close(resolve));
      }
    }
  });

  test('returns fallback {categories:[], error:...} when claude times out', async () => {
    // Create timeout mock binary inline
    const timeoutBin = path.join(__dirname, 'mock-claude-timeout.sh');
    execSync(`printf '#!/bin/bash\\nsleep 10\\n' > "${timeoutBin}" && chmod +x "${timeoutBin}"`);

    let timeoutServer;
    try {
      const mod = await import(`${PROXY_DIR}/server.js`);
      timeoutServer = await mod.createApp({
        claudeBin: timeoutBin,
        claudeTimeout: 500,
        port: TEST_PORT + 2,
      });
    } catch {
      throw new Error('server.js not found — implement in Plan 02');
    }

    try {
      const res = await fetch(`http://localhost:${TEST_PORT + 2}/categorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://example.com',
          title: 'Test Bookmark',
          description: 'Categorize this bookmark',
        }),
      });
      assert.equal(res.status, 200, 'HTTP status should be 200 even on timeout');
      const body = await res.json();
      assert.deepEqual(body.categories, [], 'categories should be empty on timeout');
      assert.ok(body.error, 'error field should be present on timeout');
    } finally {
      if (timeoutServer && typeof timeoutServer.close === 'function') {
        await new Promise((resolve) => timeoutServer.close(resolve));
      }
    }
  });
});

// ---------------------------------------------------------------------------
// POST /process-tweet tests
// ---------------------------------------------------------------------------

describe('POST /process-tweet', async () => {
  let server;

  before(async () => {
    try {
      const mod = await import(`${PROXY_DIR}/server.js`);
      server = await mod.createApp({ claudeBin: MOCK_CLAUDE_BIN, port: TEST_PORT + 3 });
    } catch {
      server = null;
    }
  });

  after(async () => {
    if (server && typeof server.close === 'function') {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('returns {originalId, isAI, title, categories, externalLinks} when mock claude succeeds', async () => {
    if (!server) throw new Error('server.js not found — implement in Plan 02');
    const res = await fetch(`http://localhost:${TEST_PORT + 3}/process-tweet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tweet: { id: 'test-id', text: 'This is a test tweet about AI tools' },
        categories: ['IA', 'Eines'],
      }),
    });
    assert.equal(res.status, 200, 'HTTP status should be 200');
    const body = await res.json();
    assert.ok('originalId' in body, 'response should have originalId');
    assert.ok('isAI' in body, 'response should have isAI');
    assert.ok('title' in body, 'response should have title');
    assert.ok(Array.isArray(body.categories), 'categories should be an array');
    assert.ok(Array.isArray(body.externalLinks), 'externalLinks should be an array');
  });

  test('returns fallback when claude fails: {originalId, isAI:false, title: first 80 chars, categories:[Altres], externalLinks:[]}', async () => {
    // Use a binary that exits non-zero to simulate failure
    const failBin = path.join(__dirname, 'mock-claude-fail.sh');
    execSync(`printf '#!/bin/bash\\nexit 1\\n' > "${failBin}" && chmod +x "${failBin}"`);

    let failServer;
    try {
      const mod = await import(`${PROXY_DIR}/server.js`);
      failServer = await mod.createApp({ claudeBin: failBin, port: TEST_PORT + 4 });
    } catch {
      throw new Error('server.js not found — implement in Plan 02');
    }

    const tweetText = 'This is a test tweet about AI tools with a very long text that should be truncated at 80 characters for the title';
    try {
      const res = await fetch(`http://localhost:${TEST_PORT + 4}/process-tweet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tweet: { id: 'fallback-id', text: tweetText },
          categories: ['IA', 'Eines'],
        }),
      });
      assert.equal(res.status, 200, 'HTTP status should be 200 even on failure');
      const body = await res.json();
      assert.equal(body.originalId, 'fallback-id', 'originalId should match tweet id');
      assert.equal(body.isAI, false, 'isAI should be false on fallback');
      assert.equal(body.title, tweetText.slice(0, 80), 'title should be first 80 chars of tweet text');
      assert.deepEqual(body.categories, ['Altres'], 'categories should be ["Altres"] on fallback');
      assert.deepEqual(body.externalLinks, [], 'externalLinks should be empty on fallback');
    } finally {
      if (failServer && typeof failServer.close === 'function') {
        await new Promise((resolve) => failServer.close(resolve));
      }
    }
  });
});
