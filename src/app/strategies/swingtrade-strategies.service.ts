import { Injectable } from '@angular/core';
import { StockBacktest } from '@shared/stock-backtest.interface';

@Injectable({
  providedIn: 'root'
})
export class SwingtradeStrategiesService {

  constructor() { }

  processSignals(backtest: StockBacktest): StockBacktest {
    //const lastSignal = backtest.signals[backtest.signals.length - 1];
    //const lowsFrequency = {};
    let highToLowSum = 0;
    backtest.signals.forEach((sig) => {
      highToLowSum += sig.high - sig.low;
    });
    backtest.averageMove = Number((highToLowSum / backtest.signals.length).toFixed(2));
    return backtest;
  }
}
