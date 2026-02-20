#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Patch "Pokemon Stadium 2 (USA)" (N64) -> "Moves Modded + All rental Pokemons"
 *
 * ✅ The user provides their own base ROM.
 * ✅ This script verifies the base ROM checksum before patching.
 * ✅ No external dependencies (Node.js built-ins only).
 *
 * Usage:
 *   node patch_pokemon_stadium2.js "Pokemon Stadium 2 (USA).z64"
 *   node patch_pokemon_stadium2.js <input_rom> <output_rom>
 *
 * Notes:
 * - Accepts .z64 (big-endian), .v64 (byteswapped), .n64 (little-endian).
 *   If needed, it converts to .z64 internally before verifying/applying the patch.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const EXPECTED = Object.freeze({
  base: {
    size: 67108864,
    md5: "1561c75d11cedf356a8ddb1a4a5f9d5d",
    sha1: "d8343e69a7dc63b869cf6361d87cde64444281d3",
    sha256: "8160abe7d4b9734317000c44e9f882efefe4cc6359eacded98be62f2811e40a9",
    crc32: "a9998e09",
  },
  target: {
    size: 67108864,
    md5: "45fa00992d7db6529edd8e74bddf8500",
    sha1: "8c7653b476276d6242ba1af4cee04658baa6b614",
    sha256: "e86a4c85c045f4bd4c4f29a210d5f9e5ffd558a79c3a43065aab9b37b8cd46d3",
    crc32: "0c65071d",
  },
  defaultInputName: "Pokemon Stadium 2 (USA).z64",
  defaultOutputName: "Pokemon Stadium 2 (USA) [Moves Modded + All rental Pokemons].z64",
});

function hashHex(algo, buf) {
  return crypto.createHash(algo).update(buf).digest('hex');
}

// Fast CRC32 (no dependency)
function crc32Hex(buf) {
  // Table generated once at runtime (small + fast enough for 64MB)
  const table = crc32Hex._table || (crc32Hex._table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c >>> 0;
    }
    return t;
  })());

  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  }
  c = (c ^ 0xFFFFFFFF) >>> 0;
  return c.toString(16).padStart(8, '0');
}

function detectFormat(buf) {
  const b0 = buf[0], b1 = buf[1], b2 = buf[2], b3 = buf[3];
  if (b0 === 0x80 && b1 === 0x37 && b2 === 0x12 && b3 === 0x40) return 'z64'; // big-endian
  if (b0 === 0x37 && b1 === 0x80 && b2 === 0x40 && b3 === 0x12) return 'v64'; // byteswapped (16-bit)
  if (b0 === 0x40 && b1 === 0x12 && b2 === 0x37 && b3 === 0x80) return 'n64'; // little-endian (32-bit)
  return 'unknown';
}

function toZ64(buf) {
  const fmt = detectFormat(buf);
  if (fmt === 'z64') return { buf, fmt, converted: false };

  const out = Buffer.from(buf); // copy
  if (fmt === 'v64') {
    // Swap every 16-bit halfword: AB CD -> BA DC
    for (let i = 0; i < out.length; i += 2) {
      const t = out[i];
      out[i] = out[i + 1];
      out[i + 1] = t;
    }
    return { buf: out, fmt, converted: true };
  }

  if (fmt === 'n64') {
    // Reverse every 32-bit word: A B C D -> D C B A
    for (let i = 0; i < out.length; i += 4) {
      const a = out[i], b = out[i + 1], c = out[i + 2], d = out[i + 3];
      out[i] = d;
      out[i + 1] = c;
      out[i + 2] = b;
      out[i + 3] = a;
    }
    return { buf: out, fmt, converted: true };
  }

  return { buf, fmt, converted: false };
}

function parsePatch(patchBuf) {
  if (patchBuf.length < 57) throw new Error('Patch too short');
  if (patchBuf.slice(0, 4).toString('ascii') !== 'N64P') throw new Error('Invalid patch (magic)');
  const ver = patchBuf.readUInt8(4);
  if (ver !== 1) throw new Error(`Invalid patch (version ${ver})`);
  const baseSha1 = patchBuf.slice(5, 25).toString('hex');
  const targetSha1 = patchBuf.slice(25, 45).toString('hex');
  const baseSize = patchBuf.readUInt32BE(45);
  const targetSize = patchBuf.readUInt32BE(49);
  const recordCount = patchBuf.readUInt32BE(53);

  let pos = 57;
  const records = new Array(recordCount);
  for (let i = 0; i < recordCount; i++) {
    if (pos + 8 > patchBuf.length) throw new Error('Corrupted patch (records)');
    const offset = patchBuf.readUInt32BE(pos); pos += 4;
    const len = patchBuf.readUInt32BE(pos); pos += 4;
    if (pos + len > patchBuf.length) throw new Error('Corrupted patch (data)');
    records[i] = { offset, data: patchBuf.slice(pos, pos + len) };
    pos += len;
  }
  if (pos !== patchBuf.length) {
    throw new Error('Corrupted patch (extra data)');
  }

  return { baseSha1, targetSha1, baseSize, targetSize, recordCount, records };
}

function assertEqual(label, got, expected) {
  if (got !== expected) {
    throw new Error(`Invalid ${label}.\n  Expected: ${expected}\n  Got     : ${got}`);
  }
}

async function main() {
  const inputPath = process.argv[2] || EXPECTED.defaultInputName;
  const outputPath = process.argv[3] || path.join(path.dirname(inputPath), EXPECTED.defaultOutputName);

  if (!fs.existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
  }

  const raw = await fs.promises.readFile(inputPath);

  // Convert if needed (so checksum + offsets match .z64)
  const conv = toZ64(raw);
  const rom = conv.buf;

  if (rom.length !== EXPECTED.base.size) {
    console.error(`Unexpected size: ${rom.length} bytes (expected ${EXPECTED.base.size}).`);
    process.exit(1);
  }

  const sha1 = hashHex('sha1', rom);
  const md5 = hashHex('md5', rom);
  const sha256 = hashHex('sha256', rom);
  const crc32 = crc32Hex(rom);

  // Verify base ROM checksums
  try {
    assertEqual('SHA-1 (base ROM)', sha1, EXPECTED.base.sha1);
    assertEqual('MD5 (base ROM)', md5, EXPECTED.base.md5);
    assertEqual('CRC32 (base ROM)', crc32, EXPECTED.base.crc32);
  } catch (e) {
    console.error(String(e.message));
    console.error('\nProvided ROM info:');
    console.error(`  Detected format: ${conv.fmt}${conv.converted ? ' (converted to .z64 for patching)' : ''}`);
    console.error(`  Size           : ${rom.length}`);
    console.error(`  SHA-1          : ${sha1}`);
    console.error(`  MD5            : ${md5}`);
    console.error(`  SHA-256        : ${sha256}`);
    console.error(`  CRC32          : ${crc32}`);
    process.exit(2);
  }

  // Load patchBuf from a file
  const patchBuf = fs.readFileSync('patchBuf.bin');
  const patch = parsePatch(patchBuf);

  // Sanity check patch metadata
  assertEqual('Patch/base SHA-1', patch.baseSha1, EXPECTED.base.sha1);
  assertEqual('Patch/target SHA-1', patch.targetSha1, EXPECTED.target.sha1);
  assertEqual('Patch/base size', String(patch.baseSize), String(EXPECTED.base.size));
  assertEqual('Patch/target size', String(patch.targetSize), String(EXPECTED.target.size));

  // Apply patch
  const out = Buffer.from(rom); // copy
  for (const r of patch.records) {
    if (r.offset + r.data.length > out.length) {
      throw new Error(`Record out of bounds: offset=${r.offset}, len=${r.data.length}`);
    }
    r.data.copy(out, r.offset);
  }

  // Verify output
  const outSha1 = hashHex('sha1', out);
  const outMd5 = hashHex('md5', out);
  const outSha256 = hashHex('sha256', out);
  const outCrc32 = crc32Hex(out);

  try {
    assertEqual('SHA-1 (patched ROM)', outSha1, EXPECTED.target.sha1);
    assertEqual('MD5 (patched ROM)', outMd5, EXPECTED.target.md5);
    assertEqual('CRC32 (patched ROM)', outCrc32, EXPECTED.target.crc32);
  } catch (e) {
    console.error(String(e.message));
    console.error('\nGenerated ROM info:');
    console.error(`  Size     : ${out.length}`);
    console.error(`  SHA-1    : ${outSha1}`);
    console.error(`  MD5      : ${outMd5}`);
    console.error(`  SHA-256  : ${outSha256}`);
    console.error(`  CRC32    : ${outCrc32}`);
    process.exit(3);
  }

  await fs.promises.writeFile(outputPath, out);
  console.log('✅ Patch applied successfully!');
  console.log(`Input : ${inputPath}`);
  console.log(`Output: ${outputPath}`);
  console.log(`Format: ${conv.fmt}${conv.converted ? ' -> z64' : ''}`);
  console.log('\nChecksums (output):');
  console.log(`  SHA-1   : ${outSha1}`);
  console.log(`  MD5     : ${outMd5}`);
  console.log(`  SHA-256 : ${outSha256}`);
  console.log(`  CRC32   : ${outCrc32}`);
}

main().catch((err) => {
  console.error('Error:', err && err.stack ? err.stack : String(err));
  process.exit(99);
});
