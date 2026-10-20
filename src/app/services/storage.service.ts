import { Injectable, signal } from '@angular/core';
import { PokedexPokemon } from '../models/pokemon-api.model';

const HISTORY_KEY = 'pokemon-ar-history';
const CACHE_KEY = 'pokemon-ar-cache';
const HISTORY_LIMIT = 100;

@Injectable({ providedIn: 'root' })
export class StorageService {
  readonly history = signal<PokedexPokemon[]>(this.readRecords(HISTORY_KEY));
  private readonly cachedPokemons = signal<PokedexPokemon[]>(this.readRecords(CACHE_KEY));

  savePokemon(pokemon: PokedexPokemon): void {
    const history = [pokemon, ...this.history().filter((item) => item.id !== pokemon.id)]
      .slice(0, HISTORY_LIMIT);
    this.history.set(history);
    this.writeRecords(HISTORY_KEY, history);
    this.cachePokemon(pokemon);
  }

  cachePokemon(pokemon: PokedexPokemon): void {
    const cache = [pokemon, ...this.cachedPokemons().filter((item) => item.id !== pokemon.id)];
    this.cachedPokemons.set(cache);
    this.writeRecords(CACHE_KEY, cache);
  }

  findCachedPokemon(identifier: string): PokedexPokemon | undefined {
    const query = identifier.trim().toLowerCase().replace(/^#/, '');
    return this.cachedPokemons().find((pokemon) =>
      String(pokemon.id) === query || pokemon.name.toLowerCase() === query
    );
  }

  removeFromHistory(id: number): void {
    const history = this.history().filter((pokemon) => pokemon.id !== id);
    this.history.set(history);
    this.writeRecords(HISTORY_KEY, history);
  }

  clearHistory(): void {
    this.history.set([]);
    this.writeRecords(HISTORY_KEY, []);
  }

  private readRecords(key: string): PokedexPokemon[] {
    try {
      const raw: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
      return Array.isArray(raw) ? raw.filter(isPokedexPokemon) : [];
    } catch {
      return [];
    }
  }

  private writeRecords(key: string, records: PokedexPokemon[]): void {
    try {
      localStorage.setItem(key, JSON.stringify(records));
    } catch {
      // La app continúa si el navegador bloquea el almacenamiento local.
    }
  }
}

function isPokedexPokemon(value: unknown): value is PokedexPokemon {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record['id'] === 'number'
    && typeof record['name'] === 'string'
    && typeof record['image'] === 'string'
    && Array.isArray(record['types'])
    && typeof record['height'] === 'number'
    && typeof record['weight'] === 'number'
    && Array.isArray(record['abilities'])
    && Array.isArray(record['stats'])
    && typeof record['description'] === 'string';
}