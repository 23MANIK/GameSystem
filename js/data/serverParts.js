/**
 * serverParts.js — the four resources a single server is built from.
 *
 * Numbers are game-scaled so a cheap server tops out around 40 users.
 * `capacity` is in the unit the simulator uses for that part:
 *   cpu     → requests per second the cores can process
 *   ram     → megabytes of memory
 *   storage → disk operations per second
 *   network → kilobytes per second of bandwidth
 */

export const PART_ORDER = ['cpu', 'ram', 'storage', 'network'];

export const SERVER_PARTS = {
  cpu: {
    id: 'cpu',
    name: 'CPU',
    icon: '🧠',
    short: 'CPU',
    whatItDoes: 'Does the work for every request: running your code, building each page. More cores = more requests handled per second.',
    whenFull: 'Requests wait in line for a free core, so pages get slow and some time out.',
    options: [
      { id: 'cpu_1', label: '1 vCPU', spec: '1 core', cost: 100, capacity: 12 },
      { id: 'cpu_2', label: '2 vCPU', spec: '2 cores', cost: 250, capacity: 24 },
      { id: 'cpu_4', label: '4 vCPU', spec: '4 cores', cost: 600, capacity: 48 },
      { id: 'cpu_8', label: '8 vCPU', spec: '8 cores', cost: 1500, capacity: 96, unlockLevel: 5 }
    ]
  },
  ram: {
    id: 'ram',
    name: 'Memory (RAM)',
    icon: '🧩',
    short: 'RAM',
    whatItDoes: 'Short-term memory. The operating system and app need ~400 MB, and every online user needs a little more for their session.',
    whenFull: 'The server starts swapping to disk or the app crashes. Out of memory is the fastest way to go down.',
    options: [
      { id: 'ram_1', label: '1 GB', spec: '1,024 MB', cost: 80, capacity: 1024 },
      { id: 'ram_2', label: '2 GB', spec: '2,048 MB', cost: 200, capacity: 2048 },
      { id: 'ram_4', label: '4 GB', spec: '4,096 MB', cost: 450, capacity: 4096 },
      { id: 'ram_8', label: '8 GB', spec: '8,192 MB', cost: 1100, capacity: 8192, unlockLevel: 5 }
    ]
  },
  storage: {
    id: 'storage',
    name: 'Storage',
    icon: '💾',
    short: 'Disk',
    whatItDoes: 'Where the Guestbook entries are saved so they survive a restart. Its speed decides how many reads and writes per second it can do.',
    whenFull: 'Every read and write waits for the disk. Spinning HDDs are cheap but slow; SSDs are much faster.',
    options: [
      // space = how many Guestbook entries fit (game-scaled so disks fill in minutes, not months)
      { id: 'disk_hdd', label: 'HDD', spec: 'Big, slow', cost: 60, capacity: 2.6, space: 6000 },
      { id: 'disk_ssd', label: 'SSD', spec: 'Fast, small', cost: 180, capacity: 26, space: 1500 },
      { id: 'disk_nvme', label: 'NVMe', spec: 'Fastest, mid', cost: 400, capacity: 130, space: 4000 },
      { id: 'disk_nvme_xl', label: 'NVMe XL', spec: 'Fast and big', cost: 1000, capacity: 260, space: 20000, unlockLevel: 5 }
    ]
  },
  network: {
    id: 'network',
    name: 'Network',
    icon: '🌐',
    short: 'Net',
    whatItDoes: 'The pipe between your server and the internet. Every response travels through it, and "read everything" responses grow as the Guestbook grows.',
    whenFull: 'Responses queue up in the pipe. Users see slow loads even when CPU and RAM are fine.',
    options: [
      { id: 'net_10', label: '10 Mbps', spec: '1.25 MB/s', cost: 50, capacity: 1250 },
      { id: 'net_100', label: '100 Mbps', spec: '12.5 MB/s', cost: 150, capacity: 12500 },
      { id: 'net_1000', label: '1 Gbps', spec: '125 MB/s', cost: 400, capacity: 125000 },
      { id: 'net_10g', label: '10 Gbps', spec: '1.25 GB/s', cost: 1000, capacity: 1250000, unlockLevel: 5 }
    ]
  }
};

/** The cheapest option for every part — the default first build. */
export function cheapestServer() {
  const server = {};
  for (const partId of PART_ORDER) {
    server[partId] = SERVER_PARTS[partId].options[0].id;
  }
  return server;
}

export function getOption(partId, optionId) {
  const part = SERVER_PARTS[partId];
  if (!part) return null;
  return part.options.find(o => o.id === optionId) || null;
}

export function getOptionIndex(partId, optionId) {
  const part = SERVER_PARTS[partId];
  return part ? part.options.findIndex(o => o.id === optionId) : -1;
}

/** Total price of a full server config. */
export function serverCost(server) {
  let total = 0;
  for (const partId of PART_ORDER) {
    const opt = getOption(partId, server?.[partId]);
    if (opt) total += opt.cost;
  }
  return total;
}

/**
 * Cost to move from `current` to `next`. Upgrading a part costs the price
 * difference; there is no refund for picking something cheaper.
 */
export function upgradeCost(current, next) {
  if (!current) return serverCost(next);
  let total = 0;
  for (const partId of PART_ORDER) {
    const a = getOption(partId, current[partId]);
    const b = getOption(partId, next[partId]);
    if (a && b && b.cost > a.cost) total += b.cost - a.cost;
  }
  return total;
}

/**
 * Running cost: a server costs coins every minute it is switched on,
 * proportional to its price (cloud bills work the same way).
 */
export const RUNNING_COST_PER_MINUTE_RATE = 0.12;

export function runningCostPerMinute(server) {
  return server ? Math.round(serverCost(server) * RUNNING_COST_PER_MINUTE_RATE) : 0;
}

/** Options you can buy at a level (the extra-large ones unlock later). */
export function optionsForLevel(partId, level) {
  return SERVER_PARTS[partId].options.filter(o => (o.unlockLevel || 1) <= level);
}
