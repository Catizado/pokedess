import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { finalize, forkJoin, map, switchMap } from 'rxjs';
import { Pokemon, PokemonInput } from '../models/pokemon.model';
import { calculateWeaknesses } from '../utils/weaknesses';

interface PokemonListResponse {
  results: { url: string }[];
}

interface PokemonApiDetail {
  id: number;
  name: string;
  height: number;
  weight: number;
  sprites: {
    front_default: string | null;
    other?: { 'official-artwork'?: { front_default: string | null } };
  };
  types: { type: { name: string } }[];
  stats: { base_stat: number; stat: { name: string } }[];
}

const API_URL = 'https://pokeapi.co/api/v2/pokemon';
const STORAGE_KEY = 'custom-pokemons';
const FIRST_CUSTOM_ID = 900; 

function toPokemon(d: PokemonApiDetail): Pokemon {
  const types = d.types.map((t) => t.type.name);
  return {
    id: d.id,
    name: d.name,
    image: d.sprites.other?.['official-artwork']?.front_default ?? d.sprites.front_default ?? '',
    types,
    weaknesses: calculateWeaknesses(types),
    height: d.height / 10,
    weight: d.weight / 10,
    stats: d.stats.map((s) => ({ name: s.stat.name, value: s.base_stat })),
  };
}

@Injectable({ providedIn: 'root' })
export class PokemonService {
  private http = inject(HttpClient);

  private apiPokemons = signal<Pokemon[]>([]);
  private customPokemons = signal<Pokemon[]>(this.readStorage());

  readonly pokemons = computed(() => [...this.apiPokemons(), ...this.customPokemons()]);
    readonly loading = signal(true);
  readonly loadFailed = signal(false);

    constructor() {
    this.load();
  }

  getById(id: number): Pokemon | undefined {
    return this.pokemons().find((p) => p.id === id);
  }

  create(data: PokemonInput): Pokemon {
    const pokemon: Pokemon = { ...data, id: this.nextCustomId(), isCustom: true };
    this.saveCustom([...this.customPokemons(), pokemon]);
    return pokemon;
  }

  // Solo afecta a los Pokémon propios: los de la API no están en customPokemons.
  update(id: number, data: PokemonInput): void {
    this.saveCustom(this.customPokemons().map((p) => (p.id === id ? { ...p, ...data } : p)));
  }

  remove(id: number): void {
    this.saveCustom(this.customPokemons().filter((p) => p.id !== id));
  }

    load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    this.http
      .get<PokemonListResponse>(`${API_URL}?limit=151`)
      .pipe(
        switchMap((res) =>
          forkJoin(res.results.map((p) => this.http.get<PokemonApiDetail>(p.url)))
        ),
        map((details) => details.map(toPokemon)),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (pokemons) => this.apiPokemons.set(pokemons),
        error: (err) => {
          console.error('No se pudo cargar la PokeAPI', err);
          this.loadFailed.set(true);
        },
      });
  }

  private nextCustomId(): number {
    return Math.max(FIRST_CUSTOM_ID - 1, ...this.customPokemons().map((p) => p.id)) + 1;
  }

  private saveCustom(list: Pokemon[]): void {
    this.customPokemons.set(list);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  private readStorage(): Pokemon[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Pokemon[]) : [];
    } catch {
      return [];
    }
  }
}