import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiEndpoints } from '../config/api-endpoints';
import { ApiService } from './api.service';

export type AuthLoginRequest = {
  email: string;
  password: string;
};

export type AuthRegisterRequest = {
  name: string;
  email: string;
  password: string;
};

export type AuthResponse = {
  accessToken: string;
  user: {
    name: string;
    email: string;
  };
};

export type AuthGoogleRequest = {
  idToken?: string;
};

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly api = inject(ApiService);

  login(payload: AuthLoginRequest): Observable<AuthResponse> {
    return this.api.post<AuthResponse>(ApiEndpoints.auth.login, payload);
  }

  register(payload: AuthRegisterRequest): Observable<AuthResponse> {
    return this.api.post<AuthResponse>(ApiEndpoints.auth.register, payload);
  }

  loginWithGoogle(payload: AuthGoogleRequest = {}): Observable<AuthResponse> {
    return this.api.post<AuthResponse>(ApiEndpoints.auth.google, payload);
  }
}
