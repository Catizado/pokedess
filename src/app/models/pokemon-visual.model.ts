import type { Signal } from '@angular/core';

export interface VisualPokemonCandidate {
  name: string;
  score: number;
}

export interface PokemonVisualRecognizer {
  readonly initializing: Signal<boolean>;
  readonly processing: Signal<boolean>;
  readonly progress: Signal<number>;
  readonly engine: Signal<'GPU' | 'CPU'>;
  classify(image: File | HTMLCanvasElement): Promise<VisualPokemonCandidate[]>;
  release(): Promise<void>;
}