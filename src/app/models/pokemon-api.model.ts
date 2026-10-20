export interface PokemonApiStat {
  name: string;
  value: number;
}

export interface PokemonLearnableMove {
  name: string;
  url: string;
  learnMethod: string;
  levelLearnedAt: number | null;
  versionGroup: string;
}

export interface PokedexPokemon {
  id: number;
  name: string;
  displayName?: string;
  image: string;
  types: string[];
  height: number;
  weight: number;
  abilities: string[];
  stats: PokemonApiStat[];
  description: string;
}