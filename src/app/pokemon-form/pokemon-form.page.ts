import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  NavController,
  IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton,
  IonContent, IonList, IonItem, IonInput, IonSelect, IonSelectOption, IonNote
} from '@ionic/angular';
import { PokemonService } from '../services/pokemon.service';
import { PokemonInput, POKEMON_STATS, POKEMON_TYPES } from '../models/pokemon.model';
import { spanishStatName, spanishTypeName } from '../utils/pokemon-localization';

interface FormState {
  name: string;
  image: string;
  height: string;
  weight: string;
  types: string[];
  weaknesses: string[];
  stats: Record<string, string>;
}

interface FormErrors {
  name?: string;
  image?: string;
  height?: string;
  weight?: string;
  types?: string;
  stats?: string;
}

@Component({
  selector: 'app-pokemon-form',
  templateUrl: './pokemon-form.page.html',
  styleUrls: ['./pokemon-form.page.scss'],
  standalone: true,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton,
    IonContent, IonList, IonItem, IonInput, IonSelect, IonSelectOption, IonNote
  ]
})
export class PokemonFormPage implements OnInit {
  private route = inject(ActivatedRoute);
  private navCtrl = inject(NavController);
  private pokemonService = inject(PokemonService);

  readonly typeOptions = POKEMON_TYPES;
  readonly stats = POKEMON_STATS;

  private readonly editingId = Number(this.route.snapshot.paramMap.get('id')) || null;
  private readonly existing =
    this.editingId === null ? undefined : this.pokemonService.getById(this.editingId);

  readonly isEditing = this.editingId !== null;
  readonly form = signal<FormState>(this.initialState());
  readonly submitted = signal(false);

  readonly errors = computed<FormErrors>(() => {
    const f = this.form();
    const errors: FormErrors = {};
    const image = f.image.trim();

    if (!f.name.trim()) {
      errors.name = 'El nombre es obligatorio.';
    }
    if (image && !/^https?:\/\//i.test(image)) {
      errors.image = 'La imagen debe ser una URL que empiece por http:// o https://';
    }
    if (!(Number(f.height) > 0)) {
      errors.height = 'Ingresa una altura mayor que 0.';
    }
    if (!(Number(f.weight) > 0)) {
      errors.weight = 'Ingresa un peso mayor que 0.';
    }
    if (f.types.length < 1 || f.types.length > 2) {
      errors.types = 'Elige 1 o 2 tipos.';
    }
    const invalidStat = this.stats.some((s) => {
      const value = Number(f.stats[s.name]);
      return !Number.isInteger(value) || value < 1 || value > 255;
    });
    if (invalidStat) {
      errors.stats = 'Cada estadística debe ser un entero entre 1 y 255.';
    }
    return errors;
  });

  ngOnInit(): void {
    // Solo se pueden editar Pokémon propios que existan.
    if (this.isEditing && !this.existing?.isCustom) {
      this.navCtrl.navigateRoot('/home');
    }
  }

  typeName(type: string): string {
    return spanishTypeName(type);
  }

  statName(stat: string): string {
    return spanishStatName(stat);
  }

  setField(field: 'name' | 'image' | 'height' | 'weight', event: CustomEvent): void {
    this.form.update((f) => ({ ...f, [field]: event.detail.value ?? '' }));
  }

  setList(field: 'types' | 'weaknesses', event: CustomEvent): void {
    this.form.update((f) => ({ ...f, [field]: event.detail.value ?? [] }));
  }

  setStat(name: string, event: CustomEvent): void {
    this.form.update((f) => ({ ...f, stats: { ...f.stats, [name]: event.detail.value ?? '' } }));
  }

  save(): void {
    this.submitted.set(true);
    if (Object.keys(this.errors()).length > 0) {
      return;
    }

    const data = this.toInput();
    if (this.editingId !== null) {
      this.pokemonService.update(this.editingId, data);
      this.navCtrl.navigateBack(['/pokemon-detail', this.editingId]);
    } else {
      this.pokemonService.create(data);
      this.navCtrl.navigateBack('/home');
    }
  }

  private toInput(): PokemonInput {
    const f = this.form();
    return {
      name: f.name.trim().toLowerCase(),
      image: f.image.trim(),
      types: f.types,
      weaknesses: f.weaknesses,
      height: Number(f.height),
      weight: Number(f.weight),
      stats: this.stats.map((s) => ({ name: s.name, value: Number(f.stats[s.name]) })),
    };
  }

  private initialState(): FormState {
    const p = this.existing;
    if (p?.isCustom) {
      return {
        name: p.name,
        image: p.image,
        height: String(p.height),
        weight: String(p.weight),
        types: p.types,
        weaknesses: p.weaknesses,
        stats: Object.fromEntries(p.stats.map((s) => [s.name, String(s.value)])),
      };
    }
    return {
      name: '',
      image: '',
      height: '',
      weight: '',
      types: [],
      weaknesses: [],
      stats: Object.fromEntries(POKEMON_STATS.map((s) => [s.name, '50'])),
    };
  }
}