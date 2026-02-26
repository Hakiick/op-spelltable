/**
 * Seeded pseudo-random number generator (xoshiro128**).
 * Provides deterministic randomness for reproducible training.
 */

export function createSeededRandom(seed: number): () => number {
  // Initialize state from seed using splitmix32
  let s0 = seed | 0;
  function splitmix32(): number {
    s0 |= 0;
    s0 = (s0 + 0x9e3779b9) | 0;
    let t = s0 ^ (s0 >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97);
    t = t ^ (t >>> 15);
    return t >>> 0;
  }

  let a = splitmix32();
  let b = splitmix32();
  let c = splitmix32();
  let d = splitmix32();

  // xoshiro128** core
  return function random(): number {
    const result = Math.imul(rotl(Math.imul(b, 5), 7), 9) >>> 0;
    const t = (b << 9) >>> 0;

    c ^= a;
    d ^= b;
    b ^= c;
    a ^= d;

    c ^= t;
    d = rotl(d, 11);

    return result / 4294967296;
  };
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/**
 * Fisher-Yates shuffle with seeded random.
 */
export function shuffleArray<T>(array: T[], random: () => number): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
