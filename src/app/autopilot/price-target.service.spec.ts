import { TestBed } from '@angular/core/testing';

import { PriceTargetService } from './price-target.service';
import { BacktestService, CartService, PortfolioService } from '@shared/services';
import { OptionsOrderBuilderService } from '../options-order-builder.service';
import { OrderHandlingService } from '../order-handling/order-handling.service';
import { of } from 'rxjs';

describe('PriceTargetService', () => {
  let service: PriceTargetService;
  const cartServiceSpy = jasmine.createSpyObj('CartService', ['addOptionOrder', 'getAvailableFunds', 'createOptionOrder']);
  const orderHandlingServiceSpy = jasmine.createSpyObj('OrderHandlingService', ['getEstimatedPrice']);
  const portfolioServiceSpy = jasmine.createSpyObj('PortfolioService', ['getTdPortfolio']);
  const backtestServiceSpy = jasmine.createSpyObj('BacktestService', ['getLastPriceTiingo']);

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [],
      providers: [
        { provide: BacktestService, useValue: backtestServiceSpy },
        { provide: CartService, useValue: cartServiceSpy },
        { provide: PortfolioService, useValue: portfolioServiceSpy },
        { provide: OptionsOrderBuilderService, useValue: {} },
        { provide: OrderHandlingService, useValue: orderHandlingServiceSpy }
      ]
    });
    service = TestBed.inject(PriceTargetService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should determine if price target is met', () => {
  });
  it('should calculate profit loss', async () => {
    const fakePortData = [
      {
        "shortQuantity": 0,
        "averagePrice": 73.1541361257,
        "currentDayProfitLoss": -112.690000000001,
        "currentDayProfitLossPercentage": -0.76,
        "longQuantity": 191,
        "settledLongQuantity": 191,
        "settledShortQuantity": 0,
        "instrument": {
          "assetType": "EQUITY",
          "cusip": "679295105",
          "symbol": "OKTA",
          "netChange": 0.07
        },
        "marketValue": 14771.94,
        "maintenanceRequirement": 4431.58,
        "averageLongPrice": 73.154107853403,
        "taxLotAverageLongPrice": 73.1541361257,
        "longOpenProfitLoss": 799.499999991299,
        "previousSessionLongQuantity": 191,
        "currentDayCost": 0
      },
      {
        "shortQuantity": 0,
        "averagePrice": 13.5951,
        "currentDayProfitLoss": -10.61,
        "currentDayProfitLossPercentage": -0.58,
        "longQuantity": 1,
        "settledLongQuantity": 1,
        "settledShortQuantity": 0,
        "instrument": {
          "assetType": "OPTION",
          "cusip": "0MSFT.XK40420000",
          "symbol": "MSFT  241220P00420000",
          "description": "Microsoft Corp 12/20/2024 $420 Put",
          "netChange": 0.5189,
          "type": "VANILLA",
          "putCall": "PUT",
          "underlyingSymbol": "MSFT"
        },
        "marketValue": 1812.5,
        "maintenanceRequirement": 0,
        "averageLongPrice": 13.59,
        "taxLotAverageLongPrice": 13.5951,
        "longOpenProfitLoss": 452.99,
        "previousSessionLongQuantity": 1,
        "currentDayCost": 0
      },
      {
        "shortQuantity": 0,
        "averagePrice": 1.6051,
        "currentDayProfitLoss": 0,
        "currentDayProfitLossPercentage": 0,
        "longQuantity": 1,
        "settledLongQuantity": 1,
        "settledShortQuantity": 0,
        "instrument": {
          "assetType": "OPTION",
          "cusip": "0MO...XK40050000",
          "symbol": "MO    241220P00050000",
          "description": "ALTRIA GROUP INC 12/20/2024 $50 Put",
          "netChange": 0.01,
          "type": "VANILLA",
          "putCall": "PUT",
          "underlyingSymbol": "MO"
        },
        "marketValue": 149,
        "maintenanceRequirement": 0,
        "averageLongPrice": 1.6,
        "taxLotAverageLongPrice": 1.6051,
        "longOpenProfitLoss": -11.51,
        "previousSessionLongQuantity": 1,
        "currentDayCost": 0
      },
      {
        "shortQuantity": 0,
        "averagePrice": 3.9051,
        "currentDayProfitLoss": 0,
        "currentDayProfitLossPercentage": 0,
        "longQuantity": 2,
        "settledLongQuantity": 2,
        "settledShortQuantity": 0,
        "instrument": {
          "assetType": "OPTION",
          "cusip": "0MRNA.MH50050000",
          "symbol": "MRNA  250117P00050000",
          "description": "MODERNA INC 01/17/2025 $50 Put",
          "netChange": -0.2,
          "type": "VANILLA",
          "putCall": "PUT",
          "underlyingSymbol": "MRNA"
        },
        "marketValue": 790,
        "maintenanceRequirement": 0,
        "averageLongPrice": 3.9,
        "taxLotAverageLongPrice": 3.9051,
        "longOpenProfitLoss": 8.98,
        "previousSessionLongQuantity": 2,
        "currentDayCost": 0
      }
    ];
    portfolioServiceSpy.getTdPortfolio.and.returnValue(of(fakePortData));
    const pl = await service.todaysPortfolioPl();

    expect(pl).toEqual(-0.007036289678282304);
  });
  it('should return true if price target met loss', async () => {
    const fakePortData = [
      {
        "shortQuantity": 0,
        "averagePrice": 73.1541361257,
        "currentDayProfitLoss": 150.690000000001,
        "currentDayProfitLossPercentage": null,
        "longQuantity": 191,
        "settledLongQuantity": 191,
        "settledShortQuantity": 0,
        "instrument": {
          "assetType": "EQUITY",
          "cusip": "679295105",
          "symbol": "OKTA",
          "netChange": 0.07
        },
        "marketValue": 14771.94,
        "maintenanceRequirement": 4431.58,
        "averageLongPrice": 73.154107853403,
        "taxLotAverageLongPrice": 73.1541361257,
        "longOpenProfitLoss": 799.499999991299,
        "previousSessionLongQuantity": 191,
        "currentDayCost": 0
      },
      {
        "shortQuantity": 0,
        "averagePrice": 13.5951,
        "currentDayProfitLoss": -10.61,
        "currentDayProfitLossPercentage": -0.58,
        "longQuantity": 1,
        "settledLongQuantity": 1,
        "settledShortQuantity": 0,
        "instrument": {
          "assetType": "OPTION",
          "cusip": "0MSFT.XK40420000",
          "symbol": "MSFT  241220P00420000",
          "description": "Microsoft Corp 12/20/2024 $420 Put",
          "netChange": 0.5189,
          "type": "VANILLA",
          "putCall": "PUT",
          "underlyingSymbol": "MSFT"
        },
        "marketValue": 1812.5,
        "maintenanceRequirement": 0,
        "averageLongPrice": 13.59,
        "taxLotAverageLongPrice": 13.5951,
        "longOpenProfitLoss": 452.99,
        "previousSessionLongQuantity": 1,
        "currentDayCost": 0
      },
      {
        "shortQuantity": 0,
        "averagePrice": 1.6051,
        "currentDayProfitLoss": 0,
        "currentDayProfitLossPercentage": 0,
        "longQuantity": 1,
        "settledLongQuantity": 1,
        "settledShortQuantity": 0,
        "instrument": {
          "assetType": "OPTION",
          "cusip": "0MO...XK40050000",
          "symbol": "MO    241220P00050000",
          "description": "ALTRIA GROUP INC 12/20/2024 $50 Put",
          "netChange": 0.01,
          "type": "VANILLA",
          "putCall": "PUT",
          "underlyingSymbol": "MO"
        },
        "marketValue": 149,
        "maintenanceRequirement": 0,
        "averageLongPrice": 1.6,
        "taxLotAverageLongPrice": 1.6051,
        "longOpenProfitLoss": -11.51,
        "previousSessionLongQuantity": 1,
        "currentDayCost": 0
      },
      {
        "shortQuantity": 0,
        "averagePrice": 3.9051,
        "currentDayProfitLoss": 0,
        "currentDayProfitLossPercentage": 0,
        "longQuantity": 2,
        "settledLongQuantity": 2,
        "settledShortQuantity": 0,
        "instrument": {
          "assetType": "OPTION",
          "cusip": "0MRNA.MH50050000",
          "symbol": "MRNA  250117P00050000",
          "description": "MODERNA INC 01/17/2025 $50 Put",
          "netChange": -0.2,
          "type": "VANILLA",
          "putCall": "PUT",
          "underlyingSymbol": "MRNA"
        },
        "marketValue": 790,
        "maintenanceRequirement": 0,
        "averageLongPrice": 3.9,
        "taxLotAverageLongPrice": 3.9051,
        "longOpenProfitLoss": 8.98,
        "previousSessionLongQuantity": 2,
        "currentDayCost": 0
      }
    ];
    portfolioServiceSpy.getTdPortfolio.and.returnValue(of(fakePortData));
    backtestServiceSpy.getLastPriceTiingo.and.returnValue(of({
      'SPY': {
        lastPrice: 579.58,
        closePrice: 575.97
      }
    }));
    service.targetDiff = 0;
    const pl = await service.todaysPortfolioPl();

    expect(pl).toEqual(0.007993864218441227);
    const priceTargetMet = await service.hasMetPriceTarget();
    expect(priceTargetMet).toEqual(true);
  });
});