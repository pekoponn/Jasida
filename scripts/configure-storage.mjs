// Run only in a local terminal. The admin key is never written to disk or bundled.
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { loadEnv } from 'vite';
import { createClient } from '@supabase/supabase-js';

const env = loadEnv('development', process.cwd(), 'VITE_');
const url = env.VITE_SUPABASE_URL?.trim();
if (!url) throw new Error('Isi VITE_SUPABASE_URL di .env terlebih dahulu.');
if (!process.stdin.isTTY) throw new Error('Jalankan langsung di terminal interaktif.');

console.log(`Project: ${url}`);
console.log('Bucket report-images akan dibatasi ke image/webp dan maksimal 99.999 byte.');
console.log('Foto lama tetap tersimpan. Key admin hanya dipakai sementara dalam memori.');
let muted = false;
const output = new Writable({ write(chunk, encoding, done) {
  if (!muted) process.stdout.write(chunk, encoding);
  done();
} });
const rl = createInterface({ input: process.stdin, output, terminal: true });
let key;
try {
  process.stdout.write('Tempel Supabase secret key atau legacy service_role key (input disembunyikan): ');
  muted = true;
  key = (await rl.question('')).trim();
} finally {
  muted = false;
  rl.close();
  process.stdout.write('\n');
}

let role;
if (key.split('.').length === 3) {
  try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role; } catch {}
}
if (!key.startsWith('sb_secret_') && role !== 'service_role') {
  throw new Error('Ini bukan key admin. Gunakan secret/service_role hanya untuk script terminal ini.');
}
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: before, error: readError } = await supabase.storage.getBucket('report-images');
if (readError) throw new Error(`Tidak dapat membaca bucket: ${readError.message}`);
console.log('Pengaturan sebelumnya:', JSON.stringify({
  public: before.public, fileSizeLimit: before.file_size_limit, allowedMimeTypes: before.allowed_mime_types
}));
const { error } = await supabase.storage.updateBucket('report-images', {
  public: before.public,
  allowedMimeTypes: ['image/webp'],
  fileSizeLimit: 99_999
});
if (error) throw new Error(`Pengaturan gagal: ${error.message}`);
const { data: after, error: verifyError } = await supabase.storage.getBucket('report-images');
if (verifyError) throw new Error(`Verifikasi gagal: ${verifyError.message}`);
if (Number(after.file_size_limit) !== 99_999 || after.allowed_mime_types?.length !== 1 || after.allowed_mime_types[0] !== 'image/webp') {
  throw new Error('Pengaturan bucket belum sesuai target.');
}
console.log('BERHASIL: report-images hanya menerima image/webp dengan ukuran maksimal 99.999 byte.');
