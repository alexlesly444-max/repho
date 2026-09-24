# Local Photo Preparation

A dependency-free, static browser tool for preparing a photo before a user **manually** submits it to an external visual-search service. The default interface is Russian; the `EN` button switches to English.

## Privacy and limitations

- Image decoding, cropping, rotation, scaling, and re-encoding happen locally in browser memory. The application contains no upload, analytics, telemetry, recognition, comparison, search, persistence, or network code.
- No image or settings are written to cookies, Web Storage, IndexedDB, Cache Storage, or a server. Object URLs are short-lived and revoked on replacement, reset, clearing, export completion, and page exit where the platform permits.
- Canvas export is intended to omit ordinary source metadata such as EXIF by creating a new image from decoded pixels. This is not a forensic-erasure guarantee: browser encoders may add implementation data, unrecognized traces may remain, and visible content itself may reveal identity or location.
- The editor validates declared MIME type and file signatures, relies on the browser decoder to reject malformed data, and limits inputs to 20 MiB encoded and 32 megapixels decoded. A malicious browser or compromised device is outside the threat model.
- External-service links contain no image-derived parameters. Opening one leaves this application's privacy boundary; the user must upload the exported file manually and accept that service's terms and privacy practices.
- If the project is published later, the host (including GitHub Pages) and network intermediaries may log ordinary page requests and IP addresses. This task does not include deployment. Hosting would not be equivalent to anonymous access.

## Offline use

Download or clone the complete static project folder, disconnect from the network, and open its `index.html` directly in a modern browser. The application itself, including file selection, editing, and export, works from the local folder without a network connection because all runtime assets are included and there is no service worker or cache-storage dependency. The five external-service links naturally require a connection and are not part of offline editing.

Some browsers restrict downloads from `file:` URLs. If that browser behavior occurs, run an optional loopback-only server from the downloaded folder:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8000/`. This serves only the local downloaded files; it does not make a hosted URL available offline. There is deliberately no service worker or Cache Storage feature, so no claim is made that any future GitHub Pages URL will reliably work offline. For sensitive material, use a dedicated offline browser profile and close the tab/browser after exporting to encourage memory release. JavaScript cannot guarantee immediate physical memory erasure because garbage collection, browser caches, swap, screenshots, extensions, and operating-system behavior are outside its control.

## Exports

The three export buttons produce exactly these variants from the locally rendered pixels:

1. **Full clean re-encode** of the full-size decoded pixels,
2. a 4:5 portrait crop derived from the manual crop frame, and
3. a square crop derived from the same frame with an adjustable margin.

JPEG and PNG are available. Exports always use fixed generic names (`photo-clean-reencode`, `photo-portrait-4x5`, or `photo-square`) and never derive a name from the input. “Face crop” is only a user-positioned square label: there is no face detection or recognition.

## Audit and future deployment

See [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md) and [`docs/SECURITY_AUDIT.md`](docs/SECURITY_AUDIT.md). No deployment workflow is included. Deployment must be a separate, reviewed task after implementation and security verification are accepted.

The CSP in `index.html` is a defense-in-depth meta policy for local/static use. Meta CSP has limitations and is not a substitute for server-controlled HTTP security headers. If the site is published later, inspect the headers returned by the actual GitHub Pages URL and record which policies the host delivers; that hosted-header check is **not verified** in this task because there is intentionally no deployment.

## Security reports

Do not disclose suspected vulnerabilities in a public issue. Follow [`SECURITY.md`](SECURITY.md) to submit a private security advisory.
