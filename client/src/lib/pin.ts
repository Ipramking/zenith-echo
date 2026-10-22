// The PIN is never stored in plain text. SHA-256 with a random salt where the browser allows it
// (crypto.subtle only exists on https or localhost); otherwise a simple non-cryptographic fallback,
// which is fine for a local demo but would not be acceptable in a real banking app.

function weak(s: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 'w:' + (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16)
}

export function newSalt(): string {
  return Array.from({ length: 8 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('')
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  const input = `${salt}:${pin}`
  try {
    if (globalThis.crypto?.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
      return 's:' + Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
    }
  } catch {
    /* fall through to the fallback */
  }
  return weak(input)
}

/** Compares using whichever method produced the stored hash. */
export async function checkPin(pin: string, salt: string, stored: string): Promise<boolean> {
  if (stored.startsWith('w:')) return weak(`${salt}:${pin}`) === stored
  return (await hashPin(pin, salt)) === stored
}
