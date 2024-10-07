import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DaytradeActiveSearchComponent } from './daytrade-active-search.component';
import { BacktestService, DaytradeService, MachineLearningService, PortfolioService } from '@shared/services';
import { StrategyBuilderService } from 'src/app/backtest-table/strategy-builder.service';
import { of } from 'rxjs';
import { MachineDaytradingService } from 'src/app/machine-daytrading/machine-daytrading.service';
import { MessageService } from 'primeng/api';
import { GlobalSettingsService } from 'src/app/settings/global-settings.service';

describe('DaytradeActiveSearchComponent', () => {
  let component: DaytradeActiveSearchComponent;
  let fixture: ComponentFixture<DaytradeActiveSearchComponent>;

  const mockBacktestService = {
    getLastPriceTiingo: () => Promise.resolve(null),
    getBacktestEvaluation: () => null
  };

  const mockStrategyBuilderService = {
    getBacktestData: () => Promise.resolve(null),
    getCallStrangleTrade: () => Promise.resolve(null),
    removeTradingStrategy: () => null,
    findTrades: () => null,
    addStrangle: () => null,
    sanitizeData: () => null,
    findOptionsPrice: () => 0,
    getTradingStrategies: () => null,
    getRecentBacktest: () => [],
    getBuyList: () => [],
    getQuantity: () => null
  };

  const mockPortfolioService = {
    getPrice: () => Promise.resolve(null),
    getUserPreferences: () => of(null),
    sendMultiOrderSell: () => Promise.resolve(null),
    getEquityMarketHours: () => Promise.resolve(null),
    getTdBalance: () => Promise.resolve(null)
  };

  const mockDaytradeService = {
    sendBuy: () => null,
    createOrder: () => null
  };

  const mockMachineDaytradingService = {
    getPortfolioBalance: () => Promise.resolve(null)
  };

  const mockMachineLearningService = {
    trainDaytrade: () => Promise.resolve(null)
  };

  const mockGlobalSettingsService = {
    daytradeAlgo: () => []
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DaytradeActiveSearchComponent ],
      providers: [
        MessageService,
        { provide: GlobalSettingsService, useValue: mockGlobalSettingsService },
        { provide: MachineDaytradingService, useValue: mockMachineDaytradingService },
        { provide: BacktestService, useValue: mockBacktestService },
        { provide: StrategyBuilderService, useValue: mockStrategyBuilderService },
        { provide: PortfolioService, useValue: mockPortfolioService },
        { provide: MachineLearningService, useValue: mockMachineLearningService },
        { provide: DaytradeService, useValue: mockDaytradeService }
      ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DaytradeActiveSearchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
