// Generates the PWA PNG icons from the English Words logo geometry (same shapes as icon.svg).
// Dependency-free: flattens the vector paths, rasterizes with 4×4 supersampling and encodes PNG.
// Run: node tools/app-icons.mjs
import {writeFile,mkdir} from 'node:fs/promises';
import {deflateSync} from 'node:zlib';

// ---------- geometry (logo viewBox 0 0 72 64) ----------
const roundRect=(x,y,w,h,r)=>{const k=.5523*r;return [['M',x+r,y],['L',x+w-r,y],['C',x+w-r+k,y,x+w,y+r-k,x+w,y+r],['L',x+w,y+h-r],['C',x+w,y+h-r+k,x+w-r+k,y+h,x+w-r,y+h],['L',x+r,y+h],['C',x+r-k,y+h,x,y+h-r+k,x,y+h-r],['L',x,y+r],['C',x,y+r-k,x+r-k,y,x+r,y],['Z']];};
const parse=d=>{const out=[],t=d.match(/[MLCQZ]|-?\d*\.?\d+/gi);let i=0;while(i<t.length){const c=t[i++];const n=c==='Z'?0:c==='C'?6:c==='Q'?4:2;out.push([c,...t.slice(i,i+n).map(Number)]);i+=n;}return out;};
const E=[roundRect(4,8,11,46,4.5),roundRect(4,8,27,11,4.5),roundRect(4,25.5,23,11,4.5),roundRect(4,43,27,11,4.5)];
const BOOK=parse('M37 9C44 9 52 6 62 4Q67 3 67 8L67 40Q67 45 62 46C54 47.5 46 50 41 54L34 61Q32 62.5 32.8 59.8L36.5 48Q37 46 37 44Z');
const SHINE=parse('M37 9C41 10 44 12 46 14L46 47C44 47.6 42.4 48.6 41 50L37 52Z');
const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const gradient=(x1,y1,x2,y2,stops)=>(x,y)=>{const dx=x2-x1,dy=y2-y1;let t=((x-x1)*dx+(y-y1)*dy)/(dx*dx+dy*dy);t=Math.max(0,Math.min(1,t));for(let i=1;i<stops.length;i++)if(t<=stops[i][0]){const [o0,c0]=stops[i-1],[o1,c1]=stops[i];return lerp(hex(c0),hex(c1),(t-o0)/(o1-o0||1));}return hex(stops.at(-1)[1]);};

// Flatten a path (in logo units) to polygons in pixel units via transform (s, ox, oy).
function flatten(cmds,s,ox,oy){const polys=[];let cur=[],px=0,py=0;const P=(x,y)=>cur.push([ox+x*s,oy+y*s]);
 for(const [c,...a] of cmds){if(c==='M'){if(cur.length)polys.push(cur);cur=[];px=a[0];py=a[1];P(px,py);}else if(c==='L'){px=a[0];py=a[1];P(px,py);}else if(c==='C'){for(let i=1;i<=16;i++){const t=i/16,m=1-t;P(m*m*m*px+3*m*m*t*a[0]+3*m*t*t*a[2]+t*t*t*a[4],m*m*m*py+3*m*m*t*a[1]+3*m*t*t*a[3]+t*t*t*a[5]);}px=a[4];py=a[5];}else if(c==='Q'){for(let i=1;i<=12;i++){const t=i/12,m=1-t;P(m*m*px+2*m*t*a[0]+t*t*a[2],m*m*py+2*m*t*a[1]+t*t*a[3]);}px=a[2];py=a[3];}else if(c==='Z'){if(cur.length)polys.push(cur);cur=[];}}
 if(cur.length)polys.push(cur);return polys;}

// Coverage mask (0..1 per pixel) for polygons using non-zero winding and SS×SS supersampling.
function coverage(polys,size,SS=4){const cov=new Float32Array(size*size),edges=[];
 for(const poly of polys)for(let i=0;i<poly.length;i++){const [x0,y0]=poly[i],[x1,y1]=poly[(i+1)%poly.length];if(y0!==y1)edges.push([x0,y0,x1,y1,y1>y0?1:-1]);}
 for(let sy=0;sy<size*SS;sy++){const y=(sy+.5)/SS,xs=[];for(const [x0,y0,x1,y1,w] of edges){if((y>=Math.min(y0,y1))&&(y<Math.max(y0,y1)))xs.push([x0+(y-y0)/(y1-y0)*(x1-x0),w]);}
  xs.sort((a,b)=>a[0]-b[0]);let wind=0;for(let i=0;i<xs.length-1;i++){wind+=xs[i][1];if(!wind)continue;const a=Math.max(0,xs[i][0]*SS),b=Math.min(size*SS,xs[i+1][0]*SS);for(let sx=Math.ceil(a-.5);sx<b-.5;sx++){if(sx<0)continue;cov[Math.floor(sy/SS)*size+Math.floor(sx/SS)]+=1/(SS*SS);}}}
 return cov;}

function render(size,{background,radius,logoScale}){
 const px=new Float32Array(size*size*4);
 const paint=(cov,color,alpha=1)=>{for(let i=0;i<size*size;i++){const a=Math.min(1,cov[i])*alpha;if(!a)continue;const x=i%size+.5,y=Math.floor(i/size)+.5,c=typeof color==='function'?color(x,y):color,o=i*4,da=px[o+3],oa=a+da*(1-a);for(let k=0;k<3;k++)px[o+k]=(c[k]*a+px[o+k]*da*(1-a))/(oa||1);px[o+3]=oa;}};
 if(background){const bg=gradient(0,0,0,size,[[0,'#2A3448'],[1,'#1B2230']]);paint(coverage(flatten(radius?roundRect(0,0,size,size,radius):[['M',0,0],['L',size,0],['L',size,size],['L',0,size],['Z']],1,0,0),size),bg);}
 const s=size*logoScale/72,ox=(size-72*s)/2,oy=(size-64*s)/2;
 const tr=(x,y)=>[(x-ox)/s,(y-oy)/s];
 const eFill=(x,y)=>{const [,ly]=tr(x,y);return gradient(0,8,0,54,[[0,'#36A6F8'],[1,'#2A80EC']])(0,ly);};
 const bFill=(x,y)=>{const [lx,ly]=tr(x,y);return gradient(67,4,34,60,[[0,'#8AEDF2'],[.55,'#45B4F5'],[1,'#2D86E8']])(lx,ly);};
 paint(coverage(E.flatMap(r=>flatten(r,s,ox,oy)),size),eFill);
 paint(coverage(flatten(BOOK,s,ox,oy),size),bFill);
 paint(coverage(flatten(SHINE,s,ox,oy),size),[255,255,255],.28);
 return Buffer.from(Array.from(px,(v,i)=>i%4===3?Math.round(v*255):Math.round(v)));
}

function png(size,rgba){const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;return c>>>0;});
 const crc=b=>{let c=0xFFFFFFFF;for(const x of b)c=crcTable[(c^x)&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;};
 const chunk=(type,data)=>{const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const td=Buffer.concat([Buffer.from(type),data]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([len,td,c]);};
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
 const raw=Buffer.alloc(size*(size*4+1));for(let y=0;y<size;y++){raw[y*(size*4+1)]=0;rgba.copy(raw,y*(size*4+1)+1,y*size*4,(y+1)*size*4);}
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);}

const out=new URL('../icons/',import.meta.url);await mkdir(out,{recursive:true});
const specs=[
 ['icon-192.png',192,{background:true,radius:42,logoScale:.66}],      // purpose "any": rounded tile
 ['icon-512.png',512,{background:true,radius:112,logoScale:.66}],
 ['maskable-512.png',512,{background:true,radius:0,logoScale:.56}],    // full bleed, logo inside the 80% safe zone
 ['apple-touch-icon.png',180,{background:true,radius:0,logoScale:.62}], // iOS applies its own mask
 ['favicon-32.png',32,{background:false,logoScale:.98}]];
for(const [name,size,opts] of specs){await writeFile(new URL(name,out),png(size,render(size,opts)));console.log('icons/'+name,size+'×'+size);}
