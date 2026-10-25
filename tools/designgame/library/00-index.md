# Hello Interview: System Design Question Breakdowns (Index)

These are study notes I wrote myself from Hello Interview's 32 written breakdowns, made for later study and as reference material for game and level design. The originals are at https://www.hellointerview.com/learn/system-design/in-a-hurry/problem-breakdowns.

Status: ✅ = notes saved · ⏳ = pending

| # | Problem | Difficulty | Notes | Original |
|---|---|---|---|---|
| 1 | Bitly | Easy | ✅ 01-bitly.md | https://www.hellointerview.com/learn/system-design/problem-breakdowns/bitly |
| 2 | Dropbox | Easy | ✅ 02-dropbox.md | https://www.hellointerview.com/learn/system-design/problem-breakdowns/dropbox |
| 3 | Yelp | Easy | ✅ 03-yelp.md | https://www.hellointerview.com/learn/system-design/problem-breakdowns/yelp |
| 4 | Local Delivery Service (Gopuff) | Easy | ✅ 04-local-delivery-gopuff.md | https://www.hellointerview.com/learn/system-design/problem-breakdowns/gopuff |
| 5 | Ticketmaster | Medium | ✅ 05-ticketmaster.md | https://www.hellointerview.com/learn/system-design/problem-breakdowns/ticketmaster |
| 6 | Instagram | Medium | ✅ 06-instagram.md | https://www.hellointerview.com/learn/system-design/problem-breakdowns/instagram |
| 7 | FB News Feed | Medium | ✅ 07-fb-news-feed.md | https://www.hellointerview.com/learn/system-design/problem-breakdowns/fb-news-feed |
| 8 | Tinder | Medium | ✅ 08-tinder.md | https://www.hellointerview.com/learn/system-design/problem-breakdowns/tinder |
| 9 | LeetCode | Medium | ✅ 09-leetcode.md | https://www.hellointerview.com/learn/system-design/problem-breakdowns/leetcode |
| 10 | WhatsApp | Medium | ✅ 10-whatsapp.md | https://www.hellointerview.com/learn/system-design/problem-breakdowns/whatsapp |
| 11 | Strava | Medium | ✅ 11-strava.md | https://www.hellointerview.com/learn/system-design/problem-breakdowns/strava |
| 12 | Distributed Cache | Medium | ✅ 12-distributed-cache.md | https://www.hellointerview.com/learn/system-design/problem-breakdowns/distributed-cache |
| 13 | Rate Limiter | Medium | ✅ 13-rate-limiter.md | https://www.hellointerview.com/learn/system-design/problem-breakdowns/distributed-rate-limiter |
| 14 | Online Auction | Medium | ✅ 14-online-auction.md | https://www.hellointerview.com/learn/system-design/problem-breakdowns/online-auction |
| 15 | YouTube | Medium | ✅ 15-youtube.md | https://www.hellointerview.com/learn/system-design/problem-breakdowns/youtube |
| 16 | Job Scheduler | Medium | ✅ 16-job-scheduler.md | https://www.hellointerview.com/learn/system-design/problem-breakdowns/job-scheduler |
| 17 | FB Live Comments | Medium | ✅ 17-fb-live-comments.md | https://www.hellointerview.com/learn/system-design/problem-breakdowns/fb-live-comments |
| 18 | News Aggregator | Medium | ✅ 18-news-aggregator.md | https://www.hellointerview.com/learn/system-design/problem-breakdowns/google-news |
| 19 | Price Tracking Service | Medium | ✅ 19-price-tracking-camelcamelcamel.md | https://www.hellointerview.com/learn/system-design/problem-breakdowns/camelcamelcamel |
| 20 | Notification System | Medium | ✅ 20-notification-system.md | https://www.hellointerview.com/learn/system-design/problem-breakdowns/notification-system |
| 21 | YouTube Top K | Hard | ✅ 21-youtube-top-k.md | https://www.hellointerview.com/learn/system-design/problem-breakdowns/top-k |
| 22 | Uber | Hard | ✅ 22-uber.md | https://www.hellointerview.com/learn/system-design/problem-breakdowns/uber |
| 23 | Robinhood | Hard | ✅ 23-robinhood.md | https://www.hellointerview.com/learn/system-design/problem-breakdowns/robinhood |
| 24 | Google Docs | Hard | ✅ 24-google-docs.md | https://www.hellointerview.com/learn/system-design/problem-breakdowns/google-docs |
| 25 | Web Crawler | Hard | ✅ 25-web-crawler.md | https://www.hellointerview.com/learn/system-design/problem-breakdowns/web-crawler |
| 26 | Ad Click Aggregator | Hard | ✅ 26-ad-click-aggregator.md | https://www.hellointerview.com/learn/system-design/problem-breakdowns/ad-click-aggregator |
| 27 | FB Post Search | Hard | ✅ 27-fb-post-search.md | https://www.hellointerview.com/learn/system-design/problem-breakdowns/fb-post-search |
| 28 | Payment System | Hard | ✅ 28-payment-system.md | https://www.hellointerview.com/learn/system-design/problem-breakdowns/payment-system |
| 29 | Metrics Monitoring | Hard | ✅ 29-metrics-monitoring.md | https://www.hellointerview.com/learn/system-design/problem-breakdowns/metrics-monitoring |
| 30 | Online Chess | Hard | ✅ 30-online-chess.md | https://www.hellointerview.com/learn/system-design/problem-breakdowns/online-chess |
| 31 | ChatGPT | Hard | ✅ 31-chatgpt.md | https://www.hellointerview.com/learn/system-design/problem-breakdowns/chatgpt |
| 32 | Flash Sale | Hard | ✅ 32-flash-sale.md | https://www.hellointerview.com/learn/system-design/problem-breakdowns/flash-sale |

**Practice-only (no written breakdown yet):** Food Review App (Medium), Game Leaderboard (Medium), Donations Website (Hard), GitHub Actions (Hard).

## Pattern cross-reference (which breakdowns to study for each pattern)
- **Scaling Reads (caching, CDN, precompute):** Bitly, Yelp, Gopuff, Instagram, FB News Feed, News Aggregator, YouTube, Top K, FB Post Search, Metrics Monitoring
- **Scaling Writes (sharding, batching, queues):** Top K, Ad Click Aggregator, Strava, Job Scheduler, Rate Limiter, Metrics Monitoring, FB Post Search
- **Dealing with Contention (locks, OCC, SKIP LOCKED):** Ticketmaster, Online Auction, Tinder, Uber, Online Chess, Flash Sale, Yelp (avg rating), Rate Limiter
- **Real-time Updates (WS/SSE/Pub-Sub):** WhatsApp, FB Live Comments, Google Docs, Robinhood, Online Auction, Online Chess, ChatGPT
- **Multi-step Processes / Durable workflows:** Payment System, Notification System, Uber (driver timeouts), Robinhood (order reconciliation)
- **Handling Large Blobs:** Dropbox, YouTube, Instagram
- **Managing Long Running Tasks:** LeetCode, YouTube transcoding, Job Scheduler, ChatGPT, Web Crawler
- **Proximity Search:** Yelp, Uber, Gopuff, Tinder

## Top picks for the gamification app
1. **Online Chess:** matchmaking, authoritative game server, fair clocks, leaderboards
2. **LeetCode:** competitions, live leaderboard (Redis ZSET), sandboxed judging
3. **Strava:** activity tracking, offline-first, regional and time leaderboards
4. **Rate Limiter:** a token bucket is the same thing as an energy/stamina system
5. **Flash Sale / Ticketmaster:** limited drops, timed holds, waiting rooms
6. **Job Scheduler / Notification System:** daily quests, timed rewards, re-engagement pushes
7. **YouTube Top K:** trending leaderboards (hourly, daily, all-time)
