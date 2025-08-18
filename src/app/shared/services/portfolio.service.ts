import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs/Observable';
import { map } from 'rxjs/operators';

import { AuthenticationService } from './authentication.service';
import { Holding } from '../models';
import * as _ from 'lodash';
import { Subject, of } from 'rxjs';
import { Options } from '@shared/models/options';
import * as moment from 'moment';

export interface PortfolioInfoHolding {
  name: string;
  pl: number;
  cost?: number;
  pnlPercentage?: number;
  netLiq: number;
  shares: number;
  alloc: number;
  recommendation: string;
  buyReasons: string;
  sellReasons: string;
  buyConfidence: number;
  sellConfidence: number;
  prediction: number;
  primaryLegs?: Options[];
  secondaryLegs?: Options[];
  assetType?: string;
}

export interface Balance {
  accruedInterest: number;
  availableFunds: number;
  availableFundsNonMarginableTrade: number;
  bondValue: number;
  buyingPower: number;
  buyingPowerNonMarginableTrade: number;
  cashBalance: number;
  cashReceipts: number;
  dayTradingBuyingPower: number;
  equity: number;
  equityPercentage: number;
  liquidationValue: number;
  longMarginValue: number;
  longMarketValue: number;
  longOptionMarketValue: number;
  maintenanceCall: number;
  maintenanceRequirement: number;
  marginBalance: number;
  moneyMarketFund: number;
  mutualFundValue: number;
  pendingDeposits: number;
  regTCall: number;
  savings: number;
  shortBalance: number;
  shortMarginValue: number;
  shortMarketValue: number;
  shortOptionMarketValue: number;
  sma: number;
}

interface Order {
  symbol: string;
  quantity: number;
  price: number;
  type: 'BUY' | 'SELL';
  timestamp: string;
}

@Injectable()
export class PortfolioService {
  portfolioSubject: Subject<PortfolioInfoHolding> = new Subject();
  portfolio;
  private readonly ORDERS_KEY = 'orders'; // Single key for orders

  constructor(
    private http: HttpClient,
    private authenticationService: AuthenticationService) {
  }

  private saveOrder(order: Order): void {
    const today = moment().format('YYYY-MM-DD');
    let orders: Order[] = [];
    const storedOrders = sessionStorage.getItem(this.ORDERS_KEY);
    if (storedOrders) {
      orders = JSON.parse(storedOrders);
      // Filter out orders that are not from today
      orders = orders.filter(o => moment(o.timestamp).format('YYYY-MM-DD') === today);
    }
    orders.push(order);
    sessionStorage.setItem(this.ORDERS_KEY, JSON.stringify(orders));
  }

  private getTodaysOrders(): Order[] {
    const storedOrders = sessionStorage.getItem(this.ORDERS_KEY);
    if (storedOrders) {
      let orders = JSON.parse(storedOrders);
      const today = moment().format('YYYY-MM-DD');
      // Filter out orders that are not from today
      orders = orders.filter(o => moment(o.timestamp).format('YYYY-MM-DD') === today);
      return orders;
    }
    return [];
  }

  private checkForMatchingBuyOrder(symbol: string): boolean {
    const todaysOrders = this.getTodaysOrders();
    const matchingOrder = todaysOrders.find(order => order.symbol === symbol && order.type === 'BUY');
    if (matchingOrder) {
      console.log(`Cannot sell ${symbol} today because a buy order already exists.`);
      return true;
    }
    return false;
  }

  getPortfolio(): Observable<any> {
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authenticationService.getToken() });
    const options = { headers: headers };

    return this.http.get('/api/portfolio/positions/', options);
  }

  updatePortfolioProfitLoss(accountId: string,
    date,
    lastRiskTolerance,
    lastStrategy,
    profit): Observable<any> {
    const body = {
      accountId,
      date,
      lastRiskTolerance,
      lastStrategy,
      profit
    };
    return this.http.put('/api/portfolio/add-profit-loss', body);
  }

  addStrategy(date,
    type,
    key,
    strategy,
    reason): Observable<any> {
    const body = {
      date,
      type,
      key,
      strategy,
      reason
    };
    return this.http.put('/api/portfolio/add-strategy', body);
  }

  getStrategy(): Observable<any> {
    return this.http.get('/api/portfolio/strategy');
  }

  getProfitLoss(): Observable<any> {
    return this.http.get('/api/portfolio/profit-loss');
  }

  purgeStrategy(): Observable<any> {
    return this.http.delete('/api/portfolio/strategy');
  }

  getTdPortfolio() {
    const accountId = this.getAccountId();
    if (!accountId) {
      return of(null);
    }
    const options = {
      params: {
        accountId
      }
    };
    return this.http.get('/api/portfolio/v2/positions', options);
  }

  getResource(url: string): Observable<any> {
    const body = { instrument: url };
    return this.http.post('/api/portfolio/resources', body);
  }

  sell(holding: Holding, quantity: number, price: number, type: string): Observable<any> {
    return this.sendTdSell(holding, quantity, price, false);
  }

  buy(holding: Holding, quantity: number, price: number, type: string): Observable<any> {
    return this.sendTdBuy(holding, quantity, price, false);
  }

  sellRh(holding: Holding, quantity: number, price: number, type: string): Observable<any> {
    if (quantity === 0) {
      throw new Error('Order Quantity is 0');
    }
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authenticationService.getToken() });
    const options = { headers: headers };
    const body = {
      'account': this.authenticationService.myAccount.account,
      'url': holding.instrument,
      'symbol': holding.symbol,
      'quantity': quantity,
      'type': type
    };

    if (price) {
      body['price'] = price;
    }

    return this.http.post('/api/portfolio/sell', body, options);
  }

  buyRh(holding: Holding, quantity: number, price: number, type: string): Observable<any> {
    if (quantity === 0) {
      throw new Error('Order Quantity is 0');
    }
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authenticationService.getToken() });
    const options = { headers: headers };
    const body = {
      'account': this.authenticationService.myAccount.account,
      'url': holding.instrument,
      'symbol': holding.symbol,
      'quantity': quantity,
      'price': price,
      'type': type
    };

    return this.http.post('/api/portfolio/buy', body, options);
  }

  extendedHoursBuy(holding: Holding, quantity: number, price: number): Observable<any> {
    return this.sendTdBuy(holding, quantity, price, true);
  }

  extendedHoursRhBuy(holding: Holding, quantity: number, price: number): Observable<any> {
    if (quantity === 0) {
      throw new Error('Order Quantity is 0');
    }
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authenticationService.getToken() });
    const options = { headers: headers };
    const body = {
      'account': this.authenticationService.myAccount.account,
      'url': holding.instrument,
      'symbol': holding.symbol,
      'quantity': quantity,
      'price': price,
      'type': 'limit',
      'extendedHour': true
    };

    return this.http.post('/api/portfolio/buy', body, options);
  }

  getInstruments(symbol: string): Observable<any> {
    const body = { symbol: symbol };
    return this.http.post('/api/portfolio/instruments', body);
  }

  getInstrument(symbol: string): Observable<any> {
    const options: any = {
      params: {
        cusip: symbol
      }
    };
    return this.http.get('/api/portfolio/instrument', options);
  }

  getQuote(symbol: string): Observable<any> {
    const accountId = this.getAccountId();
    if (!accountId) {
      return of(null);
    }
    const options = {
      params: {
        symbol,
        accountId
      }
    };

    return this.http.get('/api/portfolio/quote', options).map(quote => {
      return quote[symbol].quote;
    })
  }

  getPrice(symbol: string, lastPrice = true): Observable<number> {
    const options: any = {
      params: {
        symbol
      }
    };

    if (this.authenticationService.selectedTdaAccount) {
      options.params.accountId = this.getAccountId();
    }
    return this.http.get('/api/portfolio/quote', options)
      .pipe(
        map((quote) => {
          return lastPrice ? _.round(quote[symbol].quote.lastPrice, 2) : _.round(quote[symbol].quote.askPrice, 2);
        })
      );
  }

  sendTdBuy(holding: Holding, quantity: number, price: number, extended: boolean): Observable<any> {
    const accountId = this.getAccountId();
    if (!accountId) {
      return of(null);
    }
    const body = {
      symbol: holding.symbol,
      quantity: quantity,
      price: price,
      type: 'LIMIT',
      extendedHours: extended,
      accountId
    };

    const order: Order = {
      symbol: holding.symbol,
      quantity: quantity,
      price: price,
      type: 'BUY',
      timestamp: moment().toISOString()
    };
    this.saveOrder(order);

    return this.http.post('/api/portfolio/v2/buy', body);
  }

  sendTdSell(holding: Holding, quantity: number, price: number, extended: boolean): Observable<any> {
    if (this.checkForMatchingBuyOrder(holding.symbol)) {
      return of(null);
    }

    const body = {
      symbol: holding.symbol,
      quantity: quantity,
      price: price,
      type: 'MARKET',
      extendedHours: extended,
      accountId: this.getAccountId()
    };
    return this.http.post('/api/portfolio/v2/sell', body);
  }

  sendOptionBuy(primaryLegSymbol: string, quantity: number, price: number, extended: boolean): Observable<any> {
    const accountId = this.getAccountId();
    if (!accountId) {
      return of(null);
    }
    const body = {
      symbol: primaryLegSymbol,
      quantity: quantity,
      price: price,
      accountId
    };
    const order: Order = {
      symbol: primaryLegSymbol,
      quantity: quantity,
      price: price,
      type: 'BUY',
      timestamp: moment().toISOString()
    };
    this.saveOrder(order);
    return this.http.post('/api/portfolio/v2/option-buy', body);
  }

  sendOptionSell(primaryLegSymbol: string, quantity: number, price: number): Observable<any> {
    if (this.checkForMatchingBuyOrder(primaryLegSymbol)) {
      return of(null);
    }
    const accountId = this.getAccountId();
    if (!accountId) {
      return of(null);
    }
    const body = {
      symbol: primaryLegSymbol,
      quantity: quantity,
      price: price,
      accountId
    };
    return this.http.post('/api/portfolio/v2/option-sell', body);
  }

  sendTwoLegOrder(primaryLegSymbol: string, secondaryLegSymbol: string,
    quantity: number, price: number, extended: boolean): Observable<any> {
    const accountId = this.getAccountId();
    if (!accountId) {
      return of(null);
    }
    const body = {
      primaryLegSymbol,
      secondaryLegSymbol,
      quantity: quantity,
      price: price,
      type: 'NET_DEBIT',
      extendedHours: extended,
      accountId
    };
    return this.http.post('/api/portfolio/v2/two-leg', body);
  }

  sendMultiOrderSell(primaryLeg: Options[], secondaryLeg: Options[],
    price: number): Observable<any> {
    const accountId = this.getAccountId();
    if (!accountId) {
      return of(null);
    }
    const body = {
      primaryLeg,
      secondaryLeg,
      price: price,
      type: 'NET_CREDIT',
      accountId
    };
    return this.http.post('/api/portfolio/v2/multi-order-sell', body);
  }

  getTdBalance(): Observable<any> {
    const accountId = this.getAccountId();

    const options = {
      params: {
        accountId
      }
    };

    return this.http.get('/api/portfolio/balance', options);
  }

  getIntradayPriceHistoryQuotes(symbol: string): Observable<any> {
    const options = {
      params: {
        symbol
      }
    };

    return this.http.get('/api/portfolio/v2/intraday', options);
  }

  getAccountId() {
    if (!this.authenticationService.selectedTdaAccount) {
      return null;
    } else {
      return this.authenticationService.selectedTdaAccount.accountId;
    }
  }

  getEquityMarketHours(date: string) {
    const options = {
      params: {
        date
      }
    };

    return this.http.get('/api/portfolio/v3/equity-hours', options);
  }

  getUserPreferences() {
    const accountId = sessionStorage.getItem('accountId');
    const options = {
      params: {
        accountId: accountId
      }
    };

    return this.http.get('/api/portfolio/user-preferences', options);
  }
}
