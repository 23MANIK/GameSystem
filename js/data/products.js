/**
 * products.js — what the player can choose to build.
 * Each is a classic system design problem. Only playable levels can be started;
 * everything else shows as locked until it is built.
 * Playable products take their level list from their pack (js/products/).
 * difficulty ('easy' | 'medium' | 'hard') is shown on the picker card.
 */

import { GUESTBOOK_LEVELS } from './levels.js';
import { URL_SHORTENER_LEVELS } from '../products/urlShortener/levels.js';
import { CLOUD_DRIVE_LEVELS } from '../products/cloudDrive/levels.js';
import { NEWS_FEED_LEVELS } from '../products/newsFeed/levels.js';

const levelList = levels => levels.map(l => ({ level: l.level, name: l.name, focus: l.subtitle, playable: !l.comingSoon }));

export const PRODUCTS = [
  {
    id: 'guestbook',
    difficulty: 'easy',
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
    difficulty: 'easy',
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
    difficulty: 'medium',
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
    difficulty: 'hard',
    name: 'Cloud Drive',
    likeWhat: 'like Google Drive',
    icon: '☁️',
    tagline: 'Upload, share and sync files of any size across devices. Blob storage, pre-signed URLs, chunked uploads, dedup, sync servers, conflicts and cold storage.',
    concepts: ['Blob storage', 'Pre-signed URLs', 'Chunked uploads', 'Dedup', 'WebSocket sync', 'Conflicts', 'Cold storage'],
    playable: true,
    levels: levelList(CLOUD_DRIVE_LEVELS)
  },
  {
    id: 'chat',
    difficulty: 'medium',
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
    difficulty: 'hard',
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
    difficulty: 'hard',
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
