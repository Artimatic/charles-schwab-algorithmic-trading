import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { TradingSignals, SignalUpdate } from '../shared/models/trading-signals.interface';
import * as moment from 'moment';

@Injectable({
  providedIn: 'root'
})
export class SignalsStateService {
  private initialState: TradingSignals = {
    marketStatus: {
      isOpen: false,
      sessionStart: '',
      sessionEnd: '',
      lastCheck: null
    },
    currentHoldings: [],
    lastCredentialCheck: null,
    boughtAtClose: false,
    developedStrategy: false,
    lastProfitCheck: moment().toDate(),
    hasErrors: false
  };

  private state$ = new BehaviorSubject<TradingSignals>(this.initialState);

  constructor() {}

  // Selectors
  select<K extends keyof TradingSignals>(key: K): Observable<TradingSignals[K]> {
    return this.state$.pipe(
      map(state => state[key]),
      distinctUntilChanged()
    );
  }

  // State updates
  update(update: SignalUpdate): void {
    const currentState = this.state$.getValue();
    let newState: TradingSignals;

    switch (update.type) {
      case 'MARKET_STATUS':
        newState = {
          ...currentState,
          marketStatus: {
            ...currentState.marketStatus,
            ...update.payload,
            lastCheck: new Date()
          }
        };
        break;

      case 'HOLDINGS':
        newState = {
          ...currentState,
          currentHoldings: update.payload
        };
        break;

      case 'CREDENTIALS':
        newState = {
          ...currentState,
          lastCredentialCheck: new Date()
        };
        break;

      case 'CLOSE_TRADE':
        newState = {
          ...currentState,
          boughtAtClose: update.payload
        };
        break;

      case 'STRATEGY':
        newState = {
          ...currentState,
          developedStrategy: update.payload
        };
        break;

      case 'PROFIT':
        newState = {
          ...currentState,
          lastProfitCheck: new Date()
        };
        break;

      case 'ERROR':
        newState = {
          ...currentState,
          hasErrors: true,
          errorMessage: update.payload
        };
        break;

      default:
        newState = currentState;
    }

    this.state$.next(newState);
  }

  // Reset state
  reset(): void {
    this.state$.next(this.initialState);
  }

  // Get current state snapshot
  getState(): TradingSignals {
    return this.state$.getValue();
  }
}
