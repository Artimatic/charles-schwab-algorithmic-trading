import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AutopilotComponent } from './autopilot.component';
import { BacktestService, CartService, DaytradeService, PortfolioService, ReportingService, ScoreKeeperService, TradeService } from '@shared/services';
import { of, Subject } from 'rxjs';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { StrategyBuilderService } from '../backtest-table/strategy-builder.service';
import { MessageService } from 'primeng/api';
import { DialogService } from 'primeng/dynamicdialog';

describe('AutopilotComponent', () => {
  let component: AutopilotComponent;
  let fixture: ComponentFixture<AutopilotComponent>;
  
  const mockPortfolioService = {
    getPrice: () => Promise.resolve(null),
    getUserPreferences: () => of(null),
    sendMultiOrderSell: () => Promise.resolve(null),
    getEquityMarketHours: () => Promise.resolve(null),
    getTdBalance: () => Promise.resolve(null)
  };

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

  const mockCartService = {
    addToCart: () => null,
    isStrangle: () => null,
    addSingleLegOptionOrder: () => null,
    deleteDaytrade: () => null,
    removeCompletedOrders: () => null,
    findCurrentPositions: () => Promise.resolve(null),
    getAvailableFunds: () => Promise.resolve(null),
    otherOrders: [],
    buyOrders: [],
    sellOrders: []
  };

  const mockScoreKeeperService = {
    resetTotal: () => null,
    profitLossHash: {},
    total: 0
  };

  const mockReportingService = {
    addAuditLog: () => null,
    exportAuditHistory: () => null
  };

  const mockTradeService = {
    algoQueue: new Subject()
  };

  const mockDaytradeService = {
    sendBuy: () => null
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AutopilotComponent ],
      imports: [HttpClientTestingModule],
      providers: [
        MessageService,
        DialogService,
        { provide: TradeService, useValue: mockTradeService },
        { provide: DaytradeService, useValue: mockDaytradeService },
        { provide: ReportingService, useValue: mockReportingService },
        { provide: ScoreKeeperService, useValue: mockScoreKeeperService },
        { provide: CartService, useValue: mockCartService },
        { provide: PortfolioService, useValue: mockPortfolioService },
        { provide: BacktestService, useValue: mockBacktestService },
        { provide: StrategyBuilderService, useValue: mockStrategyBuilderService }
      ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AutopilotComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
