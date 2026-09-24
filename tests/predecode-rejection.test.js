'use strict';

const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const zlib = require('node:zlib');
const {parseImageHeader} = require('../image-header.js');

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const value of bytes) {
    crc ^= value;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name=Buffer.from(type), out=Buffer.alloc(data.length+12);
  out.writeUInt32BE(data.length);name.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc32(out.subarray(4,8+data.length)),8+data.length);return out;
}
function oversizedPng() {
  const width=6000,height=6000,ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width);ihdr.writeUInt32BE(height,4);ihdr.set([1,0,0,0,0],8);
  const row=Buffer.alloc(1+Math.ceil(width/8));
  return Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(Buffer.concat(Array(height).fill(row)))),chunk('IEND',Buffer.alloc(0))]);
}
function element(id) {
  return {id,disabled:false,hidden:false,value:id==='format'?'image/jpeg':'',style:{},dataset:{},clientWidth:800,clientHeight:600,
    listeners:{},addEventListener(type,fn){this.listeners[type]=fn},getContext(){return {clearRect(){},setTransform(){},fillRect(){},save(){},translate(){},rotate(){},drawImage(){},restore(){}}},
    setPointerCapture(){}};
}

(async()=>{
  const bytes=oversizedPng();
  assert.ok(bytes.length<20*1024*1024,'fixture remains below encoded-size limit');
  assert.deepEqual(parseImageHeader(bytes),{type:'image/png',width:6000,height:6000});
  const ids=['file','clear','status','preview','stage','crop','empty','zoom','rotation','margin','reset','format','quality','language'];
  const elements=Object.fromEntries(ids.map(id=>[id,element(id)]));
  const exports=[element('export1'),element('export2'),element('export3')];
  let imageConstructions=0,objectUrlCreations=0;
  const context={console,devicePixelRatio:1,ImageHeader:{HEADER_LIMIT:256*1024,parseImageHeader},
    Image:function(){imageConstructions+=1},URL:{createObjectURL(){objectUrlCreations+=1;return 'blob:test'},revokeObjectURL(){}},
    document:{getElementById:id=>elements[id],querySelectorAll:selector=>selector==='.export'?exports:[],createElement:()=>element('created')},
    addEventListener(){},setTimeout,globalThis:null};context.globalThis=context;
  vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../app.js'),'utf8'),context);
  elements.file.files=[{size:bytes.length,slice:(start,end)=>({arrayBuffer:async()=>bytes.subarray(start,end)})}];
  await elements.file.listeners.change();
  assert.equal(elements.status.textContent,'Изображение превышает 32 мегапикселя.');
  assert.equal(imageConstructions,0,'Image decoder must not be constructed');
  assert.equal(objectUrlCreations,0,'object URL must not be created');
  console.log('pre-decode rejection test: 36 MP compressed PNG rejected before Image or object URL');
})().catch(error=>{console.error(error);process.exitCode=1});
