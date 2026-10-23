/**
 * Scale Architect - Isometric Grid Renderer
 * Renders an 8x8 isometric cyber grid with diamond-shaped interactive cells,
 * hover highlights, occupancy tracking, and placement validation states.
 */

import { gridToScreen, getGridCenter } from './IsometricUtils.js';

export default class GridRenderer {
  /**
   * @param {HTMLElement} container - DOM container element (e.g. #grid-overlay)
   * @param {number} gridSize - Grid dimensions (default 8 for 8x8)
   */
  constructor(container, gridSize = 8) {
    this.container = container;
    this.gridSize = gridSize;
    this.tileWidth = 120;
    this.tileHeight = 60;
    this.offsetX = 0;
    this.offsetY = 0;
    this.cells = new Map(); // key `${gridX},${gridY}` -> HTMLElement
    this.hoveredCell = null;
    this.selectedCell = null;
    this.placementMode = false;
    this.validPlacementCells = null;
    this.occupiedCells = new Set();
    this.clickCallback = null;
    this.hoverCallback = null;
    this.wrapper = null;
    this._handleResize = this.recalculateOffsets.bind(this);
  }

  /**
   * Initialize grid, calculate offsets, and generate cells.
   */
  init() {
    this.container.innerHTML = '';
    this.cells.clear();

    // Create a dedicated wrapper div inside container
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'grid-board-wrapper';
    this.wrapper.style.position = 'absolute';
    this.wrapper.style.top = '0';
    this.wrapper.style.left = '0';
    this.wrapper.style.width = '100%';
    this.wrapper.style.height = '100%';
    this.wrapper.style.pointerEvents = 'auto';
    this.container.appendChild(this.wrapper);

    // Calculate initial centering offsets
    this.calculateOffsets();

    // Generate grid tiles
    for (let gy = 0; gy < this.gridSize; gy++) {
      for (let gx = 0; gx < this.gridSize; gx++) {
        const cell = this.createCell(gx, gy);
        this.cells.set(`${gx},${gy}`, cell);
        this.wrapper.appendChild(cell);
      }
    }

    // Attach resize listener to maintain responsive grid centering
    window.addEventListener('resize', this._handleResize);
  }

  /**
   * Calculate centering offsets so the grid sits perfectly in the viewport.
   */
  calculateOffsets() {
    const parentWidth = this.container.clientWidth || window.innerWidth;
    const parentHeight = this.container.clientHeight || (window.innerHeight - 124);

    // Center X is halfway across the container
    // Machines sit one tile right of the grid centre (see ROLE_TILES), so shift left
    // by half a tile to keep the whole system centred on screen
    this.offsetX = Math.floor(parentWidth / 2) - this.tileWidth / 2;

    // Center Y balances the diamond bounds vertically with a slight perspective bias
    const gridCenter = getGridCenter(this.gridSize, this.tileWidth, this.tileHeight);
    this.offsetY = Math.floor(parentHeight / 2 - gridCenter.y + 20);
  }

  /**
   * Recalculate offsets on window resize and update all cell positions.
   */
  recalculateOffsets() {
    this.calculateOffsets();
    for (let gy = 0; gy < this.gridSize; gy++) {
      for (let gx = 0; gx < this.gridSize; gx++) {
        const cell = this.cells.get(`${gx},${gy}`);
        if (cell) {
          const pos = gridToScreen(gx, gy, this.tileWidth, this.tileHeight);
          cell.style.left = `${pos.x + this.offsetX - this.tileWidth / 2}px`;
          cell.style.top = `${pos.y + this.offsetY - this.tileHeight / 2}px`;
        }
      }
    }
  }

  /**
   * Create an individual isometric diamond grid cell element.
   * @param {number} gridX - Column index
   * @param {number} gridY - Row index
   * @returns {HTMLElement} The created DOM element
   */
  createCell(gridX, gridY) {
    const pos = gridToScreen(gridX, gridY, this.tileWidth, this.tileHeight);

    const cell = document.createElement('div');
    cell.className = 'grid-cell';
    cell.id = `grid-cell-${gridX}-${gridY}`;
    cell.dataset.gridX = String(gridX);
    cell.dataset.gridY = String(gridY);

    cell.style.position = 'absolute';
    cell.style.width = `${this.tileWidth}px`;
    cell.style.height = `${this.tileHeight}px`;
    cell.style.left = `${pos.x + this.offsetX - this.tileWidth / 2}px`;
    cell.style.top = `${pos.y + this.offsetY - this.tileHeight / 2}px`;
    cell.style.cursor = 'pointer';
    cell.style.display = 'flex';
    cell.style.alignItems = 'center';
    cell.style.justifyContent = 'center';
    cell.style.background = 'transparent';
    cell.style.border = 'none';

    // SVG Diamond tile for clean borders, clip-path, and coordinate label
    cell.innerHTML = `
      <svg class="grid-cell-svg" viewBox="0 0 ${this.tileWidth} ${this.tileHeight}" width="100%" height="100%" style="overflow: visible; pointer-events: none;">
        <polygon 
          class="grid-cell-polygon" 
          points="${this.tileWidth / 2},2 ${this.tileWidth - 2},${this.tileHeight / 2} ${this.tileWidth / 2},${this.tileHeight - 2} 2,${this.tileHeight / 2}" 
          fill="rgba(17, 24, 39, 0.45)" 
          stroke="rgba(0, 240, 255, 0.15)" 
          stroke-width="1.2"
          style="transition: fill 0.15s ease, stroke 0.15s ease, filter 0.15s ease;"
        />
        <text 
          class="cell-coord" 
          x="${this.tileWidth / 2}" 
          y="${this.tileHeight / 2 + 3}" 
          text-anchor="middle" 
          font-family="monospace" 
          font-size="8px" 
          fill="rgba(148, 163, 184, 0.3)"
          style="user-select: none;"
        >${gridX},${gridY}</text>
      </svg>
    `;

    // Pointer Events
    cell.addEventListener('mouseenter', () => {
      this.hoveredCell = { x: gridX, y: gridY };
      cell.classList.add('hover');
      const poly = cell.querySelector('.grid-cell-polygon');
      if (poly) {
        if (!cell.classList.contains('occupied') && !cell.classList.contains('invalid-placement')) {
          poly.setAttribute('fill', 'rgba(6, 214, 160, 0.18)');
          poly.setAttribute('stroke', 'rgba(6, 214, 160, 0.7)');
          poly.setAttribute('filter', 'drop-shadow(0 0 6px rgba(6, 214, 160, 0.5))');
        }
      }
      if (typeof this.hoverCallback === 'function') {
        this.hoverCallback({ gridX, gridY, cell });
      }
    });

    cell.addEventListener('mouseleave', () => {
      if (this.hoveredCell && this.hoveredCell.x === gridX && this.hoveredCell.y === gridY) {
        this.hoveredCell = null;
      }
      cell.classList.remove('hover');
      this.updateCellSvgStyle(cell, gridX, gridY);
    });

    cell.addEventListener('click', (e) => {
      e.stopPropagation();
      // Cell boxes are rectangles that overlap their neighbours; work out which
      // diamond was really clicked from the mouse position.
      const hit = this.tileAt(e.clientX, e.clientY) || { x: gridX, y: gridY };
      const target = this.cells.get(`${hit.x},${hit.y}`) || cell;
      this.selectedCell = hit;
      if (typeof this.clickCallback === 'function') {
        this.clickCallback({
          gridX: hit.x,
          gridY: hit.y,
          cell: target,
          isOccupied: this.occupiedCells.has(`${hit.x},${hit.y}`),
          placementMode: this.placementMode
        });
      }
    });

    return cell;
  }

  /**
   * Internal helper to refresh SVG polygon colors based on state classes.
   */
  updateCellSvgStyle(cell, gridX, gridY) {
    const poly = cell.querySelector('.grid-cell-polygon');
    if (!poly) return;

    const isOccupied = this.occupiedCells.has(`${gridX},${gridY}`);

    if (cell.classList.contains('valid-placement') || cell.classList.contains('placement-valid')) {
      poly.setAttribute('fill', 'rgba(6, 214, 160, 0.22)');
      poly.setAttribute('stroke', 'var(--accent-cyan, #06d6a0)');
      poly.setAttribute('stroke-width', '2');
      poly.setAttribute('filter', 'drop-shadow(0 0 8px rgba(6, 214, 160, 0.6))');
    } else if (cell.classList.contains('invalid-placement') || cell.classList.contains('placement-invalid')) {
      poly.setAttribute('fill', 'rgba(239, 68, 68, 0.22)');
      poly.setAttribute('stroke', 'var(--accent-red, #ef4444)');
      poly.setAttribute('stroke-width', '2');
      poly.setAttribute('filter', 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.6))');
    } else if (cell.classList.contains('selected-target') || cell.classList.contains('selected')) {
      poly.setAttribute('fill', 'rgba(6, 214, 160, 0.15)');
      poly.setAttribute('stroke', 'var(--accent-cyan, #00f0ff)');
      poly.setAttribute('stroke-width', '2');
      poly.setAttribute('filter', 'drop-shadow(0 0 10px rgba(0, 240, 255, 0.7))');
    } else if (isOccupied) {
      poly.setAttribute('fill', 'rgba(30, 41, 59, 0.6)');
      poly.setAttribute('stroke', 'rgba(255, 255, 255, 0.18)');
      poly.setAttribute('stroke-width', '1.2');
      poly.removeAttribute('filter');
    } else {
      poly.setAttribute('fill', 'rgba(17, 24, 39, 0.45)');
      poly.setAttribute('stroke', 'rgba(0, 240, 255, 0.15)');
      poly.setAttribute('stroke-width', '1.2');
      poly.removeAttribute('filter');
    }
  }

  /**
   * Mark a grid cell as occupied or empty.
   * @param {number} gridX - Cell column
   * @param {number} gridY - Cell row
   * @param {boolean} occupied - True to mark occupied, false to clear
   */
  setOccupied(gridX, gridY, occupied) {
    const key = `${gridX},${gridY}`;
    const cell = this.cells.get(key);

    if (occupied) {
      this.occupiedCells.add(key);
      if (cell) cell.classList.add('occupied');
    } else {
      this.occupiedCells.delete(key);
      if (cell) cell.classList.remove('occupied');
    }

    if (cell) {
      this.updateCellSvgStyle(cell, gridX, gridY);
    }
  }

  /**
   * Enable or disable interactive placement mode with visual indicators.
   * @param {boolean} enabled - True to activate placement highlights
   * @param {Set<string>|Array<string>|null} validCells - Optional set of valid cell keys "x,y"
   */
  setPlacementMode(enabled, validCells = null) {
    this.placementMode = enabled;
    this.validPlacementCells = validCells ? (validCells instanceof Set ? validCells : new Set(validCells)) : null;

    for (let gy = 0; gy < this.gridSize; gy++) {
      for (let gx = 0; gx < this.gridSize; gx++) {
        const key = `${gx},${gy}`;
        const cell = this.cells.get(key);
        if (!cell) continue;

        cell.classList.remove('valid-placement', 'placement-valid', 'invalid-placement', 'placement-invalid');

        if (enabled) {
          const isOccupied = this.occupiedCells.has(key);
          const isValidKey = this.validPlacementCells ? this.validPlacementCells.has(key) : true;

          if (!isOccupied && isValidKey) {
            cell.classList.add('valid-placement', 'placement-valid');
          } else {
            cell.classList.add('invalid-placement', 'placement-invalid');
          }
        }

        this.updateCellSvgStyle(cell, gx, gy);
      }
    }
  }

  /**
   * Add a specific highlight class to a cell.
   * @param {number} gridX - Cell column
   * @param {number} gridY - Cell row
   * @param {string} type - Highlight class type ('hover', 'valid-placement', 'invalid-placement', 'selected-target')
   */
  highlightCell(gridX, gridY, type = 'hover') {
    const cell = this.cells.get(`${gridX},${gridY}`);
    if (cell) {
      cell.classList.add(type);
      this.updateCellSvgStyle(cell, gridX, gridY);
    }
  }

  /**
   * Clear all transient highlight classes from all grid cells.
   */
  clearHighlights() {
    for (const [key, cell] of this.cells) {
      const [gx, gy] = key.split(',').map(Number);
      cell.classList.remove(
        'hover',
        'selected-target',
        'selected',
        'valid-placement',
        'placement-valid',
        'invalid-placement',
        'placement-invalid'
      );
      this.updateCellSvgStyle(cell, gx, gy);
    }
    this.selectedCell = null;
  }

  /**
   * Get the DOM element for a specific grid coordinate.
   * @param {number} gridX - Column index
   * @param {number} gridY - Row index
   * @returns {HTMLElement|undefined}
   */
  getCellElement(gridX, gridY) {
    return this.cells.get(`${gridX},${gridY}`);
  }

  /** The diamond tile under a screen point (client coordinates), or null. */
  tileAt(clientX, clientY) {
    if (!this.wrapper) return null;
    const rect = this.wrapper.getBoundingClientRect();
    const sx = clientX - rect.left - this.offsetX;
    const sy = clientY - rect.top - this.offsetY;
    // Inverse of gridToScreen (tile centres): x = (gx - gy)·w/2, y = (gx + gy)·h/2
    const gx = Math.round((sx / (this.tileWidth / 2) + sy / (this.tileHeight / 2)) / 2);
    const gy = Math.round((sy / (this.tileHeight / 2) - sx / (this.tileWidth / 2)) / 2);
    if (gx < 0 || gy < 0 || gx >= this.gridSize || gy >= this.gridSize) return null;
    return { x: gx, y: gy };
  }

  /**
   * Register a callback triggered when a cell is clicked.
   * @param {Function} callback - Callback accepting { gridX, gridY, cell, isOccupied, placementMode }
   */
  onCellClick(callback) {
    this.clickCallback = callback;
  }

  /**
   * Register a callback triggered when a cell is hovered.
   * @param {Function} callback - Callback accepting { gridX, gridY, cell }
   */
  onCellHover(callback) {
    this.hoverCallback = callback;
  }

  /**
   * Clean up all DOM elements and event listeners.
   */
  destroy() {
    window.removeEventListener('resize', this._handleResize);
    this.cells.clear();
    this.occupiedCells.clear();
    this.container.innerHTML = '';
  }
}
