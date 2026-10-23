/**
 * Scale Architect - Canvas Particle System
 * High-performance animated data packets flowing along infrastructure connections,
 * subtle ambient floating cyber-dust, and explosion/glitch effects during system incidents.
 */

export default class ParticleSystem {
  /**
   * @param {HTMLCanvasElement} canvas - Target canvas element (e.g. #particle-canvas)
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    this.particles = [];          // Active data flow packets
    this.connections = [];        // Connection paths { from: {x,y}, to: {x,y}, color }
    this.ambientParticles = [];   // Floating background cyber dust
    this.burstParticles = [];     // Explosions/sparks on events
    this.animationId = null;
    this.isRunning = false;
    this.isEventMode = false;
    this.maxAmbient = 35;
    this._handleResize = this.resize.bind(this);
  }

  /**
   * Initialize canvas dimensions, spawn ambient particles, and begin loop.
   */
  init() {
    if (!this.canvas || !this.ctx) return;
    this.resize();
    this.initAmbientParticles();
    window.addEventListener('resize', this._handleResize);
    this.start();
  }

  /**
   * Resize canvas buffer to match parent element or screen.
   */
  resize() {
    if (!this.canvas) return;
    const parent = this.canvas.parentElement;
    const width = parent ? parent.clientWidth : window.innerWidth;
    const height = parent ? parent.clientHeight : window.innerHeight;

    // Only resize if dimensions changed to preserve buffer
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
  }

  /**
   * Register a connection line for data packet flow.
   * @param {{ x: number, y: number }} fromPos - Screen start position
   * @param {{ x: number, y: number }} toPos - Screen destination position
   * @param {string} color - Neon hex or rgba color
   */
  addConnection(fromPos, toPos, color = '#06d6a0') {
    if (!fromPos || !toPos) return;

    // Check if connection already exists
    const key = `${Math.round(fromPos.x)},${Math.round(fromPos.y)}->${Math.round(toPos.x)},${Math.round(toPos.y)}`;
    const exists = this.connections.some(c => c.key === key);
    if (exists) return;

    this.connections.push({
      key,
      from: { x: fromPos.x, y: fromPos.y },
      to: { x: toPos.x, y: toPos.y },
      color,
      spawnTimer: Math.random() * 20
    });
  }

  /**
   * Remove a connection line.
   */
  removeConnection(fromPos, toPos) {
    if (!fromPos || !toPos) return;
    const key = `${Math.round(fromPos.x)},${Math.round(fromPos.y)}->${Math.round(toPos.x)},${Math.round(toPos.y)}`;
    this.connections = this.connections.filter(c => c.key !== key);
  }

  /**
   * Clear all active connections and data packets.
   */
  clearConnections() {
    this.connections = [];
    this.particles = [];
  }

  /**
   * Activate or deactivate incident event mode.
   * In event mode, particles turn red, speed up, and generate spark bursts.
   * @param {boolean} active
   */
  setEventMode(active) {
    this.isEventMode = Boolean(active);
    if (this.isEventMode && this.connections.length > 0) {
      // Trigger a dramatic spark burst on random connection targets
      const randConn = this.connections[Math.floor(Math.random() * this.connections.length)];
      if (randConn) {
        this.spawnBurst(randConn.to.x, randConn.to.y, '#ef4444', 20);
      }
    }
  }

  /**
   * Spawn a burst of explosion/glitch sparks at screen coordinate (x, y).
   */
  spawnBurst(x, y, color = '#ef4444', count = 16) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4.5;
      this.burstParticles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: 0.02 + Math.random() * 0.03,
        size: 1.5 + Math.random() * 2.5,
        color
      });
    }
  }

  /**
   * Populate background floating ambient cyber dust.
   */
  initAmbientParticles() {
    this.ambientParticles = [];
    const w = this.canvas ? this.canvas.width : window.innerWidth;
    const h = this.canvas ? this.canvas.height : window.innerHeight;

    for (let i = 0; i < this.maxAmbient; i++) {
      this.ambientParticles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -0.2 - Math.random() * 0.3, // slow upward drift
        size: 1 + Math.random() * 2,
        alpha: 0.15 + Math.random() * 0.35,
        color: Math.random() > 0.5 ? '#00f0ff' : '#e040fb'
      });
    }
  }

  /**
   * Start the particle animation loop.
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.animate();
  }

  /**
   * Stop the particle animation loop.
   */
  stop() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Main render & update loop.
   */
  animate() {
    if (!this.isRunning || !this.ctx || !this.canvas) return;

    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    ctx.clearRect(0, 0, width, height);

    // 1. Draw and update ambient background cyber dust
    this.updateAndDrawAmbient(ctx, width, height);

    // 2. Draw connection flow lines
    for (const conn of this.connections) {
      this.drawConnectionLine(conn.from, conn.to, this.isEventMode ? '#ef4444' : conn.color);

      // Spawn packets along this connection
      conn.spawnTimer = (conn.spawnTimer || 0) + 1;
      const spawnRate = this.isEventMode ? 15 : 30; // faster in event mode
      if (conn.spawnTimer >= spawnRate) {
        conn.spawnTimer = 0;
        this.particles.push({
          from: conn.from,
          to: conn.to,
          progress: 0,
          speed: this.isEventMode ? 0.025 : 0.012, // packet speed
          color: this.isEventMode ? '#ff0055' : conn.color,
          size: this.isEventMode ? 4 : 3
        });
      }
    }

    // 3. Update and draw connection data flow particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.progress += p.speed;

      if (p.progress >= 1.0) {
        // Reached destination, trigger tiny landing ripple
        if (this.isEventMode && Math.random() > 0.6) {
          this.spawnBurst(p.to.x, p.to.y, '#ef4444', 4);
        }
        this.particles.splice(i, 1);
        continue;
      }

      // Bezier curve calculation matching connection line arc
      const dx = p.to.x - p.from.x;
      const dy = p.to.y - p.from.y;
      const dist = Math.hypot(dx, dy);
      const arcHeight = Math.min(30, dist * 0.15);
      const midX = (p.from.x + p.to.x) / 2;
      const midY = (p.from.y + p.to.y) / 2 - arcHeight;

      // Quadratic bezier formula: B(t) = (1-t)^2 P0 + 2(1-t)t P1 + t^2 P2
      const t = p.progress;
      const oneMinusT = 1 - t;
      const curX = oneMinusT * oneMinusT * p.from.x + 2 * oneMinusT * t * midX + t * t * p.to.x;
      const curY = oneMinusT * oneMinusT * p.from.y + 2 * oneMinusT * t * midY + t * t * p.to.y;

      this.drawParticle(curX, curY, p.size, p.color, true);
    }

    // 4. Update and draw burst sparks
    for (let i = this.burstParticles.length - 1; i >= 0; i--) {
      const b = this.burstParticles[i];
      b.x += b.vx;
      b.y += b.vy;
      b.life -= b.decay;

      if (b.life <= 0) {
        this.burstParticles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, b.life);
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    this.animationId = requestAnimationFrame(() => this.animate());
  }

  /**
   * Draw a glowing particle circle on canvas.
   */
  drawParticle(x, y, size, color, glow = true) {
    if (!this.ctx) return;
    const ctx = this.ctx;

    ctx.save();
    if (glow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();

    // Inner bright white core for cyber neon aesthetic
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, size * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * Draw subtle dotted/dashed curved connection line.
   */
  drawConnectionLine(from, to, color) {
    if (!this.ctx) return;
    const ctx = this.ctx;

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.hypot(dx, dy);
    const arcHeight = Math.min(30, dist * 0.15);
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2 - arcHeight;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = this.isEventMode ? 0.6 : 0.25;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo(midX, midY, to.x, to.y);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Update and render ambient floating particles.
   */
  updateAndDrawAmbient(ctx, width, height) {
    for (const p of this.ambientParticles) {
      p.x += p.vx;
      p.y += p.vy;

      // Wrap around canvas edges
      if (p.y < 0) {
        p.y = height;
        p.x = Math.random() * width;
      }
      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /**
   * Clean up all animation frames, event listeners, and particle buffers.
   */
  destroy() {
    this.stop();
    window.removeEventListener('resize', this._handleResize);
    this.particles = [];
    this.connections = [];
    this.ambientParticles = [];
    this.burstParticles = [];
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
}
