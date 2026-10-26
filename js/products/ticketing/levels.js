/**
 * Ticket booking (like Ticketmaster) — the levels.
 *
 * Main source: Hello Interview "Design Ticketmaster" (study notes in
 * tools/designgame/library/05-ticketmaster.md on v3), filled in with
 * ByteByteGo and public talks (see docs/products/ticketing.md).
 *
 *   1. First Show            — one server shows events and books seats
 *   2. Thousands of Seats    — own database, an index on (event, seat)
 *   3. Sold Twice            — hold seats during checkout (reserve with a TTL)
 *   4. Scalper Bots          — API gateway rate-limits seat-map scrapers
 *   5. Big Night Out         — app servers behind a load balancer
 *   6. Same Page, Every Fan  — cache the event, venue and seat-map data
 *   7. Find the Show         — a search index instead of LIKE '%…%'
 *   8. The Mega On-Sale      — a virtual waiting room (queue)
 *
 * Traffic is "per online user per second"; `realWorld` notes give real numbers.
 */

const LOOKUP = { readKind: 'lookup', appCallCost: 0.25 }; // small JSON calls

export const TICKETING_LEVELS = [
  {
    level: 1,
    name: 'First Show',
    subtitle: 'One server shows events and books seats',
    intro: 'A local venue wants to sell tickets online, and one machine does everything.',
    mode: 'single-server',
    serverMode: true,
    userTarget: 100,
    userGrowthRate: 2,
    audience: 125,
    spikeRange: [1.2, 1.4],
    startingCoins: 500,
    coinRate: 25,
    ...LOOKUP,
    readsPerUser: 0.2,
    writesPerUser: 0.01,
    unlockedComponentIds: ['monolith'],
    unlockedFeatures: ['Event page', 'Seat map', 'Book a seat'],
    feature: {
      name: 'View and book',
      summary: 'Fans open an event, look at the seat map and book a seat. Browsing is far more common than booking.',
      endpoints: [
        { method: 'GET', path: '/api/events/:id', does: 'Event, venue and seat map', rate: 'readsPerSec' },
        { method: 'POST', path: '/api/bookings', does: 'Book the chosen seats', rate: 'writesPerSec' }
      ]
    },
    realWorld: [
      'Ticket sites are read-heavy: about 100 views for every booking.',
      'A small venue\'s box office fits on one $20/month VM running the app and PostgreSQL together.'
    ],
    story: 'A local venue wants to sell its shows online. One machine shows events and seat maps and books seats. Open it up and grow to 100 fans.',
    completionMessage: 'One server sells tickets to 100 fans. But every seat of every show is a row, and they pile up fast. Next: give the data its own database.'
  },

  {
    level: 2,
    name: 'Thousands of Seats',
    subtitle: 'Own database, an index on (event, seat)',
    intro: 'Every show adds thousands of ticket rows, and each seat map scans them all.',
    mode: 'app-db',
    serverMode: true,
    userTarget: 400,
    userGrowthRate: 4,
    audience: 500,
    startingCoins: 0,
    coinRate: 4.5,
    ...LOOKUP,
    readsPerUser: 0.2,
    writesPerUser: 0.01,
    dbReadCost: 0.12,
    unlockedComponentIds: ['database'],
    unlockedFeatures: ['Database server', 'Index on (event, seat)'],
    feature: {
      name: 'Tickets as rows',
      summary: 'Each seat of each event is a ticket row with a status: available or booked. A seat map reads every ticket of one event.',
      endpoints: [
        { method: 'GET', path: '/api/events/:id', does: 'Event + its tickets for the seat map', rate: 'readsPerSec' },
        { method: 'POST', path: '/api/bookings', does: 'Mark tickets booked, insert a booking', rate: 'writesPerSec' }
      ]
    },
    realWorld: [
      'Tickets are created with the event: a 20,000-seat arena show is 20,000 rows.',
      'Booking needs ACID transactions, so ticket sites keep events, tickets and bookings in one relational database (PostgreSQL).'
    ],
    story: 'More venues joined. Each show adds thousands of ticket rows, and every seat map scans all of them on the same machine that runs your code. Move the data to its own database.',
    completionMessage: 'The database holds every ticket, and the index finds one event\'s seats directly. Next: two fans just bought the same seat.'
  },

  {
    level: 3,
    name: 'Sold Twice',
    subtitle: 'Hold seats while fans pay',
    intro: 'Paying takes minutes, and two fans can pick the same seat in the meantime.',
    mode: 'app-db',
    serverMode: true,
    userTarget: 600,
    userGrowthRate: 6,
    audience: 750,
    startingCoins: 0,
    coinRate: 6,
    ...LOOKUP,
    readsPerUser: 0.2,
    writesPerUser: 0.015,
    dbReadCost: 0.12,
    clashShare: 0.12,
    unlockedComponentIds: [],
    unlockedFeatures: ['Seat holds (reserve, then confirm)'],
    feature: {
      name: 'Reserve, then confirm',
      summary: 'Booking splits in two: reserve the seats for 10 minutes, then confirm them when the payment goes through.',
      endpoints: [
        { method: 'GET', path: '/api/events/:id', does: 'Seat map (held seats show as taken)', rate: 'readsPerSec' },
        { method: 'POST', path: '/api/bookings', does: 'Reserve seats until now + 10 min', rate: 'writesPerSec' }
      ]
    },
    realWorld: [
      'Holding a database row lock for the whole checkout (SELECT FOR UPDATE for minutes) causes deadlocks and orphaned locks.',
      'Ticketmaster-style holds: a ticket is free if AVAILABLE, or RESERVED with an expiry in the past. Or a Redis lock: SET ticket user NX EX 600.'
    ],
    story: 'Fans complain: they typed in their card, paid, and then heard the seat was gone. Paying takes minutes, and in that time someone else bought the same seat. Hold seats during checkout.',
    completionMessage: 'A picked seat is held for 10 minutes, then confirmed or released. No seat is sold twice. Next: someone is scraping your seat maps.'
  },

  {
    level: 4,
    name: 'Scalper Bots',
    subtitle: 'An API gateway rate-limits scrapers',
    intro: 'Scalper bots refresh the seat maps nonstop, looking for good seats to resell.',
    mode: 'app-db',
    serverMode: true,
    userTarget: 800,
    userGrowthRate: 8,
    audience: 1000,
    startingCoins: 0,
    coinRate: 5.5,
    ...LOOKUP,
    readsPerUser: 0.15,
    writesPerUser: 0.01,
    dbReadCost: 0.12,
    clashShare: 0.12,
    botShare: 2.5,
    unlockedComponentIds: ['rate_limiter'],
    unlockedFeatures: ['API gateway', 'Rate limiting'],
    realWorld: [
      'Ticketmaster has said bots made billions of requests in a single big on-sale.',
      'Gateways rate-limit per account and per IP (token bucket) and answer the rest with 429, before the request touches your servers.'
    ],
    story: 'Scalpers found your API: for every real fan, bots load the seat map two or three times more, hunting for good seats to resell. They never buy at face value. Put an API gateway at the front door.',
    completionMessage: 'The gateway turns most bot calls away before they cost you anything. Next: a big night, and one app server isn\'t enough.'
  },

  {
    level: 5,
    name: 'Big Night Out',
    subtitle: 'App servers behind a load balancer',
    intro: 'Fans browse 100 times for every booking, and one crash closes the box office.',
    mode: 'app-db',
    serverMode: true,
    userTarget: 1800,
    userGrowthRate: 12,
    audience: 2300,
    startingCoins: 0,
    coinRate: 5,
    ...LOOKUP,
    readsPerUser: 0.25,
    writesPerUser: 0.008,
    dbReadCost: 0.05,
    clashShare: 0.12,
    botShare: 1,
    crashes: true,
    keepRecords: 3000,
    unlockedComponentIds: ['load_balancer'],
    unlockedFeatures: ['Load balancer', 'More app servers', 'Archive past shows'],
    realWorld: [
      'The event service is stateless: any server can render any event, so a load balancer (round robin or least connections) spreads fans and skips a crashed one.',
      'Shows that already happened don\'t need to be in the hot database: move their tickets to cheap storage.'
    ],
    story: 'Your site is the place to buy tickets in town: 1,800 fans browse at once, 100 views per booking. One app server can\'t keep up, and when it crashes nobody can buy. Scale out.',
    completionMessage: 'Stateless app servers share the browsing, and old shows are archived. Next: every fan loads the same event page from the database.'
  },

  {
    level: 6,
    name: 'Same Page, Every Fan',
    subtitle: 'Cache the event and venue data',
    intro: 'Thousands of fans load the same event page, and each load hits the database.',
    mode: 'app-db',
    serverMode: true,
    userTarget: 2500,
    userGrowthRate: 15,
    audience: 3200,
    startingCoins: 0,
    coinRate: 5.5,
    ...LOOKUP,
    readsPerUser: 0.3,
    writesPerUser: 0.008,
    dbReadCost: 0.25,
    clashShare: 0.12,
    botShare: 1,
    crashes: true,
    keepRecords: 3000,
    cacheHitRate: 0.9,
    unlockedComponentIds: ['redis_cache'],
    unlockedFeatures: ['Event cache'],
    realWorld: [
      'Events, venues and performers almost never change: cache them as eventId → object in Redis with a long TTL.',
      'Seat availability changes, so it gets a short TTL (or is invalidated when a ticket is sold).'
    ],
    story: 'A popular tour is on sale and everyone opens the same few event pages. Each page joins events, venues and tickets in the database, again and again. Keep the event data in a cache.',
    completionMessage: 'Most event pages come straight from memory, and the database only sees misses and bookings. Next: fans can\'t find the show they want.'
  },

  {
    level: 7,
    name: 'Find the Show',
    subtitle: 'A search index instead of scanning',
    intro: 'Fans search by artist and city, and each search scans every event.',
    mode: 'app-db',
    serverMode: true,
    userTarget: 3000,
    userGrowthRate: 15,
    audience: 3800,
    startingCoins: 0,
    coinRate: 6,
    ...LOOKUP,
    readsPerUser: 0.28,
    writesPerUser: 0.008,
    dbReadCost: 0.2,
    clashShare: 0.12,
    botShare: 0.5,
    crashes: true,
    keepRecords: 3000,
    cacheHitRate: 0.9,
    searchPerUser: 0.06,
    unlockedComponentIds: [],
    unlockedFeatures: ['Search events', 'Search index'],
    feature: {
      name: 'Search',
      summary: 'Fans search events by keyword, date and place. "Taylor" should find "Taylor Swift | The Eras Tour", even spelled "Tayler".',
      endpoints: [
        { method: 'GET', path: '/api/events/search?q=…', does: 'Events matching the keywords', rate: 'searchesPerSec' },
        { method: 'GET', path: '/api/events/:id', does: 'Event page and seat map', rate: 'readsPerSec' },
        { method: 'POST', path: '/api/bookings', does: 'Reserve seats', rate: 'writesPerSec' }
      ]
    },
    realWorld: [
      'LIKE \'%taylor%\' can\'t use a B-tree index: the database reads every row.',
      'Ticket sites use Elasticsearch (an inverted index with fuzzy matching), kept in sync with the database by change data capture. Search should answer in under 500 ms.'
    ],
    story: 'You now list thousands of shows, and fans search instead of browsing. Each search runs LIKE \'%taylor%\' over every event, and the database is drowning. Build a search index.',
    completionMessage: 'Searches go to an index of words, not a scan of rows. Next: the biggest tour of the year goes on sale.'
  },

  {
    level: 8,
    name: 'The Mega On-Sale',
    subtitle: 'A virtual waiting room',
    intro: 'Millions want the same tickets at 10:00, and they all press "book" at once.',
    mode: 'app-db',
    serverMode: true,
    userTarget: 3500,
    userGrowthRate: 20,
    audience: 4400,
    startingCoins: 0,
    coinRate: 5.5,
    ...LOOKUP,
    readsPerUser: 0.25,
    writesPerUser: 0.008,
    dbReadCost: 0.2,
    clashShare: 0.12,
    botShare: 0.5,
    crashes: true,
    keepRecords: 3000,
    cacheHitRate: 0.9,
    searchPerUser: 0.05,
    rushPerUser: 0.2,
    unlockedComponentIds: ['message_queue'],
    unlockedFeatures: ['Virtual waiting room'],
    feature: {
      name: 'On-sale day',
      summary: 'When a huge tour goes on sale, fans join a waiting room, see their place in line, and are let in to book a batch at a time.',
      endpoints: [
        { method: 'POST', path: '/api/queue/:eventId', does: 'Join the waiting room', rate: 'rushPerSec' },
        { method: 'GET', path: '/api/events/:id', does: 'Seat map (admitted fans)', rate: 'readsPerSec' },
        { method: 'POST', path: '/api/bookings', does: 'Reserve seats (admitted fans only)', rate: 'writesPerSec' }
      ]
    },
    realWorld: [
      'The 2022 Eras Tour presale drew about 14 million fans and 3.5 billion system requests, four times Ticketmaster\'s previous peak.',
      'Waiting rooms keep fans in a Redis sorted set by arrival time, push their position over SSE, and admit them in batches. The booking service rejects anyone not admitted.'
    ],
    story: 'The biggest tour of the year goes on sale at 10:00. Every fan presses "book" again and again, and each press checks seat locks in the database. Seats are scarce; patience is not. Put fans in a waiting room.',
    completionMessage: 'Fans wait in line, see their place, and book when it\'s their turn. The booking system sees a steady stream instead of a stampede. You built Ticketmaster.'
  }
];
