'use strict';

const assert = require('node:assert/strict');
const {parseImageHeader, readImageHeader, HEADER_LIMIT} = require('../image-header.js');

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const value of bytes) {
    crc ^= value;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function png(width, height) {
  const b = Buffer.alloc(33);
  Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]).copy(b);
  b.writeUInt32BE(13, 8); b.write('IHDR', 12); b.writeUInt32BE(width, 16); b.writeUInt32BE(height, 20);
  b.set([8,6,0,0,0], 24); b.writeUInt32BE(crc32(b.subarray(12,29)), 29);
  return b;
}
function jpeg(width, height) {
  return Buffer.from([0xff,0xd8,0xff,0xe0,0,4,0,0,0xff,0xc0,0,11,8,height>>8,height&255,width>>8,width&255,1,1,0x11,0]);
}
function webpVp8x(width, height) {
  const b=Buffer.alloc(30);b.write('RIFF');b.writeUInt32LE(22,4);b.write('WEBP',8);b.write('VP8X',12);b.writeUInt32LE(10,16);
  b.writeUIntLE(width-1,24,3);b.writeUIntLE(height-1,27,3);return b;
}
function expectReject(bytes, total=bytes.length) { assert.throws(()=>parseImageHeader(bytes,total)); }
function parseSelectedFile(file) { return parseImageHeader(file.bytes); }

assert.deepEqual(parseImageHeader(jpeg(640,480)), {type:'image/jpeg',width:640,height:480});
assert.deepEqual(parseImageHeader(png(320,240)), {type:'image/png',width:320,height:240});
assert.deepEqual(parseImageHeader(webpVp8x(800,600)), {type:'image/webp',width:800,height:600});

const compressedBombHeader=png(8000,5000);
const bomb=parseImageHeader(compressedBombHeader);
assert.equal(bomb.width*bomb.height>32_000_000,true, 'small header declares more than 32 MP');

expectReject(Buffer.from([0xff,0xd8,0xff]));
expectReject(png(20,20).subarray(0,25),25);
const badPng=png(20,20);badPng[20]^=1;expectReject(badPng);
expectReject(Buffer.from('RIFF\x04\x00\x00\x00WEBP'));
expectReject(Buffer.from('not an image'));

// Deliberately mismatched caller metadata is ignored; binary content wins.
assert.equal(parseSelectedFile({name:'wrong.jpg',type:'image/jpeg',bytes:png(7,9)}).type,'image/png');
assert.equal(parseSelectedFile({name:'wrong.png',type:'image/png',bytes:webpVp8x(7,9)}).type,'image/webp');
assert.equal(HEADER_LIMIT,256*1024);
(async()=>{
  let requestedEnd=0;const header=png(11,12);
  const file={size:HEADER_LIMIT*4,slice(start,end){assert.equal(start,0);requestedEnd=end;return {arrayBuffer:async()=>header}}};
  assert.deepEqual(await readImageHeader(file),{type:'image/png',width:11,height:12});
  assert.equal(requestedEnd,HEADER_LIMIT,'only the bounded initial slice is requested');
  console.log('image-header tests: valid formats, bounded read, oversized declaration, malformed/truncated headers, and MIME mismatches passed');
})().catch(error=>{console.error(error);process.exitCode=1});
