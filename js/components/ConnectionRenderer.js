/**
 * Scale Architect - SVG Connection Renderer
 * Renders curved, animated data conduits between placed components on the isometric grid.
 */

import { gridToScreen } from '../rendering/IsometricUtils.js';
import { COMPONENTS } from '../data/components.js';

export default class ConnectionRenderer {
  /**
   * @param {SVGElement} svgContainer - SVG element (#connection-layer)
   * @param {object} gameState - GameState instance
   * @param {object} gridRenderer - Active GridRenderer instance
   */
  constructor(svgContainer, gameState, gridRenderer) {
    this.svg = svgContainer;
    this.gameState = gameState;
    this.gridRenderer = gridRenderer;
    this.lines = new Map(); // connectionKey -> SVGPathElement
    this.isEventMode = false;
    this._handleResize = this.renderAll.bind(this);
  }

  /**
   * Initialize event bindings and render all initial connections.
   */
  init() {
    if (!this.svg) return;

    if (this.gameState && typeof this.gameState.on === 'function') {
      this.gameState.on('connectionAdded', () => this.renderAll());
      this.gameState.on('connectionRemoved', () => this.renderAll());
      this.gameState.on('componentAdded', () => this.autoConnect());
      this.gameState.on('componentRemoved', () => this.renderAll());
      this.gameState.on('componentUpgraded', () => this.renderAll());
    }

    window.addEventListener('resize', this._handleResize);

    // Initial pass
    this.autoConnect();
    this.renderAll();
  }

  /**
   * Automatically detect and establish logical architectural connections
   * between placed components based on their declared input/output topologies.
   */
  autoConnect() {
    if (!this.gameState) return;

    let placedList = [];
    if (Array.isArray(this.gameState.placedComponents)) {
      placedList = this.gameState.placedComponents;
    } else if (this.gameState.placedComponents instanceof Map) {
      placedList = Array.from(this.gameState.placedComponents.values());
    }

    if (!placedList || placedList.length < 2) return;

    // Ensure gameState.connections exists
    if (!this.gameState.connections) {
      this.gameState.connections = [];
    }

    let newlyConnected = false;

    // Compare all component pairs
    for (const source of placedList) {
      const sourceDef = COMPONENTS[source.componentId];
      if (!sourceDef || !sourceDef.connections || !sourceDef.connections.outputs) continue;

      for (const target of placedList) {
        if (source.id === target.id) continue;

        // Check if source produces an output that matches target's componentId
        if (sourceDef.connections.outputs.includes(target.componentId)) {
          const alreadyConnected = this.gameState.connections.some(
            c => (c.fromId === source.id && c.toId === target.id) ||
                 (c.from === source.id && c.to === target.id)
          );

          if (!alreadyConnected) {
            const newConn = { fromId: source.id, toId: target.id };
            if (typeof this.gameState.addConnection === 'function') {
              this.gameState.addConnection(source.id, target.id);
            } else {
              this.gameState.connections.push(newConn);
              if (typeof this.gameState.emit === 'function') {
                this.gameState.emit('connectionAdded', newConn);
              }
            }
            newlyConnected = true;
          }
        }
      }
    }

    if (newlyConnected) {
      this.renderAll();
    }
  }

  /**
   * Render all connections as styled SVG cubic/quadratic bezier paths.
   */
  renderAll() {
    if (!this.svg) return;
    this.svg.innerHTML = '';
    this.lines.clear();

    this.addDefs();

    if (!this.gameState || !this.gameState.connections) return;

    for (const conn of this.gameState.connections) {
      this.renderConnection(conn);
    }
  }

  /**
   * Inject SVG gradient defs, filters, and marker arrowheads into the SVG container.
   */
  addDefs() {
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <!-- Neon Glow Filter -->
      <filter id="cyan-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      <filter id="red-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      <!-- Arrow Markers -->
      <marker id="arrow-cyan" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 8 5 L 0 9 z" fill="#06d6a0" />
      </marker>

      <marker id="arrow-red" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 8 5 L 0 9 z" fill="#ef4444" />
      </marker>

      <marker id="arrow-amber" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 8 5 L 0 9 z" fill="#fbbf24" />
      </marker>
    `;
    this.svg.appendChild(defs);
  }

  /**
   * Render an individual connection line between two nodes.
   * @param {object} conn - { fromId, toId }
   */
  renderConnection(conn) {
    const fromId = conn.fromId || conn.from;
    const toId = conn.toId || conn.to;

    let from = null;
    let to = null;

    if (typeof this.gameState.getComponent === 'function') {
      from = this.gameState.getComponent(fromId);
      to = this.gameState.getComponent(toId);
    } else if (Array.isArray(this.gameState.placedComponents)) {
      from = this.gameState.placedComponents.find(c => c.id === fromId);
      to = this.gameState.placedComponents.find(c => c.id === toId);
    }

    if (!from || !to) return;

    const fromPos = gridToScreen(
      from.gridX,
      from.gridY,
      this.gridRenderer.tileWidth,
      this.gridRenderer.tileHeight
    );
    const toPos = gridToScreen(
      to.gridX,
      to.gridY,
      this.gridRenderer.tileWidth,
      this.gridRenderer.tileHeight
    );

    // Center coordinates aligned with component node centers
    const fx = fromPos.x + this.gridRenderer.offsetX;
    const fy = fromPos.y + this.gridRenderer.offsetY - 10;
    const tx = toPos.x + this.gridRenderer.offsetX;
    const ty = toPos.y + this.gridRenderer.offsetY - 10;

    const dx = tx - fx;
    const dy = ty - fy;
    const dist = Math.hypot(dx, dy);

    // Arch height calculation for natural isometric cable drape
    const arcHeight = Math.min(32, dist * 0.16);
    const midX = (fx + tx) / 2;
    const midY = (fy + ty) / 2 - arcHeight;

    const pathData = `M ${fx} ${fy} Q ${midX} ${midY} ${tx} ${ty}`;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const isWarning = this.isEventMode;

    path.setAttribute('d', pathData);
    path.setAttribute('class', `connection-svg-path ${isWarning ? 'warning' : 'active'}`);
    path.setAttribute('stroke', isWarning ? '#ef4444' : '#06d6a0');
    path.setAttribute('stroke-width', '2.5');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-dasharray', isWarning ? '4 4' : '6 4');
    path.setAttribute('marker-end', isWarning ? 'url(#arrow-red)' : 'url(#arrow-cyan)');
    path.setAttribute('filter', isWarning ? 'url(#red-glow)' : 'url(#cyan-glow)');

    // CSS dash animation
    path.style.animation = `dashAnimation ${isWarning ? '0.4s' : '0.8s'} linear infinite`;

    this.svg.appendChild(path);
    this.lines.set(`${fromId}->${toId}`, path);
  }

  /**
   * Pulse all connections red during active platform incidents.
   * @param {boolean} active
   */
  setEventMode(active) {
    this.isEventMode = Boolean(active);
    this.renderAll();
  }

  /**
   * Clean up SVG and event listeners.
   */
  destroy() {
    window.removeEventListener('resize', this._handleResize);
    this.lines.clear();
    if (this.svg) {
      this.svg.innerHTML = '';
    }
  }
}
