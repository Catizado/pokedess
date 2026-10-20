import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { addIcons } from 'ionicons';
import { add, swapVerticalOutline } from 'ionicons/icons';
import { PokemonService } from '../services/pokemon.service';
import { Pokemon, POKEMON_TYPES } from '../models/pokemon.model';
import { spanishTypeName } from '../utils/pokemon-localization';

import {
  ActionSheetController, NavController,
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonSearchbar, IonContent,
  IonGrid, IonRow, IonCol, IonCard, IonImg, IonCardHeader, IonCardTitle, IonCardContent,
  IonFab, IonFabButton, IonIcon, IonSpinner, IonItem, IonInput, IonSelect, IonSelectOption
} from '@ionic/angular';

type SortOrder = 'id-asc' | 'id-desc' | 'name-asc' | 'name-desc';

const SORT_OPTIONS: { order: SortOrder; label: string }[] = [
  { order: 'id-asc', label: 'Número (menor a mayor)' },
  { order: 'id-desc', label: 'Número (mayor a menor)' },
  { order: 'name-asc', label: 'Nombre (A-Z)' },
  { order: 'name-desc', label: 'Nombre (Z-A)' },
];

const COMPARATORS: Record<SortOrder, (a: Pokemon, b: Pokemon) => number> = {
  'id-asc': (a, b) => a.id - b.id,
  'id-desc': (a, b) => b.id - a.id,
  'name-asc': (a, b) => a.name.localeCompare(b.name),
  'name-desc': (a, b) => b.name.localeCompare(a.name),
};

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonSearchbar, IonContent,
    IonGrid, IonRow, IonCol, IonCard, IonImg, IonCardHeader, IonCardTitle, IonCardContent,
    IonFab, IonFabButton, IonIcon, IonSpinner, IonItem, IonInput, IonSelect, IonSelectOption
  ]
})
export class HomePage {
  private pokemonService = inject(PokemonService);
  private navCtrl = inject(NavController);
  private actionSheetCtrl = inject(ActionSheetController);

  readonly typeOptions = POKEMON_TYPES;
  readonly loading = this.pokemonService.loading;
  readonly loadFailed = this.pokemonService.loadFailed;

  readonly searchText = signal('');
  readonly sortOrder = signal<SortOrder>('id-asc');
  readonly showAdvanced = signal(false);
  readonly selectedTypes = signal<string[]>([]);
  readonly selectedWeaknesses = signal<string[]>([]);
  readonly rangeFrom = signal<number | null>(null);
  readonly rangeTo = signal<number | null>(null);

  readonly filteredPokemons = computed(() => {
    const term = this.searchText().trim().toLowerCase();
    const types = this.selectedTypes();
    const weaknesses = this.selectedWeaknesses();
    const from = this.rangeFrom();
    const to = this.rangeTo();

    return this.pokemonService
      .pokemons()
      .filter(
        (p) =>
          (!term ||
            p.name.toLowerCase().includes(term) ||
            p.id.toString() === term ||
            `#${p.id}`.includes(term)) &&
          (types.length === 0 || p.types.some((t) => types.includes(t))) &&
          (weaknesses.length === 0 || p.weaknesses.some((w) => weaknesses.includes(w))) &&
          (from === null || p.id >= from) &&
          (to === null || p.id <= to)
      )
      .sort(COMPARATORS[this.sortOrder()]);
  });

  constructor() {
    addIcons({ add, swapVerticalOutline });
  }

  typeName(type: string): string {
    return spanishTypeName(type);
  }

  filterPokemons(event: any): void {
    this.searchText.set(event.target.value ?? '');
  }

  toggleAdvanced(): void {
    this.showAdvanced.update((open) => !open);
  }

  toggleType(type: string): void {
    this.selectedTypes.update((list) =>
      list.includes(type) ? list.filter((t) => t !== type) : [...list, type]
    );
  }

  setWeaknesses(event: CustomEvent): void {
    this.selectedWeaknesses.set(event.detail.value ?? []);
  }

  setRange(bound: 'from' | 'to', event: CustomEvent): void {
    const raw = event.detail.value;
    const value = raw === null || raw === undefined || raw === '' ? null : Number(raw);
    (bound === 'from' ? this.rangeFrom : this.rangeTo).set(value);
  }

  resetFilters(): void {
    this.searchText.set('');
    this.selectedTypes.set([]);
    this.selectedWeaknesses.set([]);
    this.rangeFrom.set(null);
    this.rangeTo.set(null);
  }

  async openSortMenu(): Promise<void> {
    const sheet = await this.actionSheetCtrl.create({
      header: 'Ordenar por',
      buttons: [
        ...SORT_OPTIONS.map(({ order, label }) => ({
          text: label,
          handler: () => this.sortOrder.set(order),
        })),
        { text: 'Cancelar', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  retry(): void {
    this.pokemonService.load();
  }

  goToDetail(id: number): void {
    const path = this.pokemonService.getById(id)?.isCustom ? '/pokemon-detail' : '/detail';
    this.navCtrl.navigateForward([path, id]);
  }

  addPokemon(): void {
    this.navCtrl.navigateForward('/pokemon-form');
  }
}