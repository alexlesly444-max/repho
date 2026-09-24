# Reproducible security audit

Run from the repository root. This audit is intentionally based on inspectable static files and browser behavior; it does not claim that a third-party host or browser is infallible.

## 1. Inventory and dependency review

```sh
find . -type f -not -path './.git/*' | sort
find . -type f \( -name 'package.json' -o -name '*lock*' \) -print
```

Expected: only this application and documentation; no workflow, package or lock files, and no runtime dependencies.

## 2. Prohibited API scan

```sh
rg -n -i 'fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|localStorage|sessionStorage|indexedDB|document\.cookie|caches\.|navigator\.serviceWorker|<form|formaction=' index.html app.js styles.css
```

Expected: no matches. Also inspect every `http` occurrence:

```sh
rg -n 'https?://' index.html app.js styles.css
```

Expected: only the five fixed manual-upload destinations in `index.html`; none in JavaScript or CSS.

## 3. CSP, links, and safe rendering

```sh
rg -n "Content-Security-Policy|Referrer-Policy|name=\"referrer\"|target=\"_blank\"|rel=\"noopener noreferrer\"|innerHTML|outerHTML|insertAdjacentHTML" index.html app.js
```

Confirm the CSP defaults to `none`, permits scripts/styles only from self, permits images only from self/blob, and explicitly blocks connections, forms, objects/plugins, frames, workers, and media. This meta policy is defense in depth and cannot replace server-controlled HTTP security headers. Confirm five fixed external links, each with the required attributes, and no unsafe HTML sink.

## 4. Deployment boundary

```sh
find .github -type f -print 2>/dev/null
```

Expected: no files. Deployment is deferred to a separate reviewed task. GitHub Pages response headers are **not verified** because there is no deployment. If deployed later, use browser developer tools and `curl -I` against the real HTTPS URL to verify the effective CSP, Referrer-Policy, and other server-controlled headers; do not infer them from the meta CSP.

## 5. Browser checks

Serve the repository on loopback, open DevTools with network recording enabled, disable the network after initial load, and verify:

1. Russian UI and persistent privacy notice appear; EN/RU toggling works.
2. Keyboard focus is visible; narrow viewport controls remain usable.
3. Valid JPEG, PNG, and WebP load; renamed/mismatched, malformed, >20 MiB, and >32 MP inputs fail before editing.
4. Pointer dragging moves/resizes the crop. Arrows move it and Shift+arrows resize it. Zoom, rotation, reset, margin, clear, and replacement work.
5. Each JPEG/PNG export downloads under its fixed generic name and opens with the expected aspect ratio: Full clean re-encode, 4:5, and 1:1. Inspect outputs with a metadata tool such as `exiftool` and record exactly which metadata families were examined. Canvas re-encoding is intended to omit ordinary source metadata; do not describe limited tool results as proof that every possible trace was erased.
6. From a downloaded local folder, disconnect networking and navigate directly to its `file:///.../index.html`; test selection, editing, and all exports. This is the offline guarantee. Do not interpret a previously loaded hosted page as an offline test because no service worker or Cache Storage is present.
7. The Network panel shows no requests caused by selection, editing, clearing, or export. Do not click external links during this check.
8. External links have fixed destinations and require a separate manual upload.
9. After reset, replacement, clear, and export, previously captured blob URLs no longer resolve where the browser exposes that behavior. Close the tab to release remaining references; immediate memory overwrite cannot be proven.

Record browser name/version, operating system, test fixtures, results, and commit SHA with any release audit.
