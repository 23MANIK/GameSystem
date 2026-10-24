/**
 * /api/designgame — Create DesignGame (making games with Claude, and serving them).
 * The logic lives in tools/designgame/service.mjs; see that file for the actions.
 *
 * The deployed copy keeps tools/ next to api/ (tools/sync-deploy.sh), the repo
 * keeps it two levels up, so look in both places.
 */

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const deployed = new URL('../tools/designgame/service.mjs', import.meta.url);
const repo = new URL('../../tools/designgame/service.mjs', import.meta.url);
const lib = existsSync(fileURLToPath(deployed)) ? deployed : repo;

export default async function handler(req, res) {
  const { handle } = await import(lib.href);
  return handle(req, res);
}
