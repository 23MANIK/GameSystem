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
  },
  // ─── AI agents ───
  llm: {
    id: 'llm',
    name: 'AI Model',
    short: 'AI',
    icon: '🤖',
    componentId: 'llm_api',
    unlockLevel: Infinity,
    maxCount: 1,
    info: 'llmModel',
    // You rent it: the plan itself is cheap, the token bill is what costs (see SystemSimulator)
    costMult: 0.3,
    job: 'The "brain" you rent (like the Claude API): reads the prompt, writes the answer and decides which tool to use. You pay per token, and your plan caps how many tokens you may send each minute.',
    // Its four parts are the limits of your API plan, not hardware
    parts: {
      cpu: { name: 'Tokens per minute', short: 'Tokens', icon: '🔤', info: 'tokensPerMinute', labels: ['Starter', 'Build', 'Scale', 'Enterprise'], specs: ['~200k tok/min', '~400k tok/min', '~800k tok/min', '~1.6M tok/min'],
        whenFull: 'The provider answers "429 Too Many Requests" and those answers fail. A bigger plan, fewer tokens per question, or a queue that paces calls helps.',
        whatItDoes: 'How many tokens (pieces of words) your plan lets you send each minute. Every question counts its instructions, chat history, documents and answer. Over the limit, the provider answers "429 Too Many Requests".' },
      ram: { name: 'Answers at once', short: 'At once', icon: '⏳', info: 'llmConcurrency', labels: ['10', '20', '40', '80'], specs: ['in progress', 'in progress', 'in progress', 'in progress'],
        whenFull: 'New questions wait until another answer finishes, so answers get slow.',
        whatItDoes: 'How many answers can be written at the same time. Each one takes a few seconds, so busy minutes need more.' },
      storage: { name: 'Context window', short: 'Context', icon: '📜', info: 'contextWindow', labels: ['32k', '64k', '128k', '200k'], specs: ['tokens per prompt', 'tokens per prompt', 'tokens per prompt', 'tokens per prompt'],
        whenFull: 'A prompt that is too long is refused.',
        whatItDoes: 'How long one prompt may be. Here every prompt fits, so it is never the limit.' },
      network: { name: 'Requests per minute', short: 'Req/min', icon: '📮', info: 'rateLimits', labels: ['1,250', '12.5k', '125k', '1.25M'], specs: ['calls per minute', 'calls per minute', 'calls per minute', 'calls per minute'],
        whenFull: 'Extra calls get "429 Too Many Requests". Fewer calls per question (or a queue) helps.',
        whatItDoes: 'How many model calls your plan allows each minute. An agent that loops makes several calls per question.' }
    }
  },
  kb: {
    id: 'kb',
    name: 'Knowledge base',
    short: 'Knowledge',
    icon: '📚',
    componentId: 'vector_db',
    unlockLevel: Infinity,
    maxCount: 1,
    info: 'knowledgeBase',
    job: 'Your help articles, split into small chunks and stored as "meaning vectors" (a vector database). For each question it finds the few chunks that match best, and they go into the prompt.'
  },
  tools: {
    id: 'tools',
    name: 'Tool server',
    short: 'Tools',
    icon: '🧰',
    componentId: 'tool_server',
    unlockLevel: Infinity,
    maxCount: 1,
    info: 'toolServer',
    job: 'The agent\'s hands: safe buttons such as "look up order" and "refund" that call your real systems (like an MCP server). The model asks for a tool; this server runs it and returns the result.'
  },
  guard: {
    id: 'guard',
    name: 'Guardrail',
    short: 'Guard',
    icon: '🛡️',
    componentId: 'guardrail',
    unlockLevel: Infinity,
    maxCount: 1,
    info: 'guardrail',
    job: 'A safety check in front of the agent: a small model that spots tricks in what users type (prompt injection) and checks every answer and action before it goes out.'
  },
  orch: {
    id: 'orch',
    name: 'Orchestrator',
    short: 'Orchestrator',
    icon: '🧭',
    componentId: 'orchestrator',
    unlockLevel: Infinity,
    maxCount: 1,
    info: 'orchestrator',
    job: 'A lead agent for big jobs: it plans, starts several helper agents that work in parallel, then combines what they found.'
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
  sync: { aws: 'API Gateway WebSockets / EC2', gcp: 'Cloud Run (WebSockets)', oss: 'Node / Go WebSocket service' },
  llm: { aws: 'Amazon Bedrock (Claude)', gcp: 'Vertex AI (Claude, Gemini)', oss: 'Claude API / vLLM for open models' },
  kb: { aws: 'OpenSearch / Aurora pgvector / Bedrock Knowledge Bases', gcp: 'Vertex AI Vector Search / AlloyDB pgvector', oss: 'pgvector / Pinecone / Qdrant' },
  tools: { aws: 'Lambda / ECS behind an MCP server', gcp: 'Cloud Run (MCP server)', oss: 'MCP server (Node / Python)' },
  guard: { aws: 'Bedrock Guardrails', gcp: 'Model Armor', oss: 'Llama Guard / NeMo Guardrails' },
  orch: { aws: 'Step Functions / ECS', gcp: 'Cloud Run / Workflows', oss: 'Agent SDK / LangGraph' }
};

/** Order used for tabs, HUD chips and the map (front of the system first). */
export const ROLE_ORDER = ['cdn', 'gateway', 'guard', 'lb', 'web', 'app', 'llm', 'orch', 'tools', 'sync', 'idgen', 'queue', 'cache', 'kb', 'db', 'blob'];

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
  sync: [{ x: 4, y: 0 }],
  llm: [{ x: 1, y: 2 }],
  kb: [{ x: 4, y: 7 }],
  tools: [{ x: 5, y: 6 }],
  guard: [{ x: 0, y: 7 }],
  orch: [{ x: 1, y: 1 }]
};

/**
 * How a part of this role is shown: a rented AI model's "CPU" is really its
 * tokens-per-minute limit. Falls back to the shared part (serverParts.js).
 */
export function partView(role, part) {
  const o = ROLES[role]?.parts?.[part.id];
  return o ? { ...part, ...o } : part;
}

/** An option's label and spec for this role (the AI model's plan tiers). */
export function optionView(role, partId, opt, index) {
  const o = ROLES[role]?.parts?.[partId];
  if (!o || !opt) return opt;
  return { ...opt, label: o.labels?.[index] ?? opt.label, spec: o.specs?.[index] ?? opt.spec };
}

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
