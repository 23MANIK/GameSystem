/**
 * /api/designgame — Create DesignGame (making games with Claude, and serving them).
 * The logic lives in tools/designgame/service.mjs; see that file for the actions.
 *
 * This import path is right in the deployed copy, where tools/ sits next to
 * api/ (tools/sync-deploy.sh). Tests use service.mjs directly.
 */

export { handle as default } from '../tools/designgame/service.mjs';
