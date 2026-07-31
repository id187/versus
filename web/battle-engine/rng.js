"use strict";

class Mulberry32 {
  constructor(seed = null) {
    this.state = seed == null || seed === "" ? Date.now() >>> 0 : hashSeed(String(seed));
  }

  next() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(max) {
    return Math.floor(this.next() * max);
  }

  choice(items) {
    if (!items.length) {
      return undefined;
    }
    return items[this.range(items.length)];
  }
}

function hashSeed(text) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

module.exports = { Mulberry32, hashSeed };
