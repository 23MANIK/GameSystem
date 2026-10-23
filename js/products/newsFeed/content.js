/**
 * News feed — words and explanations that differ from the Guestbook's.
 */

export const NEWS_FEED_VOCAB = {
  record: 'post',
  records: 'posts',
  writeFails: 'every new post fails',
  readName: 'feed load'
};

export const NEWS_FEED_INCIDENTS = {
  spike: [
    { name: 'Viral post', story: 'A post went viral: everyone is opening the app to see it.', mult: 1.5 },
    { name: 'Breaking news', story: 'Breaking news: people are refreshing their feeds nonstop.', mult: 1.8 },
    { name: 'Big match final', story: 'A cup final: millions are posting and scrolling at once.', mult: 2.0, minUsers: 80 }
  ],
  bots: [
    { name: 'Spam wave', story: 'A spam network is posting crypto scams through POST /api/posts.', mult: 3 },
    { name: 'Bot farm', story: 'Thousands of fake accounts are posting in a loop.', mult: 4 }
  ],
  crash: [
    { name: 'App server crashed', story: 'One of your app servers ran out of memory and crashed. It is restarting.', crashed: 1 },
    { name: 'Hardware failure', story: 'A disk died in one of your app servers. It is being replaced.', crashed: 1 }
  ]
};

export const NEWS_FEED_ROLE_TEXT = {
  db: { job: 'Stores every post and who follows whom.' },
  cache: { job: 'Keeps each active user\'s feed as a list of post IDs, so a scroll is one lookup.' },
  queue: { job: 'Holds "new post" jobs; fan-out workers copy each post into its followers\' feeds in the background.' },
  idgen: { job: 'Hands out unique, time-ordered post IDs (Snowflake-style) across every shard.' },
  cdn: { job: 'Serves photos and pages from servers near each user.' },
  gateway: { job: 'Front door for every API call. Rate limiting stops bots posting thousands of times.' }
};

export const NEWS_FEED_PART_TEXT = {
  storage: { whatItDoes: 'Where posts are saved so they survive a restart. Its speed decides how many reads and writes per second it can do.' }
};

export const NEWS_FEED_FIX_TEXT = {
  pagination: {
    name: 'Cursor pagination',
    short: 'Return 50 posts per page and a cursor ("older than post 9381") for the next page, instead of every post.',
    effect: 'Feed responses stop growing with the number of posts: much less network and database work.'
  },
  index: {
    name: 'Index on (author, time)',
    short: 'Index posts by (author_id, created_at), so the database reads only each followee\'s newest posts.',
    effect: 'Database CPU, disk reads and latency stop growing with the number of posts. Each new post costs a little more.'
  },
  archive: {
    name: 'Keep the newest feed window',
    short: 'Keep only the newest posts in the hot database; older ones move to cheap cold storage.',
    effect: 'The hot table stops growing: disk space, scans and responses stay flat. Old posts are still there when someone scrolls far back.'
  }
};

export const NEWS_FEED_EXPLANATIONS = {
  storage: {
    title: '💾 Storage',
    body: `<p>Where data is saved so it survives a restart. Here: every post (author, text, time) and the follow graph.</p>
      <p>Disk <strong>speed</strong> decides how fast rows are found and written. Disk <strong>space</strong> decides how many posts fit.</p>`
  },
  feature: {
    title: 'How the feed uses your server',
    body: `<ul><li><code>POST /api/posts</code>: save a post. A write.</li>
      <li><code>GET /api/feed</code>: the newest posts of everyone you follow. A read, and an expensive one: it merges many people's posts.</li></ul>
      <p>Feeds are read ~50× more than posts are written, so the read path is what you optimise.</p>`
  },
  database: {
    title: '🗄️ Database server',
    body: `<p>A machine whose only job is the data: <code>posts(id, author_id, text, created_at)</code> and <code>follows(follower_id, followee_id)</code>.</p>
      <p>Splitting it off means each machine can be sized for its own job.</p>`
  },
  diskSpace: {
    title: '💽 Disk space',
    body: `<p>Every post is a row on the database disk, and posts are kept forever.</p>
      <p>When the disk is full, <strong>every new post fails</strong>. Fixes: a bigger disk, keeping only the newest window hot, or shards (Level 8).</p>`
  },
  pagination: {
    title: '📄 Cursor pagination',
    body: `<p>Return one page of the feed (say 50 posts) plus a <em>cursor</em>: "posts older than ID 9381". The next request continues from there.</p>
      <p>Unlike page numbers, new posts arriving at the top don't shift the pages, so nothing is shown twice.</p>`
  },
  index: {
    title: '🔎 Index on (author, time)',
    body: `<p>Without it, building a feed scans every post to find your followees' newest ones.</p>
      <p>With an index on <code>(author_id, created_at)</code> the database jumps straight to each followee's newest posts.</p>`
  },
  cache: {
    title: '⚡ Feed cache',
    body: `<p>Each active user's home feed kept in memory (Redis) as a list of post IDs. A scroll reads one list instead of merging many people's posts.</p>
      <p>To keep the lists fresh, each new post is pushed into its followers' lists: <em>fan-out on write</em>.</p>
      <p class="info-eg">Twitter kept ~800 tweet IDs per timeline in Redis, replicated 3×.</p>`
  }
};
