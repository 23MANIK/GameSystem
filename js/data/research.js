/**
 * Scale Architect - Research Tree Data
 * Defines architectural patterns, scaling techniques, and optimizations
 * players can research to permanently boost platform capabilities.
 */

export const RESEARCH_TREE = [
  // ==========================================
  // LEVEL 2 RESEARCH
  // ==========================================
  {
    id: 'horizontal_scaling',
    name: 'Horizontal Scaling Principles',
    description: 'Design stateless application tiers that easily multiply across commodity hardware instead of relying on a giant server.',
    icon: '📐',
    cost: 300,
    researchTime: 15,
    unlockLevel: 2,
    prerequisites: [],
    effects: {
      type: 'component_boost',
      target: 'app_server',
      value: 1.25,
      description: 'Increases App Server throughput by +25%'
    }
  },
  {
    id: 'caching_101',
    name: 'Caching 101: Cache-Aside Pattern',
    description: 'Master the fundamental cache-aside strategy: check cache first, query database on miss, and write back to cache.',
    icon: '💡',
    cost: 450,
    researchTime: 20,
    unlockLevel: 2,
    prerequisites: ['horizontal_scaling'],
    effects: {
      type: 'efficiency',
      target: 'global',
      value: 15,
      description: 'Shaves 15ms off global platform latency'
    }
  },

  // ==========================================
  // LEVEL 3 RESEARCH
  // ==========================================
  {
    id: 'db_indexing',
    name: 'B-Tree & Composite Indexing',
    description: 'Analyze slow query logs, eliminate sequential table scans, and build optimized composite indexes on foreign keys.',
    icon: '📑',
    cost: 800,
    researchTime: 30,
    unlockLevel: 3,
    prerequisites: ['horizontal_scaling'],
    effects: {
      type: 'component_boost',
      target: 'database',
      value: 1.40,
      description: 'Boosts Primary Database throughput by +40%'
    }
  },
  {
    id: 'cdn_optimization',
    name: 'CDN Edge Caching Policies',
    description: 'Implement Stale-While-Revalidate headers, gzip/brotli compression, and immutable cache-control for media assets.',
    icon: '🌐',
    cost: 1000,
    researchTime: 35,
    unlockLevel: 3,
    prerequisites: ['caching_101'],
    effects: {
      type: 'component_boost',
      target: 'cdn',
      value: 1.35,
      description: 'Boosts CDN throughput by +35% and edge hit ratio'
    }
  },

  // ==========================================
  // LEVEL 4 RESEARCH
  // ==========================================
  {
    id: 'connection_pooling',
    name: 'Database Connection Pooling',
    description: 'Use connection pooling proxies (such as PgBouncer) to multiplex thousands of app connections over few database sockets.',
    icon: '🏊',
    cost: 1800,
    researchTime: 45,
    unlockLevel: 4,
    prerequisites: ['db_indexing'],
    effects: {
      type: 'efficiency',
      target: 'database',
      value: 0.25,
      description: 'Reduces Database compute resource consumption by 25%'
    }
  },
  {
    id: 'request_coalescing',
    name: 'Request Coalescing (Singleflight)',
    description: 'Collapse duplicate concurrent read requests for the same expired cache key into a single backend fetch.',
    icon: '🛡️',
    cost: 2200,
    researchTime: 45,
    unlockLevel: 4,
    prerequisites: ['caching_101'],
    effects: {
      type: 'defense',
      target: 'cache_stampede',
      value: 0.50,
      description: 'Reduces Cache Stampede impact and error rates by 50%'
    }
  },
  {
    id: 'ttl_jitter',
    name: 'TTL Jitter & Probabilistic Expiry',
    description: 'Add randomized jitter to cache expiration timers to prevent millions of cached keys from expiring at the exact same instant.',
    icon: '🎲',
    cost: 2000,
    researchTime: 40,
    unlockLevel: 4,
    prerequisites: ['caching_101'],
    effects: {
      type: 'component_boost',
      target: 'redis_cache',
      value: 1.30,
      description: 'Increases Redis Cache capacity bonus by +30%'
    }
  },
  {
    id: 'read_write_split',
    name: 'Read/Write Splitting Proxy',
    description: 'Direct SQL INSERT/UPDATE/DELETE commands to the primary writer and distribute all SELECT reads across read replicas.',
    icon: '🔀',
    cost: 2500,
    researchTime: 50,
    unlockLevel: 4,
    prerequisites: ['db_indexing'],
    effects: {
      type: 'component_boost',
      target: 'read_replica',
      value: 1.50,
      description: 'Increases Read Replica throughput by +50%'
    }
  },

  // ==========================================
  // LEVEL 5 RESEARCH
  // ==========================================
  {
    id: 'rate_limiting_algos',
    name: 'Sliding Window Rate Limiting',
    description: 'Implement distributed sliding-window counters with Redis Lua scripts to throttle abusive scraping and brute-force attacks.',
    icon: '⏱️',
    cost: 4500,
    researchTime: 60,
    unlockLevel: 5,
    prerequisites: ['request_coalescing'],
    effects: {
      type: 'component_boost',
      target: 'rate_limiter',
      value: 1.40,
      description: 'Boosts Rate Limiter throughput and mitigation speed by +40%'
    }
  },
  {
    id: 'circuit_breaker',
    name: 'Circuit Breaker Pattern',
    description: 'Automatically trip failing remote calls into immediate fallback responses, preventing cascade thread starvation.',
    icon: '⚡',
    cost: 5000,
    researchTime: 65,
    unlockLevel: 5,
    prerequisites: ['horizontal_scaling'],
    effects: {
      type: 'defense',
      target: 'global',
      value: 0.35,
      description: 'Dampens incident error rate spikes across the platform by 35%'
    }
  },
  {
    id: 'db_sharding_strategy',
    name: 'Consistent Hashing & Resharding',
    description: 'Use a consistent hashing ring with virtual nodes to shard databases with minimal data movement during cluster expansion.',
    icon: '💍',
    cost: 6500,
    researchTime: 75,
    unlockLevel: 5,
    prerequisites: ['read_write_split'],
    effects: {
      type: 'component_boost',
      target: 'db_shard',
      value: 1.50,
      description: 'Increases Database Shard user capacity bonus by +50%'
    }
  },
  {
    id: 'blue_green_deploy',
    name: 'Blue/Green Deployment Orchestration',
    description: 'Maintain identical staging and production environments to swap router targets instantly with zero dropped requests.',
    icon: '🔄',
    cost: 5500,
    researchTime: 60,
    unlockLevel: 5,
    prerequisites: ['circuit_breaker'],
    effects: {
      type: 'efficiency',
      target: 'global',
      value: 0.08,
      description: 'Guarantees +0.08% baseline platform uptime bonus'
    }
  },
  {
    id: 'auto_scaling',
    name: 'Predictive Horizontal Autoscaling',
    description: 'Combine CPU/memory telemetry with predictive ML models to spin up microservice pods minutes before incoming traffic waves arrive.',
    icon: '📈',
    cost: 8000,
    researchTime: 90,
    unlockLevel: 5,
    prerequisites: ['horizontal_scaling', 'rate_limiting_algos'],
    effects: {
      type: 'efficiency',
      target: 'global',
      value: 0.20,
      description: 'Expands compute utilization ceiling by 20% before errors trigger'
    }
  }
];
