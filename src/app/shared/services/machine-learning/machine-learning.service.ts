import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpHeaders
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AiPicksPredictionDate } from '../ai-picks.service';

const BASE_URL = environment.appUrl;

interface MLResult {
  nextOutput: number;
  algorithm: string;
  correct: number;
  guesses: number;
  predictionHistory: AiPicksPredictionDate[];
  score: number;
  symbol: string;
}

@Injectable({
  providedIn: 'root'
})
export class MachineLearningService {

  constructor(private http: HttpClient) { }

  trainDaytrade(symbol: string,
    endDate: string = null,
    startDate: string = null,
    trainingSize: number,
    features: number[] = []) {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const options = {
      headers: headers,
      params: {
        symbol,
        startDate,
        endDate,
        trainingSize: String(trainingSize),
        features: null
      }
    };

    if (features) {
      options.params.features = String(features);
    }
    return this.http.get<MLResult[]>(`${BASE_URL}api/machine-learning/v3/train-intraday`,
      options);
  }

  activate(symbol: string,
    features: number[] = []): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const options = {
      headers: headers,
      params: {
        symbol,
        features: null
      }
    };

    if (features) {
      options.params.features = String(features);
    }

    return this.http.get(`${BASE_URL}api/machine-learning/v3/activate`, options);
  }

  activateBuyAtCloseModel(symbol, startDate, inputData): Observable<any> {
    const data = {
      symbol,
      startDate,
      inputData
    };

    return this.http.post(`${BASE_URL}api/machine-learning/activate-at-close-model`, data, {});
  }

  getQuotes(symbol: string, startDate: string, endDate: string): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const options = {
      headers: headers,
      params: {
        symbol,
        startDate,
        endDate
      }
    };

    return this.http.get(`${BASE_URL}api/machine-learning/v3/quotes`, options);
  }

  getIndicators(quotes: any): Observable<any> {

    const data = {
      quotes
    };

    return this.http.post(`${BASE_URL}api/machine-learning/v3/indicators`, data, {});
  }

  activateModel(symbol: string, indicatorData: any, features: number[] = []): Observable<any> {

    const data = {
      symbol,
      indicatorData: indicatorData,
      features: String(features)
    };

    return this.http.post(`${BASE_URL}api/machine-learning/v3/activate-model`, data, {});
  }

  trainPredictDailyV4(symbol: string,
    endDate: string = null,
    startDate: string = null,
    trainingSize: number,
    features: number[] = [],
    range: number,
    limit: number): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const options = {
      headers: headers,
      params: {
        symbol,
        startDate,
        endDate,
        trainingSize: String(trainingSize),
        features: null,
        range: String(range),
        limit: String(limit)
      }
    };

    if (features) {
      options.params.features = String(features);
    }
    return this.http.get(`${BASE_URL}api/machine-learning/v4/train-daily`,
      options);
  }

  getPredictDailyDataV4(symbol: string,
    endDate: string = null,
    startDate: string = null,
    trainingSize: number,
    features: number[] = [],
    range: number,
    limit: number): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const options = {
      headers: headers,
      params: {
        symbol,
        startDate,
        endDate,
        trainingSize: String(trainingSize),
        features: null,
        range: String(range),
        limit: String(limit)
      }
    };

    if (features) {
      options.params.features = String(features);
    }
    return this.http.get(`${BASE_URL}api/machine-learning/v4/get-data`,
      options);
  }

  activateDailyV4(symbol: string,
    features: number[] = [],
    range: number,
    limit: number): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const options = {
      headers: headers,
      params: {
        symbol,
        features: null,
        range: String(range),
        limit: String(limit)
      }
    };

    if (features) {
      options.params.features = String(features);
    }

    return this.http.get(`${BASE_URL}api/machine-learning/v4/activate-daily`, options);
  }

  scoreDailyV4(symbol: string,
    endDate: string = null,
    startDate: string = null): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const options = {
      headers: headers,
      params: {
        symbol,
        startDate,
        endDate
      }
    };
    return this.http.get(`${BASE_URL}api/machine-learning/v4/score-daily`, options);
  }

  trainTradingPair(symbol1: string,
    symbol2: string,
    endDate: string = null,
    startDate: string = null,
    trainingSize: number,
    features: number[] = [],
    range: number,
    limit: number): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const options = {
      headers: headers,
      params: {
        symbol1,
        symbol2,
        startDate,
        endDate,
        trainingSize: String(trainingSize),
        features: features ? String(features) : null,
        range: String(range),
        limit: String(limit)
      }
    };

    return this.http.get(`${BASE_URL}api/machine-learning/train/pair-trade`,
      options);
  }

  trainSellOff(symbol: string,
    endDate: string = null,
    startDate: string = null,
    trainingSize: number,
    features: number[] = [],
    range: number,
    limit: number): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const options = {
      headers: headers,
      params: {
        symbol,
        startDate,
        endDate,
        trainingSize: String(trainingSize),
        features: features ? String(features) : null,
        range: String(range),
        limit: String(limit)
      }
    };

    return this.http.get(`${BASE_URL}api/machine-learning/train/sell-model`,
      options);
  }

  trainBuy(symbol: string,
    endDate: string = null,
    startDate: string = null,
    trainingSize: number,
    features: number[] = [],
    range: number,
    limit: number): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const options = {
      headers: headers,
      params: {
        symbol,
        startDate,
        endDate,
        trainingSize: String(trainingSize),
        features: features ? String(features) : null,
        range: String(range),
        limit: String(limit)
      }
    };

    return this.http.get(`${BASE_URL}api/machine-learning/train/buy-model`,
      options);
  }
  
  activateBuy(symbol: string,
    endDate: string = null,
    startDate: string = null,
    trainingSize: number,
    features: number[] = [],
    range: number,
    limit: number): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const options = {
      headers: headers,
      params: {
        symbol,
        startDate,
        endDate,
        trainingSize: String(trainingSize),
        features: features ? String(features) : null,
        range: String(range),
        limit: String(limit)
      }
    };

    return this.http.get(`${BASE_URL}api/machine-learning/activate/buy-model`,
      options);
  }
  
  activateSell(symbol: string,
    endDate: string = null,
    startDate: string = null,
    trainingSize: number,
    features: number[] = [],
    range: number,
    limit: number): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const options = {
      headers: headers,
      params: {
        symbol,
        startDate,
        endDate,
        trainingSize: String(trainingSize),
        features: features ? String(features) : null,
        range: String(range),
        limit: String(limit)
      }
    };

    return this.http.get(`${BASE_URL}api/machine-learning/activate/sell-model`,
      options);
  }

  trainVolatility(endDate: string = null,
    startDate: string = null,
    trainingSize: number,
    range: number,
    limit: number): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const options = {
      headers: headers,
      params: {
        startDate,
        endDate,
        trainingSize: String(trainingSize),
        range: String(range),
        limit: String(limit)
      }
    };

    return this.http.get(`${BASE_URL}api/machine-learning/train/volatility-model`,
      options);
  }

  trainMfiBuy(symbol: string, endDate: string = null,
    startDate: string = null, trainingSize: number,
    range: number, limit: number): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const options = {
      headers: headers,
      params: {
        symbol,
        startDate,
        endDate,
        trainingSize: String(trainingSize),
        range: String(range),
        limit: String(limit)
      }
    };

    return this.http.get(`${BASE_URL}api/machine-learning/train/mfi-model`,
      options);
  }

  getFoundPatterns(): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const options = {
      headers: headers
    };
    return this.http.get(`${BASE_URL}api/machine-learning/v4/get-patterns`, options);
  }
}
