# Threat model

## Protected assets and privacy promise

The primary protected asset is the selected image and everything it reveals (pixels, filename, dimensions, and metadata). The application promises that it performs editing in the current browser context only and never intentionally transmits, persists, searches, recognizes, compares, or logs that data.

## Data flow and trust boundaries

1. A user explicitly chooses a local JPEG, PNG, or WebP.
2. JavaScript checks encoded size, declared MIME type, magic bytes, successful browser decoding, and decoded pixel count.
3. The browser exposes the selected file through a temporary blob URL. Pixels are rendered into an in-memory canvas.
4. A new JPEG or PNG blob is generated from canvas pixels and downloaded with a fixed generic name by an ephemeral blob URL. The source filename is not copied into application state, output names, labels, or URLs.
5. If the user follows an external link, only a fixed, non-user-derived URL is opened. Upload to that independent service is a separate, manual user action.

The browser, operating system, device, downloaded copy, any future host, and chosen third-party service are separate trust boundaries. If GitHub Pages is configured in a later task, it may retain normal access logs; the application cannot control GitHub, DNS, TLS endpoints, proxies, or ISP logging.

## In-scope threats and controls

| Threat | Control |
| --- | --- |
| Accidental image upload or telemetry | No request APIs; the defense-in-depth meta CSP blocks connections, forms, frames, external scripts/styles, media, and plugins in supporting browsers. |
| Malicious or mislabeled input | Allowlist, magic-byte check, browser decode check, 20 MiB encoded and 32 MP decoded limits. |
| Source metadata disclosure | Output is rebuilt from canvas pixels rather than copying source bytes, which is intended to omit ordinary metadata; this is not a guarantee of forensic erasure. |
| Filename disclosure or injection | Input filenames are never copied into output names, visible labels, stored application state, or URLs; exports use fixed generic names. UI uses static text or `textContent`. |
| Reverse-search link leakage | Fixed destinations have no filename, blob URL, pixels, query, or other user-derived parameters; manual upload is required. |
| Tab takeover | External links use `noopener noreferrer`; the page also sets `no-referrer`. |
| Supply-chain compromise | No runtime dependencies or deployment workflow are included. |
| Residual browser memory | Blob URLs are revoked where practical and references are cleared. Users are advised to close the browser; guaranteed erasure is impossible in JavaScript. |

## Out of scope and residual risk

- A compromised browser, extension, operating system, device, keyboard, or screen capture.
- Browser vulnerabilities in image decoders or canvas, although resource caps reduce denial-of-service exposure.
- Information visible in pixels (faces, documents, landmarks); metadata removal does not anonymize imagery.
- Copies made by downloads, backups, swap, browser internals, or the user.
- Privacy, security, retention, recognition, and legal policies of external services after manual upload.
- Hosting and network access logs if the project is published later. Use the downloaded project locally while disconnected to avoid hosting requests.
- Meta CSP cannot set every policy available to HTTP headers, and server headers can change policy enforcement. It is defense in depth, not a replacement for server-controlled headers.
- Perfect memory erasure. Revocation prevents future blob-URL use but does not prove bytes were overwritten.

## Security assumptions

The delivered source matches the audited repository, the browser honors the applicable meta CSP and standard web APIs, and the user does not install untrusted modifications. Offline use means opening the downloaded project folder while disconnected; it does not mean a future hosted URL is cached. Offline local use provides the strongest protection against unintended network disclosure.
