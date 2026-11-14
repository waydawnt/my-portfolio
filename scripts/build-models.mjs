// Builds the models with Blender (headless), then Draco-compresses them into public/models.
// Usage: npm run models:build            (set BLENDER=path\to\blender.exe if not auto-detected)
//        npm run models:build -- --compress-only
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { draco, dedup, prune } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'assets-src', 'export');
const out = join(root, 'public', 'models');
mkdirSync(out, { recursive: true });

function findBlender() {
  if (process.env.BLENDER) return process.env.BLENDER;
  const base = 'C:\\Program Files\\Blender Foundation';
  if (existsSync(base)) {
    const versions = readdirSync(base).sort().reverse();
    for (const v of versions) {
      const exe = join(base, v, 'blender.exe');
      if (existsSync(exe)) return exe;
    }
  }
  return 'blender';
}

if (!process.argv.includes('--compress-only')) {
  const blender = findBlender();
  console.log('Blender:', blender);
  const r = spawnSync(blender, ['--background', '--python', join(root, 'assets-src', 'build_models.py')], { encoding: 'utf8' });
  const log = (r.stdout || '') + (r.stderr || '');
  console.log(log.split('\n').filter((l) => /ASSET|MODELS DONE|Error|Traceback|File "/.test(l)).join('\n'));
  if (r.status !== 0 || !log.includes('MODELS DONE')) {
    console.error(log.slice(-3000));
    process.exit(1);
  }
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.encoder': await draco3d.createEncoderModule(),
  'draco3d.decoder': await draco3d.createDecoderModule(),
});

let total = 0;
for (const f of readdirSync(src).filter((n) => n.endsWith('.glb'))) {
  const doc = await io.read(join(src, f));
  // Keep node names and hierarchy intact (lid, door, flag, screens are animated by name).
  await doc.transform(dedup(), prune({ keepLeaves: true, keepAttributes: true }), draco({ quantizeColor: 8 }));
  await io.write(join(out, f), doc);
  const a = statSync(join(src, f)).size;
  const b = statSync(join(out, f)).size;
  total += b;
  const tris = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives()).reduce((n, p) => n + (p.getIndices()?.getCount() ?? 0) / 3, 0);
  console.log(`${f.padEnd(16)} ${String(tris).padStart(6)} tris  ${(a / 1024).toFixed(1).padStart(7)} KB -> ${(b / 1024).toFixed(1).padStart(6)} KB`);
}
console.log(`Total compressed model payload: ${(total / 1024).toFixed(1)} KB`);
