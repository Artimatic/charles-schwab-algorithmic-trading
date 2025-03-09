import { Injectable } from '@angular/core';
import { AutopilotService } from '../autopilot/autopilot.service';
import { CartService } from '@shared/services/cart.service';
import { AlgoQueueItem, TradeService } from '@shared/services/trade.service';
import { DaytradeRecommendation } from '@shared/stock-backtest.interface';
import { OrderType } from '@shared/stock-backtest.interface';
import { OptionsOrderBuilderService } from '../strategies/options-order-builder.service';

@Injectable({
  providedIn: 'root'
})
export class ScenarioGeneratorService {

  constructor(private autopilotService: AutopilotService,
    private cartService: CartService,
    private tradeService: TradeService,
    private optionsOrderBuilderService: OptionsOrderBuilderService
  ) { }

  async testSellLoser() {
    const currentHoldings = await this.cartService.findCurrentPositions();
    this.autopilotService.sellLoser(currentHoldings);
  }

  testBuyCall() {
    this.optionsOrderBuilderService.addOptionByBalance('SPY', 2000, 'Test buying calls', true);
    this.sendSignal('SPY', OrderType.Buy);
  }

  testBuyPut() {
    this.optionsOrderBuilderService.addOptionByBalance('AAPL', 2000, 'Test buying puts', false);
    this.sendSignal('AAPL', OrderType.Sell);
  }

  async testTradingPair() {
    const options = await this.optionsOrderBuilderService.balanceTrades(['NVDA'], ['AMD'], 1000, 5000, 'Test trading pair');
    this.optionsOrderBuilderService.addTradingPair(options, 'Test trading pair');
    this.sendSignal('NVDA', OrderType.Buy);
  }

  sendSignal(symbol: string, recommendation: OrderType) {
    const signal = {
      name: symbol,
      time: new Date().toISOString(),
      recommendation: recommendation,
      mfi: DaytradeRecommendation.Bullish,
      roc: DaytradeRecommendation.Neutral,
      bband: DaytradeRecommendation.Neutral,
      vwma: DaytradeRecommendation.Bullish,
      macd: DaytradeRecommendation.Bearish,
      demark9: DaytradeRecommendation.Neutral,
      bbandBreakout: DaytradeRecommendation.Neutral,
      mfiTrade: DaytradeRecommendation.Neutral
    };

    const resetCommand: AlgoQueueItem = {
      symbol: symbol,
      reset: true
    };

    this.tradeService.algoQueue.next(resetCommand);
    const queueItem: AlgoQueueItem = {
      symbol: symbol,
      reset: false,
      analysis: signal,
      ml: null
    };
    this.tradeService.algoQueue.next(queueItem);
  }
}
