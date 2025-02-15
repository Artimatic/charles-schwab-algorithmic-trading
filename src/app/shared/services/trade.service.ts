import { Injectable } from '@angular/core';
import { Recommendation } from '@shared/stock-backtest.interface';
import { Subject } from 'rxjs';
import { TrainingResults } from 'src/app/machine-learning/ask-model/ask-model.component';

export interface AlgoQueueItem  {
  symbol: string;
  id?: string;
  reset: boolean;
  updateOrder?: boolean;
  triggerMlBuySell?: boolean;
  delay?: number;
  analysis?: Recommendation;
  ml?: number;
}

@Injectable()
export class TradeService {
  algoQueue: Subject<AlgoQueueItem> = new Subject();

  constructor() { }

}
