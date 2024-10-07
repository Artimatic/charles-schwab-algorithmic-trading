import { Injectable } from '@angular/core';
import { ComplexStrategy, StrategyBuilderService } from '../backtest-table/strategy-builder.service';

@Injectable({
  providedIn: 'root'
})
export class ComplexStrategyBuilderService {

  constructor(private strategyBuilderService: StrategyBuilderService) { }

  addStrategy(strategy: ComplexStrategy) {
    this.strategyBuilderService.addComplexStrategy(strategy);
  }

  markStategyForDissassembly(symbol: string) {
    let strategies: ComplexStrategy[] = this.strategyBuilderService.getComplexStrategy();
    strategies = strategies.filter(strat => !strat.trades.find(trade => trade.primaryLegs && trade.primaryLegs.find(leg => leg.symbol === symbol)));
    this.strategyBuilderService.setComplexStrategy(strategies);
  }
}
