import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, from, of, switchMap, tap, throwError } from 'rxjs';
import { LocalDataService } from './local-data.service';
import { TenantService } from './tenant.service';

export const identityInterceptor: HttpInterceptorFn = (
  request: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> => {
  const tenant = inject(TenantService);
  const headers = tenant.headers();
  return next(
    request.clone({
      setHeaders: {
        ...headers,
        'X-Correlation-ID': crypto.randomUUID(),
      },
    }),
  );
};

export const offlineCacheInterceptor: HttpInterceptorFn = (
  request: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> => {
  if (request.method !== 'GET' || request.url.includes('/events')) return next(request);

  const localData = inject(LocalDataService);
  const tenantId = inject(TenantService).current().id;
  return next(request).pipe(
    tap((event) => {
      if (!(event instanceof HttpResponse)) return;
      void localData.putApi({
        key: localData.apiKey(tenantId, request.urlWithParams),
        tenantId,
        body: event.body,
        status: event.status,
        statusText: event.statusText,
        url: request.urlWithParams,
        storedAt: new Date().toISOString(),
      });
    }),
    catchError((error: HttpErrorResponse) => {
      const canUseCache = !navigator.onLine || [0, 502, 503, 504].includes(error.status);
      if (!canUseCache) return throwError(() => error);
      return from(localData.getApi(tenantId, request.urlWithParams)).pipe(
        switchMap((cached) =>
          cached
            ? of(
                new HttpResponse({
                  body: cached.body,
                  status: cached.status,
                  statusText: `${cached.statusText} · offline cache`,
                  url: cached.url,
                  headers: undefined,
                }),
              )
            : throwError(() => error),
        ),
      );
    }),
  );
};

