import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// CLAUDE.md hard rule: server/engine/ is pure — it may import only other engine files and shared/.
it('engine_has_no_io_imports', () => {
  const dir = join(__dirname, '../../server/engine');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
    const specifiers = [...readFileSync(join(dir, file), 'utf8').matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
    for (const spec of specifiers) expect(spec, `${file} imports ${spec}`).toMatch(/^(\.\/|\.\.\/\.\.\/shared\/)/);
  }
});
