import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'scanner',
    pathMatch: 'full',
  },
  {
    path: 'scanner',
    loadComponent: () => import('./features/scanner/scanner.page').then((m) => m.ScannerPage),
  },
  {
    path: 'pokedex',
    loadComponent: () => import('./features/pokedex/pokedex.page').then((m) => m.PokedexPage),
  },
  {
    path: 'detail/:id',
    loadComponent: () => import('./features/detail/detail.page').then((m) => m.DetailPage),
  },
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'pokemon-detail/:id',
    loadComponent: () => import('./pokemon-detail/pokemon-detail.page').then((m) => m.PokemonDetailPage),
  },
    {
    path: 'pokemon-form',
    loadComponent: () => import('./pokemon-form/pokemon-form.page').then((m) => m.PokemonFormPage),
  },
  {
    path: 'pokemon-form/:id',
    loadComponent: () => import('./pokemon-form/pokemon-form.page').then((m) => m.PokemonFormPage),
  },
];