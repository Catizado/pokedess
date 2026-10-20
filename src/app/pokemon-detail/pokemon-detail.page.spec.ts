import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AlertController, NavController } from '@ionic/angular';
import { vi } from 'vitest';
import { PokemonService } from '../services/pokemon.service';
import { PokemonDetailPage } from './pokemon-detail.page';

describe('PokemonDetailPage', () => {
  let component: PokemonDetailPage;
  let fixture: ComponentFixture<PokemonDetailPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: NavController, useValue: { navigateForward: vi.fn(), navigateBack: vi.fn() } },
        { provide: AlertController, useValue: { create: vi.fn() } },
        { provide: PokemonService, useValue: { loading: signal(false), getById: vi.fn(), remove: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PokemonDetailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
