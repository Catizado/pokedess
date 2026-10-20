import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VoiceService } from './voice.service';

class MockUtterance {
  lang = '';
  rate = 1;
  voice: SpeechSynthesisVoice | null = null;

  constructor(readonly text: string) {}
}

describe('VoiceService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('announces the Pokémon name and translated types in Spanish', () => {
    const synthesis = {
      cancel: vi.fn(),
      speak: vi.fn(),
      getVoices: vi.fn(() => [{
        lang: 'es-MX', name: 'Spanish', voiceURI: 'spanish', default: true, localService: true,
      } as SpeechSynthesisVoice]),
    };
    vi.stubGlobal('speechSynthesis', synthesis);
    vi.stubGlobal('SpeechSynthesisUtterance', MockUtterance);
    const service = TestBed.inject(VoiceService);

    service.announcePokemon('pikachu', ['electric', 'flying'], 'Su cola le sirve para vigilar los alrededores.');

    expect(synthesis.cancel).toHaveBeenCalledOnce();
    expect(synthesis.speak).toHaveBeenCalledOnce();
    const utterance = synthesis.speak.mock.calls[0][0] as MockUtterance;
    expect(utterance.text).toBe(
      'Pokémon: pikachu. Tipo: eléctrico y volador. Descripción: Su cola le sirve para vigilar los alrededores.',
    );
    expect(utterance.lang).toBe('es-ES');
    expect(utterance.voice?.lang).toBe('es-MX');
  });

  it('does not announce when voice is disabled', () => {
    const synthesis = { cancel: vi.fn(), speak: vi.fn(), getVoices: vi.fn(() => []) };
    vi.stubGlobal('speechSynthesis', synthesis);
    vi.stubGlobal('SpeechSynthesisUtterance', MockUtterance);
    const service = TestBed.inject(VoiceService);
    service.setEnabled(false);
    service.announcePokemon('pikachu', ['electric'], 'Descripción de prueba.');

    expect(synthesis.speak).not.toHaveBeenCalled();
  });
});