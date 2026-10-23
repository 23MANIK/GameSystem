import { openFeedback } from './ui/Feedback.js';
// ═══════════════════════════════════════════════════════════════════
// Scale Architect — Main Game Controller
// Levels 1–7: start with one server, then add a database, web server, gateway,
// load balancer, cache and CDN as the Guestbook grows. See data/levels.js.
// ═══════════════════════════════════════════════════════════════════

import GameState from './game/GameState.js';
import LevelSystem from './game/LevelSystem.js';
import EventSystem from './game/EventSystem.js';
import ResourceManager from './game/ResourceManager.js';
import Tutorial from './game/Tutorial.js';
import TrafficSpikes from './game/TrafficSpikes.js';
import { ROLES, ROLE_TILES } from './data/roles.js';
import { LEVELS } from './data/levels.js';

import SystemDiagram from './rendering/SystemDiagram.js';

import HUD from './ui/HUD.js';
import Notifications from './ui/Notifications.js';
import ServerBuilder from './ui/ServerBuilder.js';
import GuestbookPanel from './ui/GuestbookPanel.js';
import GuideBubble from './ui/GuideBubble.js';
import InfoTips, { infoButton } from './ui/InfoTips.js';
import { linkTerms } from './ui/Glossary.js';
import NotificationsPanel from './ui/NotificationsPanel.js';
import GoalsPanel from './ui/GoalsPanel.js';
import LevelsPanel from './ui/LevelsPanel.js';
import LevelIntro from './ui/LevelIntro.js';
import MoneyPanel from './ui/MoneyPanel.js';
import Presence from './game/Presence.js';
import ProductPicker from './ui/ProductPicker.js';
import { evaluateChallenges } from './game/Challenges.js';

import { PART_ORDER, SERVER_PARTS } from './data/serverParts.js';
import { getProduct } from './data/products.js';
import { vocab } from './products/registry.js';
import { fixesForLevel } from './data/codeFixes.js';

class ScaleArchitect {
  constructor() {
    // ─── Core Game Systems ───
    this.gameState = new GameState();
    this.levelSystem = null;
    this.eventSystem = null;
    this.resourceManager = null;
    this.tutorial = null;

    // ─── Rendering ───
    this.diagram = null; // the system drawn as an architecture diagram

    // ─── UI ───
    this.hud = null;
    this.notifications = null;
    this.serverBuilder = null;
    this.guestbookPanel = null;
    this.guide = null;

    // ─── Game Loop ───
    this.tickInterval = null;
    this.tickRate = 2000; // 2 seconds per tick
    this.activePanel = null;
    this.isRunning = false;
    this.placing = null; // role of a machine waiting to be placed on the map
    this.overloadWarned = false;

    // ─── Intro Particles ───
    this.introParticleId = null;
  }

  // ═══════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════

  init() {
    // "N playing now": a ping once a minute while the game is open (hidden until set up)
    this.presence = new Presence();
    this.presence.onChange(() => this.renderPresence());
    this.presence.peek();
    this.setupIntroScreen();
    this.animateIntroParticles();
  }

  setupIntroScreen() {
    const introScreen = document.getElementById('intro-screen');
    const btnNewGame = document.getElementById('btn-new-game');
    const btnContinue = document.getElementById('btn-continue-game');

    // Check for saved game
    const hasSave = this.gameState.load();
    let saveLabel = '';
    if (hasSave) {
      btnContinue.style.display = 'inline-flex';
      const gs = this.gameState;
      const product = getProduct(gs.productId);
      saveLabel = `${product.icon} ${product.name} · Level ${gs.level}: ${gs.levelDef().name}`;
      btnContinue.innerHTML = `<span>▶️</span><span class="intro-continue">Continue<small class="intro-save">${saveLabel}</small></span>`;
    }

    // New Game → pick a product first
    const picker = new ProductPicker(document.getElementById('product-screen'));
    btnNewGame.addEventListener('click', () => {
      picker.open((productId) => {
        this.gameState.reset();
        this.gameState.productId = productId;
        this.gameState.coins = LEVELS[0].startingCoins;
        this.startGame(introScreen);
      }, null, saveLabel);
    });

    btnContinue.addEventListener('click', () => {
      this.startGame(introScreen);
    });
  }

  startGame(introScreen) {
    // A double click on Continue / Play must not start two games (two clocks, two diagrams)
    if (this.started) return;
    this.started = true;
    this.presence?.start(this.gameState.productId);
    introScreen.style.animation = 'fade-out 0.6s ease-out forwards';
    cancelAnimationFrame(this.introParticleId);

    setTimeout(() => {
      introScreen.style.display = 'none';
      this.initGameSystems();
      this.initRendering();
      this.initUI();
      this.setupEventListeners();

      this.gameState.recalculateMetrics();
      this.tutorial.sync();
      this.guide.render();

      // Bought a machine but never placed it (e.g. reloaded mid-step)
      this.resumePlacement();

      this.updateTraffic();

      if (this.gameState.levelCompleted) {
        // A finished level stays frozen at its final result
        const next = this.nextPlayableLevel();
        this.notifications.show(next
          ? `✅ Level complete. Open Goals to start Level ${next.level}: ${next.name}.`
          : '✅ Level complete. Your results are saved and paused. Next level coming soon.', 'success', 6000);
      } else {
        // A new level opens with its intro card; the clock starts after it
        this.startLevelWithIntro();
      }

      if (!this.tutorial.active && !this.gameState.levelCompleted && this.gameState.introSeenLevel === this.gameState.level) {
        const levelData = this.levelSystem.getCurrentLevel();
        const product = getProduct(this.gameState.productId);
        this.notifications.show(`📍 ${product.name} · Level ${levelData.level}: ${levelData.name}`, 'info', 5000);
      }
    }, 600);
  }

  initGameSystems() {
    this.levelSystem = new LevelSystem(this.gameState);
    this.eventSystem = new EventSystem(this.gameState);
    this.resourceManager = new ResourceManager(this.gameState, this.levelSystem);
    this.tutorial = new Tutorial(this.gameState);
    this.spikes = new TrafficSpikes(this.gameState);
  }

  initRendering() {
    this.diagram = new SystemDiagram(document.getElementById('game-world'), this.gameState, {
      // Click a machine → its tab in the Server Builder
      onNodeClick: (role) => this.openServerBuilder(role),
      // Click the glowing slot → place the machine that's waiting
      onSlotClick: (role) => {
        const tile = this.placementTiles(role)[0];
        if (tile) this.placeMachine(role, tile.x, tile.y);
      }
    });
    this.diagram.init();
  }

  initUI() {
    const hudContainer = document.getElementById('hud-container');
    this.hud = new HUD(hudContainer, this.gameState);
    this.hud.init();

    // Toasts: at most 2 on screen. Every one is also saved to the Notifications tab.
    this.notifications = new Notifications(document.getElementById('notification-container'), 2);
    const showToast = this.notifications.show.bind(this.notifications);
    this.notifications.show = (message, type = 'info', duration) => {
      this.gameState.logNotification(message, type);
      // The Alerts tab already shows it live, so no pop-up on top of it
      if (this.activePanel === 'notifications') return null;
      return showToast(message, type, duration);
    };
    this.notificationsPanel = new NotificationsPanel(document.getElementById('panel-body'), this.gameState);
    this.gameState.on('notificationLogged', () => this.updateNotificationBadge());
    this.updateNotificationBadge();

    this.serverBuilder = new ServerBuilder(
      document.getElementById('modal-backdrop'),
      document.getElementById('modal-content'),
      this.gameState,
      this.notifications
    );

    this.guestbookPanel = new GuestbookPanel(
      document.getElementById('panel-body'),
      this.gameState,
      this.notifications,
      (method, failed) => this.showRequest(method, failed)
    );

    // "Try it yourself" in Goals opens the optional Guestbook panel
    this.goalsPanel = new GoalsPanel(document.getElementById('panel-body'), this.gameState, () => {
      this.activePanel = null;
      this.togglePanel('guestbook');
    }, () => this.startNextLevel(), (tab, place) => {
      // "Next up" action: open the builder on the right tab, or show the slot to place
      if (place) { this.closePanel(); this.resumePlacement(); return; }
      this.openServerBuilder(tab);
    });

    this.moneyPanel = new MoneyPanel(document.getElementById('panel-body'), this.gameState);
    this.levelsPanel = new LevelsPanel(document.getElementById('panel-body'), this.gameState, this.notifications, () => {
      this.activePanel = null;
      this.togglePanel('guestbook');
    });

    // (i) buttons anywhere on the page
    this.infoTips = new InfoTips();

    this.guide = new GuideBubble(document.getElementById('guide-bubble'), this.tutorial, this.gameState);
    this.levelIntro = new LevelIntro();
  }

  // ═══════════════════════════════════════════════════════════════
  // EVENT LISTENERS
  // ═══════════════════════════════════════════════════════════════

  setupEventListeners() {
    // ─── Nav Bar ───
    document.querySelectorAll('.nav-btn[data-panel]').forEach(btn => {
      btn.addEventListener('click', () => this.handleNav(btn.dataset.panel));
    });

    document.getElementById('panel-close-btn').addEventListener('click', () => this.closePanel());
    // Phones: tap the dimmed background or swipe the sheet down to close it
    document.getElementById('sheet-scrim')?.addEventListener('click', () => this.closePanel());
    this.setupSheetSwipe();

    // Click a machine chip in the top bar → its tab in the Server Builder
    this.gameState.on('openBuilder', ({ role }) => this.openServerBuilder(role));
    // Level card in the top bar → Goals
    this.gameState.on('openGoals', () => { if (this.activePanel !== 'goals') this.togglePanel('goals'); });
    // The Lv card in the top bar → everything about the level, dropping down from the card
    this.gameState.on('openLevel', () => this.toggleLevelPop());
    // Home: save and go back to the start screen (Continue / New Game → product list)
    this.gameState.on('goHome', () => this.goHome());
    // Coins in the top bar → Money panel
    this.gameState.on('openMoney', () => this.toggleMoneyPop());

    // ─── Game State Events ───
    this.gameState.on('levelUp', (data) => this.showLevelUpOverlay(data));
    this.gameState.on('levelComplete', (data) => {
      this.freezeLevel();
      this.showLevelCompleteOverlay(data);
    });
    this.gameState.on('serverUpgraded', () => {
      this.overloadWarned = false;
      // Re-check every part against the new server, so the next bottleneck gets a warning
      this.gameState.warnedParts = [];
      this.hud.update();
    });
    this.gameState.on('usersChanged', () => this.updateTraffic());

    // The "ship the feature" challenge: the player signs and reads themselves
    this.gameState.on('entryWritten', (data) => {
      if (data?.isPlayer) this.gameState.achievements.signed = true;
      this.checkChallenges();
    });
    this.gameState.on('entriesRead', () => {
      this.gameState.achievements.read = true;
      this.checkChallenges();
    });
  }

  /** A popover that grows out of the Lv card: the level's story, feature and notes. */
  toggleLevelPop(force = null) {
    if (!this.levelPop) {
      this.levelPop = document.createElement('div');
      this.levelPop.className = 'level-pop';
      this.levelPop.setAttribute('role', 'dialog');
      this.levelPop.hidden = true;
      document.body.appendChild(this.levelPop);
      document.addEventListener('click', (e) => {
        if (this.levelPop.hidden) return;
        if (this.levelPop.contains(e.target) || e.target.closest('#hud-level') || e.target.closest('.info-pop')) return;
        this.toggleLevelPop(false);
      });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.toggleLevelPop(false); });
      window.addEventListener('resize', () => this.positionLevelPop());
    }
    const open = force ?? this.levelPop.hidden;
    if (!open) {
      this.levelPop.hidden = true;
      document.getElementById('hud-level')?.classList.remove('open');
      return;
    }
    if (this.moneyPop && !this.moneyPop.hidden) this.toggleMoneyPop(false);
    this.renderLevelPop();
    this.levelPop.hidden = false;
    document.getElementById('hud-level')?.classList.add('open');
    this.positionLevelPop();
  }

  renderLevelPop() {
    if (!this.levelPop || this.levelPop.hidden === undefined) return;
    const scroll = this.levelPop.querySelector('.level-pop-body')?.scrollTop || 0;
    const product = getProduct(this.gameState.productId);
    this.levelPop.innerHTML = `<span class="level-pop-arrow" aria-hidden="true"></span>
      <div class="level-pop-body">
        ${this.presence?.online != null ? `<p class="lv-live"><span class="live-dot"></span>${this.presence.label(this.gameState.productId)}</p>` : ''}
        ${this.levelsPanel.renderAbout()}
        <div class="level-pop-more">
          <h4 class="goals-section">${product.icon} All ${product.levels.length} levels</h4>
          <ol class="lv-list">${this.levelsPanel.renderRoadmap()}</ol>
          <h4 class="goals-section">Your blueprint ${infoButton('blueprint')}</h4>
          ${this.levelsPanel.renderBlueprint()}
        </div>
      </div>`;
    this.levelPop.querySelector('#bp-copy')?.addEventListener('click', () => this.levelsPanel.copyBlueprint());
    this.levelPop.querySelector('#feat-try')?.addEventListener('click', () => {
      this.toggleLevelPop(false);
      this.activePanel = null;
      this.togglePanel('guestbook');
    });
    const body = this.levelPop.querySelector('.level-pop-body');
    if (body) body.scrollTop = scroll;
  }

  /** Money drops down from the Coins box, like the level info from the Lv card. */
  toggleMoneyPop(force = null) {
    if (!this.moneyPop) {
      this.moneyPop = document.createElement('div');
      this.moneyPop.className = 'level-pop money-pop';
      this.moneyPop.setAttribute('role', 'dialog');
      this.moneyPop.hidden = true;
      this.moneyPop.innerHTML = '<span class="level-pop-arrow" aria-hidden="true"></span><div class="level-pop-body"><div class="money-pop-inner"></div></div>';
      document.body.appendChild(this.moneyPop);
      this.moneyPopPanel = new MoneyPanel(this.moneyPop.querySelector('.money-pop-inner'), this.gameState);
      document.addEventListener('click', (e) => {
        if (this.moneyPop.hidden) return;
        if (this.moneyPop.contains(e.target) || e.target.closest('#hud-coins-btn') || e.target.closest('.info-pop')) return;
        this.toggleMoneyPop(false);
      });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.toggleMoneyPop(false); });
      window.addEventListener('resize', () => this.positionPop(this.moneyPop, 'hud-coins-btn'));
    }
    const open = force ?? this.moneyPop.hidden;
    document.getElementById('hud-coins-btn')?.classList.toggle('open', open);
    if (!open) { this.moneyPop.hidden = true; return; }
    this.toggleLevelPop(false);
    this.moneyPopPanel.render();
    this.moneyPop.hidden = false;
    this.positionPop(this.moneyPop, 'hud-coins-btn');
  }

  /** Place a popover under the element it opened from, with its pointer on that element. */
  positionPop(pop, anchorId) {
    const anchor = document.getElementById(anchorId);
    if (!anchor || !pop || pop.hidden) return;
    const r = anchor.getBoundingClientRect();
    const w = Math.min(380, window.innerWidth - 24);
    const left = Math.max(12, Math.min(window.innerWidth - w - 12, r.left + r.width / 2 - w / 2));
    pop.style.width = `${w}px`;
    pop.style.left = `${left}px`;
    pop.style.top = `${r.bottom + 10}px`;
    pop.style.maxHeight = `${window.innerHeight - r.bottom - 90}px`;
    pop.style.setProperty('--arrow-x', `${r.left + r.width / 2 - left}px`);
  }

  /** Centre the popover under the Lv card, inside the window. */
  positionLevelPop() {
    const card = document.getElementById('hud-level');
    if (!card || !this.levelPop || this.levelPop.hidden) return;
    const r = card.getBoundingClientRect();
    const w = Math.min(420, window.innerWidth - 24);
    const left = Math.max(12, Math.min(window.innerWidth - w - 12, r.left + r.width / 2 - w / 2));
    this.levelPop.style.width = `${w}px`;
    this.levelPop.style.left = `${left}px`;
    this.levelPop.style.top = `${r.bottom + 10}px`;
    this.levelPop.style.maxHeight = `${window.innerHeight - r.bottom - 90}px`;
    // The little arrow points at the card's centre
    this.levelPop.style.setProperty('--arrow-x', `${r.left + r.width / 2 - left}px`);
  }

  /** Show the live player count on the start screen and in the Lv popover. */
  renderPresence() {
    const el = document.getElementById('intro-live');
    const text = this.presence?.label();
    if (el) {
      el.hidden = !text;
      el.innerHTML = text ? `<span class="live-dot"></span>${text}` : '';
    }
    if (this.levelPop && !this.levelPop.hidden) this.renderLevelPop();
  }

  /** Show the level's intro card (once per level), then start the clock. */
  startLevelWithIntro() {
    const gs = this.gameState;
    if (gs.introSeenLevel === gs.level) {
      this.startGameLoop();
      return;
    }
    this.levelIntro.open(gs, () => {
      gs.introSeenLevel = gs.level;
      gs.save();
      this.guide.render();
      this.startGameLoop();
    });
  }

  /** Phones: drag a bottom sheet down by its header; far enough closes it. */
  setupSheetSwipe() {
    const sheet = document.getElementById('side-panel');
    const header = document.getElementById('panel-header');
    if (!sheet || !header) return;
    let startY = null;
    let dy = 0;
    header.addEventListener('touchstart', (e) => {
      if (window.innerWidth > 600) return;
      startY = e.touches[0].clientY;
      dy = 0;
      sheet.classList.add('dragging');
    }, { passive: true });
    header.addEventListener('touchmove', (e) => {
      if (startY === null) return;
      dy = Math.max(0, e.touches[0].clientY - startY);
      sheet.style.transform = `translateY(${dy}px)`;
    }, { passive: true });
    header.addEventListener('touchend', () => {
      if (startY === null) return;
      sheet.classList.remove('dragging');
      startY = null;
      if (dy > 90) this.closePanel();
      else sheet.style.transform = '';
    });
  }

  /** Save and return to the start screen. The game picks up where it was on Continue. */
  goHome() {
    this.stopGameLoop();
    this.gameState.save();
    location.reload();
  }

  /**
   * The level met everything it asked for: stop the clock. No more users,
   * spikes, revenue or costs, so the final results stay exactly as achieved.
   */
  freezeLevel() {
    this.stopGameLoop();
    const gs = this.gameState;
    gs.spike = null;
    gs.recalculateMetrics();
    if (this.tutorial.active) this.tutorial.finish();
    if (this.serverBuilder.isOpen) this.serverBuilder.close();
    gs.save();
    this.updateTraffic();
    this.hud.update();
    this.updateActivePanel();
  }

  /** Latch newly met challenges, celebrate them, and check the level. */
  checkChallenges() {
    const { newlyDone } = evaluateChallenges(this.gameState);
    for (const ch of newlyDone) {
      this.notifications.show(`🎯 Challenge done: ${ch.label}`, 'success', 4500);
    }
    if (newlyDone.length) {
      this.gameState.save();
      this.hud.update();
    }
    this.levelSystem.checkLevelUp();
  }

  handleNav(panelType) {
    if (panelType === 'server') {
      this.openServerBuilder();
      return;
    }
    this.togglePanel(panelType);
  }

  openServerBuilder(tab = null) {
    if (this.gameState.levelCompleted) {
      this.notifications.show('✅ This level is complete and paused. Start the next level from Goals.', 'info', 4000);
      return;
    }
    if (this.placing) {
      this.notifications.show(`Place your ${ROLES[this.placing].name.toLowerCase()} first: click the glowing slot.`, 'info', 3000);
      return;
    }
    this.serverBuilder.open(({ upgrade, role, extra }) => {
      if (extra) this.autoPlaceExtra(role);
      else if (!upgrade) this.startPlacement(role);
      this.updateActivePanel();
    }, tab);
  }

  /** The next level, if it's built and this one is done. */
  nextPlayableLevel() {
    const next = LEVELS[this.gameState.level];
    return next && !next.comingSoon ? next : null;
  }

  /** Move on to the next level: machines, data, users and coins carry over. */
  startNextLevel() {
    const next = this.nextPlayableLevel();
    if (!next || !this.gameState.levelCompleted) return;
    const overlay = document.getElementById('level-up-overlay');
    overlay.style.display = 'none';
    overlay.classList.remove('active');

    this.gameState.startLevel(next.level);
    this.overloadWarned = false;
    this.hud.render();
    this.diagram.update(true);
    this.tutorial.sync();
    this.guide.render();
    this.updateTraffic();
    this.updateActivePanel();
    this.startLevelWithIntro();
  }

  // ═══════════════════════════════════════════════════════════════
  // PANEL MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  togglePanel(panelType) {
    if (this.activePanel === panelType) {
      this.closePanel();
      return;
    }

    const titles = { guestbook: '📖 Guestbook App', goals: '🎯 Goals', levels: '🗺️ Levels', money: '💰 Money', notifications: '🔔 Notifications' };
    document.getElementById('panel-title').textContent = titles[panelType] || 'Panel';

    if (panelType === 'guestbook') this.guestbookPanel.render();
    if (panelType === 'goals') this.goalsPanel.render();
    if (panelType === 'levels') this.levelsPanel.render('all');
    if (panelType === 'level') {
      const L = this.gameState.levelDef();
      document.getElementById('panel-title').textContent = `📍 Level ${L.level}: ${L.name}`;
      this.levelsPanel.render('level');
    }
    if (panelType === 'money') this.moneyPanel.render();
    if (panelType === 'notifications') this.notificationsPanel.render();

    const sidePanel = document.getElementById('side-panel');
    sidePanel.classList.remove('closed');
    sidePanel.classList.add('open');
    sidePanel.style.transform = '';
    // Phones show panels as bottom sheets over a dimmed background
    document.body.classList.add('sheet-open');
    this.activePanel = panelType;

    document.querySelectorAll('.nav-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.panel === panelType);
    });
    this.guide.refreshHighlight();
  }

  closePanel() {
    const sidePanel = document.getElementById('side-panel');
    sidePanel.classList.remove('open');
    sidePanel.classList.add('closed');
    sidePanel.style.transform = '';
    document.body.classList.remove('sheet-open');
    this.activePanel = null;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    this.guide.refreshHighlight();
  }

  /** Unread count on the Notifications button (live list if that tab is open). */
  updateNotificationBadge() {
    if (this.activePanel === 'notifications') this.notificationsPanel.update();
    const badge = document.getElementById('nav-alerts-badge');
    if (!badge) return;
    const unread = this.gameState.unreadNotifications();
    badge.style.display = unread > 0 ? 'flex' : 'none';
    badge.textContent = unread > 99 ? '99+' : String(unread);
  }

  updateActivePanel() {
    if (this.activePanel === 'guestbook') this.guestbookPanel.update();
    if (this.activePanel === 'goals') this.goalsPanel.update();
    if (this.activePanel === 'levels' || this.activePanel === 'level') this.levelsPanel.update();
    if (this.levelPop && !this.levelPop.hidden && !document.querySelector('.info-pop:not([hidden])')) this.renderLevelPop();
    if (this.activePanel === 'money') this.moneyPanel.update();
    if (this.moneyPop && !this.moneyPop.hidden && !document.querySelector('.info-pop:not([hidden])')) {
      const body = this.moneyPop.querySelector('.level-pop-body');
      const top = body.scrollTop;
      this.moneyPopPanel.render();
      body.scrollTop = top;
    }
    if (this.activePanel === 'notifications') this.notificationsPanel.update();
  }

  // ═══════════════════════════════════════════════════════════════
  // SERVER PLACEMENT
  // ═══════════════════════════════════════════════════════════════

  /** Free tiles where a machine of this role may go (see ROLE_TILES). */
  placementTiles(role) {
    const used = new Set(this.gameState.placedComponents.map(c => `${c.gridX},${c.gridY}`));
    return (ROLE_TILES[role] || []).filter(t => !used.has(`${t.x},${t.y}`));
  }

  /** Ask the player to place a newly bought machine: its slot glows on the diagram. */
  startPlacement(role = 'app') {
    const tiles = this.placementTiles(role).slice(0, 1);
    if (!tiles.length) return;
    this.placing = role;
    this.diagram.setSlot(role);
    const name = this.gameState.hasDatabaseLevel() ? ROLES[role].name.toLowerCase() : 'server';
    this.notifications.show(`${ROLES[role].icon} Click the glowing slot to place your ${name}.`, 'info', 4000);
  }

  /** After a reload: any bought-but-not-placed machine goes back to placement. */
  resumePlacement() {
    const gs = this.gameState;
    for (const role of gs.availableRoles()) {
      if (gs.getServerConfig(role) && !gs.isPlaced(role)) {
        this.startPlacement(role);
        return;
      }
    }
  }

  placeMachine(role, gridX, gridY) {
    const gs = this.gameState;
    const id = gs.addComponent(ROLES[role].componentId, gridX, gridY);
    if (!id) return;
    this.placing = null;
    this.diagram.setSlot(null);
    gs.recalculateMetrics();
    const event = role === 'app' ? 'serverPlaced' : role === 'db' ? 'dbPlaced' : 'machinePlaced';
    gs.emit(event, { role, gridX, gridY });
    gs.save();
    const msg = role === 'app' && !gs.hasDatabaseLevel()
      ? '✅ Server is online!'
      : `✅ ${ROLES[role].name} is online and connected.`;
    this.notifications.show(msg, 'success', 4000);
    this.diagram.update();
    this.updateTraffic();
  }

  /** Extra app servers / database shards join their tier straight away. */
  autoPlaceExtra(role = 'app') {
    const tile = this.placementTiles(role)[0];
    if (!tile) return;
    const gs = this.gameState;
    const id = gs.addComponent(ROLES[role].componentId, tile.x, tile.y);
    if (!id) return;
    gs.recalculateMetrics();
    if (role === 'db') {
      const n = gs.dbCount();
      gs.emit('dbShardPlaced', { count: n });
      this.notifications.show(`🧱 Shard #${n} is online. Links are now split ${n} ways by their short code: ${n}× the disk space and write capacity.`, 'success', 5000);
    } else {
      gs.emit('appServerPlaced', { count: gs.appCount() });
      this.notifications.show(`🖥️ App server #${gs.appCount()} is online. The load balancer now splits traffic ${gs.appCount()} ways.`, 'success', 4500);
    }
    gs.save();
    this.diagram.update();
    this.updateTraffic();
  }

  autoPlaceExtraApp() {
    this.autoPlaceExtra('app');
  }

  // ═══════════════════════════════════════════════════════════════
  // GAME LOOP
  // ═══════════════════════════════════════════════════════════════

  startGameLoop() {
    this.isRunning = true;
    this.tickInterval = setInterval(() => {
      if (!this.gameState.isPaused) this.gameTick();
    }, this.tickRate);
  }

  stopGameLoop() {
    this.isRunning = false;
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  gameTick() {
    const gs = this.gameState;
    const seconds = this.tickRate / 1000;

    // Finished levels don't change any more
    if (gs.levelCompleted) return;

    // 0. Traffic spikes start and end
    const spike = this.spikes.tick(seconds);
    if (spike.started) this.onSpikeStarted(spike.started);
    if (spike.ended) this.onSpikeEnded(spike.ended);

    // 1. Users arrive or leave, coins come in (and are lost while requests fail)
    this.resourceManager.tick(this.levelSystem, seconds);

    // Level 1: everyone in town who wants it is here; growth stops
    const audience = gs.levelDef().audience;
    if (audience && gs.users >= audience && !gs.achievements.audienceReached) {
      gs.achievements.audienceReached = true;
      const who = gs.level === 1 ? `Everyone in town who wants ${getProduct(gs.productId).name === 'Guestbook' ? 'the Guestbook' : 'it'} is here` : 'Everyone who wants it right now is here';
      this.notifications.show(`🏘️ ${who} (${audience.toLocaleString()} users). Growth stops for this level: a good time to build headroom for spikes.`, 'info', 7000);
    }

    // 2. Users write new records (Guestbook entries, short links); spam that
    // gets past the gateway is stored too, so the data keeps growing
    if (gs.appLive && gs.isServerPlaced()) {
      const perSec = gs.serverStatus?.recordsPerSec ?? gs.users * gs.writesPerUser();
      const failing = gs.serverStatus?.diskFull ? 1 : 0;
      gs.guestbook.simulateVisitors(perSec * (1 - failing) * seconds);
    }

    // 3. Incidents (none in Level 1)
    if (this.levelSystem.getAvailableEvents().length > 0) {
      this.eventSystem.tick();
    }

    // 4. Recalculate server load
    gs.recalculateMetrics();
    this.checkPartWarnings();

    // 5. Challenges and level completion
    this.checkChallenges();
    // The guide moves past steps the player already did their own way
    this.tutorial.autoAdvance();

    // 6. Auto-save every ~30 seconds
    if (gs.tickCount % 15 === 0) gs.save();

    this.updateTraffic();
    this.updateActivePanel();
  }

  onSpikeStarted(incident) {
    const text = {
      spike: `📈 Traffic spike: ${incident.name}! ${incident.story} ×${incident.mult} traffic for ${incident.duration}s.`,
      bots: `🤖 ${incident.name}! ${incident.story} Bot traffic ×${incident.mult} for ${incident.duration}s.`,
      crash: `💥 ${incident.name}! ${incident.story} Down for ${incident.duration}s.`
    }[incident.kind] || `⚠️ ${incident.name}`;
    this.notifications.show(text, 'warning', 6000);
    this.hud.update();
    this.diagram.update();
  }

  onSpikeEnded(incident) {
    const revenue = Math.round(incident.revenue);
    const lost = Math.round(incident.lost);
    const what = { spike: 'spike', bots: 'bot attack', crash: 'crash' }[incident.kind] || 'incident';
    if (incident.handled) {
      const praise = {
        spike: `Your system kept up and earned ${revenue} coins during it.`,
        bots: 'Your gateway turned the bots away and real users never noticed.',
        crash: 'The other app servers picked up the work: users never noticed.'
      }[incident.kind];
      this.notifications.show(`✅ ${what[0].toUpperCase() + what.slice(1)} handled! ${praise}`, 'success', 6000);
    } else {
      const pct = Math.round(incident.avgError * 100);
      const gs = this.gameState;
      const advice = {
        spike: 'Leave more headroom before the next one.',
        bots: gs.isPlaced('gateway')
          ? 'Your gateway was swamped: it checks every bot request, so give it more CPU.'
          : 'An API gateway with rate limiting stops this.',
        crash: gs.appCount() > 1
          ? 'The remaining app servers did not have enough spare room. Add another, or make them bigger.'
          : 'With only one app server, a crash means the site is down. Run more behind a load balancer.'
      }[incident.kind];
      this.notifications.show(
        `🔥 The ${what} hurt: ${pct}% of requests failed, ${lost} coins lost, ${incident.usersLost} users left. ${advice}`,
        'error', 7000
      );
    }
    this.hud.update();
    this.diagram.update();
  }

  /** Tell the player when a part of any machine gets busy, or something is overloaded. */
  checkPartWarnings() {
    const gs = this.gameState;
    const status = gs.serverStatus;
    if (!status || !gs.appLive) return;
    const several = Object.keys(status.servers).length > 1;

    for (const [role, server] of Object.entries(status.servers)) {
      for (const partId of PART_ORDER) {
        const usage = server.usage[partId];
        const key = `${role}.${partId}`;
        const warned = gs.warnedParts.includes(key);
        if (usage >= 0.8 && !warned) {
          gs.warnedParts.push(key);
          gs.emit('partWarning', { role, partId, usage });
          // When the guide is waiting for this warning, it explains it instead
          if (!(this.tutorial.active && [].concat(this.tutorial.step?.advanceOn || []).includes('partWarning'))) {
            const part = SERVER_PARTS[partId];
            const who = several ? `${ROLES[role].icon} ${ROLES[role].name}: ` : '';
            this.notifications.show(`⚠️ ${who}${part.short} is at ${Math.round(usage * 100)}%. Fix it before it runs out.`, 'warning', 5000);
          }
        } else if (usage < 0.6 && warned) {
          gs.warnedParts = gs.warnedParts.filter(id => id !== key);
        }
      }
    }

    if (status.space?.capacity && status.space.pct >= 0.8 && !gs.warnedParts.includes('space')) {
      gs.warnedParts.push('space');
      const tidy = fixesForLevel(gs.level).find(f => ['archive', 'expiry'].includes(f.id) && !gs.codeFixes[f.id]);
      const tip = tidy ? ` Try ${tidy.icon} ${tidy.name} (Code fixes), or a bigger disk.` : ' Buy a bigger disk.';
      this.notifications.show(`💽 Disk is ${Math.round(status.space.pct * 100)}% full. When it's full, ${vocab('writeFails')}.${tip}`, 'warning', 7000);
    }

    if (status.collisionShare > 0 && !gs.warnedParts.includes('collision')) {
      gs.warnedParts.push('collision');
      this.notifications.show('🧬 Clashing codes! Each shard counts its own IDs, so two shards just made the same short code and a link broke. One ID generator for everyone fixes it.', 'error', 8000);
    } else if (!status.collisionShare && gs.warnedParts.includes('collision')) {
      gs.warnedParts = gs.warnedParts.filter(id => id !== 'collision');
    }

    if (status.peak > 1 && !this.overloadWarned) {
      this.overloadWarned = true;
      const part = SERVER_PARTS[status.busiest];
      const who = several ? `${ROLES[status.busiestRole].name}'s ` : '';
      this.notifications.show(`🔥 Overloaded! ${who}${part.short} is past 100%. Requests are failing and users are leaving.`, 'error', 5000);
    } else if (status.peak <= 0.95) {
      this.overloadWarned = false;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // TRAFFIC ANIMATION
  // ═══════════════════════════════════════════════════════════════

  /** The diagram animates requests; refresh its loads, rates and states. */
  updateTraffic() {
    this.diagram?.update();
  }

  /** Show the player's own Guestbook request travelling through the system. */
  showRequest(method, failed) {
    this.diagram?.pulse(method, failed);
  }

  // ═══════════════════════════════════════════════════════════════
  // OVERLAYS
  // ═══════════════════════════════════════════════════════════════

  showLevelCompleteOverlay(data) {
    this.notifications.clear();
    const overlay = document.getElementById('level-up-overlay');
    document.getElementById('level-up-number').textContent = data.level;
    overlay.querySelector('.level-up-title').textContent = 'LEVEL COMPLETE!';
    document.getElementById('level-up-name').textContent = data.name;

    const next = !data.next ? ''
      : data.nextPlayable
        ? `<div class="unlock-section"><h4>🔓 Next: Level ${data.next.level}</h4><ul><li><strong>${data.next.name}</strong>: ${data.next.subtitle}</li></ul></div>`
        : `<div class="unlock-section"><h4>🔒 Coming next</h4><ul><li>Level ${data.next.level}: ${data.next.name}, ${data.next.subtitle} (coming soon)</li></ul></div>`;
    const s = data.stats;
    const statsHtml = s ? `
      <div class="lc-stats">
        <div><span>Avg users online</span><strong>${s.avgUsers}</strong></div>
        <div><span>Est. daily users ${infoButton('dailyUsers')}</span><strong>${s.estDailyUsers.toLocaleString()}</strong></div>
        <div><span>Peak users</span><strong>${s.peakUsers}</strong></div>
        <div><span>Revenue</span><strong class="pos">+${s.revenue.toLocaleString()}</strong></div>
        <div><span>Server cost</span><strong class="neg">−${s.cost.toLocaleString()}</strong></div>
        <div><span>Profit</span><strong class="${s.profit >= 0 ? 'pos' : 'neg'}">${s.profit.toLocaleString()}</strong></div>
        <div><span>Lost to failures ${infoButton('lostRevenue')}</span><strong class="neg">−${s.lost.toLocaleString()}</strong></div>
        <div><span>Outage penalties</span><strong class="neg">−${s.penalties.toLocaleString()}</strong></div>
        <div><span>Uptime · Reputation ${infoButton('reputation')}</span><strong>${s.uptime}% · ${s.reputation}</strong></div>
      </div>` : '';
    const f = data.funding;
    const fundingHtml = f && f.amount > 0 ? `
      <div class="lc-funding">
        <div class="lc-funding-head">
          <span class="lc-funding-icon">💸</span>
          <div>
            <span class="lc-funding-round">${f.round} ${infoButton('funding')}</span>
            <strong class="lc-funding-amount">+${f.amount.toLocaleString()} coins</strong>
          </div>
        </div>
        <p class="lc-funding-why">
          ${f.investor} put in ${f.amount.toLocaleString()}: a ${f.base.toLocaleString()} round to fund the next stage,
          ×${f.usersFactor} for your users (avg ${s.avgUsers.toLocaleString()} vs a target of ${(data.userTarget || 0).toLocaleString()})
          and ×${f.profitFactor} because you kept ${f.margin}% of revenue as profit.
          ${f.reliabilityCut > 0
            ? `They cut ${f.reliabilityCut.toLocaleString()} because of your outages (reliability ${f.reliability}%).`
            : 'No outages: full amount!'}
          Valuation: ${f.valuation.toLocaleString()} coins.
        </p>
      </div>` : '';
    document.getElementById('level-up-unlocks').innerHTML = `
      <p class="level-complete-message">${linkTerms(data.completionMessage)}</p>
      ${fundingHtml}
      ${statsHtml}
      ${next}
      <p class="level-complete-hint">${data.next
        ? '⏸ Your system handled everything this level asked for, so the level is paused at these results. Machines, data, users and coins carry over to the next level.'
        : '🏆 You finished every level of this product, from one garage server to a global system. More products are coming soon.'}</p>`;

    overlay.style.display = 'flex';
    overlay.classList.add('active');
    overlay.style.animation = 'fade-in 0.5s ease-out';
    const btn = document.getElementById('level-up-continue');
    if (data.nextPlayable) {
      btn.textContent = `Start Level ${data.next.level} →`;
      btn.onclick = () => this.startNextLevel();
    } else {
      btn.textContent = 'Continue';
      btn.onclick = () => {
        overlay.style.animation = 'fade-out 0.3s ease-out forwards';
        setTimeout(() => { overlay.style.display = 'none'; overlay.classList.remove('active'); }, 300);
      };
    }
    this.hud.update();
  }

  showLevelUpOverlay(data) {
    const overlay = document.getElementById('level-up-overlay');
    document.getElementById('level-up-number').textContent = data.level;
    overlay.querySelector('.level-up-title').textContent = 'LEVEL UP!';
    document.getElementById('level-up-name').textContent = data.name;

    let unlockHtml = '<h3>New Unlocks:</h3>';
    if (data.newComponents && data.newComponents.length > 0) {
      unlockHtml += '<div class="unlock-section"><h4>🏗️ Components</h4><ul>';
      for (const comp of data.newComponents) unlockHtml += `<li>${comp.icon} ${comp.name}</li>`;
      unlockHtml += '</ul></div>';
    }
    if (data.newFeatures && data.newFeatures.length > 0) {
      unlockHtml += '<div class="unlock-section"><h4>✨ Features</h4><ul>';
      for (const feature of data.newFeatures) unlockHtml += `<li>${feature}</li>`;
      unlockHtml += '</ul></div>';
    }
    document.getElementById('level-up-unlocks').innerHTML = unlockHtml;

    overlay.style.display = 'flex';
    overlay.classList.add('active');
    overlay.style.animation = 'fade-in 0.5s ease-out';
    document.getElementById('level-up-continue').onclick = () => {
      overlay.style.animation = 'fade-out 0.3s ease-out forwards';
      setTimeout(() => { overlay.style.display = 'none'; overlay.classList.remove('active'); }, 300);
    };
    this.notifications.showLevelUp?.(data.level, data.name);
  }

  // ═══════════════════════════════════════════════════════════════
  // INTRO PARTICLES (Welcome screen background)
  // ═══════════════════════════════════════════════════════════════

  animateIntroParticles() {
    const canvas = document.getElementById('intro-particles');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 0.5,
        speedX: (Math.random() - 0.5) * 0.5,
        speedY: (Math.random() - 0.5) * 0.5,
        opacity: Math.random() * 0.5 + 0.1,
        color: ['#06d6a0', '#e040fb', '#3b82f6', '#fbbf24'][Math.floor(Math.random() * 4)],
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(6, 214, 160, ${0.1 * (1 - dist / 150)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        p.x += p.speedX;
        p.y += p.speedY;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
      }

      this.introParticleId = requestAnimationFrame(animate);
    };

    animate();

    window.addEventListener('resize', () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  const game = new ScaleArchitect();
  game.init();

  // Expose for debugging
  window.__game = game;
});
document.getElementById('btn-feedback')?.addEventListener('click', () => openFeedback('home screen'));
