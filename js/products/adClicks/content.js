/**
 * Ad click aggregator — words and explanations that differ from the Guestbook's.
 */

export const AD_CLICKS_VOCAB = {
  record: 'ad',
  records: 'ads',
  writeFails: 'every new ad and count fails',
  readName: 'click'
};

export const AD_CLICKS_INCIDENTS = {
  spike: [
    { name: 'Halftime ad', story: 'An ad aired at halftime: millions grab their phones and click.', mult: 1.6 },
    { name: 'Flash sale', story: 'A retailer started a flash sale and its ads are everywhere.', mult: 1.8 },
    { name: 'Black Friday', story: 'Black Friday: every advertiser is running at full budget.', mult: 2.0, minUsers: 80 }
  ],
  bots: [
    { name: 'Click farm', story: 'A click farm is hitting ads to drain competitors\' budgets.', mult: 3 },
    { name: 'Scraper wave', story: 'Scrapers are following every ad link they find.', mult: 4 }
  ],
  crash: [
    { name: 'Click processor crashed', story: 'One click processor ran out of memory and crashed. It is restarting.', crashed: 1 },
    { name: 'Hardware failure', story: 'A disk died in one of your click processors. It is being replaced.', crashed: 1 }
  ]
};

export const AD_CLICKS_ROLE_TEXT = {
  app: { job: 'The click processor: checks the impression ID, logs the click and redirects the visitor to the advertiser.' },
  db: { job: 'Stores ads and the click counts per ad per minute (an OLAP store like ClickHouse in real life).' },
  queue: { job: 'The click stream (Kafka / Kinesis): every click is appended here; workers count them in batches or windows.' },
  cache: { job: 'Remembers recent impression IDs, so a repeated click is dropped before it is counted.' },
  blob: { job: 'The data lake: every raw click in big, cheap files, for batch recounts and audits.', short: 'Data lake' },
  lb: { job: 'Spreads clicks across your click processors and skips any that are down.' }
};

export const AD_CLICKS_PART_TEXT = {
  storage: { whatItDoes: 'Where ads and click counts are saved. Its speed decides how many writes per second it can take: every click starts as a write.' }
};

export const AD_CLICKS_FIX_TEXT = {
  index: {
    name: 'Index on ad ID',
    short: 'Index ads by ad_id, so a click finds its target URL directly.',
    effect: 'Database CPU, disk reads and latency stop growing with the number of ads. Each new ad costs a little more.'
  }
};

export const AD_CLICKS_EXPLANATIONS = {
  storage: {
    title: '💾 Storage',
    body: `<p>Where data is saved so it survives a restart. Here: ads, and the clicks (or click counts) for each ad.</p>
      <p>Every click starts as a write, so disk <strong>speed</strong> matters more than size.</p>`
  },
  feature: {
    title: 'How the click counter uses your server',
    body: `<ul><li><code>GET /click/:adId</code>: find the ad's URL, record the click, answer 302. Every click.</li>
      <li><code>GET /api/metrics</code>: an advertiser's clicks per minute over a time range.</li>
      <li><code>POST /api/ads</code>: a new ad. Rare.</li></ul>
      <p>Clicks are billed, so the count must be <strong>complete</strong> (no lost clicks) and <strong>exact</strong> (no double counts).</p>`
  },
  database: {
    title: '🗄️ Database server',
    body: `<p>A machine whose only job is the data: <code>ads(id, advertiser_id, url)</code> and the click counts.</p>
      <p>In real life the counts live in an OLAP store (ClickHouse, Druid, BigQuery), built for adding up columns fast.</p>`
  },
  index: {
    title: '🔎 Index on ad ID',
    body: `<p>Without it, each click scans every ad to find where to send the visitor.</p>
      <p>With an index on <code>ad_id</code> the database jumps straight to the row.</p>`
  },
  messageQueue: {
    title: '📨 Click stream',
    body: `<p>An append-only log (Kafka, Kinesis). The click processor appends each click and redirects at once.</p>
      <p>Consumers read the log in order: a batch writer here, later a stream processor that counts per minute. The log keeps clicks for days, so a crashed consumer can replay.</p>`
  },
  cache: {
    title: '⚡ Impression ID cache',
    body: `<p>Redis holding the impression IDs counted in the last hours. "Seen this ID?" is one memory lookup.</p>
      <p class="info-eg">100 million IDs × 16 bytes ≈ 1.6 GB: a Redis cluster with replicas.</p>`
  },
  blobStorage: {
    title: '🗄️ Data lake',
    body: `<p>Cheap object storage (like S3) holding every raw click in big files, written straight from the stream (Kafka Connect, Firehose).</p>
      <p>Batch jobs (Spark) read it to recount clicks and correct the live totals.</p>`
  }
};
