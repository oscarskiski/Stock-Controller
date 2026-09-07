/* =========================================================
   Yard Stock — minimal QR code encoder
   ---------------------------------------------------------
   Self-contained (no CDN, no dependency), byte mode only,
   error-correction level L, versions 1-6. That range comfortably
   covers a product deep-link URL (~60-100 bytes) while staying
   small enough to print legibly on a 60x85mm card, and avoids
   needing QR "version information" bits (only required from
   version 7 up), which keeps this implementation smaller.

   QR.encode(text) -> { size, modules } where modules[row][col]
   is true for a dark module. QR.toSvg(text, opts) renders it.
   ========================================================= */
(function () {
  'use strict';

  /* ---------------- GF(256) tables ---------------- */
  const EXP = new Array(512);
  const LOG = new Array(256);
  (function buildTables() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d; // primitive polynomial x^8 + x^4 + x^3 + x^2 + 1
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();
  function gfMul(a, b) { if (a === 0 || b === 0) return 0; return EXP[LOG[a] + LOG[b]]; }

  function rsGeneratorPoly(ecLen) {
    let poly = [1];
    for (let i = 0; i < ecLen; i++) {
      const next = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= gfMul(poly[j], 1);
        next[j + 1] ^= gfMul(poly[j], EXP[i]);
      }
      poly = next;
    }
    return poly; // highest-degree coefficient first, poly[0] === 1
  }
  /** Reed-Solomon remainder (the EC codewords) for a data codeword array. */
  function rsEncode(data, ecLen) {
    // rsGeneratorPoly already returns the polynomial highest-degree first, so
    // gen[0] is the x^ecLen coefficient and equals 1 — which is what makes the
    // long division below cancel res[i]. Reversing it here silently produced
    // garbage EC codewords and unscannable codes.
    const gen = rsGeneratorPoly(ecLen);
    const res = data.concat(new Array(ecLen).fill(0));
    for (let i = 0; i < data.length; i++) {
      const coef = res[i];
      if (coef === 0) continue;
      for (let j = 0; j < gen.length; j++) {
        res[i + j] ^= gfMul(gen[j], coef);
      }
    }
    return res.slice(data.length);
  }

  /* ---------------- Version tables (byte mode, EC level L) ---------------- */
  // [byteCapacity, totalCodewords, dataCodewords]
  const VTABLE = {
    1: [17, 26, 19], 2: [32, 44, 34], 3: [53, 70, 55],
    4: [78, 100, 80], 5: [106, 134, 108], 6: [134, 172, 136]
  };
  const ALIGN_POS = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34] };

  function pickVersion(byteLen) {
    for (let v = 1; v <= 6; v++) if (VTABLE[v][0] >= byteLen) return v;
    throw new Error('Text too long for this QR encoder (max ' + VTABLE[6][0] + ' bytes)');
  }

  function utf8Bytes(str) {
    const bytes = [];
    for (let i = 0; i < str.length; i++) {
      let c = str.codePointAt(i);
      if (c > 0xFFFF) i++; // surrogate pair consumed
      if (c < 0x80) bytes.push(c);
      else if (c < 0x800) bytes.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F));
      else if (c < 0x10000) bytes.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F));
      else bytes.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 0x3F), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F));
    }
    return bytes;
  }

  function buildDataCodewords(bytes, version) {
    const [, , dataLen] = VTABLE[version];
    const bits = [];
    const pushBits = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
    pushBits(0b0100, 4);            // byte mode indicator
    pushBits(bytes.length, 8);      // character count (8 bits, versions 1-9)
    bytes.forEach(b => pushBits(b, 8));
    // terminator (up to 4 zero bits)
    for (let i = 0; i < 4 && bits.length < dataLen * 8; i++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);
    const codewords = [];
    for (let i = 0; i < bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
      codewords.push(byte);
    }
    const pad = [0xEC, 0x11];
    let p = 0;
    while (codewords.length < dataLen) { codewords.push(pad[p % 2]); p++; }
    return codewords;
  }

  /* ---------------- Matrix construction ---------------- */
  function isFunctionModule(size, version, row, col) {
    // finder patterns (with separators) top-left, top-right, bottom-left
    if (row < 9 && col < 9) return true;
    if (row < 9 && col >= size - 8) return true;
    if (row >= size - 8 && col < 9) return true;
    // timing patterns
    if (row === 6 || col === 6) return true;
    // alignment pattern(s)
    const pos = ALIGN_POS[version];
    for (const r of pos) for (const c of pos) {
      if (r === 6 && c === 6) continue; // overlaps top-left finder, skipped
      if (Math.abs(row - r) <= 2 && Math.abs(col - c) <= 2) return true;
    }
    // dark module + format info strips are handled by the caller separately
    return false;
  }

  function drawFinder(m, size, r0, c0) {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const rr = r0 + r, cc = c0 + c;
      if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
      const onRing = (r === 0 || r === 6 || c === 0 || c === 6) && r >= 0 && r <= 6 && c >= 0 && c <= 6;
      const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      const isFinderArea = r >= 0 && r <= 6 && c >= 0 && c <= 6;
      m[rr][cc] = isFinderArea ? (onRing || core) : false; // separator ring stays light
    }
  }
  function drawAlignment(m, r0, c0) {
    for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++) {
      const onRing = Math.abs(r) === 2 || Math.abs(c) === 2;
      const core = r === 0 && c === 0;
      m[r0 + r][c0 + c] = onRing || core;
    }
  }

  const EC_L_BITS = 0b01; // spec-defined bit pattern for EC level L (not a natural 0/1/2/3 order)
  function formatBits(maskId) {
    let data = (EC_L_BITS << 3) | maskId; // 5 bits
    let g = data << 10;
    const poly = 0b10100110111; // BCH generator g(x) for format info
    for (let i = 4; i >= 0; i--) {
      if (g & (1 << (i + 10))) g ^= poly << i;
    }
    let bits = (data << 10) | g;
    bits ^= 0b101010000010010; // fixed XOR mask
    return bits;
  }

  function encode(text) {
    const bytes = utf8Bytes(text);
    const version = pickVersion(bytes.length);
    const [, totalLen, dataLen] = VTABLE[version];
    const ecLen = totalLen - dataLen;
    const dataCw = buildDataCodewords(bytes, version);
    const ecCw = rsEncode(dataCw, ecLen);
    const allCw = dataCw.concat(ecCw);

    const size = version * 4 + 17;
    const m = Array.from({ length: size }, () => new Array(size).fill(false));
    const reserved = Array.from({ length: size }, () => new Array(size).fill(false));
    const mark = (r, c) => { reserved[r][c] = true; };

    drawFinder(m, size, 0, 0); drawFinder(m, size, 0, size - 7); drawFinder(m, size, size - 7, 0);
    for (let i = 0; i < 9; i++) { mark(i, Math.min(i, 8)); }
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) mark(r, c);
    for (let r = 0; r < 9; r++) for (let c = size - 8; c < size; c++) mark(r, c);
    for (let r = size - 8; r < size; r++) for (let c = 0; c < 9; c++) mark(r, c);

    for (let i = 8; i < size - 8; i++) { m[6][i] = (i % 2 === 0); mark(6, i); m[i][6] = (i % 2 === 0); mark(i, 6); }

    const pos = ALIGN_POS[version];
    for (const r of pos) for (const c of pos) {
      if (r === 6 && c === 6) continue;
      if ((r < 9 && c < 9) || (r < 9 && c > size - 9) || (r > size - 9 && c < 9)) continue;
      drawAlignment(m, r, c);
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) mark(r + dr, c + dc);
    }

    m[size - 8][8] = true; mark(size - 8, 8); // dark module

    // format info: two copies, level-L + mask 0
    const fbits = formatBits(0);
    const bit = (i) => (fbits >> i) & 1;
    // around top-left finder
    const tl = [[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[7,8],[8,8],[8,7],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0]];
    for (let i = 0; i < 15; i++) { const [r, c] = tl[i]; m[r][c] = !!bit(i); }
    // top-right + bottom-left
    for (let i = 0; i < 8; i++) { m[8][size - 1 - i] = !!bit(i); }
    for (let i = 8; i < 15; i++) { m[size - 15 + i][8] = !!bit(i); }

    // place data bits in the standard up/down zigzag, skipping reserved modules
    const bitsOut = [];
    allCw.forEach(cw => { for (let i = 7; i >= 0; i--) bitsOut.push((cw >> i) & 1); });
    // Standard up/down zigzag over column pairs, right to left. When the pair
    // reaches the vertical timing line at column 6 the whole walk shifts one
    // column left, so `right` itself must be reassigned — deriving a separate
    // column from it left columns 3..0 misplaced and column 0 never written,
    // which no scanner could read.
    let bi = 0, up = true;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let k = 0; k < size; k++) {
        const row = up ? size - 1 - k : k;
        for (const c of [right, right - 1]) {
          if (reserved[row][c]) continue;
          const dark = bi < bitsOut.length ? !!bitsOut[bi++] : false;
          const masked = ((row + c) % 2 === 0) ? !dark : dark; // mask 0: (row+col)%2==0
          m[row][c] = masked;
        }
      }
      up = !up;
    }

    return { size, modules: m };
  }

  function toSvg(text, opts) {
    opts = opts || {};
    // The spec requires a 4-module quiet zone; at 2 many phone scanners simply
    // refuse to lock on, especially against the card's printed border.
    const quiet = opts.quietZone == null ? 4 : opts.quietZone;
    const dark = opts.dark || '#000000';
    const light = opts.light || 'transparent';
    const { size, modules } = encode(text);
    const total = size + quiet * 2;
    let rects = '';
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (modules[r][c]) rects += '<rect x="' + (c + quiet) + '" y="' + (r + quiet) + '" width="1" height="1"/>';
      }
    }
    return '<svg viewBox="0 0 ' + total + ' ' + total + '" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">' +
      (light !== 'transparent' ? '<rect width="' + total + '" height="' + total + '" fill="' + light + '"/>' : '') +
      '<g fill="' + dark + '">' + rects + '</g></svg>';
  }

  window.QR = { encode, toSvg };
})();
