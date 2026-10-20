import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { PokemonApiService } from './pokemon-api.service';
import { PokemonVisualService } from './pokemon-visual.service';

const visualMocks = vi.hoisted(() => ({
  pipeline: vi.fn(),
  classifier: vi.fn(),
  dispose: vi.fn(),
}));

vi.mock('@huggingface/transformers', () => ({ pipeline: visualMocks.pipeline }));

describe('PokemonVisualService', () => {
  let service: PokemonVisualService;

  beforeEach(() => {
    visualMocks.classifier.mockReset().mockResolvedValue([
      { label: 'Pikachu', score: 0.73 },
      { label: 'Eevee', score: 0.12 },
      { label: 'Onix', score: 0.04 },
    ]);
    visualMocks.dispose.mockReset().mockResolvedValue(undefined);
    visualMocks.pipeline.mockReset().mockResolvedValue(
      Object.assign(visualMocks.classifier, { dispose: visualMocks.dispose }),
    );

    TestBed.configureTestingModule({
      providers: [
        PokemonVisualService,
        {
          provide: PokemonApiService,
          useValue: { getKantoPokemonNames: () => of(['bulbasaur', 'pikachu', 'eevee', 'onix']) },
        },
      ],
    });
    service = TestBed.inject(PokemonVisualService);
  });

  it('loads CLIP lazily and maps the ranked labels back to canonical Kanto names', async () => {
    const candidates = await service.classify(document.createElement('canvas'));

    expect(visualMocks.pipeline).toHaveBeenCalledOnce();
    expect(visualMocks.pipeline).toHaveBeenCalledWith(
      'zero-shot-image-classification',
      'Xenova/clip-vit-base-patch32',
      expect.objectContaining({ dtype: 'q8' }),
    );
    expect(visualMocks.classifier.mock.calls[0][1]).toEqual(['Bulbasaur', 'Pikachu', 'Eevee', 'Onix']);
    expect(candidates).toEqual([
      { name: 'pikachu', score: 0.73 },
      { name: 'eevee', score: 0.12 },
      { name: 'onix', score: 0.04 },
    ]);

    await service.release();
    expect(visualMocks.dispose).toHaveBeenCalledOnce();
  });
});