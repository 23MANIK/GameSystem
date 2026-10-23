# Cloud Drive (like Dropbox / Google Drive): level design (draft)

Status: **playable, 11 levels.** Code: `js/products/cloudDrive/`. Balance check: `node tools/balance-levels.mjs cloud_drive`.

**Base source: Hello Interview, *Design Dropbox*.** Its requirements, its "bad → good → great" options and its deep dives set the core levels (1–7) and their order. Other sources (section 1b) only add extra levels or real-world numbers where Hello Interview doesn't go. All notes are our own summaries, used to design our levels, not copies.

## 1. What the base source covers (our summary)

**Requirements**
- Upload and download from any device.
- Share with other users, and see files shared with you.
- Sync automatically across devices.
- Out of scope: editing, previews, versioning, per-user quotas, virus scanning.
- Non-functional:
  - Availability over consistency: a few seconds' lag before another user sees a file is fine.
  - Files up to 50 GB.
  - Durable (lost or corrupted files can be recovered), secure, and fast to upload, download and sync.

**Entities and API**
- Three entities: File (the bytes), FileMetadata (name, size, type, owner, status, where it's stored) and User.
- API: `POST /files`, `GET /files/{id}`, `POST /files/{id}/share`, `GET /files/changes?since=…`.
- User identity comes from the auth token in headers, never from the request body.

**High-level design, each part from worst to best**

| Concern | Bad | Good | Best |
|---|---|---|---|
| Storing bytes | On the app server's disk | Blob storage (S3), with the app server in the middle | Client uploads **directly** to blob storage with a short-lived pre-signed URL; the app server only signs URLs and records metadata |
| Downloading | Through the app server | Straight from blob storage | From a **CDN**, using signed URLs |
| Sharing | A share list inside each file's metadata (slow "shared with me") | Cache the lookups | A separate **shares table** keyed by user (userId → fileId) |
| Metadata DB | — | DynamoDB or Postgres both fine | — |

**Sync**
- Local → remote: an agent on the device watches the folder (OS file events), queues changed files and uploads them. Conflicts are settled by last-write-wins.
- Remote → local: one WebSocket or SSE connection per device pushes change notices, with polling `changes?since=` every few minutes as a safety net in case a notice is lost.

**Deep dives**
1. **Large files (the core of the problem).**
   - One 50 GB request fails for several reasons:
     - It takes about 1.1 h at 100 Mbps.
     - Gateways cap request bodies; API Gateway allows about 10 MB.
     - A dropped connection means starting again.
     - The user sees no progress.
   - The fix is client-side chunking (5–10 MB):
     - Each chunk gets a fingerprint (SHA-256), and so does the whole file.
     - Chunk status is tracked in metadata; the server verifies each chunk with S3 rather than trusting the client.
     - This is S3's multipart upload: one pre-signed URL per part, then an assemble step.
   - What this gives you:
     - A progress bar, resumable uploads and parallel chunk uploads.
     - Deduplication: the same fingerprint means the bytes are already stored.
     - Downloads don't need chunks; HTTP Range requests resume them.
2. **Speed.**
   - Upload chunks in parallel and adapt chunk size to the connection.
   - Sync only the chunks that changed (delta sync). Fixed-size chunks break this, because inserting one byte shifts every later chunk; **content-defined chunking** (a rolling hash, e.g. Rabin) keeps edits local.
   - Compress on the client, but only types that shrink (text yes, images and video no). Zstandard, Brotli and Gzip are the usual choices. Always compress *before* encrypting.
3. **Security.**
   - HTTPS in transit and encryption at rest (S3 server-side encryption).
   - The shares table acts as the access control list.
   - Signed URLs expire in minutes. They're bearer tokens, so add IP binding or cookies when stronger protection is needed.

**Points raised in the discussion under the article**
- A CDN may not pay off: most files are private and read rarely by their owner, so a CDN mainly helps publicly shared or cross-region files. Measure before adding one.
- Storing chunks as separate objects, with a manifest listing them, is the alternative to assembling one object. It's how video streaming works, and it makes delta sync easier.

## 1b. What the other sources add

- **System Design Handbook, "Google Drive system design".**
  - Chunks of about 4–8 MB, deduplicated by content hash.
  - The metadata DB holds names, folders, permissions, versions and the chunk map. It needs strong consistency and is sharded by user or folder.
  - Sync uses an **ordered change log**: each device catches up from its last sequence number. Push via WebSocket plus polling as a fallback.
  - Conflicts have four options:
    - last-write-wins (simple, loses data)
    - version branching
    - merging (OT/CRDTs, for documents)
    - a "conflicted copy" file (for binary files)
  - Versioning: full snapshots restore fast but cost space; diffs are the reverse.
  - Storage tiers: hot vs cold, and erasure coding instead of 3× copies.
  - Estimate:
    - 500M users × 5 GB ≈ 2.5 EB logical; about 4.5 EB physical after 3× copies and ~40% dedup.
    - About 60k metadata queries/s vs about 3k file operations/s: **metadata traffic is ~20× file traffic.**
- **Educative, "Google Drive system design".** Frames the hard part as concurrent edits on shared, mutable files.
- **Dropbox Tech, "Rewriting the heart of our sync engine" (Nucleus, 2020).**
  - About four years to rebuild desktop sync.
  - The old model had no stable file IDs across moves and assumed no sharing.
  - The new one has strict invariants, stable unique IDs, and atomic moves.
  - The client and server must agree on the remote state before applying a change.
  - It runs millions of seeded random simulations a day.
- **Dropbox Magic Pocket** (Dropbox Tech blog, QCon 2022 talk). Dropbox's own exabyte-scale, immutable blob store, built to replace S3 and save cost. It's multi-region, aims for 99.99% availability, and uses dense drives (SMR).

## 2. Problems → levels (as built, easy → hard)

| # | Level | Problem the player feels | New piece | Code fix / switch |
|---|---|---|---|---|
| 1 | My First Upload | One box holds code, metadata AND file bytes; disk fills fast | One server | — |
| 2 | Bytes vs Metadata | A server disk holds only a few hundred files | **Blob storage** + metadata DB | Index on (owner, folder) |
| 3 | Direct Uploads | Every byte passes through the app server | — | **Pre-signed URLs** (Hello Interview: bad → good → great upload) |
| 4 | Big Files | Multi-GB uploads hit size limits, time out, restart from zero | **API gateway + load balancer** (HI's "front door") | **Chunked, resumable uploads** |
| 5 | Trust but Verify | Clients report "chunk done" wrongly: files marked complete with a chunk missing | — | **Server-side chunk checks** (HI: client PATCH = good, server verification = great) |
| 6 | Same Files Everywhere | Storage bill; copies uploaded again and again | — | **Fingerprints + dedup**; compression switch (helps text, not media) |
| 7 | Sharing | "Shared with me" scans every file's share list | Cache | **Shares table** (HI: share list in metadata → cache → separate table) |
| 8 | Sync Everywhere | 3 devices per user poll constantly; changes arrive late | **Sync server** (WebSocket, RAM per device) | **Delta sync** (content-defined chunks) |
| | *Extras (from other sources)* | | | |
| 9 | Two Edits at Once | Last write wins silently loses edits | — | **Versions + conflicted copies** (+30% storage) |
| 10 | Exabytes for Less | Storage bill; metadata traffic about 20× file traffic swamps one DB | **Metadata shards** | **Cold storage tier** |
| 11 | Downloads Worldwide | Viral public links, users far away | **CDN** | Signed, expiring links (CDN only pays off for public files) |

Simulator params added for this product (all generic, reusable):
- `readKind: 'file'`, `readKB`, `writeKB`, `recordSpace`, `blobSpaceMult`
- `bigFileShare`, `unverifiedShare`, `dedupShare`, `updateShare`
- `devicesPerUser`, `pollPerDevice`, `listReadsPerUser`, `browsePerUser`, `conflictShare`, `publicShare`

New roles: `blob`, `sync`. New fixes: `presigned`, `chunking`, `verifyUploads`, `dedup`, `compress` (toggle), `sharesTable`, `deltaSync`, `versions`, `coldTier`.

## 3. My inputs (beyond the base source)

1. **Storage cost should be a real pressure.** In Drive-like products the bill is storage (GB-months), not CPU. Give blob storage a cheap price per GB and the app server's disk an expensive one. Then moving bytes to blob storage (L2) and dedup (L5) visibly save money.
2. **Large files are where the base source puts most of its weight**, so they get two levels: L4 (chunking and resume) and L5 (fingerprints and dedup).
3. **Measure whether to add a CDN**, as the discussion points out. The CDN level can be optional, or only pay off when the "public link" traffic share is high. Learning to measure first is the lesson.
4. **Sync connections cost RAM, not CPU.** One open WebSocket per device means the sync server's RAM grows with *online devices*, whether or not anything happens. This teaches a new kind of bottleneck. The game has a RAM-per-user load already, so it's cheap to add.
5. **Conflicts** now have their own level (L8). Last-write-wins vs keep-both is a real trade-off: losing edits vs extra storage and user confusion.
7. **Metadata is the hidden hot path.** About 20× more metadata operations than file operations, so sharding the metadata DB (L9) mirrors the URL shortener's sharding lesson in a new context.
6. **Real numbers for the realWorld notes** (section 1b):
   - Magic Pocket is exabyte-scale, multi-region, aims for 99.99% availability, and replaced S3 to save cost.
   - Nucleus took about four years and runs millions of simulations a day.
   - The Handbook's 500M users × 5 GB ≈ 2.5 EB estimate.

## 4. New engine mechanics this needs

| Mechanic | How (generic) |
|---|---|
| Blob storage role | New role `blob`: huge space, cheap, slow-ish per request; usage is bytes stored and bandwidth |
| Upload bytes vs requests | Level param `uploadMB` per write; with `presignedUpload`, the bytes skip the app's and gateway's network and go straight to `blob` |
| Request size limit | Gateway `maxBodyMB`; uploads above it fail unless `chunking` is on |
| Dedup / compression | Fix `dedup` cuts stored bytes by a level-set share; switch `compress` trades client time for bytes |
| Sync connections | Role `sync`: RAM per online device; queue for change events; `pollingShare` load on the API when there are no push notices |
| Storage cost | Running cost per GB stored on `blob` vs app or DB disks |

## 5. Sources

Read so far:
- Hello Interview, *Design Dropbox* (base)
- System Design Handbook, *Google Drive system design* (systemdesignhandbook.com/guides/google-drive-system-design)
- Educative, *Google Drive system design* (educative.io/blog/google-drive-system-design)
- Dropbox Tech, *Rewriting the heart of our sync engine* (dropbox.tech)
- Dropbox Tech, *Improving storage efficiency in Magic Pocket* (dropbox.tech)
- QCon SF 2022, *Magic Pocket* talk (qconsf.com)

- Hello Interview, *Handling Large Blobs* pattern (public preview only: confirms pre-signed URLs, resumable uploads, and keeping upload status in sync)

Still worth reading (open in the browser if you can):

1. Hello Interview pattern **"Handling Large Blobs"** (linked from the article, under Patterns).
2. ByteByteGo / *System Design Interview* Vol. 1, chapter **"Design Google Drive"**: block servers, sync conflicts, notification service, numbers.
3. Dropbox Tech Blog: **"Inside the Magic Pocket"** (their storage system) and **"Rewriting the heart of our sync engine"** (Nucleus).
4. Optional: the **tus.io** resumable upload protocol, and AWS docs on **S3 Multipart Upload** and **pre-signed URLs**, for the realWorld notes.
