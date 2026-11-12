import { describe, expect, it } from 'vitest';
import { inlineScriptHashes, pageRules, policyFor, routeFor } from '../../scripts/csp-headers.mjs';

describe('csp-headers', () => {
  it('hashes_inline_scripts_only', () => {
    const html = '<script src="/_next/a.js"></script><script>self.__next_f.push([0])</script><script></script><script>self.__next_f.push([0])</script>';
    expect(inlineScriptHashes(html)).toEqual(["'sha256-VXfQxoId3eHgS78yBQY2mYYWuOAzZGdxULBMV816UdU='"]);
  });

  it('policy_keeps_scripts_strict', () => {
    const p = policyFor(["'sha256-abc='"]);
    expect(p).toContain("script-src 'self' 'sha256-abc='");
    expect(p).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(p).toContain("frame-ancestors 'none'");
  });

  it('routes_and_rules', () => {
    expect(routeFor('index.html')).toBe('/');
    expect(routeFor('members/view/index.html')).toBe('/members/view/');
    expect(routeFor('404.html')).toBeNull();
    // The catch-all CSP is detached first: Pages would otherwise join both policies with a comma.
    expect(pageRules([{ route: '/me/', html: '<script>x()</script>' }])[0]).toMatch(/^\/me\/\n {2}! Content-Security-Policy\n {2}Content-Security-Policy: default-src 'self'; script-src 'self' 'sha256-/);
  });
});
