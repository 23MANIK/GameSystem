/**
 * roles.js — every kind of machine in your system, and the level it unlocks at.
 * Each is built from the same four parts (CPU, RAM, Storage, Network).
 *
 * Request path (left → right), only through machines you have:
 *   users → CDN → gateway → load balancer → web / app servers → cache → database
 * unlockLevel and maxCount are set per product (see js/products/registry.js).
 */

export const ROLES = {
  app: {
    id: 'app',
    name: 'App server',
    short: 'App',
    icon: '🖥️',
    componentId: 'monolith',
    unlockLevel: 1,
    maxCount: 6,
    info: 'appServer',
    job: 'Runs your code: handles API requests, keeps sessions, talks to the database.'
  },
  db: {
    id: 'db',
    name: 'Database',
    short: 'DB',
    icon: '🗄️',
    componentId: 'database',
    unlockLevel: 2,
    maxCount: 1,
    info: 'database',
    job: 'Stores, finds and returns the entries.'
  },
  web: {
    id: 'web',
    name: 'Web (UI) server',
    short: 'Web',
    icon: '🌐',
    componentId: 'frontend_server',
    unlockLevel: 3,
    maxCount: 1,
    info: 'webServer',
    job: 'Serves the user interface: HTML, CSS, JavaScript and images.'
  },
  gateway: {
    id: 'gateway',
    name: 'API gateway',
    short: 'Gateway',
    icon: '🚦',
    componentId: 'rate_limiter',
    unlockLevel: 4,
    maxCount: 1,
    info: 'gateway',
    job: 'Front door for every API request. Rate limiting blocks clients that send too many.'
  },
  lb: {
    id: 'lb',
    name: 'Load balancer',
    short: 'LB',
    icon: '⚖️',
    componentId: 'load_balancer',
    unlockLevel: 5,
    maxCount: 1,
    info: 'loadBalancer',
    job: 'Spreads requests across your app servers and skips any that are down.'
  },
  cache: {
    id: 'cache',
    name: 'Cache',
    short: 'Cache',
    icon: '⚡',
    componentId: 'redis_cache',
    unlockLevel: 6,
    maxCount: 1,
    info: 'cache',
    job: 'Keeps popular data in memory so most reads never reach the database.'
  },
  cdn: {
    id: 'cdn',
    name: 'CDN',
    short: 'CDN',
    icon: '🌍',
    componentId: 'cdn',
    unlockLevel: 7,
    maxCount: 1,
    info: 'cdn',
    job: 'Copies of your pages and popular data on servers around the world, close to users.'
  },
  idgen: {
    id: 'idgen',
    name: 'ID generator',
    short: 'IDs',
    icon: '🔢',
    componentId: 'id_generator',
    unlockLevel: Infinity,
    maxCount: 1,
    info: 'idGenerator',
    job: 'Hands out unique numbers (like Redis INCR or a ticket server), so no two servers or shards ever make the same short code.'
  },
  blob: {
    id: 'blob',
    name: 'Blob storage',
    short: 'Blob',
    icon: '🪣',
    componentId: 'object_storage',
    unlockLevel: Infinity,
    maxCount: 1,
    info: 'blobStorage',
    // Storage-heavy and cheap to run per GB, like S3
    costMult: 0.4,
    job: 'Holds the files themselves (the bytes): huge, cheap, durable. Metadata lives in the database.'
  },
  sync: {
    id: 'sync',
    name: 'Sync server',
    short: 'Sync',
    icon: '🔄',
    componentId: 'sync_server',
    unlockLevel: Infinity,
    maxCount: 1,
    info: 'syncServer',
    job: 'Keeps one live connection (WebSocket) open to every device and pushes "this file changed" the moment it happens.'
  },
  queue: {
    id: 'queue',
    name: 'Message queue',
    short: 'Queue',
    icon: '📨',
    componentId: 'message_queue',
    unlockLevel: Infinity,
    maxCount: 1,
    info: 'messageQueue',
    job: 'A buffer for events (like Kafka). Producers drop events in and move on; a worker processes them later, in batches.'
  }
};

/**
 * Real-world equivalents of each machine, for the blueprint.
 * Game parts map to cloud instance sizes by order of magnitude, not exactly.
 */
export const CLOUD_EQUIVALENTS = {
  app: { aws: 'EC2 (Auto Scaling group)', gcp: 'Compute Engine / Cloud Run', oss: 'Node / Go / Java service' },
  db: { aws: 'RDS PostgreSQL / Aurora', gcp: 'Cloud SQL', oss: 'PostgreSQL / MySQL' },
  web: { aws: 'S3 + EC2 (nginx)', gcp: 'Cloud Storage + nginx', oss: 'nginx' },
  gateway: { aws: 'API Gateway', gcp: 'API Gateway / Apigee', oss: 'Kong / Envoy' },
  lb: { aws: 'Application Load Balancer', gcp: 'Cloud Load Balancing', oss: 'HAProxy / nginx' },
  cache: { aws: 'ElastiCache (Redis)', gcp: 'Memorystore (Redis)', oss: 'Redis / Memcached' },
  cdn: { aws: 'CloudFront (+ Lambda@Edge)', gcp: 'Cloud CDN', oss: 'Cloudflare (Workers)' },
  idgen: { aws: 'ElastiCache Redis INCR', gcp: 'Memorystore Redis INCR', oss: 'Redis / ticket server / Snowflake' },
  queue: { aws: 'MSK (Kafka) / Kinesis', gcp: 'Pub/Sub', oss: 'Apache Kafka' },
  blob: { aws: 'S3 (+ Glacier for cold)', gcp: 'Cloud Storage (Nearline / Coldline)', oss: 'MinIO / Ceph' },
  sync: { aws: 'API Gateway WebSockets / EC2', gcp: 'Cloud Run (WebSockets)', oss: 'Node / Go WebSocket service' }
};

/** Order used for tabs, HUD chips and the map (front of the system first). */
export const ROLE_ORDER = ['cdn', 'gateway', 'lb', 'web', 'app', 'sync', 'idgen', 'queue', 'cache', 'db', 'blob'];

/**
 * Where each machine sits on the 8×8 map. Tiles with the same x+y form a
 * horizontal row on screen, 120px apart, so cards never overlap:
 *   row x+y=3 (top):    web, extra app servers
 *   row x+y=7 (middle): CDN → gateway → LB → app → cache → database
 *   row x+y=11 (bottom): extra app servers
 */
export const ROLE_TILES = {
  cdn: [{ x: 1, y: 6 }],
  gateway: [{ x: 2, y: 5 }],
  lb: [{ x: 3, y: 4 }],
  web: [{ x: 0, y: 3 }],
  app: [{ x: 4, y: 3 }, { x: 2, y: 1 }, { x: 6, y: 5 }, { x: 5, y: 2 }, { x: 3, y: 0 }, { x: 7, y: 4 }],
  cache: [{ x: 6, y: 1 }],
  db: [{ x: 7, y: 0 }, { x: 7, y: 1 }, { x: 7, y: 2 }, { x: 7, y: 3 }],
  idgen: [{ x: 5, y: 0 }],
  queue: [{ x: 6, y: 7 }],
  blob: [{ x: 7, y: 6 }],
  sync: [{ x: 4, y: 0 }]
};

/** How many of a role can run side by side (app servers, database shards). */
export function roleMaxCount(role) {
  return ROLES[role]?.maxCount ?? 1;
}

export function roleForComponent(componentId) {
  return Object.values(ROLES).find(r => r.componentId === componentId) || null;
}

/** Roles you can use at a level. */
export function rolesForLevel(level) {
  return ROLE_ORDER.filter(id => ROLES[id].unlockLevel <= level);
}
