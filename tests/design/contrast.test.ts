import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Design Brief §3 contrast rules, measured against the tokens in globals.css.

function rootTokens(): Record<string, string> {
  const css = readFileSync(resolve(__dirname, '../../src/app/globals.css'), 'utf8');
  const root = css.match(/:root\s*\{([^}]*)\}/);
  if (!root) throw new Error('no :root block in globals.css');
  const tokens: Record<string, string> = {};
  for (const m of root[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    tokens[m[1]] = m[2].trim();
  }
  return tokens;
}

function hex(value: string): [number, number, number] {
  const m = value.match(/^#([0-9a-f]{6})$/i);
  if (!m) throw new Error(`expected #rrggbb, got "${value}"`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(hex(a)), luminance(hex(b))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('design tokens (Design Brief §3)', () => {
  const t = rootTokens();

  it('uses the UM primary and gold exactly', () => {
    expect(t['--primary']?.toUpperCase()).toBe('#A50511');
    expect(t['--secondary']?.toUpperCase()).toBe('#FFB600');
    expect(t['--radius']).toBe('0.5rem');
  });

  it('white on primary is at least 7.9:1', () => {
    expect(ratio(t['--primary'], '#FFFFFF')).toBeGreaterThanOrEqual(7.9);
  });

  it('secondary-foreground on secondary is at least 4.5:1', () => {
    expect(ratio(t['--secondary-foreground'], t['--secondary'])).toBeGreaterThanOrEqual(4.5);
  });

  it('muted-foreground on muted is at least 4.5:1', () => {
    expect(ratio(t['--muted-foreground'], t['--muted'])).toBeGreaterThanOrEqual(4.5);
  });

  it('white on destructive is at least 4.5:1', () => {
    expect(ratio('#FFFFFF', t['--destructive'])).toBeGreaterThanOrEqual(4.5);
  });
});
