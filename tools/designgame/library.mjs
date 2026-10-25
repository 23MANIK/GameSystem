/**
 * library.mjs — design notes the generator uses as its main source.
 *
 * A folder of Markdown study notes, one per system (e.g. "22-uber.md"), plus an
 * optional "advanced/" folder of deep dives. Each note starts with a "# Title"
 * line and may have "**Patterns:** …" and "**Source:** <url>" lines. Index files
 * (names containing "index") are skipped.
 *
 * The prompt check picks up to two notes that match the request; research then
 * reads those first and only searches the web to fill gaps.
 *
 * Folder: DESIGNGAME_LIBRARY_DIR, else tools/designgame/library. No folder = no
 * library, and research works from the web alone.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_LIBRARY_DIR = path.join(HERE, 'library');
const MAX_NOTES = 2;
const MAX_CHARS = 14000; // per note, about 3.5k tokens

/** Read every note in a folder. Returns [{ id, title, patterns, source, text }]. */
export function loadLibrary(dir = process.env.DESIGNGAME_LIBRARY_DIR || DEFAULT_LIBRARY_DIR) {
  if (!dir || !fs.existsSync(dir)) return [];
  const files = [];
  const walk = d => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.md') && !/index/i.test(e.name)) files.push(p);
    }
  };
  walk(dir);
  return files.sort().map(file => {
    const text = fs.readFileSync(file, 'utf8');
    const title = (text.match(/^#\s+(.+)$/m)?.[1] || path.basename(file, '.md'))
      .replace(/^[A-Z]?\d+\s*·\s*/, '').replace(/:\s*Study Notes.*$/i, '').trim();
    return {
      id: path.basename(file, '.md').toLowerCase().replace(/[^a-z0-9]+/g, '_'),
      title,
      patterns: text.match(/\*\*Patterns:\*\*\s*([^\n·]+)/)?.[1]?.trim() || '',
      source: text.match(/\*\*Source:\*\*\s*(https?:\/\/\S+)/)?.[1] || null,
      text: text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}\n\n(cut short)` : text
    };
  });
}

/** One line per note, for the prompt check to choose from. */
export function libraryMenu(lib) {
  return lib.map(n => `- ${n.id}: ${n.title}${n.patterns ? ` (${n.patterns})` : ''}`).join('\n');
}

/** The notes the check picked (unknown ids are dropped). */
export function pickNotes(lib, ids) {
  const want = [...new Set((Array.isArray(ids) ? ids : []).map(String))];
  return want.map(id => lib.find(n => n.id === id)).filter(Boolean).slice(0, MAX_NOTES);
}
