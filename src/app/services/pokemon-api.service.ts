import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, from, map, mergeMap, of, switchMap, tap, throwError, toArray } from 'rxjs';
import { PokedexPokemon, PokemonLearnableMove } from '../models/pokemon-api.model';
import { StorageService } from './storage.service';

interface PokeApiPokemon {
  id: number;
  name: string;
  height: number;
  weight: number;
  sprites: {
    front_default: string | null;
    other?: { 'official-artwork'?: { front_default: string | null } };
  };
  types: { type: { name: string } }[];
  abilities: { ability: { name: string } }[];
  stats: { base_stat: number; stat: { name: string } }[];
  species: { url: string };
}

interface PokeApiSpecies {
  names?: { name: string; language: { name: string } }[];
  flavor_text_entries: {
    flavor_text: string;
    language: { name: string };
  }[];
}

interface PokeApiMoveLearnset {
  moves: {
    move: { name: string; url: string };
    version_group_details: {
      level_learned_at: number;
      move_learn_method: { name: string };
      version_group: { name: string };
    }[];
  }[];
}

interface PokeApiLocalizedNames {
  names: { name: string; language: { name: string } }[];
}

interface PokeApiPokemonList {
  results: { name: string }[];
}

const API_URL = 'https://pokeapi.co/api/v2';

@Injectable({ providedIn: 'root' })
export class PokemonApiService {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(StorageService);
  private readonly memoryCache = new Map<string, PokedexPokemon>();
  private readonly moveCache = new Map<number, PokemonLearnableMove[]>();
  private readonly localizedNameCache = new Map<string, string>();
  private officialNamesCache: string[] | null = null;
  private kantoNamesCache: string[] | null = null;

  getKantoPokemonNames(): Observable<string[]> {
    if (this.kantoNamesCache) return of(this.kantoNamesCache);
    return this.http.get<PokeApiPokemonList>(`${API_URL}/pokemon?limit=151`).pipe(
      map((response) => response.results.map((pokemon) => pokemon.name)),
      tap((names) => this.kantoNamesCache = names),
    );
  }

  getOfficialPokemonNames(): Observable<string[]> {
    if (this.officialNamesCache) return of(this.officialNamesCache);
    return this.http.get<{ results: { name: string }[] }>(`${API_URL}/pokemon-species?limit=2000`).pipe(
      map((response) => response.results.map((species) => species.name)),
      tap((names) => this.officialNamesCache = names),
    );
  }

  searchPokemon(identifier: string): Observable<PokedexPokemon> {
    const query = identifier.trim().toLowerCase().replace(/^#/, '');
    if (!query) return throwError(() => new Error('Escribe un nombre o número de Pokédex.'));

    const cached = this.memoryCache.get(query) ?? this.storage.findCachedPokemon(query);
    if (cached) {
      if (cached.displayName) return of(cached);
      return this.http.get<PokeApiSpecies>(`${API_URL}/pokemon-species/${cached.id}/`).pipe(
        map((species) => ({
          ...cached,
          displayName: species.names?.find((item) => item.language.name === 'es')?.name
            ?? species.names?.find((item) => item.language.name === 'es-419')?.name
            ?? cached.name,
        })),
        tap((pokemon) => {
          this.memoryCache.set(String(pokemon.id), pokemon);
          this.memoryCache.set(pokemon.name, pokemon);
          this.storage.cachePokemon(pokemon);
        }),
        catchError(() => of(cached)),
      );
    }

    return this.http.get<PokeApiPokemon>(`${API_URL}/pokemon/${encodeURIComponent(query)}`).pipe(
      switchMap((pokemon) => forkJoin({
        pokemon: of(pokemon),
        species: this.http.get<PokeApiSpecies>(pokemon.species.url),
      })),
      map(({ pokemon, species }) => toPokedexPokemon(pokemon, species)),
      tap((pokemon) => {
        this.memoryCache.set(String(pokemon.id), pokemon);
        this.memoryCache.set(pokemon.name, pokemon);
        this.storage.cachePokemon(pokemon);
      }),
    );
  }

  getMoveLearnset(pokemonId: number): Observable<PokemonLearnableMove[]> {
    const cached = this.moveCache.get(pokemonId);
    if (cached) return of(cached);
    if (!Number.isInteger(pokemonId) || pokemonId < 1) {
      return throwError(() => new Error('El número de Pokémon no es válido.'));
    }

    return this.http.get<PokeApiMoveLearnset>(`${API_URL}/pokemon/${pokemonId}`).pipe(
      map((response) => {
        const moves = response.moves.flatMap(({ move, version_group_details }) =>
          version_group_details.map((detail) => ({
            name: move.name,
            url: move.url,
            learnMethod: detail.move_learn_method.name,
            levelLearnedAt: detail.move_learn_method.name === 'level-up'
              ? detail.level_learned_at
              : null,
            versionGroup: detail.version_group.name,
          }))
        );
        return [...new Map(moves.map((move) => [
          `${move.name}|${move.learnMethod}|${move.levelLearnedAt}|${move.versionGroup}`,
          move,
        ])).values()];
      }),
      tap((moves) => this.moveCache.set(pokemonId, moves)),
    );
  }

  getSpanishMoveNames(moves: PokemonLearnableMove[]): Observable<Record<string, string>> {
    const uniqueMoves = [...new Map(moves.map((move) => [move.name, move])).values()];
    return from(uniqueMoves).pipe(
      mergeMap((move) => this.getSpanishName(move.name, move.url), 5),
      toArray(),
      map((entries) => Object.fromEntries(entries)),
    );
  }

  getSpanishAbilityNames(abilities: string[]): Observable<Record<string, string>> {
    const uniqueAbilities = [...new Set(abilities)];
    return from(uniqueAbilities).pipe(
      mergeMap((ability) => {
        const slug = ability.trim().toLowerCase().replace(/\s+/g, '-');
        return this.getSpanishName(slug, `${API_URL}/ability/${encodeURIComponent(slug)}/`).pipe(
          map(([, name]): [string, string] => [ability, name]),
        );
      }, 4),
      toArray(),
      map((entries) => Object.fromEntries(entries)),
    );
  }

  private getSpanishName(key: string, url: string): Observable<[string, string]> {
    const cached = this.localizedNameCache.get(key);
    if (cached) return of([key, cached]);

    return this.http.get<PokeApiLocalizedNames>(url).pipe(
      map((response) => response.names.find((item) => item.language.name === 'es')
        ?? response.names.find((item) => item.language.name === 'es-419')),
      map((localized) => localized?.name ?? humanizePokemonTerm(key)),
      catchError(() => of(humanizePokemonTerm(key))),
      tap((name) => this.localizedNameCache.set(key, name)),
      map((name): [string, string] => [key, name]),
    );
  }
}

function humanizePokemonTerm(value: string): string {
  return value.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function toPokedexPokemon(pokemon: PokeApiPokemon, species: PokeApiSpecies): PokedexPokemon {
  const entry = species.flavor_text_entries.find((item) => item.language.name === 'es')
    ?? species.flavor_text_entries.find((item) => item.language.name === 'en');

  return {
    id: pokemon.id,
    name: pokemon.name,
    displayName: species.names?.find((item) => item.language.name === 'es')?.name
      ?? species.names?.find((item) => item.language.name === 'es-419')?.name,
    image: pokemon.sprites.other?.['official-artwork']?.front_default
      ?? pokemon.sprites.front_default
      ?? '',
    types: pokemon.types.map((item) => item.type.name),
    height: pokemon.height / 10,
    weight: pokemon.weight / 10,
    abilities: pokemon.abilities.map((item) => item.ability.name),
    stats: pokemon.stats.map((item) => ({ name: item.stat.name, value: item.base_stat })),
    description: (entry?.flavor_text ?? 'Sin descripción disponible.')
      .replace(/[\n\f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  };
}