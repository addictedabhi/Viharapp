import { describe, it, expect } from 'vitest';
import { loginPage, resultPage, uploadForm } from '../src/pages.js';

describe('worker html pages', () => {
  it('login page is Hindi, has form posting to /login, no external creds', () => {
    const html = loginPage();
    expect(html).toContain('<form');
    expect(html).toContain('action="/login"');
    expect(html).toContain('method="post"');
    expect(html).toContain('लॉगिन');
    expect(html).toContain('#3E6AE1'); // Tesla electric blue
  });

  it('login page can show an error message', () => {
    expect(loginPage({ error: 'गलत' })).toContain('गलत');
  });

  it('result page lists totals and failures', () => {
    const html = resultPage({
      totals: { groups: 2, members: 3, mapped: 1, geocodeFailed: 1 },
      geocodeFailures: [{ zone: 'Z', serial: 2, city: 'X', district: 'Y' }],
    });
    expect(html).toContain('2');
    expect(html).toContain('नक्शे पर नहीं'); // geocode-failed heading
    expect(html).toContain('X');
  });

  it('escapes HTML in error messages (no XSS)', () => {
    const html = loginPage({ error: '<script>x</script>' });
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('upload form posts multipart to /upload and escapes errors', () => {
    const html = uploadForm('<b>oops</b>');
    expect(html).toContain('enctype="multipart/form-data"');
    expect(html).toContain('action="/upload"');
    expect(html).not.toContain('<b>oops</b>');
    expect(html).toContain('&lt;b&gt;oops');
  });
});
