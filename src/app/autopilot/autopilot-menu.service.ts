import { Injectable } from '@angular/core';
import * as moment from 'moment-timezone';
import { MenuItem, MessageService } from 'primeng/api';
import { CartService, MachineLearningService, PortfolioService } from '@shared/services';
import { OrderingService } from '@shared/ordering.service';
import { AutopilotService, SwingtradeAlgorithms } from './autopilot.service';
import { NewStockFinderService } from '../backtest-table/new-stock-finder.service';
import { OptionsOrderBuilderService } from '../strategies/options-order-builder.service';
import { environment } from '../../environments/environment';

/** Context provided by the component for menu actions that affect component state or UI. */
export interface IAutopilotMenuContext {
  startManualTrading(): Promise<void>;
  updateStockList(): void;
  sellAll(): Promise<void>;
}

/**
 * Builds PrimeNG menu items for the autopilot toolbar (start, other options, multibutton/test actions).
 * Delegates component-specific actions via IAutopilotMenuContext; uses injected services for the rest.
 */
@Injectable({
  providedIn: 'root'
})
export class AutopilotMenuService {
  constructor(
    private messageService: MessageService,
    private autopilotService: AutopilotService,
    private cartService: CartService,
    private portfolioService: PortfolioService,
    private machineLearningService: MachineLearningService,
    private optionsOrderBuilderService: OptionsOrderBuilderService,
    private orderingService: OrderingService,
    private newStockFinderService: NewStockFinderService
  ) {}

  getStartButtonOptions(context: IAutopilotMenuContext): MenuItem[] {
    return [
      {
        label: 'Start orders without auto manage',
        command: async () => {
          await context.startManualTrading();
          this.messageService.add({
            severity: 'success',
            summary: 'Trading started'
          });
          this.newStockFinderService.addOldList();
        }
      }
    ];
  }

  getOtherOptions(context: IAutopilotMenuContext): MenuItem[] {
    return [
      {
        label: 'Update stock list',
        command: () => context.updateStockList()
      },
      {
        label: 'Change strategy',
        command: () => this.autopilotService.changeStrategy(true)
      }
    ];
  }

  getMultibuttonOptions(context: IAutopilotMenuContext): MenuItem[] {
    const items: MenuItem[] = [
      {
        label: 'Sell All',
        command: async () => {
          await context.sellAll();
        }
      },
      {
        label: 'Set credentials',
        command: async () => {
          this.autopilotService.checkCredentials();
        }
      }
    ];

    if (!environment.production) {
      items.push(
      {
        label: 'Test create strategy',
        command: async () => {
          this.autopilotService.addPairOnSignal(SwingtradeAlgorithms.breakSupport, 'buy', false);
          this.autopilotService.addPairOnSignal(SwingtradeAlgorithms.breakResistance, 'buy', false);
          this.autopilotService.addPairOnSignal(SwingtradeAlgorithms.breakSupport, 'sell', false);
          this.autopilotService.addPairOnSignal(SwingtradeAlgorithms.breakResistance, 'sell', false);
          this.autopilotService.addPairOnSignal(SwingtradeAlgorithms.mfiTrade, 'sell');
          this.autopilotService.addPairOnSignal(SwingtradeAlgorithms.mfiDivergence, 'sell');
          this.autopilotService.addPairOnSignal(SwingtradeAlgorithms.mfiTrade, 'buy');
          this.autopilotService.addPairOnSignal(SwingtradeAlgorithms.mfiDivergence2, 'buy');
          this.autopilotService.addPairOnSignal(SwingtradeAlgorithms.mfiDivergence2, 'sell');
          this.autopilotService.addPairOnSignal(SwingtradeAlgorithms.mfiDivergence, 'buy');
          this.autopilotService.addPairOnSignal(SwingtradeAlgorithms.flagPennant, 'buy');
          this.autopilotService.addPairOnSignal(SwingtradeAlgorithms.flagPennant, 'sell');
          this.autopilotService.addPairOnSignal(SwingtradeAlgorithms.demark9, 'buy');
          this.autopilotService.addPairOnSignal(SwingtradeAlgorithms.mfi, 'sell');
          this.autopilotService.addPairOnSignal(SwingtradeAlgorithms.bband, 'sell');
          this.autopilotService.addPairOnSignal(SwingtradeAlgorithms.mfi, 'buy');
          this.autopilotService.addPairOnSignal(SwingtradeAlgorithms.bband, 'buy');
          this.autopilotService.addPairOnSignal(SwingtradeAlgorithms.macd, 'buy');
          this.autopilotService.buyWinnersSellLosers();
        }
      },
      {
        label: 'Print cart',
        command: async () => {
          console.log('Buy', this.cartService.buyOrders);
          console.log('Sell', this.cartService.sellOrders);
          console.log('Other', this.cartService.otherOrders);
        }
      },
      {
        label: 'Test handle strategy',
        command: async () => {
          await this.autopilotService.handleStrategy();
        }
      },
      {
        label: 'Test add options strategies',
        command: async () => {
          await this.optionsOrderBuilderService.addOptionsStrategiesToCart();
        }
      },
      {
        label: 'Test upload profit loss',
        command: async () => {
          const lastProfitLoss = JSON.parse(localStorage.getItem('profitLoss'));
          console.log(localStorage.getItem('profitLoss'));
          const accountId = sessionStorage.getItem('accountId');
          this.portfolioService.updatePortfolioProfitLoss(accountId || null, lastProfitLoss.date,
            lastProfitLoss.lastRiskTolerance,
            lastProfitLoss.lastStrategy,
            lastProfitLoss.profit).subscribe();
        }
      },
      {
        label: 'Test ml',
        command: async () => {
          const buyFeatures = Array(66).fill(1);
          const featuresToTry = [buyFeatures];
          console.log('buyFeatures', buyFeatures);
          console.log('featuresToTry', featuresToTry);
          const endDate = moment().format('YYYY-MM-DD');
          const list = ['AMD', 'GOOGL', 'CRWD', 'DELL', 'META', 'NVDA'];
          const allScores = [];
          const parameters = [
            { days: 700, range: 4, limit: 0.04, trainingSize: 0.9 }
          ];
          for (const p of parameters) {
            for (const f of featuresToTry) {
              for (const sym1 of list) {
                const train = await this.machineLearningService.trainBuy(sym1, endDate,
                  moment().subtract({ day: p.days }).format('YYYY-MM-DD'), p.trainingSize, f, p.range, p.limit).toPromise();
                allScores.push({ days: p.days, score: train[0].score, features: f.join(), symbol: sym1, range: p.range, limit: p.limit });
                console.log(sym1, 'Train', f, train[0].score, train[0].predictionHistory.filter(r => r.prediction > 0.5).map((val) => {
                  return { date: val.date, prediction: val.prediction, actual: val.actual[0] };
                }));

                const activate = await this.machineLearningService.activateBuy(sym1, endDate,
                  moment().subtract({ day: p.days }).format('YYYY-MM-DD'), p.trainingSize, f, p.range, p.limit).toPromise();
                allScores.push({ days: p.days, score: activate[0].score, features: f.join(), symbol: sym1, range: p.range, limit: p.limit });
                console.log(sym1, 'Activate', f, activate[0].score, activate[0].predictionHistory.filter(r => r.prediction > 0.5).map((val) => {
                  return { date: val.date, prediction: val.prediction, actual: val.actual[0] };
                }));
              }
            }
          }
          console.log(allScores.sort((a, b) => b.score - a.score).filter((a) => a.score > 0.5));
        }
      },
      {
        label: 'Test api',
        command: async () => {
          const currentHoldings = await this.cartService.findCurrentPositions();
          for (const holding of currentHoldings) {
            if (holding.shares) {
              const price = await this.portfolioService.getPrice(holding.name).toPromise();
              const orderSizePct = 0.5;
              const order = this.cartService.buildOrderWithAllocation(holding.name,
                holding.shares,
                price,
                'Sell',
                orderSizePct, -0.005, 0.01, -0.003, null, true);
              const result = await this.orderingService.getRecommendationAndProcess(order).toPromise();
              console.log('sell result', result);
            }
          }
          const buys = this.autopilotService.getBuyList();
          for (const buy of buys) {
            const price = await this.portfolioService.getPrice(buy).toPromise();
            const order = this.cartService.buildOrderWithAllocation(buy, 1, price, 'Buy',
              0.5, -0.005, 0.01, -0.003, null, true);
            const result = await this.orderingService.getRecommendationAndProcess(order).toPromise();
            console.log('buy result', result);
          }
        }
      }
      );
    }

    return items;
  }
}
