import type { Signal } from '@angular/core';

export type RecognitionImage = File | HTMLCanvasElement;

export interface PokemonRecognition {
  name: string;
  similarity: number;
  text: string;
}

export interface PokemonRecognizer {
  readonly initializing: Signal<boolean>;
  readonly processing: Signal<boolean>;
  readonly progress: Signal<number>;
  recognize(image: RecognitionImage, titleCrop?: boolean): Promise<PokemonRecognition | null>;
  release(): Promise<void>;
}