import { Component, OnInit } from '@angular/core';
import { AiPicksService, CartService, PortfolioInfoHolding } from '@shared/services';
import { Stock } from '@shared/stock.interface';
import { StrategyBuilderService } from 'src/app/backtest-table/strategy-builder.service';
import { OptionsOrderBuilderService } from 'src/app/strategies/options-order-builder.service';

@Component({
  selector: 'app-algo-evaluation',
  templateUrl: './algo-evaluation.component.html',
  styleUrls: ['./algo-evaluation.component.css']
})
export class AlgoEvaluationComponent implements OnInit {
  selectedColumns = [];
  selectedStock: any;
  currentList: any[] = [];
  stockList: Stock[] = [];
  showPortfolio;
  recommendations: Stock[] = [];

  constructor(private aiPicksService: AiPicksService,
    private optionsOrderBuilderService: OptionsOrderBuilderService,
    private cartService: CartService,
    private strategyBuilderService: StrategyBuilderService) { }

  async ngOnInit() {
    await this.getBacktests();

    this.aiPicksService.mlNeutralResults.subscribe(async () => {
      await this.getBacktests();
    });
  }

  async getBacktests() {
    this.stockList = [];
    const savedBacktest = JSON.parse(localStorage.getItem('backtest'));
    if (savedBacktest) {
      for (const saved in savedBacktest) {
        this.stockList.push(savedBacktest[saved]);
      }
    }
    this.recommendations = this.stockList.filter(stock => {
      if ((stock?.ml > 0.5) && (stock.recommendation.toLowerCase() === 'buy' || stock.recommendation.toLowerCase() === 'strongbuy')) {
        stock.recommendation = 'Strong buy';
        if (stock.impliedMovement < 0.09) {
          this.optionsOrderBuilderService.addCallToCurrentTrades(stock.stock);
        } else {
          this.strategyBuilderService.addBullishStock(stock.stock);
        }
        return true;
      } else if ((stock?.sellMl > 0.5) && (stock.recommendation.toLowerCase() === 'sell' || stock.recommendation.toLowerCase() === 'strongsell')) {
        stock.recommendation = 'Strong sell';
        if (stock.impliedMovement < 0.09) {
          this.optionsOrderBuilderService.addPutToCurrentTrades(stock.stock);
        }
        return true;
      }
      return false;
    });

    await this.setTable();
  }

  setColumnsForRecommendations() {
    this.selectedColumns = [
      { field: 'stock', header: 'Stock' },
      { field: 'buySignals', header: 'Buy' },
      { field: 'sellSignals', header: 'Sell' },
      { field: 'recommendation', header: 'Recommendation' },
      { field: 'returns', header: 'Returns' },
      { field: 'impliedMovement', header: 'Implied Movement' }
    ];
  }

  setColumnsForPortfolio() {
    this.selectedColumns = [
      { field: 'name', header: 'Stock' },
      { field: 'shares', header: 'Shares' },
      { field: 'primaryLegs', header: 'Primary Options' },
      { field: 'secondaryLegs', header: 'Secondary Options' },
      { field: 'shares', header: 'Shares' },
      { field: 'pl', header: 'PnL' },
      { field: 'netLiq', header: 'NetLiq' },
      { field: 'recommendation', header: 'Recommendation' }
    ];
  }

  async setTable(ev = null) {
    this.showPortfolio = ev?.checked;
    if (this.showPortfolio) {
      this.setColumnsForPortfolio
      const positions = await this.cartService.findCurrentPositions();
      this.currentList = positions.map((pos: PortfolioInfoHolding) => {
        return {
          name: pos.name,
          pl: pos.pl,
          netLiq: pos.netLiq,
          shares: pos.shares,
          primaryLegs: pos.primaryLegs.map(leg => leg.description).join(','),
          secondaryLegs: pos.secondaryLegs.map(leg => leg.description).join(','),
          recommendation: pos.recommendation
        };
      });
    } else {
      this.setColumnsForRecommendations();
      this.currentList = this.recommendations;
    }
  }
}
