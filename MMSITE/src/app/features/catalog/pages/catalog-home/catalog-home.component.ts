import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { CatalogOffer, OfferSide } from '../../models/catalog-offer.model';
import { CatalogService } from '../../services/catalog.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-catalog-home',
  imports: [CurrencyPipe, DatePipe, FormsModule, RouterLink],
  template: `
    <section class="mm-page-shell space-y-5">
      <header class="glass-panel flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
        <div>
          <h1 class="mm-page-h1">Catálogo de compra e venda</h1>
          <p class="mt-0.5 mm-page-lead">
            Só para busca: a negociação aparece no painel depois que você criá-la na tela “Nova transação”.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <span class="hud-chip">Fora do fluxo principal</span>
          <button type="button" class="neon-button px-3 py-2 text-xs" (click)="showSellForm = !showSellForm">
            Vender
          </button>
        </div>
      </header>

      @if (showSellForm) {
        <section class="glass-panel space-y-4 p-5 sm:p-6">
          <h2 class="mm-page-h2">Criar anúncio no meu catálogo</h2>
          <div class="grid gap-3 md:grid-cols-2">
            <label class="block">
              <span class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Título</span>
              <input
                [(ngModel)]="sellTitle"
                type="text"
                class="input-base"
              />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Categoria</span>
              <input
                [(ngModel)]="sellCategory"
                type="text"
                class="input-base"
              />
            </label>
          </div>
          <div class="grid gap-3 md:grid-cols-3">
            <label class="block">
              <span class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Preço</span>
              <input
                [(ngModel)]="sellAmount"
                type="number"
                class="input-base"
              />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Cidade</span>
              <input
                [(ngModel)]="sellCity"
                type="text"
                class="input-base"
              />
            </label>
            <label class="block">
              <span class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Nome anunciante</span>
              <input
                [(ngModel)]="sellOwner"
                type="text"
                class="input-base"
              />
            </label>
          </div>
          <label class="block">
              <span class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Descrição</span>
            <textarea
              [(ngModel)]="sellDescription"
              rows="3"
              class="input-base resize-none"
            ></textarea>
          </label>
          <button type="button" class="neon-button px-4 py-2.5 text-sm" (click)="createSellOffer()">Publicar no catálogo</button>
        </section>
      }

      <section class="glass-panel space-y-4 p-5 sm:p-6">
        <div class="grid gap-3 lg:grid-cols-5">
          <label class="block">
            <span class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Busca</span>
            <input
              [(ngModel)]="searchTerm"
              type="text"
              placeholder="Buscar por título..."
              class="input-base"
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Lado</span>
            <select
              [(ngModel)]="offerSide"
              class="input-flat"
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
              class="input-base"
            />
          </label>
          <label class="block">
              <span class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Preço mínimo</span>
            <input
              [(ngModel)]="minPrice"
              type="number"
              class="input-base"
            />
          </label>
          <label class="block">
              <span class="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Preço máximo</span>
            <input
              [(ngModel)]="maxPrice"
              type="number"
              class="input-base"
            />
          </label>
        </div>
      </section>

      @if (filteredOffers().length > 0) {
          <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            @for (offer of filteredOffers(); track offer.id) {
              <article class="glass-panel p-4 sm:p-5">
                <div class="flex items-start justify-between gap-2">
                  <p class="text-xs text-slate-400">{{ offer.id }}</p>
                  <span class="hud-chip">{{ offer.side === 'buy' ? 'Compra' : 'Venda' }}</span>
                </div>
                <h3 class="mt-2 font-semibold text-mm-ink">{{ offer.title }}</h3>
                <p class="mt-1 text-xs text-slate-500">{{ offer.category }} • {{ offer.city }}</p>
                <p class="mt-2 text-sm text-slate-600">{{ offer.description }}</p>
                <div class="mt-3 flex items-center justify-between">
                  <p class="text-lg font-bold text-mm-ink">
                    {{ offer.amount | currency: offer.currency : 'symbol' : '1.2-2' }}
                  </p>
                  <p class="text-xs text-slate-500">{{ offer.createdAt | date: 'shortDate' }}</p>
                </div>
                <div class="mt-3 flex gap-2">
                  <a routerLink="/transaction/create" class="neon-button inline-flex px-3 py-2 text-center text-xs">Iniciar transação</a>
                </div>
              </article>
            }
          </div>
      } @else {
          <p class="rounded-mm border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            Nenhuma oferta encontrada com os filtros atuais.
          </p>
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

  readonly filteredOffers = toSignal(
    this.catalogService.offers$.pipe(map((offers: CatalogOffer[]) => this.applyFilters(offers))),
    { initialValue: [] as CatalogOffer[] },
  );

  createSellOffer(): void {
    if (!this.sellTitle || !this.sellCategory || !this.sellCity || !this.sellOwner || !this.sellAmount) {
      this.toastService.show('Campos obrigatórios', 'Preencha os dados do anúncio para publicar.', 'warning');
      return;
    }

    this.catalogService.createPersonalOffer({
      title: this.sellTitle,
      description: this.sellDescription || 'Sem descrição adicional.',
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
      'Anúncio publicado',
      'O item foi adicionado ao seu catálogo.',
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
