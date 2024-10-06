import { TestBed } from '@angular/core/testing';

import { PortfolioMgmtService } from './portfolio-mgmt.service';

xdescribe('PortfolioMgmtService', () => {
  let service: PortfolioMgmtService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PortfolioMgmtService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should buy protective put', () => {
    const currentHoldings = [
      {
        "shortQuantity": 0,
        "averagePrice": 74.369,
        "currentDayProfitLoss": -2040.079999999999,
        "currentDayProfitLossPercentage": -28.65,
        "longQuantity": 70,
        "settledLongQuantity": 70,
        "settledShortQuantity": 0,
        "instrument": {
          "assetType": "EQUITY",
          "cusip": "679295105",
          "symbol": "OKTA",
          "netChange": 0.01
        },
        "marketValue": 5081.3,
        "maintenanceRequirement": 1524.39,
        "averageLongPrice": 74.368951428571,
        "taxLotAverageLongPrice": 74.369,
        "longOpenProfitLoss": -124.53,
        "previousSessionLongQuantity": 70,
        "currentDayCost": 2040.78
      },
      {
        "shortQuantity": 0,
        "averagePrice": 5.5051125,
        "currentDayProfitLoss": 100,
        "currentDayProfitLossPercentage": 2.28,
        "longQuantity": 8,
        "settledLongQuantity": 8,
        "settledShortQuantity": 0,
        "instrument": {
          "assetType": "OPTION",
          "cusip": "0MRNA.XK40060000",
          "symbol": "MRNA  241220P00060000",
          "description": "MODERNA INC 12/20/2024 $60 Put",
          "netChange": 0.185,
          "type": "VANILLA",
          "putCall": "PUT",
          "underlyingSymbol": "MRNA"
        },
        "marketValue": 4480,
        "maintenanceRequirement": 0,
        "averageLongPrice": 5.5,
        "taxLotAverageLongPrice": 5.5051125,
        "longOpenProfitLoss": 75.91,
        "previousSessionLongQuantity": 8,
        "currentDayCost": 0
      },
      {
        "shortQuantity": 0,
        "averagePrice": 10.5156,
        "currentDayProfitLoss": -138.64,
        "currentDayProfitLossPercentage": -6.25,
        "longQuantity": 2,
        "settledLongQuantity": 2,
        "settledShortQuantity": 0,
        "instrument": {
          "assetType": "OPTION",
          "cusip": "0JPM..XK40210000",
          "symbol": "JPM   241220P00210000",
          "description": "JPMORGAN CHASE & CO 12/20/2024 $210 Put",
          "netChange": -0.6932,
          "type": "VANILLA",
          "putCall": "PUT",
          "underlyingSymbol": "JPM"
        },
        "marketValue": 2080,
        "maintenanceRequirement": 0,
        "averageLongPrice": 10.4,
        "taxLotAverageLongPrice": 10.5156,
        "longOpenProfitLoss": -23.12,
        "previousSessionLongQuantity": 2,
        "currentDayCost": 0
      },
      {
        "shortQuantity": 0,
        "averagePrice": 185.94,
        "currentDayProfitLoss": -56.97,
        "currentDayProfitLossPercentage": -1.12,
        "longQuantity": 27,
        "settledLongQuantity": 27,
        "settledShortQuantity": 0,
        "instrument": {
          "assetType": "EQUITY",
          "cusip": "526057104",
          "symbol": "LEN",
          "netChange": -2.11
        },
        "marketValue": 5027.13,
        "maintenanceRequirement": 1508.14,
        "averageLongPrice": 185.94,
        "taxLotAverageLongPrice": 185.94,
        "longOpenProfitLoss": 6.75,
        "previousSessionLongQuantity": 27,
        "currentDayCost": 0
      },
      {
        "shortQuantity": 0,
        "averagePrice": 571.215,
        "currentDayProfitLoss": -567.42,
        "currentDayProfitLossPercentage": -33.25,
        "longQuantity": 2,
        "settledLongQuantity": 2,
        "settledShortQuantity": 0,
        "instrument": {
          "assetType": "COLLECTIVE_INVESTMENT",
          "cusip": "78462F103",
          "symbol": "SPY",
          "description": "SPDR S&P 500 ETF",
          "type": "EXCHANGE_TRADED_FUND"
        },
        "marketValue": 1138.88,
        "maintenanceRequirement": 341.66,
        "averageLongPrice": 571.17465,
        "taxLotAverageLongPrice": 571.215,
        "longOpenProfitLoss": -3.55,
        "previousSessionLongQuantity": 2,
        "currentDayCost": 569.06
      },
      {
        "shortQuantity": 0,
        "averagePrice": 230.066071428571,
        "currentDayProfitLoss": -954.689999999999,
        "currentDayProfitLossPercentage": -12.93,
        "longQuantity": 28,
        "settledLongQuantity": 28,
        "settledShortQuantity": 0,
        "instrument": {
          "assetType": "EQUITY",
          "cusip": "032654105",
          "symbol": "ADI",
          "netChange": 5.93
        },
        "marketValue": 6428.8,
        "maintenanceRequirement": 1928.64,
        "averageLongPrice": 230.066071428571,
        "taxLotAverageLongPrice": 230.066071428571,
        "longOpenProfitLoss": -13.05,
        "previousSessionLongQuantity": 28,
        "currentDayCost": 1120.73
      },
      {
        "shortQuantity": 0,
        "averagePrice": 1.7051,
        "currentDayProfitLoss": 14.88,
        "currentDayProfitLossPercentage": 12400,
        "longQuantity": 6,
        "settledLongQuantity": 6,
        "settledShortQuantity": 0,
        "instrument": {
          "assetType": "OPTION",
          "cusip": "0NTNX.VI40042500",
          "symbol": "NTNX  241018P00042500",
          "description": "NUTANIX INC 10/18/2024 $42.5 Put",
          "netChange": 0.0498,
          "type": "VANILLA",
          "putCall": "PUT",
          "underlyingSymbol": "NTNX"
        },
        "marketValue": 15,
        "maintenanceRequirement": 0,
        "averageLongPrice": 1.7,
        "taxLotAverageLongPrice": 1.7051,
        "longOpenProfitLoss": -1008.06,
        "previousSessionLongQuantity": 6,
        "currentDayCost": 0
      },
      {
        "shortQuantity": 0,
        "averagePrice": 64.209473684211,
        "currentDayProfitLoss": -45.2295,
        "currentDayProfitLossPercentage": -0.74,
        "longQuantity": 95,
        "settledLongQuantity": 95,
        "settledShortQuantity": 0,
        "instrument": {
          "assetType": "EQUITY",
          "cusip": "60770K107",
          "symbol": "MRNA",
          "netChange": -0.4761
        },
        "marketValue": 6028.12,
        "maintenanceRequirement": 898.12,
        "averageLongPrice": 64.209473684211,
        "taxLotAverageLongPrice": 64.209473684211,
        "longOpenProfitLoss": -71.7795,
        "previousSessionLongQuantity": 95,
        "currentDayCost": 0
      },
      {
        "shortQuantity": 0,
        "averagePrice": 13.5951,
        "currentDayProfitLoss": 39.4,
        "currentDayProfitLossPercentage": 2.25,
        "longQuantity": 1,
        "settledLongQuantity": 1,
        "settledShortQuantity": 0,
        "instrument": {
          "assetType": "OPTION",
          "cusip": "0MSFT.XK40420000",
          "symbol": "MSFT  241220P00420000",
          "description": "Microsoft Corp 12/20/2024 $420 Put",
          "netChange": 0.544,
          "type": "VANILLA",
          "putCall": "PUT",
          "underlyingSymbol": "MSFT"
        },
        "marketValue": 1790,
        "maintenanceRequirement": 0,
        "averageLongPrice": 13.59,
        "taxLotAverageLongPrice": 13.5951,
        "longOpenProfitLoss": 430.49,
        "previousSessionLongQuantity": 1,
        "currentDayCost": 0
      },
      {
        "shortQuantity": 0,
        "averagePrice": 262.606271186441,
        "currentDayProfitLoss": -233.344999999999,
        "currentDayProfitLossPercentage": -1.48,
        "longQuantity": 59,
        "settledLongQuantity": 59,
        "settledShortQuantity": 0,
        "instrument": {
          "assetType": "EQUITY",
          "cusip": "550021109",
          "symbol": "LULU",
          "netChange": -3.955
        },
        "marketValue": 15487.21,
        "maintenanceRequirement": 4646.16,
        "averageLongPrice": 262.606271186441,
        "taxLotAverageLongPrice": 262.606271186441,
        "longOpenProfitLoss": -6.564999999999,
        "previousSessionLongQuantity": 59,
        "currentDayCost": 0
      },
      {
        "shortQuantity": 0,
        "averagePrice": 227.814210526316,
        "currentDayProfitLoss": 24.700000000001,
        "currentDayProfitLossPercentage": 0.29,
        "longQuantity": 38,
        "settledLongQuantity": 38,
        "settledShortQuantity": 0,
        "instrument": {
          "assetType": "EQUITY",
          "cusip": "037833100",
          "symbol": "AAPL",
          "netChange": 0.65
        },
        "marketValue": 8620.68,
        "maintenanceRequirement": 2586.2,
        "averageLongPrice": 227.814210526316,
        "taxLotAverageLongPrice": 227.814210526316,
        "longOpenProfitLoss": -36.26,
        "previousSessionLongQuantity": 38,
        "currentDayCost": 0
      }
    ];
    expect(service).toBeTruthy();
  });
});
