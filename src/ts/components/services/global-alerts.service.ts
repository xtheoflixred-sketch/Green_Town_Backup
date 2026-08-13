import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timer, of } from 'rxjs';
import { switchMap, shareReplay, catchError } from 'rxjs/operators';
import { AlertEntry } from '../../common/utils';

@Injectable({ providedIn: 'root' })
export class GlobalAlertsService {
  // Пуллинг глобальных алертов раз в 30 секунд
  readonly globalAlerts$: Observable<AlertEntry[]> = timer(0, 30000).pipe(
    switchMap(() => this.http.get<AlertEntry[]>('/api2/global-alerts').pipe(
      catchError(() => of([])) // Return empty array on error to avoid console errors
    )),
    shareReplay(1)
  );

  constructor(private http: HttpClient) {}
}
