import * as axios from 'axios';
import * as qs from 'qs';

export interface ApiResponse {
  data: any;
  status: number;
  statusText: string;
  headers: any;
  config: any;
  request: any;
  json: any;
}

export enum OptionsStrategy {
  SINGLE = 0,
  ANALYTICAL = 1,
  COVERED = 2,
  VERTICAL = 3,
  CALENDAR = 4,
  STRANGLE = 5,
  STRADDLE = 6,
  BUTTERFLY = 7,
  CONDOR = 8,
  DIAGONAL = 9,
  COLLAR = 10,
  ROLL = 11
}

export enum ContractType {
  CALL = 0,
  PUT = 1,
  ALL = 2
}

const host = 'https://api.schwabapi.com/v1';
const charlesSchwabTraderUrl = 'https://api.schwabapi.com/trader/v1/';
const charlesSchwabMarketDataUrl = 'https://api.schwabapi.com/marketdata/v1/';

export function getAuthorization(appKey: string, appSecret: string): string {
  return Buffer.from(`${appKey}:${appSecret}`).toString('base64');
}

export function authorize(appKey: string, appCallbackUrl: string): Promise<ApiResponse> {
  const path = '/oauth/authorize';
  const url = `${host}${path}?client_id=${appKey}&redirect_uri=${appCallbackUrl}`;
  return axios.default({
    method: 'get',
    url
  });
}

export function getAccessToken(
  appKey: string,
  appSecret: string,
  grant_type: string,
  code: string,
  redirect_uri: string
): Promise<ApiResponse> {
  const path = '/oauth/token';
  const url = `${host}${path}`;
  const data = {
    grant_type,
    code,
    redirect_uri
  };

  const options = {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${getAuthorization(appKey, appSecret)}`
    },
    data: qs.stringify(data),
    url
  };

  return axios.default(options);
}

export function refreshAccessToken(
  appKey: string,
  appSecret: string,
  refreshToken: string
): Promise<any> {
  const path = '/oauth/token';
  const url = `${host}${path}`;
  const data = {
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  };

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${getAuthorization(appKey, appSecret)}`
    },
    data: qs.stringify(data),
    url
  };

  return axios.default(options);
}

export function getAccountNumbersHashValues(accessToken: string): Promise<any> {
  const url = `${host}accounts/accountNumbers`;
  const options = {
    method: 'GET',
    url,
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  };

  return axios.default(options);
}

export function getMarketData(accessToken: string, symbol: string): Promise<any> {
  const query = `${charlesSchwabMarketDataUrl}${symbol}/quotes`;
  const options = {
    url: query,
    params: {
      fields: 'quote'
    },
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  };

  return axios.default(options);
}

export function getPriceHistory(
  accessToken: string,
  symbol: string,
  periodType: string = 'day',
  period: number = 2,
  frequencyType: string = 'minute',
  frequency: number = 1,
  startDate: number = null,
  endDate: number = Date.now(),
  needExtendedHoursData: boolean = false,
  needPreviousClose: boolean = false
): Promise<any> {
  const query = `${charlesSchwabMarketDataUrl}pricehistory`;
  const params: any = {
    symbol,
    periodType,
    period,
    frequencyType,
    frequency,
    endDate,
    needExtendedHoursData,
    needPreviousClose
  };

  if (startDate) {
    params.startDate = startDate;
  }

  const options = {
    url: query,
    params,
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  };

  return axios.default(options);
}

export function placeOrder(
  accessToken: string,
  accountNumberHashValue: string,
  orderBody: any
): Promise<any> {
  const headers = {
    Accept: '*/*',
    'Accept-Encoding': 'gzip',
    'Accept-Language': 'en-US',
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  const options = {
    url: charlesSchwabTraderUrl + `accounts/${accountNumberHashValue}/orders`,
    headers: headers,
    json: true,
    gzip: true,
    data: orderBody
  };

  return axios.default(options);
}

export function getPositions(accessToken: string, accountNumberHashValue: string): Promise<any> {
  const query = `${charlesSchwabTraderUrl}accounts/${accountNumberHashValue}`;
  const options = {
    url: query,
    params: {
      fields: 'positions'
    },
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  };

  return axios.default(options);
}

export function createDefaultOptionsChainRequestParams(
  symbol: string,
  contractType: ContractType,
  includeUnderlyingQuote: boolean,
  strikeCount: number,
  strategy: OptionsStrategy,
  optionType: string = 'S'
): any {
  return {
    symbol,
    strikeCount,
    strategy,
    range: 'SNK',
    optionType,
    contractType
  };
}

export function getOptionsChain(accessToken: string, params: any): Promise<any> {
  const query = `${charlesSchwabMarketDataUrl}chains`;
  const options = {
    url: query,
    params,
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  };

  return axios.default(options);
}

export function getEquityMarketHours(
  accessToken: string,
  date: string,
  markets: string = 'equity'
): Promise<any> {
  const query = `${charlesSchwabMarketDataUrl}markets`;
  const options = {
    url: query,
    params: {
      markets,
      date
    },
    headers: {
      Authorization: `Basic ${accessToken}`
    }
  };

  return axios.default(options);
}

export function getInstrument(
  accessToken: string,
  cusip: string,
  projection: string = 'fundamental'
): Promise<any> {
  const url = `${charlesSchwabMarketDataUrl}instruments?symbol=${cusip}&projection=${projection}`;
  const options = {
    url: url,
    headers: {
      Authorization: `Basic ${accessToken}`
    }
  };

  return axios.default(options);
}
