import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
const buf = readFileSync('../../supabase/migrations/SClogolayer.png');
const img = sharp(buf);
const meta = await img.metadata();
console.log('decoded:', meta.width, 'x', meta.height, meta.format);
const png = await img.png().toBuffer();
writeFileSync('../../apps/web/public/sc-logo.png', png);
console.log('written', png.length, 'bytes');
