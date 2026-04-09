import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CatalogOffer } from '../models/catalog-offer.model';

const INITIAL_OFFERS: CatalogOffer[] = [
  {
    id: 'CAT-1001',
    title: 'Notebook Dell i7 usado',
    description: '16GB RAM, SSD 512GB, em bom estado.',
    amount: 4200,
    currency: 'BRL',
    side: 'sell',
    category: 'Eletronicos',
    city: 'Sao Paulo',
    sellerName: 'Marina',
    createdAt: '2026-04-10T09:20:00.000Z',
  },
  {
    id: 'CAT-1002',
    title: 'Procuro designer para identidade visual',
    description: 'Projeto para marca de loja online.',
    amount: 1800,
    currency: 'BRL',
    side: 'buy',
    category: 'Servicos',
    city: 'Campinas',
    sellerName: 'Lucas',
    createdAt: '2026-04-10T10:10:00.000Z',
  },
  {
    id: 'CAT-1003',
    title: 'Curso online de analise de dados',
    description: 'Acesso vitalicio com certificado.',
    amount: 350,
    currency: 'BRL',
    side: 'sell',
    category: 'Cursos',
    city: 'Remoto',
    sellerName: 'Fernanda',
    createdAt: '2026-04-10T11:00:00.000Z',
  },
];

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly offersSubject = new BehaviorSubject<CatalogOffer[]>(INITIAL_OFFERS);
  readonly offers$ = this.offersSubject.asObservable();

  createPersonalOffer(offer: Omit<CatalogOffer, 'id' | 'createdAt'>): CatalogOffer {
    const created: CatalogOffer = {
      ...offer,
      id: `CAT-${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toISOString(),
    };

    this.offersSubject.next([created, ...this.offersSubject.value]);
    return created;
  }
}
