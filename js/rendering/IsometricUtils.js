/**
 * Scale Architect - Isometric Projection Utilities
 * Mathematical conversion between 2D Cartesian grid coordinates
 * and 2.5D isometric screen projection coordinates.
 */

/**
 * Convert 2D grid coordinates to 2.5D isometric screen pixel positions.
 * @param {number} gridX - Grid column index (0 to gridSize - 1)
 * @param {number} gridY - Grid row index (0 to gridSize - 1)
 * @param {number} tileWidth - Isometric tile width in pixels (default 120)
 * @param {number} tileHeight - Isometric tile height in pixels (default 60)
 * @returns {{ x: number, y: number }} Isometric screen center position
 */
export function gridToScreen(gridX, gridY, tileWidth = 120, tileHeight = 60) {
  const halfWidth = tileWidth / 2;
  const halfHeight = tileHeight / 2;
  const screenX = (gridX - gridY) * halfWidth;
  const screenY = (gridX + gridY) * halfHeight;
  return { x: screenX, y: screenY };
}

/**
 * Convert isometric screen coordinates back to 2D grid coordinates.
 * Returns both rounded integer indices and exact floating point coordinates.
 * @param {number} screenX - Screen X offset relative to grid origin (0, 0)
 * @param {number} screenY - Screen Y offset relative to grid origin (0, 0)
 * @param {number} tileWidth - Isometric tile width in pixels (default 120)
 * @param {number} tileHeight - Isometric tile height in pixels (default 60)
 * @returns {{ gridX: number, gridY: number, x: number, y: number, exactX: number, exactY: number }}
 */
export function screenToGrid(screenX, screenY, tileWidth = 120, tileHeight = 60) {
  const halfWidth = tileWidth / 2;
  const halfHeight = tileHeight / 2;
  const exactX = (screenX / halfWidth + screenY / halfHeight) / 2;
  const exactY = (screenY / halfHeight - screenX / halfWidth) / 2;
  const gridX = Math.floor(exactX);
  const gridY = Math.floor(exactY);

  return {
    gridX,
    gridY,
    x: gridX,
    y: gridY,
    exactX,
    exactY
  };
}

/**
 * Get the center screen coordinates of the entire grid.
 * Useful for camera centering and viewport transforms.
 * @param {number} gridSize - Size of square grid (e.g. 8 for 8x8)
 * @param {number} tileWidth - Isometric tile width in pixels (default 120)
 * @param {number} tileHeight - Isometric tile height in pixels (default 60)
 * @returns {{ x: number, y: number, gridX: number, gridY: number }}
 */
export function getGridCenter(gridSize = 8, tileWidth = 120, tileHeight = 60) {
  const centerGridX = (gridSize - 1) / 2;
  const centerGridY = (gridSize - 1) / 2;
  const screenPos = gridToScreen(centerGridX, centerGridY, tileWidth, tileHeight);

  return {
    x: screenPos.x,
    y: screenPos.y,
    gridX: centerGridX,
    gridY: centerGridY
  };
}

/**
 * Check if a screen point (px, py) lies inside an isometric diamond tile.
 * Automatically handles either grid coordinates or screen center coordinates for tileX, tileY.
 * @param {number} px - Point screen X
 * @param {number} py - Point screen Y
 * @param {number} tileX - Tile gridX (or screen center X)
 * @param {number} tileY - Tile gridY (or screen center Y)
 * @param {number} tileWidth - Tile width in pixels (default 120)
 * @param {number} tileHeight - Tile height in pixels (default 60)
 * @returns {boolean} True if point is inside diamond boundary
 */
export function isPointInTile(px, py, tileX, tileY, tileWidth = 120, tileHeight = 60) {
  let cx = tileX;
  let cy = tileY;

  // If tileX and tileY look like grid coordinates (e.g. small integers), convert to screen center
  if (Number.isInteger(tileX) && Number.isInteger(tileY) && tileX >= -2 && tileX <= 64 && tileY >= -2 && tileY <= 64) {
    const center = gridToScreen(tileX, tileY, tileWidth, tileHeight);
    cx = center.x;
    cy = center.y;
  }

  const halfWidth = tileWidth / 2;
  const halfHeight = tileHeight / 2;
  const dx = Math.abs(px - cx);
  const dy = Math.abs(py - cy);

  // Standard diamond equation: |dx| / (W/2) + |dy| / (H/2) <= 1
  return (dx / halfWidth + dy / halfHeight) <= 1.0;
}

/**
 * Get grid bounding box dimensions in screen space for a given grid size.
 * @param {number} gridSize - Grid dimensions (e.g. 8 for 8x8)
 * @param {number} tileWidth - Tile width in pixels (default 120)
 * @param {number} tileHeight - Tile height in pixels (default 60)
 * @returns {{ minX: number, maxX: number, minY: number, maxY: number, width: number, height: number }}
 */
export function getGridBounds(gridSize = 8, tileWidth = 120, tileHeight = 60) {
  const halfWidth = tileWidth / 2;
  const halfHeight = tileHeight / 2;

  const minX = -gridSize * halfWidth;
  const maxX = gridSize * halfWidth;
  const minY = -halfHeight;
  const maxY = (gridSize * 2 - 1) * halfHeight;

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  };
}

/**
 * Compute Manhattan distance between two grid cells.
 * @param {number} x1 - First cell X
 * @param {number} y1 - First cell Y
 * @param {number} x2 - Second cell X
 * @param {number} y2 - Second cell Y
 * @returns {number} Manhattan grid distance
 */
export function gridDistance(x1, y1, x2, y2) {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

/**
 * Get valid adjacent orthogonal grid coordinates.
 * @param {number} gridX - Source cell X
 * @param {number} gridY - Source cell Y
 * @param {number} gridSize - Grid dimensions (default 8)
 * @returns {Array<{ x: number, y: number }>}
 */
export function getAdjacentCoords(gridX, gridY, gridSize = 8) {
  const deltas = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 }
  ];

  return deltas
    .map(d => ({ x: gridX + d.dx, y: gridY + d.dy }))
    .filter(p => p.x >= 0 && p.x < gridSize && p.y >= 0 && p.y < gridSize);
}
