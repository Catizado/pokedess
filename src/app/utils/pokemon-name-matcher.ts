export interface PokemonNameMatch {
  name: string;
  similarity: number;
}

export function normalizePokemonName(value: string): string {
  return value.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function findBestPokemonMatch(ocrText: string, officialNames: string[]): PokemonNameMatch | null {
  const candidates = extractCandidates(ocrText);
  const scores = new Map<string, number>();

  for (const officialName of officialNames) {
    const normalizedName = normalizePokemonName(officialName);
    if (!normalizedName) continue;

    let bestScore = 0;
    for (const candidate of candidates) {
      if (candidate === normalizedName) {
        bestScore = 1;
        break;
      }
      if (normalizedName.length <= 4) continue;

      const maxDistance = Math.max(1, Math.floor(normalizedName.length * 0.24));
      if (Math.abs(candidate.length - normalizedName.length) > maxDistance) continue;
      const distance = levenshteinDistance(candidate, normalizedName);
      if (distance <= maxDistance) {
        bestScore = Math.max(bestScore, 1 - distance / normalizedName.length);
      }
    }
    if (bestScore) scores.set(officialName, bestScore);
  }

  const ranked = [...scores.entries()].sort((left, right) => right[1] - left[1]);
  const best = ranked[0];
  if (!best) return null;

  const normalizedLength = normalizePokemonName(best[0]).length;
  const minimumConfidence = normalizedLength <= 4 ? 1 : 0.72;
  const secondBest = ranked[1]?.[1] ?? 0;
  if (best[1] < minimumConfidence || (best[1] < 1 && best[1] - secondBest < 0.06)) return null;

  return { name: best[0], similarity: best[1] };
}

function extractCandidates(text: string): string[] {
  const candidates = new Set<string>();
  for (const line of text.split(/[\r\n]+/)) {
    const tokens = line.match(/[a-z0-9]+/gi)?.map(normalizePokemonName).filter(Boolean) ?? [];
    const wholeLine = tokens.join('');
    if (wholeLine) candidates.add(wholeLine);

    for (let start = 0; start < tokens.length; start += 1) {
      for (let length = 1; length <= 3 && start + length <= tokens.length; length += 1) {
        const phrase = tokens.slice(start, start + length).join('');
        if (phrase) candidates.add(phrase);
      }
    }
  }
  return [...candidates];
}

function levenshteinDistance(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + substitutionCost,
      );
    }
    previous = current;
  }
  return previous[right.length];
}