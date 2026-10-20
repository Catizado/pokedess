import { DestroyRef, InjectionToken, Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { Worker as TesseractWorker } from 'tesseract.js';
import { PokemonRecognition, PokemonRecognizer, RecognitionImage } from '../models/pokemon-recognition.model';
import { findBestPokemonMatch } from '../utils/pokemon-name-matcher';
import { PokemonApiService } from './pokemon-api.service';

@Injectable({ providedIn: 'root' })
export class RecognitionService implements PokemonRecognizer {
  private readonly pokemonApi = inject(PokemonApiService);
  private readonly destroyRef = inject(DestroyRef);
  private workerPromise: Promise<TesseractWorker> | null = null;

  readonly initializing = signal(false);
  readonly processing = signal(false);
  readonly progress = signal(0);

  constructor() {
    this.destroyRef.onDestroy(() => void this.release());
  }

  async recognize(image: RecognitionImage, titleCrop = true): Promise<PokemonRecognition | null> {
    this.processing.set(true);
    try {
      const [worker, officialNames, preparedImage] = await Promise.all([
        this.getWorker(),
        firstValueFrom(this.pokemonApi.getOfficialPokemonNames()),
        prepareTitleImage(image, titleCrop),
      ]);
      const { data } = await worker.recognize(preparedImage);
      const match = findBestPokemonMatch(data.text, officialNames);
      return match ? { ...match, text: data.text } : null;
    } finally {
      this.processing.set(false);
    }
  }

  private async getWorker(): Promise<TesseractWorker> {
    if (!this.workerPromise) this.workerPromise = this.createWorker();
    return this.workerPromise;
  }

  private async createWorker(): Promise<TesseractWorker> {
    this.initializing.set(true);
    this.progress.set(0);
    try {
      const { createWorker } = await import('tesseract.js');
      return await createWorker(['eng', 'spa'], 1, {
        logger: (message) => this.progress.set(Math.round(message.progress * 100)),
      });
    } catch (error: unknown) {
      this.workerPromise = null;
      throw error;
    } finally {
      this.initializing.set(false);
    }
  }

  async release(): Promise<void> {
    const workerPromise = this.workerPromise;
    this.workerPromise = null;
    if (workerPromise) {
      try {
        await (await workerPromise).terminate();
      } catch {
        // El worker puede haberse cerrado ya al destruir la aplicación.
      }
    }
  }
}

export const POKEMON_RECOGNIZER = new InjectionToken<PokemonRecognizer>(
  'POKEMON_RECOGNIZER',
  { providedIn: 'root', factory: () => inject(RecognitionService) },
);

async function prepareTitleImage(source: RecognitionImage, cropTitle: boolean): Promise<HTMLCanvasElement> {
  const image = source instanceof HTMLCanvasElement ? source : await createImageBitmap(source);
  try {
    const left = cropTitle ? Math.round(image.width * 0.05) : 0;
    const top = cropTitle ? Math.round(image.height * 0.035) : 0;
    const width = cropTitle ? Math.round(image.width * 0.9) : image.width;
    const height = cropTitle ? Math.round(image.height * 0.24) : image.height;
    const scale = Math.min(3, Math.max(1, 1200 / width));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('No se pudo preparar la imagen para el OCR.');

    context.drawImage(image, left, top, width, height, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < pixels.data.length; index += 4) {
      const gray = pixels.data[index] * 0.299
        + pixels.data[index + 1] * 0.587
        + pixels.data[index + 2] * 0.114;
      const contrast = Math.max(0, Math.min(255, (gray - 128) * 1.45 + 128));
      pixels.data[index] = contrast;
      pixels.data[index + 1] = contrast;
      pixels.data[index + 2] = contrast;
    }
    context.putImageData(pixels, 0, 0);
    return canvas;
  } finally {
    if (image instanceof ImageBitmap) image.close();
  }
}

// TODO: Las cartas o imágenes sin texto requieren reconocimiento visual por imagen/modelo, no OCR.