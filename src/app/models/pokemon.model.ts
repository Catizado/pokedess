export interface PokemonStat {
  name: string;
  value: number;
}

export interface Pokemon {
  id: number;
  name: string;
  image: string;
  types: string[];
  weaknesses: string[];
  height: number;
  weight: number;
  stats: PokemonStat[];
  isCustom?: boolean; // Bandera para saber si lo creamos por CRUD
}
export type PokemonInput = Omit<Pokemon, 'id' | 'isCustom'>;
export const POKEMON_TYPES = [
  'normal', 'fire', 'water', 'grass', 'electric', 'ice', 'fighting', 'poison', 'ground',
  'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'
];

export const POKEMON_STATS = [
  { name: 'hp', label: 'HP' },
  { name: 'attack', label: 'Ataque' },
  { name: 'defense', label: 'Defensa' },
  { name: 'special-attack', label: 'Ataque especial' },
  { name: 'special-defense', label: 'Defensa especial' },
  { name: 'speed', label: 'Velocidad' },
];