import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { AlertEntry } from '../../common/utils';

@Injectable({ providedIn: 'root' })
export class GlobalAlertsService {
  readonly globalAlerts$: Observable<AlertEntry[]> = of([]);

  constructor() {}
}
