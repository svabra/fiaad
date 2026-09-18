import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'overview' },
  {
    path: 'overview',
    loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    title: 'Übersicht · DAAIF',
  },
  {
    path: 'query-studio',
    loadComponent: () => import('./features/query-studio/query-studio.component').then((m) => m.QueryStudioComponent),
    title: 'Query Studio · DAAIF',
  },
  {
    path: 'catalog',
    loadComponent: () => import('./features/catalog/catalog.component').then((m) => m.CatalogComponent),
    title: 'Datenquellen · DAAIF',
  },
  {
    path: 'products',
    loadComponent: () => import('./features/products/products.component').then((m) => m.ProductsComponent),
    title: 'Datenprodukte · DAAIF',
  },
  {
    path: 'architecture',
    loadComponent: () => import('./features/about/about.component').then((m) => m.AboutComponent),
    title: 'Architektur · DAAIF',
  },
  { path: '**', redirectTo: 'overview' },
];

