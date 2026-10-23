/**
 * levels.js — Scale Architect Level Progression
 *
 * Mirrors real-world startup architecture evolution:
 *   1. The Garage        — Single monolith, get your first users
 *   2. Separate the DB   — App server + database server, growing data
 *   3. Split the UI      — Web server for pages, app server for the API
 *   4. Guard the Door    — API gateway with rate limiting (bots)
 *   5. Scale Out         — Load balancer + several app servers (crashes)
 *   6. Cache It          — Cache in front of the database
 *   7. Go Global         — CDN close to users worldwide
 */

export const GUESTBOOK_LEVELS = [
    // -----------------------------------------------------------------
    // Level 1: The Garage — Single Machine
    // -----------------------------------------------------------------
    {
        level: 1,
        name: 'The Garage',
        subtitle: 'One server does everything',
        intro: 'Every big system starts as one machine. Build yours.',
        // 'single-server' = you build one machine from CPU/RAM/Storage/Network parts
        mode: 'single-server',
        serverMode: true,
        userTarget: 100,
        userGrowthRate: 2,
        // Only this many people will ever use it (your town). Growth stops here,
        // so you can build headroom for spikes instead of always being full.
        audience: 130,
        // Spikes add 20–40% traffic in Level 1 (later levels: 50–100%)
        spikeRange: [1.2, 1.4],
        startingCoins: 500,
        coinRate: 25,
        computeBudget: 60,
        unlockedComponentIds: ['monolith'],
        unlockedFeatures: ['Guestbook'],
        // The app feature your server runs this level (shown in Goals)
        feature: {
            name: 'Guestbook',
            summary: 'Anyone can read every entry and sign it with their name.',
            endpoints: [
                { method: 'GET', path: '/entries', does: 'Read every entry', rate: 'readsPerSec' },
                { method: 'POST', path: '/entries', does: 'Sign with your name', rate: 'writesPerSec' }
            ]
        },
        requiredComponents: ['monolith'],
        replacesComponents: [],
        eventIds: [],
        story:
            "Every big system starts as one machine. Build your first server, launch a tiny Guestbook where anyone can read every entry and sign with their name, then grow it to 100 users.",
        completionMessage:
            'Your single server handles 100 users! You grew it by buying a bigger machine (vertical scaling). But one machine has a ceiling, and if it dies everything dies. Next: splitting things apart.'
    },

    // -----------------------------------------------------------------
    // Level 2: Separate the Database — app server + database server
    // -----------------------------------------------------------------
    {
        level: 2,
        name: 'Separate the Database',
        subtitle: 'Give your data its own machine',
        intro: 'Your Guestbook went viral, and the data is fighting your app for the one machine.',
        mode: 'app-db',
        serverMode: true,
        userTarget: 400,
        userGrowthRate: 4,
        startingCoins: 0, // you keep your coins from Level 1
        coinRate: 7,
        // Visitors sign far more often now, so the data grows fast
        writesPerUser: 0.02,
        computeBudget: 120,
        unlockedComponentIds: ['database'],
        unlockedFeatures: ['Database server', 'Pagination', 'Database index'],
        unlockedFixes: ['pagination', 'index'],
        requiredComponents: ['monolith', 'database'],
        replacesComponents: [],
        eventIds: [],
        feature: {
            name: 'Guestbook (busier)',
            summary: 'Same app, many more signatures. Every entry makes "read all" heavier and fills the disk.',
            endpoints: [
                { method: 'GET', path: '/entries', does: 'Read every entry', rate: 'readsPerSec' },
                { method: 'POST', path: '/entries', does: 'Sign with your name', rate: 'writesPerSec' }
            ]
        },
        story:
            "Your Guestbook went viral. Signatures pour in, and your one server is doing everything: serving pages AND storing data. Give the data its own machine, then keep up as the data grows.",
        completionMessage:
            'You split your system into an app server and a database server, and learned that some problems need better code (pagination, an index), not just bigger machines. But you still have exactly one of each: if either dies, the site is down.'
    },


    // -----------------------------------------------------------------
    // Level 3: Split the UI — a web server for the interface
    // -----------------------------------------------------------------
    {
        level: 3,
        name: 'Split the UI',
        subtitle: 'A web server for pages, the app server for the API',
        intro: 'A heavy new UI: every page is 300 KB, and your app server is busy shipping files.',
        mode: 'app-db',
        serverMode: true,
        userTarget: 600,
        userGrowthRate: 5,
        startingCoins: 0,
        coinRate: 5,
        writesPerUser: 0.005,
        dbReadCost: 0.1,
        // The new rich interface: users load pages (HTML, JS, images) on top of API calls
        pageViewsPerUser: 0.03,
        pageKB: 300,
        computeBudget: 120,
        unlockedComponentIds: ['frontend_server'],
        unlockedFeatures: ['Web (UI) server', 'Rich UI with avatars'],
        requiredComponents: ['frontend_server'],
        replacesComponents: [],
        eventIds: [],
        feature: {
            name: 'Guestbook with a rich UI',
            summary: 'A new interface with avatars and animations. Every page view sends ~300 KB of HTML, JavaScript and images; the API now only sends small JSON.',
            endpoints: [
                { method: 'PAGE', path: '/', does: 'Load the interface (300 KB)', rate: 'pagesPerSec' },
                { method: 'GET', path: '/api/entries', does: 'Read entries (JSON)', rate: 'readsPerSec' },
                { method: 'POST', path: '/api/entries', does: 'Sign with your name', rate: 'writesPerSec' }
            ]
        },
        story:
            'Your designers shipped a beautiful new interface. It is also heavy: every page view is ~300 KB of HTML, JavaScript and images, and your app server is now busy shipping files instead of answering API calls.',
        completionMessage:
            'The UI and the API now live on different machines: pages come from a web server built for files, and the app server only answers API calls. Each can be sized for its own job.'
    },

    // -----------------------------------------------------------------
    // Level 4: Guard the Door — API gateway with rate limiting
    // -----------------------------------------------------------------
    {
        level: 4,
        name: 'Guard the Door',
        subtitle: 'An API gateway with rate limiting',
        intro: 'Bots found your API. They call it non-stop and never pay.',
        mode: 'app-db',
        serverMode: true,
        userTarget: 600,
        userGrowthRate: 5,
        startingCoins: 0,
        coinRate: 6,
        writesPerUser: 0.005,
        dbReadCost: 0.1,
        pageViewsPerUser: 0.03,
        pageKB: 300,
        // Scrapers and bots: extra read requests per real read, earning nothing
        botShare: 1.5,
        computeBudget: 120,
        unlockedComponentIds: ['rate_limiter'],
        unlockedFeatures: ['API gateway', 'Rate limiting'],
        requiredComponents: ['rate_limiter'],
        replacesComponents: [],
        eventIds: [],
        feature: {
            name: 'Guestbook under attack',
            summary: 'Scrapers and bots found your API. They call it non-stop, use your servers and pay nothing. Real users suffer.',
            endpoints: [
                { method: 'PAGE', path: '/', does: 'Load the interface', rate: 'pagesPerSec' },
                { method: 'GET', path: '/api/entries', does: 'Read entries (users)', rate: 'readsPerSec' },
                { method: 'BOT', path: '/api/entries', does: 'Bot and scraper calls', rate: 'botsPerSec' },
                { method: 'POST', path: '/api/entries', does: 'Sign with your name', rate: 'writesPerSec' }
            ]
        },
        story:
            'Scrapers discovered your API. Bots hammer GET /api/entries hundreds of times a minute, eating CPU and bandwidth that should go to real users, and they never bring in a coin.',
        completionMessage:
            'Every API request now passes through a gateway that knows who is calling and how often. Abusive clients get "429 Too Many Requests" before they ever reach your app.'
    },

    // -----------------------------------------------------------------
    // Level 5: Scale Out — load balancer + several app servers
    // -----------------------------------------------------------------
    {
        level: 5,
        name: 'Scale Out',
        subtitle: 'More app servers behind a load balancer',
        intro: '1,500 users want in: more than any one server can take. And servers crash.',
        mode: 'app-db',
        serverMode: true,
        userTarget: 1500,
        userGrowthRate: 12,
        startingCoins: 0,
        coinRate: 7,
        writesPerUser: 0.005,
        dbReadCost: 0.1,
        pageViewsPerUser: 0.03,
        pageKB: 300,
        botShare: 1.5,
        crashes: true,
        computeBudget: 120,
        unlockedComponentIds: ['load_balancer'],
        unlockedFeatures: ['Load balancer', 'Multiple app servers'],
        requiredComponents: ['load_balancer'],
        replacesComponents: [],
        eventIds: [],
        story:
            'You are on the news. 1,500 people want in, and even the biggest app server tops out around 500. You cannot buy a bigger machine; you need more machines. And machines crash: with only one, a crash means the site is down.',
        completionMessage:
            'Horizontal scaling: several app servers share the work, and the load balancer routes around any that crash. Need more capacity? Add another server instead of hunting for a bigger one.'
    },

    // -----------------------------------------------------------------
    // Level 6: Cache It — a cache in front of the database
    // -----------------------------------------------------------------
    {
        level: 6,
        name: 'Cache It',
        subtitle: 'Keep hot data in memory',
        intro: 'Readers refresh constantly, and every read lands on your one database.',
        mode: 'app-db',
        serverMode: true,
        userTarget: 2500,
        userGrowthRate: 15,
        startingCoins: 0,
        coinRate: 8,
        writesPerUser: 0.005,
        dbReadCost: 0.1,
        pageViewsPerUser: 0.03,
        pageKB: 300,
        botShare: 1.5,
        crashes: true,
        // Readers refresh far more: the newest entries are read over and over
        readsPerUser: 0.3,
        computeBudget: 120,
        unlockedComponentIds: ['redis_cache'],
        unlockedFeatures: ['Cache'],
        requiredComponents: ['redis_cache'],
        replacesComponents: [],
        eventIds: [],
        story:
            'People now refresh the Guestbook constantly to see new entries. You can add app servers, but there is only one database, and every read lands on it. It is maxing out and latency is creeping up.',
        completionMessage:
            'Most reads now come from memory in the cache and never touch the database. The same few hot entries were being read thousands of times; now the database only sees cache misses and writes.'
    },

    // -----------------------------------------------------------------
    // Level 7: Go Global — a CDN close to users everywhere
    // -----------------------------------------------------------------
    {
        level: 7,
        name: 'Go Global',
        subtitle: 'Serve users near where they are',
        intro: '60% of your users are on other continents, 120 ms away.',
        mode: 'app-db',
        serverMode: true,
        userTarget: 3500,
        userGrowthRate: 20,
        startingCoins: 0,
        coinRate: 4,
        writesPerUser: 0.005,
        dbReadCost: 0.1,
        pageViewsPerUser: 0.03,
        pageKB: 300,
        botShare: 1.5,
        crashes: true,
        readsPerUser: 0.3,
        // Share of users on other continents, and the extra round-trip time they pay
        globalShare: 0.6,
        distanceMs: 120,
        computeBudget: 120,
        unlockedComponentIds: ['cdn'],
        unlockedFeatures: ['CDN'],
        requiredComponents: ['cdn'],
        replacesComponents: [],
        eventIds: [],
        story:
            'The Guestbook is popular worldwide. 60% of users are on other continents, and every request crosses an ocean: about 120 ms before your servers even start working.',
        completionMessage:
            'A CDN keeps copies of your pages and popular reads in cities around the world. Far-away users get answers from a server near them, and your origin servers only see what the edge cannot answer. You built a real web-scale architecture!'
    }
];

/**
 * The levels of the product being played. A live binding: js/products/registry.js
 * swaps it when the player picks a product, and every importer sees the new list.
 */
export let LEVELS = GUESTBOOK_LEVELS;

export function setLevels(levels) {
  LEVELS = levels;
}
