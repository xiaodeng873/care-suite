import { decode } from '@jsquash/avif';
import { encode } from '@jsquash/png';
import { readFileSync, writeFileSync } from 'node:fs';
const avif = readFileSync('../../supabase/migrations/SClogolayer.png');
const image = await decode(avif);
console.log('decoded:', image.width, 'x', image.height);
const png = await encode(image);
writeFileSync('../../apps/web/public/sc-logo.png', png);
console.log('written apps/web/public/sc-logo.png', png.length, 'bytes');
