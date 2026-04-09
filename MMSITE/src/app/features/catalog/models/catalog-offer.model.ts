export type OfferSide = 'buy' | 'sell';

export interface CatalogOffer {
  id: string;
  title: string;
  description: string;
  amount: number;
  currency: string;
  side: OfferSide;
  category: string;
  city: string;
  sellerName: string;
  createdAt: string;
}
