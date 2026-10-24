// Typo tolerance shared by offline search (browser) and place matching (server):
// "pharmcy", "laxitives" and "Spartn Villge" should still find what people meant.

/** Edit distance where swapping two neighboring letters counts as one typo ("teh" -> "the"). */
export function typoDistance(a: string, b: string, max = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i < rows; i++) {
    let rowMin = Infinity;
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}

/** How many typos a word of this length may have and still count as a match. */
export function allowedTypos(word: string): number {
  if (word.length <= 3) return 0;
  if (word.length <= 6) return 1;
  return 2;
}

/** True if `typed` is `target` with a few typos (or a typo'd beginning of it, e.g. "pharm" for "pharmacy"). */
export function closeEnough(typed: string, target: string): boolean {
  if (typed === target) return true;
  const limit = allowedTypos(typed);
  if (limit === 0) return false;
  if (typoDistance(typed, target, limit) <= limit) return true;
  // Prefixes: "laxitiv" vs "laxative" compares against the start of the target word.
  return typed.length >= 5 && target.length > typed.length && typoDistance(typed, target.slice(0, typed.length), limit) <= limit;
}

/** Lowercase words without accents, so "José" and "Jose" or "farmácia" and "farmacia" compare equal. */
export function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}
