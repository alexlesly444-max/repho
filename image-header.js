'use strict';

(function expose(root) {
  const HEADER_LIMIT = 256 * 1024;

  function fail(message) { throw new Error(message); }
  function u16be(b, p) { return b[p] * 256 + b[p + 1]; }
  function u16le(b, p) { return b[p] + b[p + 1] * 256; }
  function u24le(b, p) { return b[p] + b[p + 1] * 256 + b[p + 2] * 65536; }
  function u32be(b, p) { return b[p] * 0x1000000 + b[p + 1] * 0x10000 + b[p + 2] * 0x100 + b[p + 3]; }
  function u32le(b, p) { return b[p] + b[p + 1] * 0x100 + b[p + 2] * 0x10000 + b[p + 3] * 0x1000000; }
  function ascii(b, p, length) { return String.fromCharCode(...b.subarray(p, p + length)); }
  function dimensions(type, width, height) {
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) fail('Invalid image dimensions');
    return {type, width, height};
  }
  function crc32(bytes, start, end) {
    let crc = 0xffffffff;
    for (let i = start; i < end; i += 1) {
      crc ^= bytes[i];
      for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function parsePng(bytes, totalSize) {
    const signature = [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a];
    if (bytes.length < 33 || totalSize < 33 || !signature.every((value, i) => bytes[i] === value)) fail('Malformed PNG header');
    if (u32be(bytes, 8) !== 13 || ascii(bytes, 12, 4) !== 'IHDR') fail('Malformed PNG IHDR');
    const expectedCrc = u32be(bytes, 29) >>> 0;
    if (crc32(bytes, 12, 29) !== expectedCrc) fail('Invalid PNG IHDR checksum');
    const width=u32be(bytes,16),height=u32be(bytes,20),depth=bytes[24],color=bytes[25];
    const depths={0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]};
    if (width>0x7fffffff||height>0x7fffffff||!depths[color]?.includes(depth)||bytes[26]!==0||bytes[27]!==0||bytes[28]>1) fail('Invalid PNG IHDR fields');
    return dimensions('image/png',width,height);
  }

  function parseJpeg(bytes, totalSize) {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) fail('Malformed JPEG header');
    const sof = new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
    let p = 2;
    while (p < bytes.length) {
      if (bytes[p] !== 0xff) fail('Malformed JPEG marker');
      while (p < bytes.length && bytes[p] === 0xff) p += 1;
      if (p >= bytes.length) fail('Truncated JPEG marker');
      const marker = bytes[p++];
      if (marker === 0xd9 || marker === 0xda) fail('JPEG dimensions not found');
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (p + 2 > bytes.length) fail('Truncated JPEG segment');
      const length = u16be(bytes, p);
      if (length < 2 || p + length > totalSize) fail('Malformed JPEG segment');
      if (p + length > bytes.length) fail('JPEG dimensions outside bounded header');
      if (sof.has(marker)) {
        const components=bytes[p+7];
        if (length<11||![8,12].includes(bytes[p+2])||components<1||length!==8+components*3) fail('Malformed JPEG frame');
        return dimensions('image/jpeg', u16be(bytes, p + 5), u16be(bytes, p + 3));
      }
      p += length;
    }
    fail('JPEG dimensions not found');
  }

  function parseWebp(bytes, totalSize) {
    if (bytes.length < 20 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') fail('Malformed WebP header');
    if (u32le(bytes, 4) + 8 !== totalSize) fail('Invalid WebP container size');
    let p = 12;
    while (p + 8 <= bytes.length) {
      const kind = ascii(bytes, p, 4), size = u32le(bytes, p + 4), data = p + 8;
      const end = data + size;
      if (end > totalSize || end < data) fail('Malformed WebP chunk');
      if (end > bytes.length) fail('WebP dimensions outside bounded header');
      if (kind === 'VP8X') {
        if (size!==10||(bytes[data]&0x83)!==0||bytes[data+1]||bytes[data+2]||bytes[data+3]) fail('Malformed WebP VP8X header');
        return dimensions('image/webp', u24le(bytes, data + 4) + 1, u24le(bytes, data + 7) + 1);
      }
      if (kind === 'VP8L') {
        if (size < 5 || bytes[data] !== 0x2f) fail('Malformed WebP VP8L header');
        const bits = u32le(bytes, data + 1) >>> 0;
        if (bits>>>29) fail('Unsupported WebP VP8L version');
        return dimensions('image/webp', (bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
      }
      if (kind === 'VP8 ') {
        if (size<10||(bytes[data]&1)!==0||bytes[data+3]!==0x9d||bytes[data+4]!==0x01||bytes[data+5]!==0x2a) fail('Malformed WebP VP8 header');
        return dimensions('image/webp', u16le(bytes, data + 6) & 0x3fff, u16le(bytes, data + 8) & 0x3fff);
      }
      p = end + (size & 1);
    }
    fail('WebP dimensions not found');
  }

  function parseImageHeader(input, totalSize = input.length) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    if (!Number.isSafeInteger(totalSize) || totalSize < bytes.length) fail('Invalid file size');
    if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(bytes, 1, 3) === 'PNG') return parsePng(bytes, totalSize);
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) return parseJpeg(bytes, totalSize);
    if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return parseWebp(bytes, totalSize);
    fail('Unsupported image signature');
  }

  async function readImageHeader(file) {
    const bytes = new Uint8Array(await file.slice(0, Math.min(file.size, HEADER_LIMIT)).arrayBuffer());
    return parseImageHeader(bytes, file.size);
  }

  const api = {HEADER_LIMIT, parseImageHeader, readImageHeader};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ImageHeader = api;
})(globalThis);
