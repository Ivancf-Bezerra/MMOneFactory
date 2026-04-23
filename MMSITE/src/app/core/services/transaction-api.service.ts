import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Transaction, TransactionStatus } from '../models/transaction.model';
import { ApiEndpoints } from '../config/api-endpoints';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class TransactionApiService {
  private readonly api = inject(ApiService);

  list(status?: TransactionStatus): Observable<Transaction[]> {
    const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.api.get<Transaction[]>(`${ApiEndpoints.transactions.list}${suffix}`);
  }
}
