// Hands in ASHGATE (Node 22, standard library only). The game is game/, plain static files the
// browser loads as ES modules with three.js mapped by an import map. This program copies game/ and
// screenshots/ to /output (or MAKEFUN_OUTPUT_DIR) and writes dossier.json, the text and images the
// judge reads, with the vendored make.fun library. It is deterministic: same files in, same bytes out.
//
// Play locally with `node serve.ts`, then open http://localhost:8080.
// Hand in locally: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's caps: the judge's text budget, at most 4 screenshots of 256 KiB, and game/ within
// 993 files and 48 MiB (it shares /output's 1000-entry cap with screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, { text_max_bytes: 163840, screenshots: { max: 4, max_bytes: 262144 }, game_max_files: 993, game_max_bytes: 50331648 }),
);
