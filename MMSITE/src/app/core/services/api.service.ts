import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  /**
   * Base relativa para manter os mesmos endpoints em qualquer ambiente.
   * O destino real (/api) é resolvido por proxy/reverse-proxy do ambiente.
   */
  private readonly baseUrl = '';

  constructor(private readonly http: HttpClient) {}

  get<T>(url: string): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}${url}`);
  }

  post<T>(url: string, payload: unknown): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${url}`, payload);
  }

  patch<T>(url: string, payload: unknown): Observable<T> {
    return this.http.patch<T>(`${this.baseUrl}${url}`, payload);
  }
}
