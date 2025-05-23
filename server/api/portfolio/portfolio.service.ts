import * as request from 'request-promise';
import * as charlesSchwabApi from 'charles-schwab-api';
import * as _ from 'lodash';
import * as moment from 'moment';

import * as configurations from '../../config/environment';
import QuoteService from '../quote/quote.service';
import DatabaseService from '../mongodb/database.service';

const charlesSchwabTraderUrl = 'https://api.schwabapi.com/trader/v1/';
const charlesSchwabMarketDataUrl = 'https://api.schwabapi.com/marketdata/v1/';

interface TokenInfo {
  timestamp: number;
  token: string;
}

class PortfolioService {
  access_token: { [key: string]: TokenInfo } = {};
  refreshTokensHash = {};
  accountIdToHash = {};
  accountStore = {};
  lastTokenRequest = null;
  lastPositionCheck = null;
  lastOptionsOrders: { symbol: string, timestamp: number }[] = [];
  constructor() {
    this.useCookieOrEnvironmentVariable(null)
  }

  private findOrder(symbol) {
    return Boolean(this.lastOptionsOrders.find(oldOrder => oldOrder.symbol === symbol && moment().diff(oldOrder.timestamp, 'minutes') < 10));
  }

  private addOrder(symbol) {
    this.lastOptionsOrders.push({ symbol, timestamp: moment().valueOf() });
    this.lastOptionsOrders.filter(oldOrder => moment().diff(oldOrder.timestamp, 'minutes') > 10);
  }

  postLogin(accountId, appKey, secret, callbackUrl, response) {
    this.accountStore[accountId] = {
      appKey,
      secret,
      callbackUrl
    };
    response.status(201).send({});
  }

  login(consumerKey, callbackUrl, reply) {
    return charlesSchwabApi.authorize(consumerKey, callbackUrl).then(response => {
      reply.status(200).send((response as any).json());
    })
      .catch((e) => {
        if (e.request && e.request._redirectable && e.request._redirectable._options && e.request._redirectable._options.href) {
          reply.redirect(e.request._redirectable._options.href);
        } else {
          reply.status(e.response.status).send({ message: e.response.statusText });
        }
      });
  }

  useCookieOrEnvironmentVariable(cookie) {
    if (cookie) {
      // Parse the cookie string into an object
      const cookieObj = cookie?.split(';')
        .map(v => v.split('='))
        .reduce((acc, v) => {
          acc[decodeURIComponent(v[0].trim())] = decodeURIComponent(v[1].trim());
          return acc;
        }, {});

      if (cookieObj?.accountId && cookieObj.appKey && cookieObj.secret && cookieObj.callbackUrl) {
        if (!this.accountStore[cookieObj.accountId]) {
          this.accountStore[cookieObj.accountId] = {
            appKey: cookieObj.appKey,
            secret: cookieObj.secret,
            callbackUrl: cookieObj.callbackUrl
          };
          return;
        }
      }
    }


    if (configurations.charles.accountId && configurations.charles.appKey && configurations.charles.secret && configurations.charles.callbackUrl) {
      if (!this.accountStore[configurations.charles.accountId]) {

        this.accountStore[configurations.charles.accountId] = {
          appKey: configurations.charles.appKey,
          secret: configurations.charles.secret,
          callbackUrl: configurations.charles.callbackUrl
        }
        if (configurations.charles.accountIdHash) {
          this.accountIdToHash[configurations.charles.accountId] = configurations.charles.accountIdHash;
        }
        if (!this.refreshTokensHash[configurations.charles.accountId] && configurations.charles.refresh_token) {
          this.refreshTokensHash[configurations.charles.accountId] = configurations.charles.refresh_token;
        }
      }
    }
  }

  getAccessToken(accountId, code, reply, cookie) {
    this.useCookieOrEnvironmentVariable(cookie);
    const appKey = this.accountStore[accountId].appKey;
    const secret = this.accountStore[accountId].secret;
    const callbackUrl = this.accountStore[accountId].callbackUrl;
    return charlesSchwabApi.getAccessToken(appKey, secret, 'authorization_code', code, callbackUrl)
      .then((response) => {
        const data = (response as any).data;
        this.getAccountNumbers(data?.access_token)
          .then(accountNumbers => {
            accountNumbers.forEach(val => {
              this.accountIdToHash[val.accountNumber] = val.hashValue;
            });
            this.refreshTokensHash[accountId] = (data?.refresh_token as string) || null;
            this.access_token[accountId] = {
              timestamp: moment().valueOf(),
              token: data?.access_token || null
            };
          });

        reply.status(200).send(data);
      })
      .catch((e) => {
        if (e.toJSON) {
          const error = e.toJSON();
          reply.status(error.status).send(error);
        } else {
          reply.status(500).send(e);
        }
      });
  }

  refreshAccessToken(accountId) {
    if (!accountId) {
      return Promise.reject(new Error('Missing accountId. Please log in.'));
    }
    if (!this.accountStore[accountId]?.appKey) {
      return Promise.reject(new Error('Missing appKey. Please log in.'));
    }
    if (!this.accountStore[accountId]?.secret) {
      return Promise.reject(new Error('Missing secret. Please log in.'));
    }
    if (!this.refreshTokensHash[accountId]) {
      return Promise.reject(new Error('Missing refresh token. Please log in.'));
    }

    return charlesSchwabApi.refreshAccessToken(this.accountStore[accountId].appKey,
      this.accountStore[accountId].secret,
      this.refreshTokensHash[accountId]
    ).then((response) => {
      const data = (response as any).data;
      this.refreshTokensHash[accountId] = (data?.refresh_token as string) || null;
      this.access_token[accountId] = {
        timestamp: moment().valueOf(),
        token: data?.access_token || null
      }
      return Promise.resolve({ accountId: accountId });
    })
      .catch(e => {
        if (e.toJSON) {
          const error = e.toJSON();
          console.log('error refreshing token:', JSON.stringify(error));
        }
        return e;
      });
  }

  getAccountNumbers(token) {
    const url = `${charlesSchwabTraderUrl}accounts/accountNumbers`;

    const options = {
      uri: url,
      headers: {
        Authorization: `Bearer ${token}`
      }
    };

    return request.get(options)
      .then(this.processData);
  }

  getQuote(symbol, accountId, response) {
    if (!accountId) {
      accountId = this.getAccountId();
    }
    if (!this.access_token[accountId]) {
      return this.renewExpiredAccessTokenAndGetQuote(symbol, accountId, response);
    } else {
      return this.getMarketData(symbol, accountId)
        .then(this.processData)
        .then(quote => {
          if (quote[symbol].delayed) {
            return this.renewExpiredAccessTokenAndGetQuote(symbol, accountId, response);
          } else {
            return quote;
          }
        })
        .catch(error => this.renewExpiredAccessTokenAndGetQuote(symbol, accountId, response));
    }
  }

  renewAuth(accountId, reply = null) {
    if (!accountId) {
      return Promise.reject(new Error('Missing accountId'));
    }

    if (this.access_token[accountId]) {
      const diffMinutes = moment().diff(moment(this.access_token[accountId].timestamp), 'minutes');
      console.log('Found access token ', diffMinutes, new Date().toString());

      if (diffMinutes < 30) {
        return Promise.resolve({ message: 'Found token' });
      } else {
        console.log('Access token expired.');
      }
    } else if (!this.access_token[accountId]) {
      this.access_token[accountId] = { token: '123', timestamp: moment().valueOf() };
    }
    return this.sendPositionRequest(accountId).then(pos => {
      console.log('Added new token');
      return Promise.resolve({ message: 'Added new token' });
    })
      .catch(error => {
        console.log('Potential token error: ', error);
        const diffMinutes = moment().diff(moment(this.access_token[accountId].timestamp), 'minutes');

        if (!diffMinutes || diffMinutes >= 30) {
          console.log('Last token request: ', moment(this.lastTokenRequest).format());
          if (this.access_token[accountId] && (this.lastTokenRequest === null || moment().diff(moment(this.lastTokenRequest), 'minutes') > 15)) {
            this.lastTokenRequest = moment().valueOf();
            console.log('Requesting new token');
            return this.refreshAccessToken(accountId);
          } else {
            const tooRecentErrMsg = 'Token request too soon';
            console.log(tooRecentErrMsg);
            if (reply) {
              reply.status(408).send({ error: tooRecentErrMsg });
              reply.end();
            }
            return Promise.reject(new Error('Last token request was too recent'));
          }
        }
        return Promise.reject(new Error('Unknown error'));
      });
  }

  getIntraday(symbol, accountId, reply) {
    console.log(moment().format(), 'Retrieving intraday quotes ');
    if (!accountId || !this.access_token[accountId]) {
      return Promise.reject(new Error('Missing accountId or access token'));
    } else {
      return this.getIntradayPriceHistory(symbol, accountId)
        .catch((error) => {
          console.log('Error retrieving intraday data ', error.error);

          return this.renewAuth(accountId, reply)
            .then(() => this.getIntradayPriceHistory(symbol, accountId));
        });
    }
  }

  getIntradayPriceHistory(symbol, accountId) {
    if (!accountId) {
      accountId = this.getAccountId();
    }

    const query = `${charlesSchwabMarketDataUrl}pricehistory`;
    const options = {
      uri: query,
      qs: {
        symbol,
        periodType: 'day',
        period: 2,
        frequencyType: 'minute',
        frequency: 1,
        endDate: Date.now()
      },
      headers: {
        Authorization: `Bearer ${this.access_token[accountId].token}`
      }
    };

    return request.get(options)
      .then((data) => {
        const response = this.processData(data);
        return QuoteService.convertTdIntraday(response.candles);
      });
  }

  getIntradayV2(symbol, period = 2, frequencyType = 'minute', frequency = 1, reply = null) {
    return this.renewAuth(this.getAccountId(), reply)
      .then(() => this.getIntradayPriceHistoryV2(symbol, period, frequencyType, frequency));
  }

  getAccountId() {
    let accountId;
    for (const id in this.access_token) {
      if (id && id !== 'null' && this.access_token[id]) {
        accountId = id;
      }
    }

    console.log('Using account id ', accountId);
    return accountId ? accountId : configurations.charles.accountId;
  }

  getIntradayPriceHistoryV2(symbol, period, frequencyType, frequency) {
    const accountId = this.getAccountId();

    if (!this.access_token[accountId] || !this.access_token[accountId].token) {
      return new Error('Token missing');
    }

    const query = `${charlesSchwabMarketDataUrl}pricehistory`;
    const options = {
      uri: query,
      qs: {
        symbol,
        periodType: 'day',
        period,
        frequencyType,
        frequency,
        endDate: Date.now()
      },
      headers: {
        Authorization: `Bearer ${this.access_token[accountId].token}`
      }
    };

    return request.get(options)
      .then((data) => {
        return this.processData(data);
      });
  }

  getIntradayV3(symbol, startDate = moment().subtract({ days: 1 }).valueOf(), endDate = moment().valueOf(), reply = null) {
    return this.renewAuth(this.getAccountId(), reply)
      .then(() => this.getIntradayPriceHistoryV3(symbol, moment(startDate).valueOf(), moment(endDate).valueOf()));
  }

  getIntradayPriceHistoryV3(symbol, startDate, endDate) {
    const accountId = this.getAccountId();

    const query = `${charlesSchwabMarketDataUrl}pricehistory`;
    const options = {
      uri: query,
      qs: {
        symbol,
        periodType: 'day',
        period: 2,
        frequencyType: 'minute',
        frequency: 1,
        startDate,
        endDate
      },
      headers: {
        Authorization: `Bearer ${this.access_token[accountId].token}`
      }
    };

    return request.get(options)
      .then((data) => {
        const response = this.processData(data);
        return QuoteService.convertTdIntradayV2(symbol, response.candles);
      })
      .catch(error => {
        console.log('Error on getIntradayPriceHistoryV3 request ', error);
        console.log('getIntradayPriceHistoryV3 request ', symbol, startDate, endDate);

        return error;
      });
  }

  getDailyQuotes(symbol, startDate, endDate, accountId, reply) {
    console.log(moment().format(), 'Retrieving daily quotes ');

    if (!this.access_token[accountId]) {
      console.log('missing access token');

      return this.renewAuth(accountId, reply)
        .then(() => this.getTDDailyQuotes(symbol, startDate, endDate, accountId));
    } else {
      return this.getTDDailyQuotes(symbol, startDate, endDate, accountId)
        .catch(error => {
          console.log(moment().format(), 'Error retrieving daily quotes ', error.error);

          return this.renewAuth(accountId, reply)
            .then(() => this.getTDDailyQuotes(symbol, startDate, endDate, accountId));
        });
    }
  }

  getDailyQuoteInternal(symbol, startDate, endDate, response = null) {
    let accountId;
    const accountIds = Object.getOwnPropertyNames(this.refreshTokensHash);
    if (accountIds.length > 0) {
      accountId = accountIds[0];
    } else {
      accountId = this.getAccountId();
    }
    if (!accountId) {
      console.log('Missing accountId');
    }
    return this.getDailyQuotes(symbol, startDate, endDate, accountId, response);
  }

  getTDDailyQuotes(symbol, startDate, endDate, accountId) {
    const query = `${charlesSchwabMarketDataUrl}pricehistory`;
    const options = {
      uri: query,
      qs: {
        symbol,
        periodType: 'month',
        frequencyType: 'daily',
        frequency: 1,
        startDate: startDate,
        endDate: endDate
      },
      headers: {
        Authorization: `Bearer ${this.access_token[accountId].token}`
      }
    };

    return request.get(options)
      .then((data) => {
        const response = this.processData(data);
        return QuoteService.convertTdIntraday(response.candles);
      });
  }

  getMarketData(symbol, accountId) {
    const query = `${charlesSchwabMarketDataUrl}${symbol}/quotes`;
    const options = {
      uri: query,
      qs: {
        fields: 'quote'
      },
      headers: {
        Authorization: `Bearer ${this.access_token[accountId].token}`
      }
    };
    return request.get(options);
  }

  processData(data) {
    return JSON.parse(data);
  }

  renewExpiredAccessTokenAndGetQuote(symbol, accountId, response) {
    return this.renewAuth(accountId, response)
      .then(() => {
        return this.getMarketData(symbol, accountId || this.getAccountId())
          .then(this.processData);
      });
  }

  sendBuyOrder(symbol,
    quantity,
    price,
    type = 'LIMIT',
    extendedHours = false, accountId, response) {
    return this.renewAuth(accountId, response)
      .then(() => {
        return this.tdBuy(symbol,
          quantity,
          price,
          type,
          extendedHours, accountId);
      });
  }


  sendMultiOrderSell(primaryArr,
    secondaryArr,
    price, accountId, response) {
    const orderLegCollection = [];
    primaryArr.forEach((order) => {
      const newOrder = {
        instruction: 'SELL_TO_CLOSE',
        quantity: order.quantity,
        instrument: {
          symbol: order.symbol,
          assetType: order.putCallInd ? 'OPTION' : 'EQUITY'
        }
      };
      orderLegCollection.push(newOrder)
    });
    secondaryArr.forEach((order) => {
      const newOrder = {
        instruction: 'SELL_TO_CLOSE',
        quantity: order.quantity,
        instrument: {
          symbol: order.symbol,
          assetType: order.putCallInd ? 'OPTION' : 'EQUITY'
        }
      };
      orderLegCollection.push(newOrder)
    });
    return this.renewAuth(accountId, response)
      .then(() => {
        const headers = {
          'Accept': '*/*',
          'Accept-Encoding': 'gzip',
          'Accept-Language': 'en-US',
          'Authorization': `Bearer ${this.access_token[accountId].token}`,
          'Content-Type': 'application/json',
        };

        const options = {
          uri: charlesSchwabTraderUrl + `accounts/${this.accountIdToHash[accountId]}/orders`,
          headers: headers,
          json: true,
          gzip: true,
          body: {
            orderType: 'NET_CREDIT',
            session: 'NORMAL',
            duration: 'DAY',
            orderStrategyType: 'SINGLE',
            complexOrderStrategyType: 'STRANGLE',
            price: price,
            orderLegCollection
          }
        };

        return request.post(options);
      });
  }
  sendTwoLegOrder(primarySymbol,
    secondarySymbol,
    quantity,
    price,
    type = 'NET_DEBIT',
    extendedHours = false, accountId, response) {
    return this.renewAuth(accountId, response)
      .then(() => {
        return this.tdTwoLegOrder(primarySymbol,
          secondarySymbol,
          quantity,
          price,
          type,
          extendedHours, accountId);
      });
  }

  tdTwoLegOrder(primaryLegSymbol,
    secondaryLegSymbol,
    quantity,
    price,
    type,
    extendedHours = false, accountId) {
    const headers = {
      'Accept': '*/*',
      'Accept-Encoding': 'gzip',
      'Accept-Language': 'en-US',
      'Authorization': `Bearer ${this.access_token[accountId].token}`,
      'Content-Type': 'application/json',
    };

    const options = {
      uri: charlesSchwabTraderUrl + `accounts/${this.accountIdToHash[accountId]}/orders`,
      headers: headers,
      json: true,
      gzip: true,
      body: {
        orderType: type,
        session: extendedHours ? 'SEAMLESS' : 'NORMAL',
        duration: 'DAY',
        orderStrategyType: 'SINGLE',
        complexOrderStrategyType: 'STRANGLE',
        price: price,
        orderLegCollection: [
          {
            instruction: 'BUY_TO_OPEN',
            quantity: quantity,
            instrument: {
              symbol: primaryLegSymbol,
              assetType: 'OPTION'
            }
          },
          {
            instruction: 'BUY_TO_OPEN',
            quantity: quantity,
            instrument: {
              symbol: secondaryLegSymbol,
              assetType: 'OPTION'
            }
          }
        ]
      }
    };

    return request.post(options);
  }

  tdBuy(symbol,
    quantity,
    price,
    type = 'LIMIT',
    extendedHours = false, accountId) {
    if (this.findOrder(symbol)) {
      return Promise.reject({ statusCode: 409, message: 'Order already exists' });
    }
    const headers = {
      'Accept': '*/*',
      'Accept-Encoding': 'gzip',
      'Accept-Language': 'en-US',
      'Authorization': `Bearer ${this.access_token[accountId].token}`,
      'Content-Type': 'application/json',
    };

    const options = {
      uri: charlesSchwabTraderUrl + `accounts/${this.accountIdToHash[accountId]}/orders`,
      headers: headers,
      json: true,
      gzip: true,
      body: {
        orderType: type,
        session: extendedHours ? 'SEAMLESS' : 'NORMAL',
        duration: 'DAY',
        orderStrategyType: 'SINGLE',
        price: price,
        taxLotMethod: 'LIFO',
        orderLegCollection: [
          {
            instruction: 'BUY',
            quantity: quantity,
            instrument: {
              symbol: symbol,
              assetType: 'EQUITY'
            }
          }
        ]
      }
    };
    this.addOrder(symbol);

    return request.post(options);
  }

  optionBuy(symbol,
    quantity,
    price,
    accountId, response) {
    if (this.findOrder(symbol)) {
      return Promise.reject({ statusCode: 409, message: 'Order already exists' });
    }
    const headers = {
      'Accept': '*/*',
      'Accept-Encoding': 'gzip',
      'Accept-Language': 'en-US',
      'Authorization': `Bearer ${this.access_token[accountId].token}`,
      'Content-Type': 'application/json',
    };

    const options = {
      uri: charlesSchwabTraderUrl + `accounts/${this.accountIdToHash[accountId]}/orders`,
      headers: headers,
      json: true,
      gzip: true,
      body: {
        "complexOrderStrategyType": "NONE",
        "orderType": "LIMIT",
        "session": "NORMAL",
        "price": price,
        "duration": "DAY",
        "orderStrategyType": "SINGLE",
        "orderLegCollection": [
          {
            "instruction": "BUY_TO_OPEN",
            "quantity": quantity,
            "instrument": {
              "symbol": symbol,
              "assetType": "OPTION"
            }
          }
        ]
      }
    };

    return this.renewAuth(accountId, response)
      .then(() => {
        this.addOrder(symbol);
        return request.post(options);
      });
  }

  optionSell(symbol,
    quantity,
    price,
    accountId, response) {
    const headers = {
      'Accept': '*/*',
      'Accept-Encoding': 'gzip',
      'Accept-Language': 'en-US',
      'Authorization': `Bearer ${this.access_token[accountId].token}`,
      'Content-Type': 'application/json',
    };

    const options = {
      uri: charlesSchwabTraderUrl + `accounts/${this.accountIdToHash[accountId]}/orders`,
      headers: headers,
      json: true,
      gzip: true,
      body: {
        "complexOrderStrategyType": "NONE",
        "orderType": "LIMIT",
        "session": "NORMAL",
        "price": price,
        "duration": "DAY",
        "orderStrategyType": "SINGLE",
        "orderLegCollection": [
          {
            "instruction": "SELL_TO_CLOSE",
            "quantity": quantity,
            "instrument": {
              "symbol": symbol,
              "assetType": "OPTION"
            }
          }
        ]
      }
    };

    return this.renewAuth(accountId, response)
      .then(() => {
        return request.post(options);
      });
  }

  sendSellOrder(symbol,
    quantity,
    price,
    type = 'LIMIT',
    extendedHours = false, accountId, response) {
    return this.sendPositionRequest(accountId)
      .then((pos) => {
        const foundPosition = pos.securitiesAccount.positions.find((position) => {
          return position.instrument.symbol === symbol;
        });
        if (foundPosition) {
          quantity = foundPosition.longQuantity > quantity ? quantity : foundPosition.longQuantity;
          return this.tdSell(symbol,
            quantity,
            price,
            type,
            extendedHours, accountId);
        } else {
          throw new Error('Position not found');
        }
      });
  }

  tdSell(symbol,
    quantity,
    price,
    type = 'LIMIT',
    extendedHours = false, accountId) {
    const headers = {
      'Accept': '*/*',
      'Accept-Encoding': 'gzip',
      'Accept-Language': 'en-US',
      'Authorization': `Bearer ${this.access_token[accountId].token}`,
      'Content-Type': 'application/json',
    };

    const options = {
      uri: charlesSchwabTraderUrl + `accounts/${this.accountIdToHash[accountId]}/orders`,
      headers: headers,
      json: true,
      gzip: true,
      body: {
        orderType: type,
        session: extendedHours ? 'SEAMLESS' : 'NORMAL',
        duration: 'DAY',
        orderStrategyType: 'SINGLE',
        taxLotMethod: 'LIFO',
        orderLegCollection: [
          {
            instruction: 'SELL',
            quantity: quantity,
            instrument: {
              symbol: symbol,
              assetType: 'EQUITY'
            }
          }
        ]
      }
    };

    if (type === 'limit') {
      options.body['price'] = price;
    }

    return request.post(options);
  }

  getPositions(accountId) {
    return this.sendPositionRequest(accountId)
      .then((pos) => {
        if (process.env.reportUrl && (!this.lastPositionCheck || moment().diff(moment(this.lastPositionCheck), 'hours') > 1)) {
          this.lastPositionCheck = moment();
          DatabaseService.update({ positions: pos.securitiesAccount.positions }, 'stock_portfolio', 'portfolio', { name: '1' });
        }
        return pos.securitiesAccount.positions;
      });
  }

  async addProfitLoss(accountId: string,
    date,
    lastRiskTolerance,
    lastStrategy,
    profit) {
    return await DatabaseService.update({
      accountId,
      date,
      lastRiskTolerance,
      lastStrategy,
      profit
    }, 'stock_portfolio', 'profitLoss', { date: date });
  }

  getProfitLoss() {
    return DatabaseService.getRecords('stock_portfolio', 'profitLoss');
  }

  deleteOldProfitLoss() {
    return DatabaseService.deleteOldRecords('stock_portfolio', 'profitLoss');
  }

  async addStrategy(date, type, key, strategy, reason) {
    return await DatabaseService.update({
      date,
      type,
      key,
      strategy,
      reason
    }, 'stock_portfolio', 'strategies', { key: key });
  }

  getStrategy() {
    return DatabaseService.getRecords('stock_portfolio', 'strategies');
  }

  deleteOldStrategy() {
    return DatabaseService.deleteOldRecords('stock_portfolio', 'strategies');
  }

  getTdBalance(accountId, response) {
    return this.renewAuth(accountId, response)
      .then(() => {
        return this.sendPositionRequest(accountId)
          .then((pos) => {
            return pos.securitiesAccount.currentBalances;
          });
      });
  }

  sendPositionRequest(accountId) {
    const query = `${charlesSchwabTraderUrl}accounts/${this.accountIdToHash[accountId]}`;
    const options = {
      uri: query,
      qs: {
        fields: 'positions'
      },
      headers: {
        Authorization: `Bearer ${this.access_token[accountId].token}`
      }
    };

    return request.get(options)
      .then((data) => {
        return this.processData(data);
      });
  }

  setCredentials(accountId, key, refreshToken, response) {
    this.refreshTokensHash[accountId] = refreshToken;
    // this.refreshAccessToken(accountId);
    response.status(200).send();
  }

  isSet(accountId, response, cookie) {
    accountId = accountId || this.getAccountId();
    this.useCookieOrEnvironmentVariable(cookie);
    this.lastTokenRequest = null;
    this.refreshAccessToken(accountId)
      .then(res => {
        response.status(200).send(res);
      })
      .catch(err => {
        response.status(404).send(err);
      });
  }

  deleteCredentials(accountId, response) {
    this.refreshTokensHash[accountId] = null;
    this.access_token[accountId] = null;
    this.lastTokenRequest = null;
    response.status(200).send({});
  }

  getOptionsStrangle(accountId, symbol, strikeCount, optionType = 'S', response) {
    if (!accountId) {
      accountId = this.getAccountId();
    }

    return this.renewAuth(accountId, response)
      .then(() => {
        const query = `${charlesSchwabMarketDataUrl}chains`;
        const options = {
          uri: query,
          qs: {
            symbol,
            strikeCount,
            strategy: 'STRADDLE',
            range: 'SNK',
            optionType
          },
          headers: {
            Authorization: `Bearer ${this.access_token[accountId].token}`
          }
        };
        return request.get(options)
          .then((data) => {
            return this.processData(data);
          });
      });
  }

  getEquityMarketHours(date: string, response) {
    const accountId = this.getAccountId();
    const query = `${charlesSchwabMarketDataUrl}markets`;
    const options = {
      uri: query,
      qs: {
        markets: 'equity',
        date
      },
      headers: {
        Authorization: `Bearer ${this.access_token[accountId].token}`
      }
    };

    return request.get(options)
      .then(this.processData)
      .catch(error => {
        for (const key in error) {
          console.log('error getting equity market hours', key);
        }
        return this.renewAuth(accountId, response);
      });
  }

  getInstrument(cusip: string) {
    const accountId = this.getAccountId();

    //const query = `${tdaUrl}instruments/${cusip}`;
    const url = `${charlesSchwabMarketDataUrl}instruments?symbol=${cusip}&projection=fundamental`;

    const options = {
      uri: url,
      headers: {
        Authorization: `Bearer ${this.access_token[accountId].token}`
      }
    };

    return request.get(options)
      .then(this.processData);
  }

  getUserPreferences(accountId: string) {
    accountId = accountId ? accountId : this.getAccountId();

    const url = `${charlesSchwabTraderUrl}userPreference`;

    const options = {
      uri: url,
      headers: {
        Authorization: `Bearer ${this.access_token[accountId].token}`
      }
    };

    return request.get(options)
      .then(this.processData);
  }
}

export default new PortfolioService();
