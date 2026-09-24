# Independent security and correctness audit

**Audit target:** commit `0458546` plus this report only  
**Audit date:** 2026-09-24  
**Scope:** `index.html`, `app.js`, `styles.css`, `README.md`, `SECURITY.md`, and `docs/THREAT_MODEL.md`  
**Release scope assessed:** downloaded-folder/local use only; no deployment exists

## Method and status vocabulary

The application source was inspected independently; existing prose documentation was treated only as a claim to compare with code. Static inspection used `git ls-files`, `rg`, `sed`, `find`, and `node --check app.js`. Runtime checks used the Chromium 140 already present in the environment (no package installation) with the browser context set offline before navigating directly to `file:///workspace/repho/index.html`. Synthetic files were used; no external service was contacted.

Every conclusion below has exactly one of the requested statuses: **verified**, **finding**, or **not verified**. Runtime observations are explicitly distinguished from source inspection.

## 1. Network and third parties

### 1.1 Network-capable code, remote assets, analytics, and hidden upload

**Status: verified.**

Method: searched runtime files for `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, dynamic `import()`, `importScripts`, analytics/tracker terms, remote resource elements, and CSS `@import`/`url()`. No network API, dynamic import, analytics, tracker, or upload path was found. `index.html:9` loads only `styles.css`; `index.html:78` loads only `app.js`. There are no `<img src>`, external fonts, forms, or remote scripts/styles/images. The only image assignment is `candidate.src=url` at `app.js:24`, where `url` is returned locally by `URL.createObjectURL(file)` on the selected `File` in the same statement.

Runtime evidence: with Chromium's context offline, local loading, file validation, rotation, zoom, keyboard crop adjustment, and three exports produced only `file:///workspace/repho/{index.html,styles.css,app.js}` and `blob:null/...` requests. The recorded external-request list was empty and no page exception occurred.

### 1.2 External service links

**Status: verified.**

Method: inspected every HTTP(S) literal. Exactly five exist, all as ordinary static `<a>` elements at `index.html:69-73`: Google Lens, Bing Visual Search, Yandex Images, TinEye, and Lenso. Their `href` values are fixed service roots with no query, fragment, interpolation, image bytes, source filename, object URL, or other photo-derived value. No JavaScript reads or rewrites these anchors. Each requires a user click and is labelled as manual upload by the adjacent localized text at `index.html:67` and the link text at `index.html:69-73`.

All five have `target="_blank"` and `rel="noopener noreferrer"` at `index.html:69-73`. The page-wide `<meta name="referrer" content="no-referrer">` is also present at `index.html:7`.

## 2. Local data handling

### 2.1 Servers, identity, storage, and persistence

**Status: verified.**

Method: inspected all seven tracked project files and searched runtime code for server endpoints, authentication/credential handling, databases, cloud services, cookies, `localStorage`, `sessionStorage`, IndexedDB, Cache Storage, and service workers. None is present. `git ls-files` lists only the three runtime files and four documentation files; `find` found no workflow, package manifest, or lock file. State consists of module variables `image`, `objectUrl`, `lang`, `crop`, and `drag` at `app.js:9-11`, so image/editor state is not persisted across a page lifecycle.

### 2.2 Browser-memory image lifecycle

**Status: verified.**

Source evidence: the selected `File` is represented by a temporary object URL and decoded into an `Image` at `app.js:24`; the decoded `Image` is retained in the module-scoped `image` variable at `app.js:9,24` and used by `draw()` and `renderExport()` at `app.js:27,36`. `clearImage()` nulls that reference, clears the file input/canvas, and disables editing at `app.js:21`.

This demonstrates browser-memory retention during editing. It does **not** demonstrate physical overwriting of browser or operating-system memory, and the application does not claim that guarantee (`README.md:24`; `docs/THREAT_MODEL.md:39`).

### 2.3 Object URL revocation

**Status: verified.**

Source evidence:

- `revoke()` calls `URL.revokeObjectURL` and clears the tracked value (`app.js:19`).
- replacement and clearing call `revoke()` (`app.js:21,24`);
- decode rejection and decoded-size rejection revoke the candidate URL (`app.js:24`);
- reset revokes the successfully decoded source URL after drawing (`app.js:26`);
- each export URL is revoked from a zero-delay callback after triggering the download (`app.js:36`);
- `beforeunload` calls `revoke()` (`app.js:39`).

Runtime evidence: instrumentation around `URL.createObjectURL`/`URL.revokeObjectURL` observed five URLs (two decode attempts that reached object-URL creation and three exports), and every created URL appeared in the revoked list after export/clear. Revocation was observed as an API call; immediate physical memory erasure is not inferred.

### 2.4 Source filenames

**Status: verified.**

Method: searched for `file.name`, `filename`, download handling, URL assignments, and DOM text sinks. Runtime code never reads `File.name`. The test selected a valid file named `SECRET-SOURCE-NAME.png`; that string did not occur in `body.textContent`. Export names come exclusively from the constant map `{clean:'photo-clean-reencode', portrait:'photo-portrait-4x5', square:'photo-square'}` at `app.js:36`. No log API exists, and the only service URLs are the fixed literals at `index.html:69-73`.

## 3. Image processing and exports

### 3.1 Fixed export names and dimensions

**Status: verified.**

Source evidence: `app.js:36` selects one of three fixed names and appends only the locally selected output extension. Full-size export draws from the decoded `image`; crop exports draw from the local preview canvas. Portrait output dimensions are forced to a 4:5 integer ratio and square width equals height, also at `app.js:36`.

Runtime evidence: offline Chromium produced exactly `photo-clean-reencode.png`, `photo-portrait-4x5.png`, and `photo-square.png`. No source-derived name was used.

### 3.2 “Full clean re-encode” and metadata wording

**Status: verified.**

Method: inspected the full-size branch at `app.js:36`. It draws decoded image pixels into a newly created canvas and calls `canvas.toBlob`; it does not copy source container bytes or metadata structures. This supports the limited expectation that ordinary source metadata is omitted during browser re-encoding. The UI calls it “Полное чистое перекодирование” / “Full clean re-encode” and expressly says exhaustive trace erasure is not guaranteed (`index.html:58,62`; `app.js:14-15`). `README.md:9` likewise warns that the browser encoder may add implementation data or leave unrecognized traces.

### 3.3 Exhaustive metadata/forensic erasure

**Status: not verified.** Precise reason: proving absence of every possible trace across all supported browser encoders and file formats requires broader forensic tooling and browser/version coverage than this environment provides. No such guarantee is made by the application.

### 3.4 Unsupported, mismatched, and malformed files

**Status: verified.**

Source evidence: the file handler checks 20 MiB before reading; permits only JPEG/PNG/WebP declared MIME types; verifies JPEG/PNG magic bytes and both RIFF/WEBP markers; relies on decoder `onerror` for malformed content; and rejects decoded images above 32 megapixels before enabling editing (`app.js:3-5,23-24`). Each explicit rejection calls `clearImage()` and sets a localized error status (`app.js:14-15,21,24`).

Runtime evidence under offline Chromium:

- an unsupported `text/plain` file was rejected with the visible “not a valid JPEG, PNG, or WebP” status and disabled controls;
- PNG bytes declared as JPEG were rejected with the same safe state;
- a PNG signature followed by malformed data reached decoder failure and produced the same safe state;
- a 20 MiB + 1 byte input produced the visible size error and disabled controls;
- a compact synthetic 6000×6000 (36 MP) PNG produced the visible 32-megapixel error and disabled controls;
- browser-generated valid JPEG and WebP files both reached “ready to edit.”

### 3.5 Low-level file-read failure

**Status: finding. Severity: low.** A lower-level `File.slice(...).arrayBuffer()` rejection is not converted into a user-visible failure. `signature()` awaits that operation at `app.js:23`, while the async change handler at `app.js:24` has no rejection handler. If the selected file becomes unreadable or the browser reports an I/O failure, the promise rejects, leaving an unhandled error and potentially retaining the previous editable image/status. **Minimal repair:** catch read/signature exceptions in the change handler, call `clearImage()`, and display the existing invalid-file error (or a dedicated read-error message).

### 3.6 Decoded-size limit timing

**Status: finding. Severity: medium.** The 32-megapixel test is executed in `candidate.onload` at `app.js:24`, after the browser decoder has already decoded enough of the file to populate the image. A highly compressed oversized image can therefore consume substantial decoder memory or trigger process instability before the application rejects it. The limit prevents oversized images from entering the editor but is not a pre-decode resource limit. The failure path is local availability loss from a crafted compression-bomb image; CSP and lack of networking do not mitigate decoder allocation. **Minimal repair:** parse and validate format dimensions from bounded header data before assigning the blob URL to `Image`, while retaining the post-decode dimension check as defense in depth.

### 3.7 Rotation, crop, and export network independence

**Status: verified.**

Source evidence: rotation/zoom call `draw()`; pointer/keyboard crop handlers modify the numeric `crop` object; and export uses canvas drawing plus blob URLs (`app.js:27-37`). None calls a network API. Runtime evidence: rotation to 37°, zoom to 150%, keyboard move/resize, and all three exports completed with the context offline and no HTTP(S) request.

## 4. Browser security

### 4.1 Meta Content Security Policy

**Status: verified.**

The meta policy is at `index.html:6` and is internally consistent with the current code:

- `default-src 'none'` denies unspecified resource types by default;
- `script-src 'self'` allows the same-origin local `app.js` and denies remote/inline script;
- `style-src 'self'` allows the same-origin local `styles.css` and denies remote/inline stylesheet content;
- `img-src 'self' blob:` permits local image resources and the selected-file blob used at `app.js:24`;
- `connect-src`, `font-src`, `media-src`, `object-src`, `frame-src`, `child-src`, `worker-src`, `form-action`, and `manifest-src` are explicitly `none`;
- `base-uri 'none'` prevents a `<base>` from changing URL resolution.

The policy does **not** block top-level hyperlink navigation; therefore the five deliberate external links can open. It also does not and, as a meta CSP, cannot provide server transport controls or response headers. In particular, there is no enforceable `frame-ancestors` protection in this meta policy, no HSTS, no MIME-sniffing response header, and no guarantee about headers from a future host. This is a defense-in-depth client policy, not a server-header substitute. These limitations are material only if publication is later introduced and are accurately disclosed at `README.md:40`, `docs/THREAT_MODEL.md:38`, and `docs/SECURITY_AUDIT.md:34,42`.

### 4.2 Markup, attributes, and URL handling

**Status: verified.**

Method: searched for `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval`, and `new Function`; none exists. Dynamic localized/user-facing text is assigned with `textContent` at `app.js:18,38`. The selected filename is never read. Dynamic `src`/`href` assignments are restricted to blob URLs created inside the application (`app.js:24,36`), and the only dynamic download name is selected from a constant map (`app.js:36`). Crop style values derive from clamped numeric state, not file content (`app.js:28-33`). No untrusted value reaches executable markup or a service URL.

### 4.3 Sensitive browser permissions

**Status: verified.**

Method: searched runtime files for `mediaDevices`, `getUserMedia`, camera/microphone APIs, clipboard APIs, geolocation, notifications, and permission request APIs. None is present. The file picker is an explicit `<input type="file">` at `index.html:27`, not a device permission request.

## 5. Offline and publication claims

### 5.1 Downloaded-folder offline operation

**Status: verified.**

Method: set the Chromium browser context offline before navigating directly to `file:///workspace/repho/index.html`. The browser loaded the local HTML, CSS, and JavaScript, validated local PNG/JPEG/WebP files, performed rotation/zoom/crop changes, and downloaded all three exports. The request log contained only `file:` and `blob:` URLs. This verifies the tested Chromium environment, not every browser's `file:` download policy. The optional loopback workaround for browsers that restrict `file:` downloads is accurately described at `README.md:18-24`.

### 5.2 Hosted-offline claim and service-worker absence

**Status: verified.**

Method: searched for service-worker registration and Cache Storage and found neither. `README.md:24` explicitly says there is no service worker/Cache Storage feature and makes no claim that a future GitHub Pages URL works offline. `docs/THREAT_MODEL.md:43` repeats that offline means opening the downloaded folder, not caching a future hosted URL.

### 5.3 Meta CSP versus publication headers

**Status: verified.**

`README.md:40` calls the meta policy defense in depth, says it is not a substitute for server-controlled HTTP headers, and marks future hosted-header checking as not verified. `docs/SECURITY_AUDIT.md:34,42` makes the same distinction. Source inventory confirms no deployment workflow.

### 5.4 Future publication headers

**Status: not verified.** Precise reason: no deployed URL or workflow exists, and the audit rules prohibit deployment. Consequently no server response exists whose CSP, Referrer-Policy, HSTS, MIME-sniffing, framing, or other headers can be measured.

## Findings summary

| ID | Status | Severity | Affected file | Finding | Minimal repair |
| --- | --- | --- | --- | --- | --- |
| F-01 | finding | medium | `app.js:24` | The 32 MP limit runs only after browser decoding, so it cannot prevent pre-check decoder memory exhaustion. | Parse bounded JPEG/PNG/WebP dimensions before assigning to `Image`; keep the post-decode check. |
| F-02 | finding | low | `app.js:23-24` | A rejected file-header `arrayBuffer()` read becomes an unhandled promise rejection without a safe visible status. | Catch read/signature exceptions, clear the editor, and show a read/invalid-file error. |

## Claims that remain unverified

1. **Exhaustive metadata or forensic erasure — not verified:** no finite canvas test in this environment can prove absence of every possible trace across all browsers, codecs, and forensic tools; the product correctly does not claim this.
2. **Future publication response headers — not verified:** there is no deployment or URL to inspect, and deployment was outside the permitted audit actions.
3. **Behavior in browsers other than the available Chromium 140 — not verified:** runtime testing used only that installed browser; cross-browser execution was not available without adding tooling.
4. **Physical memory overwriting — not verified:** object-URL revocation and JavaScript-reference clearing were observed, but browser garbage collection, allocator behavior, swap, and physical erasure are outside JavaScript control.

## Release recommendation

**ready for local use only**

The reviewed build has no network/upload/persistence path, works from a downloaded folder in the tested offline browser, and uses fixed non-source-derived export names. F-01 remains relevant to availability when opening adversarial images, and F-02 affects safe error presentation for rare file-read failures. Publication should remain a separate task with server-header verification.
