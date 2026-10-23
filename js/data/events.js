/**
 * Scale Architect - Incident & Event Definitions
 * Defines realistic system design incidents, their survival requirements,
 * penalties, and educational context.
 */

export const EVENTS = [
  {
    id: 'first_viral',
    name: 'First Viral Post',
    description: 'A sudden burst of traffic from a student cat meme hits your server.',
    story: 'A college student posted a hilarious campus cat meme that blew up on campus group chats. Thousands are refreshing their feeds simultaneously!',
    severity: 'low',
    minLevel: 2,
    duration: 30,
    effects: {
      latencyMultiplier: 1.8,
      errorRateIncrease: 0.05,
      throughputDrain: 0.20,
      userLossRate: 1
    },
    requirements: {
      components: ['reverse_proxy', 'session_store'],
      minTier: 1
    },
    rewards: {
      coins: 400,
      xp: 80
    },
    penalty: {
      coinsLost: 150,
      usersLost: 25
    },
    inspiredBy: 'Early Reddit viral post surges (2006)'
  },
  {
    id: 'traffic_spike',
    name: 'Unexpected Traffic Spike',
    description: 'A tech influencer shared your platform on social media.',
    story: 'A famous tech influencer just posted a glowing tweet about your sleek UI! Thousands of curious visitors are landing on your homepage all at once.',
    severity: 'medium',
    minLevel: 2,
    duration: 40,
    effects: {
      latencyMultiplier: 2.2,
      errorRateIncrease: 0.10,
      throughputDrain: 0.30,
      userLossRate: 3
    },
    requirements: {
      components: ['dns_server', 'reverse_proxy'],
      minTier: 1
    },
    rewards: {
      coins: 700,
      xp: 120
    },
    penalty: {
      coinsLost: 300,
      usersLost: 75
    },
    inspiredBy: 'Slashdot effect / Hacker News front page hug-of-death'
  },
  {
    id: 'media_overload',
    name: 'Media Storage Overload',
    description: 'Users are uploading high-res photos and 4K video clips nonstop.',
    story: 'A weekend festival kicked off, and users are uploading hundreds of gigabytes of uncompressed media. Local server drives are running out of IOPS!',
    severity: 'medium',
    minLevel: 3,
    duration: 45,
    effects: {
      latencyMultiplier: 2.5,
      errorRateIncrease: 0.12,
      throughputDrain: 0.35,
      userLossRate: 8
    },
    requirements: {
      components: ['object_storage', 'cdn'],
      minTier: 1
    },
    rewards: {
      coins: 1200,
      xp: 220
    },
    penalty: {
      coinsLost: 600,
      usersLost: 250
    },
    inspiredBy: 'Instagram initial media scaling hurdles (2011)'
  },
  {
    id: 'disk_full',
    name: 'Disk Space Full',
    description: 'Application logs and temporary upload chunks filled local disk volume.',
    story: 'Application error logs and unpruned temporary upload buffers consumed 100% of local disk capacity, blocking write operations.',
    severity: 'medium',
    minLevel: 3,
    duration: 35,
    effects: {
      latencyMultiplier: 2.8,
      errorRateIncrease: 0.18,
      throughputDrain: 0.40,
      userLossRate: 10
    },
    requirements: {
      components: ['object_storage', 'load_balancer'],
      minTier: 1
    },
    rewards: {
      coins: 1000,
      xp: 200
    },
    penalty: {
      coinsLost: 500,
      usersLost: 300
    },
    inspiredBy: 'GitLab production incident (2017) disk exhaustion'
  },
  {
    id: 'config_disaster',
    name: 'Config Change Gone Wrong',
    description: 'A bad routing timeout in upstream proxy dropped live connection pools.',
    story: 'A typo in upstream proxy keep-alive settings caused cascading gateway 504 errors for inbound traffic.',
    severity: 'medium',
    minLevel: 3,
    duration: 35,
    effects: {
      latencyMultiplier: 3.0,
      errorRateIncrease: 0.22,
      throughputDrain: 0.45,
      userLossRate: 15
    },
    requirements: {
      components: ['load_balancer'],
      minTier: 2
    },
    rewards: {
      coins: 1400,
      xp: 250
    },
    penalty: {
      coinsLost: 750,
      usersLost: 450
    },
    inspiredBy: 'Fastly global outage caused by single configuration push (2021)'
  },
  {
    id: 'ddos_attack',
    name: 'DDoS Attack',
    description: 'A distributed botnet is saturating network bandwidth with junk packets.',
    story: 'Malicious actors launched a coordinated SYN flood and HTTP application layer attack against your primary endpoints.',
    severity: 'high',
    minLevel: 3,
    duration: 50,
    effects: {
      latencyMultiplier: 3.5,
      errorRateIncrease: 0.28,
      throughputDrain: 0.55,
      userLossRate: 30
    },
    requirements: {
      components: ['load_balancer', 'cdn'],
      minTier: 2
    },
    rewards: {
      coins: 2200,
      xp: 400
    },
    penalty: {
      coinsLost: 1200,
      usersLost: 1200
    },
    inspiredBy: 'Dyn DNS massive IoT botnet DDoS attack (2016)'
  },
  {
    id: 'cache_stampede',
    name: 'Cache Stampede',
    description: 'Hot cache keys expired simultaneously, exposing DB to dog-piling.',
    story: 'A viral thread cache key expired at peak hour. Hundreds of thousands of concurrent requests missed the cache and hammered the primary database at the same millisecond!',
    severity: 'high',
    minLevel: 4,
    duration: 50,
    effects: {
      latencyMultiplier: 4.0,
      errorRateIncrease: 0.35,
      throughputDrain: 0.60,
      userLossRate: 60
    },
    requirements: {
      components: ['redis_cache', 'read_replica'],
      minTier: 2
    },
    rewards: {
      coins: 3500,
      xp: 650
    },
    penalty: {
      coinsLost: 2000,
      usersLost: 3500
    },
    inspiredBy: 'Facebook cache invalidation cascade incident (2010)'
  },
  {
    id: 'sql_injection',
    name: 'SQL Injection Probing',
    description: 'Coordinated attack script injecting malicious SQL queries into search.',
    story: 'Automated vulnerability scanners are injecting heavy UNION SELECT queries into your search endpoint, trying to lock the catalog tables and extract passwords.',
    severity: 'high',
    minLevel: 4,
    duration: 40,
    effects: {
      latencyMultiplier: 3.2,
      errorRateIncrease: 0.25,
      throughputDrain: 0.50,
      userLossRate: 50
    },
    requirements: {
      components: ['redis_cache', 'read_replica'],
      minTier: 2
    },
    rewards: {
      coins: 3000,
      xp: 550
    },
    penalty: {
      coinsLost: 1800,
      usersLost: 2800
    },
    inspiredBy: 'PlayStation Network SQL Injection breach (2011)'
  },
  {
    id: 'db_meltdown',
    name: 'Database Meltdown',
    description: 'Cascading lock contention and runaway queries saturated database CPU.',
    story: 'A complex join across unindexed follower tables blocked the connection pool. Memory paging exploded and CPU spiked to 100%, causing total service paralysis!',
    severity: 'critical',
    minLevel: 4,
    duration: 60,
    effects: {
      latencyMultiplier: 5.5,
      errorRateIncrease: 0.50,
      throughputDrain: 0.75,
      userLossRate: 150
    },
    requirements: {
      components: ['redis_cache', 'read_replica', 'message_queue'],
      minTier: 2
    },
    rewards: {
      coins: 6000,
      xp: 1000
    },
    penalty: {
      coinsLost: 4000,
      usersLost: 8000
    },
    inspiredBy: 'Twitter "Fail Whale" database saturation era (2008-2010)'
  },
  {
    id: 'celebrity_joins',
    name: 'Celebrity Joins Platform',
    description: 'Mega-celebrity joins and posts, causing a massive thundering herd fan-out.',
    story: 'A global superstar created an account and published a live video teaser! Over 500,000 notifications and feed fan-outs fired in under 10 seconds, creating an extreme thundering herd.',
    severity: 'critical',
    minLevel: 5,
    duration: 60,
    effects: {
      latencyMultiplier: 5.0,
      errorRateIncrease: 0.45,
      throughputDrain: 0.70,
      userLossRate: 250
    },
    requirements: {
      components: ['rate_limiter', 'api_gateway', 'db_shard'],
      minTier: 2
    },
    rewards: {
      coins: 10000,
      xp: 2000
    },
    penalty: {
      coinsLost: 7500,
      usersLost: 25000
    },
    inspiredBy: 'Ellen DeGeneres Oscars tweet (2014) & Jennifer Aniston joining Instagram (2019)'
  }
];
