/**
 * cloudSave.js — decide which save wins when a signed-in player has one in this
 * browser and one in the cloud. Pure functions, so they can be unit tested.
 *
 * A save is { json: string, savedAt: number (ms) }.
 * lastSync is what this browser last uploaded or downloaded: { uid, savedAt }.
 */

/**
 * @returns {'none'|'push'|'pull'|'same'}
 *   push = upload the local save, pull = replace the local save with the cloud one.
 */
export function chooseSave({ local, cloud, uid, lastSync }) {
  const hasLocal = Boolean(local?.json);
  const hasCloud = Boolean(cloud?.json);
  if (!hasLocal && !hasCloud) return 'none';
  if (!hasCloud) return 'push';
  if (!hasLocal) return 'pull';
  if (local.json === cloud.json) return 'same';
  // This browser's save was last synced with a different account (or never):
  // the signed-in player's own cloud save wins over someone else's local game.
  if (lastSync?.uid && lastSync.uid !== uid) return 'pull';
  return (cloud.savedAt || 0) > (local.savedAt || 0) ? 'pull' : 'push';
}

/** The small summary kept next to the save, for analysis in the Firestore console. */
export function saveSummary(json) {
  try {
    const s = JSON.parse(json);
    return {
      productId: typeof s.productId === 'string' ? s.productId : null,
      level: Number.isFinite(s.level) ? s.level : null,
      levelCompleted: Boolean(s.levelCompleted)
    };
  } catch {
    return { productId: null, level: null, levelCompleted: false };
  }
}

/** Highest level reached per product, merged with what the cloud already knows. */
export function mergeProgress(progress = {}, summary) {
  const out = { ...progress };
  if (summary?.productId && summary.level) {
    const done = summary.levelCompleted ? summary.level : summary.level - 1;
    out[summary.productId] = Math.max(out[summary.productId] || 0, done);
  }
  return out;
}
