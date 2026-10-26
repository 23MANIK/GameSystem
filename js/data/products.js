/**
 * products.js — what the player can choose to build.
 * Each is a classic system design problem. Only playable levels can be started;
 * everything else shows as locked until it is built.
 * Playable products take their level list from their pack (js/products/).
 */

import { GUESTBOOK_LEVELS } from './levels.js';
import { URL_SHORTENER_LEVELS } from '../products/urlShortener/levels.js';
import { CLOUD_DRIVE_LEVELS } from '../products/cloudDrive/levels.js';
import { NEWS_FEED_LEVELS } from '../products/newsFeed/levels.js';
import { TICKETING_LEVELS } from '../products/ticketing/levels.js';
import { AD_CLICKS_LEVELS } from '../products/adClicks/levels.js';

const levelList = levels => levels.map(l => ({ level: l.level, name: l.name, focus: l.subtitle, playable: !l.comingSoon }));

export const PRODUCTS = [
  {
    id: 'guestbook',
    name: 'Guestbook',
    likeWhat: 'Tutorial',
    icon: '📖',
    tagline: 'Anyone can read every entry and sign with their name. Start with one server and grow it into a full web-scale system, one piece at a time.',
    concepts: ['Vertical scaling', 'Database', 'Rate limiting', 'Load balancing', 'Caching', 'CDN'],
    playable: true,
    // Level numbers map to LEVELS in levels.js; only those with playable: true can start
    levels: levelList(GUESTBOOK_LEVELS)
  },
  {
    id: 'url_shortener',
    name: 'URL Shortener',
    likeWhat: 'like bit.ly',
    icon: '🔗',
    tagline: 'Turn long links into short ones and redirect millions of clicks fast. Index, Base62 codes, rate limits, caching, click analytics, sharding and edge redirects.',
    concepts: ['Base62 / ID generation', 'Indexes', 'Rate limiting', 'Read-heavy caching', 'Message queues', 'Sharding', 'Edge redirects'],
    playable: true,
    levels: levelList(URL_SHORTENER_LEVELS)
  },
  {
    id: 'news_feed',
    name: 'News Feed',
    likeWhat: 'like Twitter / Instagram',
    icon: '📰',
    tagline: 'Users post, follow each other and scroll a personal feed. Pagination, rate limits, feed caches, fan-out on write through a queue, the celebrity problem, sharding and photos at the edge.',
    concepts: ['Cursor pagination', 'Rate limiting', 'Feed cache', 'Fan-out on write', 'Hybrid fan-out', 'Sharding / Snowflake IDs', 'CDN'],
    playable: true,
    levels: levelList(NEWS_FEED_LEVELS)
  },
  {
    id: 'cloud_drive',
    name: 'Cloud Drive',
    likeWhat: 'like Google Drive',
    icon: '☁️',
    tagline: 'Upload, share and sync files of any size across devices. Blob storage, pre-signed URLs, chunked uploads, dedup, sync servers, conflicts and cold storage.',
    concepts: ['Blob storage', 'Pre-signed URLs', 'Chunked uploads', 'Dedup', 'WebSocket sync', 'Conflicts', 'Cold storage'],
    playable: true,
    levels: levelList(CLOUD_DRIVE_LEVELS)
  },
  {
    id: 'ticketing',
    difficulty: 'medium',
    name: 'Ticket Booking',
    likeWhat: 'like Ticketmaster',
    icon: '🎟️',
    tagline: 'Show events, draw seat maps and sell every seat exactly once, even when millions want the same show. Seat holds, scalper bots, caching, search and a virtual waiting room.',
    concepts: ['Seat holds (TTL locks)', 'Rate limiting', 'Load balancing', 'Read-heavy caching', 'Search index', 'Virtual waiting room'],
    playable: true,
    levels: levelList(TICKETING_LEVELS)
  },
  {
    id: 'ad_clicks',
    difficulty: 'hard',
    name: 'Ad Click Aggregator',
    likeWhat: 'like Google Ads reporting',
    icon: '🖱️',
    tagline: 'Count billions of ad clicks exactly once and show advertisers live numbers. Click streams, stream aggregation, dedup with impression IDs, hot ads, reconciliation and sharding.',
    concepts: ['Message queues / streams', 'Stream aggregation', 'Idempotency / dedup', 'Hot partitions', 'Lambda architecture', 'Sharding'],
    playable: true,
    levels: levelList(AD_CLICKS_LEVELS)
  },
  {
    id: 'chat',
    name: 'Chat App',
    likeWhat: 'like WhatsApp',
    icon: '💬',
    tagline: 'Real-time one-to-one and group messages.',
    concepts: ['WebSockets', 'Message queues', 'Presence'],
    levels: [
      { level: 1, name: 'Say Hi', focus: 'Polling on one server' },
      { level: 2, name: 'Real Time', focus: 'WebSocket servers' },
      { level: 3, name: 'Groups and Offline', focus: 'Queues and message storage' }
    ]
  },
  {
    id: 'video',
    name: 'Video Streaming',
    likeWhat: 'like YouTube',
    icon: '🎬',
    tagline: 'Upload videos and stream them smoothly worldwide.',
    concepts: ['Transcoding pipeline', 'CDN', 'Adaptive bitrate'],
    levels: [
      { level: 1, name: 'First Upload', focus: 'Store and serve one file' },
      { level: 2, name: 'Transcoding', focus: 'Worker queue' },
      { level: 3, name: 'Worldwide', focus: 'CDN everywhere' }
    ]
  },
  {
    id: 'ride_hailing',
    name: 'Ride Hailing',
    likeWhat: 'like Uber',
    icon: '🚕',
    tagline: 'Match riders with nearby drivers in seconds.',
    concepts: ['Geo indexing', 'Location updates', 'Matching'],
    levels: [
      { level: 1, name: 'One City', focus: 'Locations on one server' },
      { level: 2, name: 'Live Map', focus: 'Fast location updates' },
      { level: 3, name: 'Many Cities', focus: 'Geo sharding' }
    ]
  }
];

export function getProduct(id) {
  return PRODUCTS.find(p => p.id === id) || PRODUCTS[0];
}
