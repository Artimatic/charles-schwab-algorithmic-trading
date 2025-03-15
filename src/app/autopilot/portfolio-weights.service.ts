import { Injectable } from '@angular/core';
import { PortfolioInfoHolding } from '@shared/services';
import { StrategyBuilderService } from '../backtest-table/strategy-builder.service';

interface WeightedHolding {
  name: string;
  weight: number; // Portfolio weight (e.g., 0.25 for 25%)
  impliedVolatility: number; // Implied volatility (e.g., 0.20 for 20%)
}

@Injectable({
  providedIn: 'root'
})
export class PortfolioWeightsService {
  constructor(private strategyBuilderService: StrategyBuilderService) { }
  async createHoldingWeights(portfolioData: PortfolioInfoHolding[]): Promise<WeightedHolding[]> {
    const totalMarketValue = portfolioData.reduce((sum, item) => sum + item.netLiq, 0);
    const holdingWeights: WeightedHolding[] = [];

    for (const item of portfolioData) {
      const backtestData = await this.strategyBuilderService.getBacktestData(item.name);
      if(backtestData){
        holdingWeights.push({
            name: item.name.toUpperCase(),
            weight: item.netLiq / totalMarketValue,
            impliedVolatility: item.primaryLegs ? backtestData.impliedMovement * 5 : backtestData.impliedMovement
        });
      }
    }

    return holdingWeights;
  }

  calculatePortfolioVolatility(
    holdings: WeightedHolding[]
  ): number {
    let portfolioVariance = 0;
    const numHoldings = holdings.length;

    for (let i = 0; i < numHoldings; i++) {
      for (let j = 0; j < numHoldings; j++) {
        portfolioVariance += (
          holdings[i].weight *
          holdings[j].weight *
          holdings[i].impliedVolatility *
          holdings[j].impliedVolatility
        );
      }
    }

    const portfolioVolatility = Math.sqrt(portfolioVariance);
    return portfolioVolatility;
  }

  async getPortfolioVolatility(portfolioData: PortfolioInfoHolding[]) {
    const weightedHoldings = await this.createHoldingWeights(portfolioData);
    return this.calculatePortfolioVolatility(weightedHoldings);
  }
}
