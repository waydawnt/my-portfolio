// Souvenir "product-style" key for the licence card. Pure functions, shared by the
// static render (build time) and the browser. It is a decoration made from the name and
// the year: it unlocks nothing and is not checked anywhere.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 symbols, no look-alikes (I/O/0/1)
const MAX_NAME = 40;

/** Trims, collapses whitespace, drops control and direction-override characters, caps at 40 characters. */
export function cleanName(raw) {
  const s = String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(s).slice(0, MAX_NAME).join('').trim();
}

function fnv1a(str, seed) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function block(n) {
  let out = '';
  for (let i = 0; i < 5; i++) out += ALPHABET[(n >>> (i * 5)) & 31];
  return out;
}

export function licenceKey(name, year) {
  const base = `${String(name).toLowerCase()}|${year}`;
  return `VDS-${year}-${block(fnv1a(base, 0x811c9dc5))}-${block(fnv1a(base, 0x9747b28c))}`;
}
