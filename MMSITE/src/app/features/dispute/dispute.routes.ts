import { Routes } from '@angular/router';
import { DisputeDetailComponent } from './pages/dispute-detail/dispute-detail.component';

export const DISPUTE_ROUTES: Routes = [{ path: ':id', component: DisputeDetailComponent }];
