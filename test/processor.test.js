import { test, describe } from 'node:test';
import assert from 'node:assert';
import { classifyLink, fetchContent, isPaywalled, stripQuerystring } from '../src/processor.js';

describe('isPaywalled', () => {
  test('detects NYT as paywalled', () => {
    assert.strictEqual(isPaywalled('https://www.nytimes.com/2025/01/01/article.html'), true);
  });

  test('detects WSJ as paywalled', () => {
    assert.strictEqual(isPaywalled('https://www.wsj.com/articles/something'), true);
  });

  test('detects Bloomberg as paywalled', () => {
    assert.strictEqual(isPaywalled('https://www.bloomberg.com/news/article'), true);
  });

  test('returns false for GitHub', () => {
    assert.strictEqual(isPaywalled('https://github.com/user/repo'), false);
  });

  test('returns false for Twitter', () => {
    assert.strictEqual(isPaywalled('https://twitter.com/user/status/123'), false);
  });

  test('matches the host, not a substring of it', () => {
    assert.strictEqual(isPaywalled('https://www.microsoft.com/blog'), false);
    assert.strictEqual(isPaywalled('https://example.com/?ref=nytimes.com'), false);
    assert.strictEqual(isPaywalled('https://www.ft.com/content/abc'), true);
  });
});

describe('stripQuerystring', () => {
  test('removes query parameters', () => {
    const result = stripQuerystring('https://example.com/page?utm_source=twitter&ref=123');
    assert.strictEqual(result, 'https://example.com/page');
  });

  test('preserves path', () => {
    const result = stripQuerystring('https://example.com/deep/nested/path?foo=bar');
    assert.strictEqual(result, 'https://example.com/deep/nested/path');
  });

  test('handles URLs without querystring', () => {
    const result = stripQuerystring('https://example.com/page');
    assert.strictEqual(result, 'https://example.com/page');
  });

  test('handles invalid URLs gracefully', () => {
    const result = stripQuerystring('not-a-url');
    assert.strictEqual(result, 'not-a-url');
  });
});

describe('classifyLink', () => {
  test('types links by their host', () => {
    assert.strictEqual(classifyLink('https://github.com/user/repo'), 'github');
    assert.strictEqual(classifyLink('https://youtu.be/abc'), 'video');
    assert.strictEqual(classifyLink('https://x.com/user/status/123'), 'tweet');
    assert.strictEqual(classifyLink('https://x.com/user/status/123/photo/1'), 'media');
    assert.strictEqual(classifyLink('https://example.com/cat.png'), 'image');
    assert.strictEqual(classifyLink('https://example.com/post'), 'article');
  });

  test('does not mistake hosts that merely contain x.com for tweets', () => {
    assert.strictEqual(classifyLink('https://www.netflix.com/title/1'), 'article');
    assert.strictEqual(classifyLink('https://www.dropbox.com/s/file'), 'article');
  });
});

describe('fetchContent for GitHub links', () => {
  // Replaces fetch with one that answers each URL from the given table
  async function withFetch(responses, fn) {
    const realFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (url) => {
      calls.push(url);
      return responses[url];
    };
    try {
      return { result: await fn(), calls };
    } finally {
      globalThis.fetch = realFetch;
    }
  }
  const page = { ok: true, text: async () => 'page content '.repeat(100) };

  for (const status of [403, 404]) {
    test(`falls back to the page when the API answers ${status}`, async () => {
      const { result, calls } = await withFetch({
        'https://api.github.com/repos/owner/repo': { ok: false, status },
        'https://github.com/owner/repo': page
      }, () => fetchContent('https://github.com/owner/repo', 'github'));
      assert.strictEqual(result.source, 'direct');
      assert.deepStrictEqual(calls, ['https://api.github.com/repos/owner/repo', 'https://github.com/owner/repo']);
    });
  }

  test('returns repo metadata and README when the API answers', async () => {
    const { result } = await withFetch({
      'https://api.github.com/repos/owner/repo': {
        ok: true,
        json: async () => ({ name: 'repo', full_name: 'owner/repo', stargazers_count: 5, html_url: 'https://github.com/owner/repo' })
      },
      'https://api.github.com/repos/owner/repo/readme': {
        ok: true,
        json: async () => ({ content: Buffer.from('# Readme').toString('base64') })
      }
    }, () => fetchContent('https://github.com/owner/repo', 'github'));
    assert.deepStrictEqual(result, {
      name: 'repo',
      fullName: 'owner/repo',
      description: '',
      stars: 5,
      language: undefined,
      topics: [],
      readme: '# Readme',
      url: 'https://github.com/owner/repo',
      source: 'github-api'
    });
  });
});
