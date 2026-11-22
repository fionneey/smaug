import { test, describe } from 'node:test';
import assert from 'node:assert';
import { classifyLink, isPaywalled, stripQuerystring } from '../src/processor.js';

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
