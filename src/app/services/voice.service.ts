import { Injectable, signal } from '@angular/core';

const VOICE_SETTING_KEY = 'pokemon-ar-voice-enabled';

const TYPE_NAMES: Record<string, string> = {
  normal: 'normal', fire: 'fuego', water: 'agua', electric: 'eléctrico', grass: 'planta',
  ice: 'hielo', fighting: 'lucha', poison: 'veneno', ground: 'tierra', flying: 'volador',
  psychic: 'psíquico', bug: 'bicho', rock: 'roca', ghost: 'fantasma', dragon: 'dragón',
  dark: 'siniestro', steel: 'acero', fairy: 'hada',
};

@Injectable({ providedIn: 'root' })
export class VoiceService {
  readonly enabled = signal(this.readPreference());
  readonly supported = typeof window !== 'undefined'
    && 'speechSynthesis' in window
    && typeof SpeechSynthesisUtterance !== 'undefined';

  setEnabled(enabled: boolean): void {
    this.enabled.set(enabled);
    try {
      localStorage.setItem(VOICE_SETTING_KEY, String(enabled));
    } catch {
      // La preferencia solo es persistente cuando el navegador permite localStorage.
    }
    if (!enabled) this.stop();
  }

  announcePokemon(name: string, types: string[], description: string): void {
    if (!this.enabled() || !this.supported) return;
    const spokenName = name.replace(/[-_]/g, ' ');
    const spokenTypes = types.map((type) => TYPE_NAMES[type.toLowerCase()] ?? type).join(' y ');
    const spokenDescription = description.replace(/\s+/g, ' ').trim();
    const utterance = new SpeechSynthesisUtterance(
      `Pokémon: ${spokenName}. Tipo: ${spokenTypes}. Descripción: ${spokenDescription}`,
    );
    utterance.lang = 'es-ES';
    utterance.rate = 0.94;

    const spanishVoice = window.speechSynthesis.getVoices()
      .find((voice) => voice.lang.toLowerCase().startsWith('es'));
    if (spanishVoice) utterance.voice = spanishVoice;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  stop(): void {
    if (this.supported) window.speechSynthesis.cancel();
  }

  private readPreference(): boolean {
    try {
      return localStorage.getItem(VOICE_SETTING_KEY) !== 'false';
    } catch {
      return true;
    }
  }
}