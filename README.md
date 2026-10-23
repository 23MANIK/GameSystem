# Scale Architect — V1 (cold code)

This branch is a frozen copy of **V1**, exactly as it ran on
https://scale-architect.vercel.app before V2 replaced it.

- **Code:** tag `v1.0.0` plus the phone-layout fix (`fix/mobile-ui`, commits 1658681 and 333fc52).
- **What it is:** a browser game for learning system design. Pick a product (Guestbook, URL Shortener, Cloud Drive), build one server, and grow it level by level: separate database, load balancer, cache, CDN and more.
- **Do not change this branch.** New work happens on `v2`. It's kept so V1 can be read, run or redeployed at any time.

## Run it locally

No build step. Serve the folder and open it:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Roll back to V1

Copy `index.html`, `css/`, `js/` and the files in `deploy/` into the Vercel deploy folder and deploy it to production.
