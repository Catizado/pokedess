import { DestroyRef, InjectionToken, Injectable, inject, signal } from '@angular/core';
import type { ZeroShotImageClassificationOutput } from '@huggingface/transformers';
import { firstValueFrom } from 'rxjs';
import { PokemonVisualRecognizer, VisualPokemonCandidate } from '../models/pokemon-visual.model';
import { PokemonApiService } from './pokemon-api.service';

const MODEL_ID = 'Xenova/clip-vit-base-patch32';
type ImageClassifier = ((
  image: File | HTMLCanvasElement,
  labels: string[],
  options?: { hypothesis_template?: string },
) => Promise<ZeroShotImageClassificationOutput>) & { dispose(): Promise<void> };

@Injectable({ providedIn: 'root' })
export class PokemonVisualService implements PokemonVisualRecognizer {
  private readonly pokemonApi = inject(PokemonApiService);
  private readonly destroyRef = inject(DestroyRef);
  private classifierPromise: Promise<ImageClassifier> | null = null;

  readonly initializing = signal(false);
  readonly processing = signal(false);
  readonly progress = signal(0);
  readonly engine = signal<'GPU' | 'CPU'>('CPU');

  constructor() {
    this.destroyRef.onDestroy(() => void this.release());
  }

  async classify(image: File | HTMLCanvasElement): Promise<VisualPokemonCandidate[]> {
    this.processing.set(true);
    try {
      const [classifier, pokemonNames] = await Promise.all([
        this.getClassifier(),
        firstValueFrom(this.pokemonApi.getKantoPokemonNames()),
      ]);
      const labelToName = new Map(pokemonNames.map((name) => [pokemonLabel(name), name]));
      const labels = [...labelToName.keys()];
      const preparedImage = image instanceof HTMLCanvasElement ? image : await cropUploadedArtwork(image);
      const output = await classifier(preparedImage, labels, {
        hypothesis_template: 'A Pokémon card illustration of {}.',
      });
      return output.slice(0, 3).flatMap((item) => {
        const name = labelToName.get(item.label);
        return name ? [{ name, score: item.score }] : [];
      });
    } finally {
      this.processing.set(false);
    }
  }

  async release(): Promise<void> {
    const classifierPromise = this.classifierPromise;
    this.classifierPromise = null;
    if (classifierPromise) {
      try {
        await (await classifierPromise).dispose();
      } catch {
        // El runtime puede haberse cerrado durante la navegación.
      }
    }
  }

  private async getClassifier(): Promise<ImageClassifier> {
    if (!this.classifierPromise) this.classifierPromise = this.createClassifier();
    return this.classifierPromise;
  }

  private async createClassifier(): Promise<ImageClassifier> {
    this.initializing.set(true);
    this.progress.set(0);
    try {
      const { pipeline } = await import('@huggingface/transformers');
      const progressCallback = (info: import('@huggingface/transformers').ProgressInfo): void => {
        if (info.status === 'progress_total') this.progress.set(Math.round(info.progress));
        if (info.status === 'ready') this.progress.set(100);
      };

      if (await hasWebGpuAdapter()) {
        try {
          this.engine.set('GPU');
          const classifier = await pipeline('zero-shot-image-classification', MODEL_ID, {
            device: 'webgpu',
            dtype: 'q4f16',
            progress_callback: progressCallback,
          });
          this.engine.set('GPU');
          return classifier as ImageClassifier;
        } catch (error: unknown) {
          console.warn('WebGPU no pudo iniciar CLIP; se usará WASM.', error);
          this.progress.set(0);
        }
      }

      this.engine.set('CPU');
      const classifier = await pipeline('zero-shot-image-classification', MODEL_ID, {
        dtype: 'q8',
        progress_callback: progressCallback,
      });
      this.engine.set('CPU');
      return classifier as ImageClassifier;
    } catch (error: unknown) {
      this.classifierPromise = null;
      throw error;
    } finally {
      this.initializing.set(false);
    }
  }
}

export const POKEMON_VISUAL_RECOGNIZER = new InjectionToken<PokemonVisualRecognizer>(
  'POKEMON_VISUAL_RECOGNIZER',
  { providedIn: 'root', factory: () => inject(PokemonVisualService) },
);

function pokemonLabel(name: string): string {
  if (name === 'nidoran-f') return 'Nidoran female';
  if (name === 'nidoran-m') return 'Nidoran male';
  if (name === 'farfetchd') return "Farfetch'd";
  if (name === 'mr-mime') return 'Mr. Mime';
  return name.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function cropUploadedArtwork(file: File): Promise<HTMLCanvasElement> {
  const image = await createImageBitmap(file);
  try {
    const isPortraitCard = image.height / image.width > 1.15;
    const left = isPortraitCard ? Math.round(image.width * 0.08) : 0;
    const top = isPortraitCard ? Math.round(image.height * 0.22) : 0;
    const width = Math.max(1, Math.round(image.width * (isPortraitCard ? 0.84 : 1)));
    const height = Math.max(1, Math.round(image.height * (isPortraitCard ? 0.48 : 1)));
    const scale = Math.min(1, 512 / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No se pudo preparar la ilustración.');
    context.drawImage(image, left, top, width, height, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    image.close();
  }
}

async function hasWebGpuAdapter(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  const gpuNavigator = navigator as Navigator & {
    gpu?: { requestAdapter: () => Promise<unknown | null> };
  };
  try {
    return (await gpuNavigator.gpu?.requestAdapter()) !== null
      && gpuNavigator.gpu !== undefined;
  } catch {
    return false;
  }
}