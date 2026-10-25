# Hello Interview: Advanced Topics (Index)

My own study notes from Hello Interview's Advanced Topics deep dives. They're companions to the 32 question breakdowns in `hello-interview/00-index.md`.

| # | Topic | Notes | Original | Use it for |
|---|---|---|---|---|
| A1 | Proximity Search | A1-proximity-search.md | https://www.hellointerview.com/learn/system-design/deep-dives/proximity-search | Nearby search: quadtree, k-d/BKD, R-tree, geohash, S2, H3 |
| A2 | Data Structures for Big Data | A2-data-structures-for-big-data.md | https://www.hellointerview.com/learn/system-design/deep-dives/data-structures-for-big-data | Bloom filter, Count-Min Sketch, HyperLogLog, histograms |
| A3 | Vector Databases | A3-vector-databases.md | https://www.hellointerview.com/learn/system-design/deep-dives/vector-databases | Embeddings, HNSW/IVF/LSH/Annoy, filtering, RAG and recommendations |
| A4 | Time Series Databases | A4-time-series-databases.md | https://www.hellointerview.com/learn/system-design/deep-dives/time-series-databases | LSM, delta/XOR compression, time partitions, rollups, cardinality |
| A5 | Change Data Capture | A5-change-data-capture.md | https://www.hellointerview.com/learn/system-design/deep-dives/change-data-capture | WAL→Kafka sync, migrations, outbox vs CDC vs jobs |

## Quick decision guide
- **"Find things near X"** → A1 (encoded cells for moving points, R-tree for shapes; always post-filter).
- **"Count, dedup or percentiles at huge scale with some error allowed"** → A2.
- **"Find things similar to X"** → A3 (start with pgvector; HNSW).
- **"Huge write rate of metrics or events over time"** → A4 (only if tags are low-cardinality).
- **"Keep a second store in sync"** → A5 (CDC for copies, outbox for business events, queues for jobs).
