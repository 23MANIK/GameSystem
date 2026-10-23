/**
 * components.js — Scale Architect Game Components
 *
 * Defines every infrastructure component available in the game.
 * Progression mirrors real-world startup architecture evolution:
 *   Level 1: Monolith
 *   Level 2: Frontend + Backend separation
 *   Level 3: Dedicated Database + Object Storage
 *   Level 4: Load Balancer, Cache, Read Replicas
 *   Level 5: CDN, Message Queue, Search, Security, DB Sharding
 *
 * Each component has 3 size tiers: Small, Medium, Large
 * (analogous to AWS t2.micro → m5.large → c5.4xlarge).
 */

export const COMPONENTS = {

    // =========================================================================
    // LEVEL 1 — The Single Machine
    // =========================================================================

    monolith: {
        id: 'monolith',
        name: 'Monolith Server',
        description: 'One machine that runs everything: web UI, app logic, database, file storage.',
        icon: '🖥️',
        category: 'compute',
        maxCount: 1,
        inputs: [],
        outputs: [],
        tiers: [
            {
                name: 'Small',
                cost: 0,
                computeCost: 20,
                throughput: 50,
                latencyReduction: 0,
                capacityBonus: 100,
                description: 'A single VPS running everything — Node.js app serving HTML, processing requests, and storing data in SQLite.'
            },
            {
                name: 'Medium',
                cost: 200,
                computeCost: 35,
                throughput: 150,
                latencyReduction: 10,
                capacityBonus: 300,
                description: 'Upgraded to a beefier machine with more RAM and SSD storage. Still a monolith, but faster.'
            },
            {
                name: 'Large',
                cost: 500,
                computeCost: 55,
                throughput: 350,
                latencyReduction: 20,
                capacityBonus: 700,
                description: 'Maxed out single machine — 32GB RAM, NVMe SSD, optimized queries. This is as far as vertical scaling goes.'
            }
        ]
    },

    // =========================================================================
    // LEVEL 2 — Separate UI & Backend
    // =========================================================================

    frontend_server: {
        id: 'frontend_server',
        name: 'Frontend Server',
        description: 'Serves the web UI (HTML/CSS/JS), static assets.',
        icon: '🌐',
        category: 'compute',
        maxCount: 2,
        inputs: ['load_balancer', 'cdn', 'waf'],
        outputs: ['backend_server'],
        tiers: [
            {
                name: 'Small',
                cost: 150,
                computeCost: 10,
                throughput: 200,
                latencyReduction: 15,
                capacityBonus: 200,
                description: 'A lightweight Nginx server handling HTML, CSS, and JS bundles for the InstaVerse UI.'
            },
            {
                name: 'Medium',
                cost: 350,
                computeCost: 18,
                throughput: 500,
                latencyReduction: 25,
                capacityBonus: 500,
                description: 'Upgraded frontend with gzip compression, HTTP/2, and optimized asset delivery.'
            },
            {
                name: 'Large',
                cost: 800,
                computeCost: 30,
                throughput: 1200,
                latencyReduction: 40,
                capacityBonus: 1200,
                description: 'High-performance frontend with server-side rendering, Brotli compression, and edge-optimized delivery.'
            }
        ]
    },

    backend_server: {
        id: 'backend_server',
        name: 'Backend API Server',
        description: 'Handles business logic, API endpoints, user authentication.',
        icon: '⚙️',
        category: 'compute',
        maxCount: 4,
        inputs: ['frontend_server', 'load_balancer'],
        outputs: ['database', 'redis_cache', 'message_queue', 'search_engine', 'read_replica', 'db_shard', 'object_storage'],
        tiers: [
            {
                name: 'Small',
                cost: 200,
                computeCost: 15,
                throughput: 100,
                latencyReduction: 10,
                capacityBonus: 250,
                description: 'A single Node.js process handling REST API requests, auth, and business logic.'
            },
            {
                name: 'Medium',
                cost: 450,
                computeCost: 25,
                throughput: 300,
                latencyReduction: 20,
                capacityBonus: 600,
                description: 'Clustered Node.js with worker threads, connection pooling, and optimized middleware.'
            },
            {
                name: 'Large',
                cost: 1000,
                computeCost: 40,
                throughput: 700,
                latencyReduction: 35,
                capacityBonus: 1500,
                description: 'High-performance API server with auto-scaling, rate limiting middleware, and circuit breakers.'
            }
        ]
    },

    // =========================================================================
    // LEVEL 3 — Dedicated Database
    // =========================================================================

    database: {
        id: 'database',
        name: 'PostgreSQL Database',
        description: 'Dedicated database server for structured data.',
        icon: '🗄️',
        category: 'storage',
        maxCount: 1,
        inputs: ['backend_server'],
        outputs: ['read_replica', 'db_shard'],
        tiers: [
            {
                name: 'Small',
                cost: 300,
                computeCost: 15,
                throughput: 80,
                latencyReduction: 20,
                capacityBonus: 400,
                description: 'A dedicated PostgreSQL instance — proper ACID transactions, indexes, and query planning.'
            },
            {
                name: 'Medium',
                cost: 700,
                computeCost: 30,
                throughput: 250,
                latencyReduction: 35,
                capacityBonus: 1000,
                description: 'Optimized PostgreSQL with connection pooling (PgBouncer), materialized views, and query caching.'
            },
            {
                name: 'Large',
                cost: 1500,
                computeCost: 50,
                throughput: 600,
                latencyReduction: 50,
                capacityBonus: 2500,
                description: 'Enterprise-grade PostgreSQL with parallel queries, partitioned tables, and WAL-level replication.'
            }
        ]
    },

    object_storage: {
        id: 'object_storage',
        name: 'Object Storage (S3)',
        description: 'Store user uploads, images, media files.',
        icon: '📦',
        category: 'storage',
        maxCount: 2,
        inputs: ['backend_server', 'cdn'],
        outputs: [],
        tiers: [
            {
                name: 'Small',
                cost: 250,
                computeCost: 5,
                throughput: 100,
                latencyReduction: 5,
                capacityBonus: 300,
                description: 'Basic S3 bucket for user-uploaded images and profile photos.'
            },
            {
                name: 'Medium',
                cost: 600,
                computeCost: 10,
                throughput: 300,
                latencyReduction: 15,
                capacityBonus: 800,
                description: 'Multi-region object storage with lifecycle policies and automatic tiering.'
            },
            {
                name: 'Large',
                cost: 1200,
                computeCost: 18,
                throughput: 700,
                latencyReduction: 25,
                capacityBonus: 2000,
                description: 'High-throughput object storage with intelligent tiering, versioning, and cross-region replication.'
            }
        ]
    },

    // =========================================================================
    // LEVEL 4 — Scaling Out
    // =========================================================================

    load_balancer: {
        id: 'load_balancer',
        name: 'Load Balancer',
        description: 'Distributes traffic across multiple backend servers.',
        icon: '⚖️',
        category: 'network',
        maxCount: 2,
        inputs: ['cdn', 'waf', 'rate_limiter'],
        outputs: ['frontend_server', 'backend_server'],
        tiers: [
            {
                name: 'Small',
                cost: 500,
                computeCost: 8,
                throughput: 500,
                latencyReduction: 15,
                capacityBonus: 1000,
                description: 'A basic round-robin load balancer distributing requests across backend instances.'
            },
            {
                name: 'Medium',
                cost: 1200,
                computeCost: 15,
                throughput: 1500,
                latencyReduction: 30,
                capacityBonus: 3000,
                description: 'Application-aware load balancer with health checks, sticky sessions, and weighted routing.'
            },
            {
                name: 'Large',
                cost: 2500,
                computeCost: 25,
                throughput: 4000,
                latencyReduction: 50,
                capacityBonus: 8000,
                description: 'Global load balancer with geo-routing, auto-scaling triggers, and connection draining.'
            }
        ]
    },

    redis_cache: {
        id: 'redis_cache',
        name: 'Redis Cache',
        description: 'In-memory cache to reduce database load.',
        icon: '⚡',
        category: 'cache',
        maxCount: 2,
        inputs: ['backend_server'],
        outputs: [],
        tiers: [
            {
                name: 'Small',
                cost: 400,
                computeCost: 8,
                throughput: 800,
                latencyReduction: 30,
                capacityBonus: 800,
                description: 'A single Redis instance caching hot queries — user sessions, feed data, counters.'
            },
            {
                name: 'Medium',
                cost: 900,
                computeCost: 15,
                throughput: 2000,
                latencyReduction: 50,
                capacityBonus: 2000,
                description: 'Redis Sentinel with automatic failover, pub/sub for real-time features, and LRU eviction.'
            },
            {
                name: 'Large',
                cost: 2000,
                computeCost: 25,
                throughput: 5000,
                latencyReduction: 70,
                capacityBonus: 5000,
                description: 'Redis Cluster with data sharding, pipeline batching, and sub-millisecond latency at scale.'
            }
        ]
    },

    read_replica: {
        id: 'read_replica',
        name: 'DB Read Replica',
        description: 'Read-only copy of the database for read-heavy workloads.',
        icon: '📋',
        category: 'storage',
        maxCount: 3,
        inputs: ['database', 'backend_server'],
        outputs: [],
        tiers: [
            {
                name: 'Small',
                cost: 500,
                computeCost: 12,
                throughput: 200,
                latencyReduction: 15,
                capacityBonus: 600,
                description: 'A single read replica handling SELECT queries — feed rendering, profile lookups.'
            },
            {
                name: 'Medium',
                cost: 1100,
                computeCost: 22,
                throughput: 500,
                latencyReduction: 25,
                capacityBonus: 1500,
                description: 'Optimized read replica with query caching and connection pooling for high-read workloads.'
            },
            {
                name: 'Large',
                cost: 2200,
                computeCost: 35,
                throughput: 1200,
                latencyReduction: 40,
                capacityBonus: 3500,
                description: 'High-performance read replica with parallel query execution and aggressive prefetching.'
            }
        ]
    },

    // =========================================================================
    // LEVEL 5 — Full Scale Architecture
    // =========================================================================

    cdn: {
        id: 'cdn',
        name: 'CDN (Content Delivery Network)',
        description: 'Edge caching for static content worldwide.',
        icon: '🌍',
        category: 'network',
        maxCount: 3,
        inputs: [],
        outputs: ['frontend_server', 'load_balancer', 'object_storage'],
        tiers: [
            {
                name: 'Small',
                cost: 600,
                computeCost: 5,
                throughput: 1000,
                latencyReduction: 40,
                capacityBonus: 2000,
                description: 'Basic CDN with a few edge locations caching images, CSS, and JS bundles.'
            },
            {
                name: 'Medium',
                cost: 1500,
                computeCost: 10,
                throughput: 3000,
                latencyReduction: 60,
                capacityBonus: 5000,
                description: 'Global CDN with 50+ edge locations, video streaming support, and cache invalidation API.'
            },
            {
                name: 'Large',
                cost: 3500,
                computeCost: 18,
                throughput: 8000,
                latencyReduction: 80,
                capacityBonus: 15000,
                description: 'Enterprise CDN with 200+ edge locations, edge compute (Lambda@Edge), and real-time analytics.'
            }
        ]
    },

    message_queue: {
        id: 'message_queue',
        name: 'Message Queue (Kafka)',
        description: 'Async processing for notifications, feeds, emails.',
        icon: '📨',
        category: 'messaging',
        maxCount: 2,
        inputs: ['backend_server'],
        outputs: [],
        tiers: [
            {
                name: 'Small',
                cost: 700,
                computeCost: 10,
                throughput: 500,
                latencyReduction: 10,
                capacityBonus: 1500,
                description: 'A single Kafka broker handling async jobs — email notifications, feed fan-out, image resizing.'
            },
            {
                name: 'Medium',
                cost: 1600,
                computeCost: 18,
                throughput: 1500,
                latencyReduction: 20,
                capacityBonus: 4000,
                description: 'Kafka cluster with multiple partitions, consumer groups, and dead-letter queues.'
            },
            {
                name: 'Large',
                cost: 3500,
                computeCost: 30,
                throughput: 4000,
                latencyReduction: 35,
                capacityBonus: 10000,
                description: 'Enterprise Kafka with exactly-once semantics, stream processing (KSQL), and cross-DC replication.'
            }
        ]
    },

    id_generator: {
        id: 'id_generator',
        name: 'ID Generator',
        description: 'Hands out unique IDs (Redis INCR / ticket server).',
        icon: '🔢',
        category: 'compute',
        maxCount: 1,
        inputs: ['backend_server'],
        outputs: [],
        tiers: [
            { name: 'Small', cost: 400, computeCost: 5, throughput: 500, latencyReduction: 0, capacityBonus: 0, description: 'A single counter.' }
        ]
    },

    sync_server: {
        id: 'sync_server',
        name: 'Sync Server',
        description: 'WebSocket connections that push file changes to devices.',
        icon: '🔄',
        category: 'compute',
        maxCount: 1,
        inputs: ['backend_server'],
        outputs: [],
        tiers: [
            { name: 'Small', cost: 500, computeCost: 5, throughput: 500, latencyReduction: 0, capacityBonus: 0, description: 'One WebSocket server.' }
        ]
    },

    search_engine: {
        id: 'search_engine',
        name: 'Search Engine (Elasticsearch)',
        description: 'Full-text search for users, posts, hashtags.',
        icon: '🔍',
        category: 'compute',
        maxCount: 1,
        inputs: ['backend_server'],
        outputs: [],
        tiers: [
            {
                name: 'Small',
                cost: 800,
                computeCost: 15,
                throughput: 300,
                latencyReduction: 10,
                capacityBonus: 1000,
                description: 'A single Elasticsearch node indexing user profiles, post content, and hashtags.'
            },
            {
                name: 'Medium',
                cost: 1800,
                computeCost: 28,
                throughput: 800,
                latencyReduction: 20,
                capacityBonus: 3000,
                description: 'Elasticsearch cluster with sharded indices, autocomplete suggestions, and relevance tuning.'
            },
            {
                name: 'Large',
                cost: 4000,
                computeCost: 45,
                throughput: 2000,
                latencyReduction: 35,
                capacityBonus: 8000,
                description: 'Enterprise search cluster with ML-powered ranking, real-time indexing, and geo-search.'
            }
        ]
    },

    rate_limiter: {
        id: 'rate_limiter',
        name: 'Rate Limiter',
        description: 'Protects APIs from abuse and DDoS.',
        icon: '🚦',
        category: 'security',
        maxCount: 1,
        inputs: [],
        outputs: ['load_balancer'],
        tiers: [
            {
                name: 'Small',
                cost: 400,
                computeCost: 5,
                throughput: 1000,
                latencyReduction: 5,
                capacityBonus: 500,
                description: 'Basic token-bucket rate limiter — per-IP and per-user request throttling.'
            },
            {
                name: 'Medium',
                cost: 900,
                computeCost: 10,
                throughput: 3000,
                latencyReduction: 10,
                capacityBonus: 1500,
                description: 'Distributed rate limiter with sliding window counters and adaptive throttling.'
            },
            {
                name: 'Large',
                cost: 2000,
                computeCost: 18,
                throughput: 8000,
                latencyReduction: 15,
                capacityBonus: 4000,
                description: 'Intelligent rate limiter with bot detection, geo-blocking, and real-time threat scoring.'
            }
        ]
    },

    waf: {
        id: 'waf',
        name: 'Web Application Firewall',
        description: 'Protects against SQL injection, XSS, bots.',
        icon: '🛡️',
        category: 'security',
        maxCount: 1,
        inputs: [],
        outputs: ['load_balancer', 'frontend_server'],
        tiers: [
            {
                name: 'Small',
                cost: 500,
                computeCost: 5,
                throughput: 500,
                latencyReduction: 0,
                capacityBonus: 500,
                description: 'Basic WAF with OWASP top-10 rule sets — blocks common SQL injection and XSS attacks.'
            },
            {
                name: 'Medium',
                cost: 1200,
                computeCost: 10,
                throughput: 1500,
                latencyReduction: 5,
                capacityBonus: 1500,
                description: 'Advanced WAF with custom rules, bot mitigation, and IP reputation scoring.'
            },
            {
                name: 'Large',
                cost: 2500,
                computeCost: 18,
                throughput: 4000,
                latencyReduction: 10,
                capacityBonus: 4000,
                description: 'Enterprise WAF with ML-based threat detection, virtual patching, and real-time analytics.'
            }
        ]
    },

    db_shard: {
        id: 'db_shard',
        name: 'Database Shard',
        description: 'Horizontal database partitioning.',
        icon: '🧩',
        category: 'storage',
        maxCount: 4,
        inputs: ['database', 'backend_server'],
        outputs: [],
        tiers: [
            {
                name: 'Small',
                cost: 1000,
                computeCost: 15,
                throughput: 300,
                latencyReduction: 10,
                capacityBonus: 2000,
                description: 'A single database shard partitioned by user-ID range — distributes write load.'
            },
            {
                name: 'Medium',
                cost: 2200,
                computeCost: 28,
                throughput: 800,
                latencyReduction: 20,
                capacityBonus: 5000,
                description: 'Consistent-hash sharding with automatic rebalancing and cross-shard query support.'
            },
            {
                name: 'Large',
                cost: 5000,
                computeCost: 45,
                throughput: 2000,
                latencyReduction: 35,
                capacityBonus: 12000,
                description: 'Enterprise sharding with Vitess-style proxy, live resharding, and global transaction support.'
            }
        ]
    }
};
