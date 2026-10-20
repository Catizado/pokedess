import { findBestPokemonMatch, normalizePokemonName } from './pokemon-name-matcher';

describe('pokemon-name-matcher', () => {
  const officialNames = ['pikachu', 'charizard', 'mr-mime', 'mew'];

  it('normalizes accents, spaces, and punctuation', () => {
    expect(normalizePokemonName('Mr. Mime')).toBe('mrmime');
    expect(normalizePokemonName('Pokémon')).toBe('pokemon');
  });

  it('finds an exact name among other card text', () => {
    expect(findBestPokemonMatch('PIKACHU\n25/102 HP 60', officialNames)?.name).toBe('pikachu');
  });

  it('tolerates a small OCR typo and a split multiword name', () => {
    expect(findBestPokemonMatch('Charizrd', officialNames)?.name).toBe('charizard');
    expect(findBestPokemonMatch('MR MIME', officialNames)?.name).toBe('mr-mime');
  });

  it('rejects short or unrelated text instead of guessing', () => {
    expect(findBestPokemonMatch('meww', officialNames)).toBeNull();
    expect(findBestPokemonMatch('ultra rare trainer card', officialNames)).toBeNull();
  });
});