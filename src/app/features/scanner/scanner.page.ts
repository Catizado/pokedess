import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton, IonContent, IonHeader, IonSearchbar, IonSelect, IonSelectOption,
  IonTitle, IonToolbar, IonToggle,
} from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { PokedexPokemon } from '../../models/pokemon-api.model';
import { PokemonRecognition } from '../../models/pokemon-recognition.model';
import { CameraService, cameraErrorMessage } from '../../services/camera.service';
import { PokemonApiService } from '../../services/pokemon-api.service';
import { POKEMON_RECOGNIZER } from '../../services/recognition.service';
import { POKEMON_VISUAL_RECOGNIZER } from '../../services/pokemon-visual.service';
import { StorageService } from '../../services/storage.service';
import { VoiceService } from '../../services/voice.service';
import { VisualPokemonCandidate } from '../../models/pokemon-visual.model';
import { humanize, spanishTypeName } from '../../utils/pokemon-localization';
import { advanceVisualConfirmation } from '../../utils/visual-candidate-confirmation';

const TYPE_COLORS: Record<string, string> = {
  normal: '#A8A77A', fire: '#EE8130', water: '#6390F0', grass: '#7AC74C',
  electric: '#D9B800', ice: '#96D9D6', fighting: '#C22E28', poison: '#A33EA1',
  ground: '#E2BF65', flying: '#A98FF3', psychic: '#F95587', bug: '#A6B91A',
  rock: '#B6A136', ghost: '#735797', dragon: '#6F35FC', dark: '#705746',
  steel: '#B7B7CE', fairy: '#D685AD',
};

@Component({
  selector: 'app-scanner',
  standalone: true,
  imports: [
    IonButton, IonContent, IonHeader, IonSearchbar, IonSelect, IonSelectOption,
    IonTitle, IonToolbar, IonToggle, RouterLink,
  ],
  templateUrl: './scanner.page.html',
  styleUrl: './scanner.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScannerPage implements OnInit, OnDestroy {
  private readonly camera = inject(CameraService);
  private readonly pokemonApi = inject(PokemonApiService);
  readonly recognizer = inject(POKEMON_RECOGNIZER);
  readonly visualRecognizer = inject(POKEMON_VISUAL_RECOGNIZER);
  private readonly storage = inject(StorageService);
  readonly voice = inject(VoiceService);

  @ViewChild('videoElement') private videoElement?: ElementRef<HTMLVideoElement>;
  @ViewChild('cardGuide') private cardGuide?: ElementRef<HTMLDivElement>;
  @ViewChild('frameCanvas') private frameCanvas?: ElementRef<HTMLCanvasElement>;

  readonly cameras = signal<MediaDeviceInfo[]>([]);
  readonly selectedCamera = signal('');
  readonly cameraActive = signal(false);
  readonly cameraBusy = signal(false);
  readonly cameraMessage = signal('Activa la cámara para preparar el escáner.');
  readonly overlayEnabled = signal(false);
  readonly query = signal('');
  readonly result = signal<PokedexPokemon | null>(null);
  readonly visualCandidates = signal<VisualPokemonCandidate[]>([]);
  readonly visualSource = signal<'camera' | 'image' | null>(null);
  readonly spanishAbilities = signal<Record<string, string>>({});
  readonly searching = signal(false);
  readonly searchMessage = signal('');
  readonly frameInterval = signal(500);
  readonly framesCaptured = signal(0);
  readonly recognitionMessage = signal('Centra el nombre de la carta dentro del marco para empezar.');
  readonly candidateName = signal('');
  readonly consecutiveReadings = signal(0);

  private captureTimer: number | undefined;
  private recognitionLocked = false;
  private acceptedName = '';
  private cameraRequestId = 0;
  private visualFrameCanvas: HTMLCanvasElement | null = null;
  private lastVisualAttemptAt = 0;
  private visualCandidateName = '';
  private visualConsecutiveReadings = 0;

  ngOnInit(): void {
    void this.loadCameraList();
  }

  ngOnDestroy(): void {
    this.cameraRequestId += 1;
    this.stopCapture();
    this.camera.stopCamera();
    this.releaseVideo();
    this.voice.stop();
    void this.recognizer.release();
    void this.visualRecognizer.release();
  }

  ionViewWillLeave(): void {
    this.cameraRequestId += 1;
    this.stopCapture();
    this.camera.stopCamera();
    this.releaseVideo();
    this.cameraActive.set(false);
    this.overlayEnabled.set(false);
    this.voice.stop();
    void this.recognizer.release();
    void this.visualRecognizer.release();
  }

  async toggleCamera(): Promise<void> {
    if (this.cameraActive()) {
      this.cameraRequestId += 1;
      this.stopCapture();
      this.camera.stopCamera();
      this.releaseVideo();
      this.cameraActive.set(false);
      this.overlayEnabled.set(false);
      this.cameraMessage.set('Cámara detenida.');
      this.voice.stop();
      return;
    }
    await this.startCamera();
  }

  async selectCamera(event: CustomEvent<{ value?: string }>): Promise<void> {
    const deviceId = event.detail.value ?? '';
    this.selectedCamera.set(deviceId);
    if (this.cameraActive()) await this.startCamera();
  }

  setFrameInterval(event: CustomEvent<{ value?: number }>): void {
    this.frameInterval.set(Number(event.detail.value) || 700);
    if (this.cameraActive()) this.startCapture();
  }

  setQuery(event: CustomEvent<{ value?: string | null }>): void {
    this.query.set(event.detail.value ?? '');
  }

  setVoice(event: CustomEvent<{ checked: boolean }>): void {
    this.voice.setEnabled(event.detail.checked);
  }

  async searchPokemon(): Promise<void> {
    const query = this.query().trim();
    if (!query) {
      this.searchMessage.set('Escribe un nombre o número de Pokédex.');
      return;
    }
    this.searching.set(true);
    this.searchMessage.set('');
    this.result.set(null);
    this.clearVisualCandidates();
    try {
      const pokemon = await firstValueFrom(this.pokemonApi.searchPokemon(query));
      this.storage.savePokemon(pokemon);
      this.result.set(pokemon);
      this.overlayEnabled.set(false);
      this.searchMessage.set('Añadido al historial de la Pokédex.');
    } catch (error: unknown) {
      this.searchMessage.set(error instanceof HttpErrorResponse && error.status === 404
        ? 'No encontramos ese Pokémon. Prueba otro nombre o número.'
        : 'No se pudo consultar la PokéAPI. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      this.searching.set(false);
    }
  }

  async recognizeUploadedImage(event: Event): Promise<void> {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    const file = input.files?.item(0);
    input.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/gif'].includes(file.type)) {
      this.recognitionMessage.set('Usa una imagen JPG, PNG, WebP, BMP o GIF.');
      return;
    }
    if (file.size > 16 * 1024 * 1024) {
      this.recognitionMessage.set('La imagen supera el límite de 16 MB.');
      return;
    }
    if (this.recognitionLocked) {
      this.recognitionMessage.set('Espera a que termine el análisis actual.');
      return;
    }

    this.recognitionLocked = true;
    this.recognitionMessage.set('Leyendo el nombre de la imagen…');
    try {
      let textDetection: PokemonRecognition | null = null;
      try {
        const first = await this.recognizer.recognize(file);
        const second = await this.recognizer.recognize(file);
        if (first && second && first.name === second.name) textDetection = second;
      } catch (error: unknown) {
        console.warn('El OCR no pudo leer el archivo; se probará el reconocimiento visual.', error);
      }

      if (textDetection) {
        this.candidateName.set(textDetection.name);
        this.consecutiveReadings.set(2);
        await this.showRecognizedPokemon(textDetection, 'image');
        return;
      }

      this.resetCandidate();
      this.recognitionMessage.set('No se leyó el nombre. Analizando la ilustración de Kanto…');
      const candidates = await this.visualRecognizer.classify(file);
      await this.showVisualCandidates(candidates, 'image');
    } catch (error: unknown) {
      console.error('Falló el reconocimiento visual de la imagen seleccionada', error);
      this.resetCandidate();
      this.recognitionMessage.set('No se pudo analizar el aspecto. Comprueba la conexión del modelo e inténtalo de nuevo.');
    } finally {
      this.recognitionLocked = false;
    }
  }

  rescan(): void {
    this.result.set(null);
    this.overlayEnabled.set(false);
    this.clearVisualCandidates();
    this.query.set('');
    this.searchMessage.set('');
    this.acceptedName = '';
    this.resetCandidate();
    this.recognitionMessage.set('Buscando una lectura estable…');
  }

  async acceptVisualCandidate(name: string): Promise<void> {
    const candidate = this.visualCandidates().find((item) => item.name === name);
    const source = this.visualSource();
    if (!candidate || !source || this.recognitionLocked) return;

    this.recognitionLocked = true;
    this.clearVisualCandidates();
    this.recognitionMessage.set('Cargando la ficha del Pokémon confirmado…');
    try {
      await this.showRecognizedPokemon({ name, similarity: candidate.score, text: '' }, source);
    } catch {
      this.recognitionMessage.set('No se pudieron cargar sus datos. Revisa la conexión.');
    } finally {
      this.recognitionLocked = false;
    }
  }

  private async startCamera(): Promise<void> {
    const video = this.videoElement?.nativeElement;
    if (!video || this.cameraBusy()) return;
    const requestId = ++this.cameraRequestId;
    this.cameraBusy.set(true);
    this.resetCandidate();
    this.overlayEnabled.set(false);
    this.cameraMessage.set('Solicitando acceso a la cámara…');
    try {
      const stream = await this.camera.openCamera(this.selectedCamera() || undefined);
      if (requestId !== this.cameraRequestId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      video.srcObject = stream;
      await video.play();
      if (requestId !== this.cameraRequestId) {
        this.camera.stopCamera();
        this.releaseVideo();
        return;
      }
      this.cameraActive.set(true);
      this.cameraMessage.set('Cámara activa. Centra la carta dentro del marco.');
      await this.loadCameraList();
      this.startCapture();
    } catch (error: unknown) {
      if (requestId !== this.cameraRequestId) return;
      this.camera.stopCamera();
      this.releaseVideo();
      this.cameraActive.set(false);
      this.cameraMessage.set(cameraErrorMessage(error));
    } finally {
      this.cameraBusy.set(false);
    }
  }

  private async loadCameraList(): Promise<void> {
    try {
      const devices = await this.camera.listCameras();
      this.cameras.set(devices);
      if (!this.selectedCamera() && devices.length) {
        this.selectedCamera.set(devices[0].deviceId);
      }
    } catch {
      // El texto del estado de cámara conserva el error útil para el usuario.
    }
  }

  private startCapture(): void {
    this.stopCapture();

    const tick = () => {
      if (!this.cameraActive()) return;
      const video = this.videoElement?.nativeElement;
      const guide = this.cardGuide?.nativeElement;
      const canvas = this.frameCanvas?.nativeElement;
      if (video && guide && canvas && this.camera.captureTitleRegion(video, guide, canvas)) {
        this.framesCaptured.update((count) => count + 1);
        void this.recognizeCameraFrame(canvas);
      }
      this.captureTimer = window.setTimeout(tick, this.frameInterval());
    };

    this.captureTimer = window.setTimeout(tick, this.frameInterval());
  }

  private async recognizeCameraFrame(canvas: HTMLCanvasElement): Promise<void> {
    if (this.recognitionLocked) return;
    this.recognitionLocked = true;
    try {
      const detection = await this.recognizer.recognize(canvas, false);
      if (!detection) {
        this.resetCandidate(false);
        await this.classifyCameraArtwork();
        return;
      }

      if (this.acceptedName === detection.name) return;

      this.clearVisualCandidates();
      this.visualConsecutiveReadings = 0;
      const count = detection.name === this.candidateName() ? this.consecutiveReadings() + 1 : 1;
      this.candidateName.set(detection.name);
      this.consecutiveReadings.set(count);
      this.recognitionMessage.set(`Lectura ${count}/2: ${detection.name} (${Math.round(detection.similarity * 100)}% de coincidencia).`);
      if (count >= 2 && this.acceptedName !== detection.name) {
        await this.showRecognizedPokemon(detection);
      }
    } catch (error: unknown) {
      console.error('Falló el OCR del fotograma de cámara', error);
      this.resetCandidate();
      this.recognitionMessage.set('Falló el OCR. Comprueba la conexión e inténtalo de nuevo.');
    } finally {
      this.recognitionLocked = false;
    }
  }

  private async showRecognizedPokemon(
    detection: PokemonRecognition,
    source: 'camera' | 'image' = 'camera',
  ): Promise<void> {
    const pokemon = await firstValueFrom(this.pokemonApi.searchPokemon(detection.name));
    const abilities = await firstValueFrom(this.pokemonApi.getSpanishAbilityNames(pokemon.abilities));
    this.storage.savePokemon(pokemon);
    this.spanishAbilities.set(abilities);
    this.acceptedName = source === 'camera' ? detection.name : '';
    this.result.set(pokemon);
    this.overlayEnabled.set(source === 'camera');
    this.query.set(pokemon.name);
    this.searchMessage.set('Reconocimiento confirmado y guardado en la Pokédex.');
    this.recognitionMessage.set(`Detectado: ${pokemon.displayName ?? pokemon.name}.`);
    if (source === 'camera') {
      this.voice.announcePokemon(pokemon.displayName ?? pokemon.name, pokemon.types, pokemon.description);
    }
  }

  private async classifyCameraArtwork(): Promise<void> {
    const now = Date.now();
    if (now - this.lastVisualAttemptAt < 2500) return;
    this.lastVisualAttemptAt = now;

    const video = this.videoElement?.nativeElement;
    const guide = this.cardGuide?.nativeElement;
    if (!video || !guide) return;
    this.visualFrameCanvas ??= document.createElement('canvas');
    if (!this.camera.captureArtworkRegion(video, guide, this.visualFrameCanvas)) return;

    this.recognitionMessage.set('No se leyó el nombre. Comparando la ilustración con Kanto…');
    const candidates = await this.visualRecognizer.classify(this.visualFrameCanvas);
    const first = candidates[0];
    if (!first) {
      this.clearVisualCandidates();
      this.recognitionMessage.set('No encontramos una ilustración clara. Mantén la carta centrada.');
      return;
    }

    const previousVisualName = this.visualCandidateName;
    const confirmation = advanceVisualConfirmation(
      this.visualCandidateName,
      this.visualConsecutiveReadings,
      first.name,
    );
    this.visualCandidateName = confirmation.name;
    this.visualConsecutiveReadings = confirmation.consecutiveReadings;
    if (previousVisualName && previousVisualName !== first.name && this.visualSource() === 'camera') {
      this.visualCandidates.set([]);
      this.visualSource.set(null);
    }

    if (confirmation.confirmed) {
      if (this.acceptedName === first.name) {
        this.recognitionMessage.set(`La ilustración sigue coincidiendo con ${this.visualCandidateLabel(first.name)}.`);
        return;
      }
      await this.showVisualCandidates(candidates, 'camera');
    } else {
      this.recognitionMessage.set('Primera coincidencia visual. Comprobando de nuevo…');
    }
  }

  private async showVisualCandidates(
    candidates: VisualPokemonCandidate[],
    source: 'camera' | 'image',
  ): Promise<void> {
    const best = candidates[0];
    const runnerUp = candidates[1];
    const hasClearWinner = best !== undefined
      && best.score >= 0.3
      && best.score - (runnerUp?.score ?? 0) >= 0.1;

    if (hasClearWinner) {
      this.clearVisualCandidates();
      this.recognitionMessage.set(`Coincidencia visual clara: ${this.visualCandidateLabel(best.name)}.`);
      await this.showRecognizedPokemon({ name: best.name, similarity: best.score, text: '' }, source);
      return;
    }

    this.visualCandidates.set(candidates.slice(0, 3));
    this.visualSource.set(source);
    this.visualCandidateName = candidates[0]?.name ?? '';
    this.visualConsecutiveReadings = source === 'camera' ? 2 : 0;
    if (source === 'image') {
      this.recognitionMessage.set(candidates.length
        ? 'La imagen es ambigua. Elige cuál Pokémon aparece en la ilustración.'
        : 'No encontramos una coincidencia visual entre los Pokémon de Kanto.');
    } else if (candidates.length) {
      this.recognitionMessage.set('Coincidencia visual repetida, pero ambigua. Confirma una opción.');
    }
  }

  private clearVisualCandidates(): void {
    this.visualCandidates.set([]);
    this.visualSource.set(null);
    this.visualCandidateName = '';
    this.visualConsecutiveReadings = 0;
  }

  typeColor(types: string[]): string {
    return TYPE_COLORS[types[0]?.toLowerCase()] ?? '#D71920';
  }

  statPercent(value: number): number {
    return Math.min(100, Math.max(0, Math.round(value / 255 * 100)));
  }

  typeName(type: string): string {
    return spanishTypeName(type);
  }

  abilityName(ability: string): string {
    return this.spanishAbilities()[ability] ?? ability.replace(/-/g, ' ');
  }

  abilityNames(abilities: string[]): string {
    return abilities.map((ability) => this.abilityName(ability)).join(' · ');
  }

  visualCandidateLabel(name: string): string {
    if (name === 'nidoran-f') return 'Nidoran hembra';
    if (name === 'nidoran-m') return 'Nidoran macho';
    if (name === 'farfetchd') return "Farfetch'd";
    if (name === 'mr-mime') return 'Mr. Mime';
    return humanize(name);
  }

  private resetCandidate(resetAccepted = true): void {
    this.candidateName.set('');
    this.consecutiveReadings.set(0);
    if (resetAccepted) this.acceptedName = '';
  }

  private releaseVideo(): void {
    if (this.videoElement) this.videoElement.nativeElement.srcObject = null;
  }

  private stopCapture(): void {
    if (this.captureTimer !== undefined) window.clearInterval(this.captureTimer);
    this.captureTimer = undefined;
  }
}