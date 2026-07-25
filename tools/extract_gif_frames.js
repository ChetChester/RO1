/* 從 GIF 提取幀序列為 PNG */
const { GifCodec } = require('gifwrap');
const fs = require('fs');
const path = require('path');

async function extractFrames() {
  const gifPath = path.join(__dirname, '..', 'images', 'player_knight.gif');
  const outDir = path.join(__dirname, '..', 'images', 'knight_frames');
  
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  
  const gifBuffer = fs.readFileSync(gifPath);
  const codec = new GifCodec();
  const gif = await codec.decodeGif(gifBuffer);
  
  console.log(`GIF: ${gif.width}x${gif.height}, ${gif.frames.length} 幀`);
  
  for (let i = 0; i < gif.frames.length; i++) {
    const frame = gif.frames[i];
    const w = gif.width, h = gif.height;
    const data = frame.bitmap.data;
    
    // 建立 PNG（使用簡單的 raw RGBA 轉換）
    // 先儲存為 raw 數據，然後用 canvas 轉換
    const rawPath = path.join(outDir, `frame_${String(i).padStart(3, '0')}.raw`);
    fs.writeFileSync(rawPath, Buffer.from(data));
    console.log(`  幀 ${i}: ${rawPath} (${w}x${h})`);
  }
  
  console.log(`\n提取了 ${gif.frames.length} 個幀`);
}

extractFrames().catch(e => console.error('錯誤:', e));
