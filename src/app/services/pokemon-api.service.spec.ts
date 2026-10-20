import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { PokemonApiService } from './pokemon-api.service';

describe('PokemonApiService', () => {
  let service: PokemonApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PokemonApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the 151 Kanto Pokémon in Pokédex order and caches the names', async () => {
    const namesPromise = firstValueFrom(service.getKantoPokemonNames());
    http.expectOne('https://pokeapi.co/api/v2/pokemon?limit=151').flush({
      results: [
        { name: 'bulbasaur' }, { name: 'ivysaur' }, { name: 'venusaur' },
        ...Array.from({ length: 148 }, (_, index) => ({ name: `kanto-${index + 4}` })),
      ],
    });

    const names = await namesPromise;
    expect(names).toHaveLength(151);
    expect(names.slice(0, 3)).toEqual(['bulbasaur', 'ivysaur', 'venusaur']);
    await expect(firstValueFrom(service.getKantoPokemonNames())).resolves.toEqual(names);
    http.expectNone('https://pokeapi.co/api/v2/pokemon?limit=151');
  });

  it('combines Pokémon and species data, then serves the cached record', async () => {
    const resultPromise = firstValueFrom(service.searchPokemon('Pikachu'));
    http.expectOne('https://pokeapi.co/api/v2/pokemon/pikachu').flush({
      id: 25,
      name: 'pikachu',
      height: 4,
      weight: 60,
      sprites: { front_default: 'sprite.png', other: { 'official-artwork': { front_default: 'art.png' } } },
      types: [{ type: { name: 'electric' } }],
      abilities: [{ ability: { name: 'static' } }],
      stats: [{ base_stat: 35, stat: { name: 'hp' } }],
      species: { url: 'https://pokeapi.co/api/v2/pokemon-species/25/' },
    });
    http.expectOne('https://pokeapi.co/api/v2/pokemon-species/25/').flush({
      names: [{ name: 'Pikachu', language: { name: 'es' } }],
      flavor_text_entries: [
        { flavor_text: 'A ratón eléctrico', language: { name: 'es' } },
        { flavor_text: 'An electric mouse', language: { name: 'en' } },
      ],
    });

    const pokemon = await resultPromise;
    expect(pokemon.id).toBe(25);
    expect(pokemon.displayName).toBe('Pikachu');
    expect(pokemon.image).toBe('art.png');
    expect(pokemon.height).toBe(0.4);
    expect(pokemon.weight).toBe(6);
    expect(pokemon.description).toBe('A ratón eléctrico');

    await expect(firstValueFrom(service.searchPokemon('25'))).resolves.toEqual(pokemon);
    http.expectNone('https://pokeapi.co/api/v2/pokemon/25');
  });

  it('maps move methods and learned levels, then caches the learnset', async () => {
    const movesPromise = firstValueFrom(service.getMoveLearnset(25));
    http.expectOne('https://pokeapi.co/api/v2/pokemon/25').flush({
      moves: [
        {
          move: { name: 'quick-attack', url: 'https://pokeapi.co/api/v2/move/quick-attack/' },
          version_group_details: [{
            level_learned_at: 10,
            move_learn_method: { name: 'level-up' },
            version_group: { name: 'scarlet-violet' },
          }],
        },
        {
          move: { name: 'thunderbolt', url: 'https://pokeapi.co/api/v2/move/85/' },
          version_group_details: [{
            level_learned_at: 0,
            move_learn_method: { name: 'machine' },
            version_group: { name: 'scarlet-violet' },
          }],
        },
      ],
    });

    const moves = await movesPromise;
    expect(moves).toEqual([
      { name: 'quick-attack', url: 'https://pokeapi.co/api/v2/move/quick-attack/', learnMethod: 'level-up', levelLearnedAt: 10, versionGroup: 'scarlet-violet' },
      { name: 'thunderbolt', url: 'https://pokeapi.co/api/v2/move/85/', learnMethod: 'machine', levelLearnedAt: null, versionGroup: 'scarlet-violet' },
    ]);
    await expect(firstValueFrom(service.getMoveLearnset(25))).resolves.toEqual(moves);
    http.expectNone('https://pokeapi.co/api/v2/pokemon/25');
  });

  it('loads official Spanish names for moves and abilities', async () => {
    const translationsPromise = firstValueFrom(service.getSpanishMoveNames([
      {
        name: 'thunderbolt', url: 'https://pokeapi.co/api/v2/move/85/',
        learnMethod: 'machine', levelLearnedAt: null, versionGroup: 'scarlet-violet',
      },
    ]));
    http.expectOne('https://pokeapi.co/api/v2/move/85/').flush({
      names: [
        { name: 'Thunderbolt', language: { name: 'en' } },
        { name: 'Rayo', language: { name: 'es' } },
      ],
    });
    await expect(translationsPromise).resolves.toEqual({ thunderbolt: 'Rayo' });

    const abilitiesPromise = firstValueFrom(service.getSpanishAbilityNames(['static']));
    http.expectOne('https://pokeapi.co/api/v2/ability/static/').flush({
      names: [
        { name: 'Static', language: { name: 'en' } },
        { name: 'Electricidad Estática', language: { name: 'es' } },
      ],
    });
    await expect(abilitiesPromise).resolves.toEqual({ static: 'Electricidad Estática' });

    const legacyAbilityPromise = firstValueFrom(service.getSpanishAbilityNames(['lightning rod']));
    http.expectOne('https://pokeapi.co/api/v2/ability/lightning-rod/').flush({
      names: [{ name: 'Pararrayos', language: { name: 'es' } }],
    });
    await expect(legacyAbilityPromise).resolves.toEqual({ 'lightning rod': 'Pararrayos' });
  });
});