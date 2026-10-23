/**
 * Guestbook — the one app feature in Level 1.
 * Anyone can read every entry; anyone can add an entry with their name.
 */

const MAX_STORED = 200; // keep the save small; `count` still tracks every entry

const VISITOR_NAMES = [
  'Aarav', 'Priya', 'Lena', 'Mateo', 'Yuki', 'Omar', 'Sofia', 'Kofi', 'Ana', 'Ravi',
  'Chen', 'Maya', 'Noah', 'Zara', 'Ishaan', 'Elif', 'Tomas', 'Amara', 'Diego', 'Hana'
];

const VISITOR_MESSAGES = [
  'was here!', 'Hello from my phone 👋', 'First time here, nice site', 'Signing before it gets famous',
  'This loads fast!', 'Greetings from the internet', 'Hi everyone', 'Bookmarked 🔖',
  'Cool little guestbook', 'Came from a friend\'s link'
];

export default class Guestbook {
  constructor(data = null) {
    this.entries = [];
    this.count = 0;
    this.pendingWrites = 0;
    if (data) this.fromJSON(data);
  }

  /** GET /entries — returns every stored entry, newest first. */
  read() {
    return [...this.entries].reverse();
  }

  /** POST /entries */
  write(name, message, isPlayer = false) {
    const entry = {
      name: String(name || 'Anonymous').trim().slice(0, 24) || 'Anonymous',
      message: String(message || 'was here!').trim().slice(0, 80) || 'was here!',
      time: Date.now(),
      isPlayer
    };
    this.entries.push(entry);
    if (this.entries.length > MAX_STORED) this.entries.shift();
    this.count += 1;
    return entry;
  }

  /**
   * Simulated visitors sign the book. `expectedWrites` can be fractional;
   * the remainder carries over to the next tick.
   */
  simulateVisitors(expectedWrites) {
    this.pendingWrites += expectedWrites;
    const added = [];
    while (this.pendingWrites >= 1) {
      this.pendingWrites -= 1;
      const name = VISITOR_NAMES[Math.floor(Math.random() * VISITOR_NAMES.length)];
      const msg = VISITOR_MESSAGES[Math.floor(Math.random() * VISITOR_MESSAGES.length)];
      added.push(this.write(name, msg, false));
    }
    return added;
  }

  toJSON() {
    return { entries: this.entries, count: this.count, pendingWrites: this.pendingWrites };
  }

  fromJSON(data) {
    this.entries = Array.isArray(data?.entries) ? data.entries : [];
    this.count = typeof data?.count === 'number' ? data.count : this.entries.length;
    this.pendingWrites = typeof data?.pendingWrites === 'number' ? data.pendingWrites : 0;
  }
}
