/**
 * Ticket booking — words and explanations that differ from the Guestbook's.
 */

export const TICKETING_VOCAB = {
  record: 'ticket',
  records: 'tickets',
  writeFails: 'every booking fails',
  readName: 'seat map'
};

export const TICKETING_INCIDENTS = {
  spike: [
    { name: 'Tour announced', story: 'A world tour was just announced: everyone is checking dates.', mult: 1.5 },
    { name: 'Extra date added', story: 'A sold-out show added a second night. Fans rush back in.', mult: 1.8 },
    { name: 'Presale code leaked', story: 'A presale code is all over social media.', mult: 2.0, minUsers: 80 }
  ],
  bots: [
    { name: 'Scalper swarm', story: 'Thousands of scalper bots are reloading the seat map of a hot show.', mult: 3 },
    { name: 'Resale bot farm', story: 'A bot farm is grabbing seat maps to find seats to resell.', mult: 4 }
  ],
  crash: [
    { name: 'App server crashed', story: 'One of your app servers ran out of memory and crashed. It is restarting.', crashed: 1 },
    { name: 'Hardware failure', story: 'A disk died in one of your app servers. It is being replaced.', crashed: 1 }
  ]
};

export const TICKETING_ROLE_TEXT = {
  db: { job: 'Stores events, venues, one ticket per seat, and bookings, with transactions so a seat is sold once.' },
  cache: { job: 'Keeps event, venue and seat-map data in memory, so popular pages skip the database. Also caches repeated searches.' },
  queue: { job: 'The virtual waiting room: fans wait in arrival order and are let in to book a batch at a time.', short: 'Waiting room' },
  gateway: { job: 'Front door for every API call. Rate limiting turns away scalper bots that reload seat maps nonstop.' },
  lb: { job: 'Spreads fans across your app servers and skips any that are down.' }
};

export const TICKETING_PART_TEXT = {
  storage: { whatItDoes: 'Where tickets and bookings are saved so they survive a restart. Its speed decides how many reads and writes per second it can do.' }
};

export const TICKETING_FIX_TEXT = {
  index: {
    name: 'Index on (event, seat)',
    short: 'Index tickets by (event_id, seat), so a seat map reads only that event\'s tickets.',
    effect: 'Database CPU, disk reads and latency stop growing with the number of tickets. Each new ticket costs a little more.'
  },
  archive: {
    name: 'Archive past shows',
    short: 'Move tickets of shows that already happened out of the hot database into cheap cold storage.',
    effect: 'The hot ticket table stops growing: disk space and scans stay flat. Old bookings are still there for receipts.'
  }
};

export const TICKETING_EXPLANATIONS = {
  storage: {
    title: '💾 Storage',
    body: `<p>Where data is saved so it survives a restart. Here: events, venues, one ticket row per seat, and bookings.</p>
      <p>Disk <strong>speed</strong> decides how fast rows are found and written. Disk <strong>space</strong> decides how many tickets fit.</p>`
  },
  feature: {
    title: 'How the ticket site uses your server',
    body: `<ul><li><code>GET /api/events/:id</code>: the event, its venue and every ticket, to draw the seat map. A read.</li>
      <li><code>POST /api/bookings</code>: book seats. A write, and it must never sell a seat twice.</li></ul>
      <p>About 100 views for every booking, so the read path is what you scale. The booking path is what you keep correct.</p>`
  },
  database: {
    title: '🗄️ Database server',
    body: `<p>A machine whose only job is the data: <code>events</code>, <code>venues</code>, <code>tickets(event_id, seat, status)</code> and <code>bookings</code>.</p>
      <p>Booking needs transactions (ACID), so ticket sites keep this in a relational database like PostgreSQL.</p>`
  },
  diskSpace: {
    title: '💽 Disk space',
    body: `<p>Every seat of every show is a ticket row. A 20,000-seat arena is 20,000 rows per show.</p>
      <p>When the disk is full, <strong>every booking fails</strong>. Fixes: a bigger disk, or archiving past shows (Level 5).</p>`
  },
  index: {
    title: '🔎 Index on (event, seat)',
    body: `<p>Without it, drawing one event's seat map scans every ticket of every show.</p>
      <p>With an index on <code>(event_id, seat)</code> the database jumps straight to that event's tickets.</p>`
  },
  cache: {
    title: '⚡ Event cache',
    body: `<p>Event, venue and performer details hardly change: keep them in memory (Redis) as <code>eventId → event</code> with a long TTL.</p>
      <p>Seat availability changes, so it gets a short TTL or is cleared when a ticket sells.</p>`
  },
  messageQueue: {
    title: '🚪 Virtual waiting room',
    body: `<p>A queue of fans in arrival order (a Redis sorted set by join time). Each fan sees their place over a live connection; a batch at a time is admitted and may book.</p>
      <p>The booking service turns away anyone not admitted, so the database sees a steady stream instead of millions of presses.</p>`
  }
};
