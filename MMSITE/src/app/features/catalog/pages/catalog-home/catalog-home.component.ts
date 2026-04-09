import { Component, inject } from '@angular/core';
import { AsyncPipe, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { CatalogOffer, OfferSide } from '../../models/catalog-offer.model';
import { CatalogService } from '../../services/catalog.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-catalog-home',
  imports: [AsyncPipe, CurrencyPipe, DatePipe, FormsModule, RouterLink],
  template: `
    <section class="space-y-5">
      <header class="glass-panel flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h1 class="text-2xl font-semibold">Catalogo de compra e venda</h1>
          <p class="text-sm text-slate-500">
            Servico independente de busca. A transacao so entra na dashboard quando for iniciada.
          </p>
        </div>
        <div class="flex gap-2">
          <span class="hud-chip">Servico separado</span>
          <button type="button" class="neon-button" (click)="showSellForm = !showSellForm">
            Vender
          </button>
        </div>
      </header>

      @if (showSellForm) {
        <section class="glass-panel space-y-4 p-4">
          <h2 class="text-lg font-semibold">Criar anuncio no meu catalogo</h2>
          <div class="grid gap-3 md:grid-cols-2">
            <label class="block">
              <span class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Titulo</span>
              <input
                [(ngModel)]="sellTitle"
                type="text"
                class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-600 focus:ring-2 focus:ring-slate-200"
              />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Categoria</span>
              <input
                [(ngModel)]="sellCategory"
                type="text"
                class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-600 focus:ring-2 focus:ring-slate-200"
              />
            </label>
          </div>
          <div class="grid gap-3 md:grid-cols-3">
            <label class="block">
              <span class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Preco</span>
              <input
                [(ngModel)]="sellAmount"
                type="number"
                class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-600 focus:ring-2 focus:ring-slate-200"
              />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Cidade</span>
              <input
                [(ngModel)]="sellCity"
                type="text"
                class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-600 focus:ring-2 focus:ring-slate-200"
              />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Nome anunciante</span>
              <input
                [(ngModel)]="sellOwner"
                type="text"
                class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-600 focus:ring-2 focus:ring-slate-200"
              />
            </label>
          </div>
          <label class="block">
            <span class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Descricao</span>
            <textarea
              [(ngModel)]="sellDescription"
              rows="3"
              class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-600 focus:ring-2 focus:ring-slate-200"
            ></textarea>
          </label>
          <button type="button" class="neon-button" (click)="createSellOffer()">Publicar no catalogo</button>
        </section>
      }

      <section class="glass-panel space-y-4 p-4">
        <div class="grid gap-3 lg:grid-cols-5">
          <label class="block">
            <span class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Busca</span>
            <input
              [(ngModel)]="searchTerm"
              type="text"
              placeholder="Buscar por titulo..."
              class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-600 focus:ring-2 focus:ring-slate-200"
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Lado</span>
            <select
              [(ngModel)]="offerSide"
              class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-600 focus:ring-2 focus:ring-slate-200"
            >
              <option value="all">Compra e venda</option>
              <option value="buy">Apenas compra</option>
              <option value="sell">Apenas venda</option>
            </select>
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Categoria</span>
            <input
              [(ngModel)]="categoryFilter"
              type="text"
              class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-600 focus:ring-2 focus:ring-slate-200"
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Preco minimo</span>
            <input
              [(ngModel)]="minPrice"
              type="number"
              class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-600 focus:ring-2 focus:ring-slate-200"
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Preco maximo</span>
            <input
              [(ngModel)]="maxPrice"
              type="number"
              class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-600 focus:ring-2 focus:ring-slate-200"
            />
          </label>
        </div>
      </section>

      @if (filteredOffers$ | async; as offers) {
        @if (offers.length > 0) {
          <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            @for (offer of offers; track offer.id) {
              <article class="glass-panel p-4">
                <div class="flex items-start justify-between gap-2">
                  <p class="text-xs text-slate-400">{{ offer.id }}</p>
                  <span class="hud-chip">{{ offer.side === 'buy' ? 'Compra' : 'Venda' }}</span>
                </div>
                <h3 class="mt-2 font-semibold text-slate-800">{{ offer.title }}</h3>
                <p class="mt-1 text-xs text-slate-500">{{ offer.category }} • {{ offer.city }}</p>
                <p class="mt-2 text-sm text-slate-600">{{ offer.description }}</p>
                <div class="mt-3 flex items-center justify-between">
                  <p class="text-lg font-bold text-slate-900">
                    {{ offer.amount | currency: offer.currency : 'symbol' : '1.2-2' }}
                  </p>
                  <p class="text-xs text-slate-500">{{ offer.createdAt | date: 'shortDate' }}</p>
                </div>
                <div class="mt-3 flex gap-2">
                  <a routerLink="/transaction/create" class="neon-button text-center">Iniciar transacao</a>
                </div>
              </article>
            }
          </div>
        } @else {
          <p class="rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            Nenhuma oferta encontrada com os filtros atuais.
          </p>
        }
      }
    </section>
  `,
})
export class CatalogHomeComponent {
  private readonly catalogService = inject(CatalogService);
  private readonly toastService = inject(ToastService);

  showSellForm = false;

  searchTerm = '';
  offerSide: OfferSide | 'all' = 'all';
  categoryFilter = '';
  minPrice?: number;
  maxPrice?: number;

  sellTitle = '';
  sellDescription = '';
  sellAmount = 0;
  sellCategory = '';
  sellCity = '';
  sellOwner = '';

  readonly offers$ = this.catalogService.offers$;
  readonly filteredOffers$ = this.offers$.pipe(map((offers) => this.applyFilters(offers)));

  createSellOffer(): void {
    if (!this.sellTitle || !this.sellCategory || !this.sellCity || !this.sellOwner || !this.sellAmount) {
      this.toastService.show('Campos obrigatorios', 'Preencha os dados do anuncio para vender.', 'warning');
      return;
    }

    this.catalogService.createPersonalOffer({
      title: this.sellTitle,
      description: this.sellDescription || 'Sem descricao adicional.',
      amount: this.sellAmount,
      currency: 'BRL',
      side: 'sell',
      category: this.sellCategory,
      city: this.sellCity,
      sellerName: this.sellOwner,
    });

    this.sellTitle = '';
    this.sellDescription = '';
    this.sellAmount = 0;
    this.sellCategory = '';
    this.sellCity = '';
    this.sellOwner = '';
    this.showSellForm = false;

    this.toastService.show(
      'Anuncio publicado',
      'Seu item agora faz parte do seu catalogo pessoal na plataforma.',
      'success',
    );
  }

  private applyFilters(offers: CatalogOffer[]): CatalogOffer[] {
    return offers.filter((offer) => {
      const matchesSearch = offer.title.toLowerCase().includes(this.searchTerm.trim().toLowerCase());
      const matchesSide = this.offerSide === 'all' || offer.side === this.offerSide;
      const matchesCategory =
        !this.categoryFilter || offer.category.toLowerCase().includes(this.categoryFilter.trim().toLowerCase());
      const matchesMin = this.minPrice == null || offer.amount >= this.minPrice;
      const matchesMax = this.maxPrice == null || offer.amount <= this.maxPrice;
      return matchesSearch && matchesSide && matchesCategory && matchesMin && matchesMax;
    });
  }
}
