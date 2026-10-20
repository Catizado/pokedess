import { ChangeDetectionStrategy, Component, computed, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  IonButton, IonContent, IonHeader, IonProgressBar, IonSelect, IonSelectOption, IonSpinner, IonTitle, IonToolbar,
} from '@ionic/angular';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { PokedexPokemon, PokemonLearnableMove } from '../../models/pokemon-api.model';
import { PokemonApiService } from '../../services/pokemon-api.service';
import { humanize, spanishStatName, spanishTypeName, spanishVersionGroupName } from '../../utils/pokemon-localization';

@Component({
  selector: 'app-pokemon-detail',
  standalone: true,
  imports: [IonButton, IonContent, IonHeader, IonProgressBar, IonSelect, IonSelectOption, IonSpinner, IonTitle, IonToolbar, RouterLink],
  templateUrl: './detail.page.html',
  styleUrl: './detail.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pokemonApi = inject(PokemonApiService);
  readonly pokemon = signal<PokedexPokemon | null>(null);
  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly activeTab = signal<'details' | 'moves'>('details');
  readonly moveCategory = signal<'level-up' | 'machine'>('level-up');
  readonly moves = signal<PokemonLearnableMove[] | null>(null);
  readonly movesLoading = signal(false);
  readonly moveNamesLoading = signal(false);
  readonly movesError = signal('');
  readonly selectedVersionGroup = signal('');
  readonly spanishAbilities = signal<Record<string, string>>({});
  readonly spanishMoves = signal<Record<string, string>>({});
  readonly versionGroups = computed(() => [...new Set((this.moves() ?? []).map((move) => move.versionGroup))]);
  private translationRequestId = 0;
  readonly visibleMoves = computed(() => {
    const versionGroup = this.selectedVersionGroup() || this.versionGroups().at(-1);
    return (this.moves() ?? [])
      .filter((move) => move.versionGroup === versionGroup && move.learnMethod === this.moveCategory())
      .sort((first, second) => {
        if (this.moveCategory() === 'level-up') {
          return (first.levelLearnedAt ?? 0) - (second.levelLearnedAt ?? 0)
            || this.moveName(first).localeCompare(this.moveName(second), 'es');
        }
        return this.moveName(first).localeCompare(this.moveName(second), 'es');
      });
  });

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = Number(params.get('id'));
      if (Number.isInteger(id) && id > 0) {
        this.moves.set(null);
        this.spanishMoves.set({});
        this.spanishAbilities.set({});
        this.selectedVersionGroup.set('');
        this.activeTab.set('details');
        void this.loadPokemon(id);
      }
    });
  }

  statProgress(value: number): number {
    return Math.min(value / 255, 1);
  }

  selectTab(tab: 'details' | 'moves'): void {
    this.activeTab.set(tab);
    if (tab === 'moves' && this.moves() === null) void this.loadMoves();
  }

  selectMoveCategory(category: 'level-up' | 'machine'): void {
    this.moveCategory.set(category);
    const moves = this.moves() ?? [];
    const currentVersion = this.selectedVersionGroup();
    const categoryExistsInCurrentVersion = moves.some((move) =>
      move.versionGroup === currentVersion && move.learnMethod === category
    );
    if (!categoryExistsInCurrentVersion) {
      const latestAvailableVersion = this.versionGroups().filter((version) =>
        moves.some((move) => move.versionGroup === version && move.learnMethod === category)
      ).at(-1);
      if (latestAvailableVersion) this.selectedVersionGroup.set(latestAvailableVersion);
    }
    void this.loadVisibleMoveNames();
  }

  selectVersionGroup(event: CustomEvent<{ value?: string }>): void {
    this.selectedVersionGroup.set(event.detail.value ?? '');
    void this.loadVisibleMoveNames();
  }

  retryMoves(): void {
    this.moves.set(null);
    void this.loadMoves();
  }

  private async loadMoves(): Promise<void> {
    const id = this.pokemon()?.id;
    if (!id || this.movesLoading()) return;
    this.movesLoading.set(true);
    this.movesError.set('');
    try {
      const moves = await firstValueFrom(this.pokemonApi.getMoveLearnset(id));
      this.moves.set(moves);
      this.selectedVersionGroup.set([...new Set(moves.map((move) => move.versionGroup))].at(-1) ?? '');
      await this.loadVisibleMoveNames();
    } catch {
      this.movesError.set('No se pudieron cargar los movimientos. Revisa tu conexión.');
    } finally {
      this.movesLoading.set(false);
    }
  }

  private async loadPokemon(id: number): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      const pokemon = await firstValueFrom(this.pokemonApi.searchPokemon(String(id)));
      this.pokemon.set(pokemon);
      this.spanishAbilities.set(await firstValueFrom(this.pokemonApi.getSpanishAbilityNames(pokemon.abilities)));
    } catch (error: unknown) {
      this.errorMessage.set(error instanceof HttpErrorResponse && error.status === 404
        ? 'No se encontró ese Pokémon.'
        : 'No se pudo cargar la ficha. Revisa tu conexión.');
    } finally {
      this.loading.set(false);
    }
  }

  abilityName(ability: string): string {
    return this.spanishAbilities()[ability] ?? humanize(ability);
  }

  abilityNames(abilities: string[]): string {
    return abilities.map((ability) => this.abilityName(ability)).join(' · ');
  }

  typeName(type: string): string {
    return spanishTypeName(type);
  }

  moveName(move: PokemonLearnableMove): string {
    return this.spanishMoves()[move.name] ?? humanize(move.name);
  }

  statName(stat: string): string {
    return spanishStatName(stat);
  }

  versionGroupName(versionGroup: string): string {
    return spanishVersionGroupName(versionGroup);
  }

  private async loadVisibleMoveNames(): Promise<void> {
    const requestId = ++this.translationRequestId;
    const visible = this.visibleMoves();
    if (!visible.length) {
      this.moveNamesLoading.set(false);
      return;
    }
    this.moveNamesLoading.set(true);
    try {
      const translations = await firstValueFrom(this.pokemonApi.getSpanishMoveNames(visible));
      if (requestId === this.translationRequestId) this.spanishMoves.update((current) => ({ ...current, ...translations }));
    } finally {
      if (requestId === this.translationRequestId) this.moveNamesLoading.set(false);
    }
  }
}