import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton, IonContent, IonHeader, IonItem, IonLabel, IonList, IonTitle, IonToolbar,
} from '@ionic/angular';
import { StorageService } from '../../services/storage.service';

@Component({
  selector: 'app-pokedex',
  standalone: true,
  imports: [IonButton, IonContent, IonHeader, IonItem, IonLabel, IonList, IonTitle, IonToolbar, RouterLink],
  templateUrl: './pokedex.page.html',
  styleUrl: './pokedex.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PokedexPage {
  private readonly storage = inject(StorageService);
  readonly history = this.storage.history;

  remove(id: number): void {
    this.storage.removeFromHistory(id);
  }

  clear(): void {
    this.storage.clearHistory();
  }
}