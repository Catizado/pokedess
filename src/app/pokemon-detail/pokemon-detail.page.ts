import { Component, inject, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs/operators';
import { addIcons } from 'ionicons';
import { createOutline, trashOutline } from 'ionicons/icons';
import { PokemonService } from '../services/pokemon.service';
import { spanishStatName, spanishTypeName } from '../utils/pokemon-localization';

import {
  AlertController, NavController,
  IonHeader, IonToolbar, IonTitle, IonContent, IonGrid, IonRow, IonCol,
  IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
  IonProgressBar, IonButtons, IonBackButton, IonButton, IonIcon, IonSpinner
} from '@ionic/angular';

@Component({
  selector: 'app-pokemon-detail',
  templateUrl: './pokemon-detail.page.html',
  styleUrls: ['./pokemon-detail.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonGrid, IonRow, IonCol,
    IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
    IonProgressBar, IonButtons, IonBackButton, IonButton, IonIcon, IonSpinner
  ]
})
export class PokemonDetailPage {
  private route = inject(ActivatedRoute);
  private navCtrl = inject(NavController);
  private alertCtrl = inject(AlertController);
  private pokemonService = inject(PokemonService);

  private id = toSignal(
    this.route.paramMap.pipe(map((p) => Number(p.get('id')))),
    { initialValue: 0 }
  );

  pokemon = computed(() => this.pokemonService.getById(this.id()));
  loading = this.pokemonService.loading;

  constructor() {
    addIcons({ createOutline, trashOutline });
  }

  getStatProgress(value: number): number {
    return value ? value / 255 : 0;
  }

  typeName(type: string): string {
    return spanishTypeName(type);
  }

  statName(stat: string): string {
    return spanishStatName(stat);
  }

  edit(): void {
    this.navCtrl.navigateForward(['/pokemon-form', this.id()]);
  }

  async confirmDelete(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar Pokémon',
      message: `¿Seguro que quieres eliminar a ${this.pokemon()?.name}?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Eliminar', role: 'destructive', handler: () => this.delete() },
      ],
    });
    await alert.present();
  }

    private async delete(): Promise<void> {
    const id = this.id();
    await this.navCtrl.navigateBack('/home');
    this.pokemonService.remove(id);
  }
}