import * as moment from 'moment';
import * as _ from 'lodash';
import * as tulind from 'tulind';

import QuoteService from '../quote/quote.service';

export type RotationQuadrant = 'Leading' | 'Weakening' | 'Lagging' | 'Improving';

export interface SectorRotationResult {
  ticker: string;
  name: string;
  category: string;
  rsRatio: number;
  rsMomentum: number;
  quadrant: RotationQuadrant;
  date: string;
}

export interface SectorConfig {
  ticker: string;
  name: string;
  category: 'GICS' | 'Factor' | 'SubSector';
}

class SectorRotationService {
  private readonly BENCHMARK = 'SPY';
  
  // The 16 target major sectors, sub-sectors, and factors
  private readonly SECTORS: SectorConfig[] = [
    { ticker: 'XLK', name: 'Technology', category: 'GICS' },
    { ticker: 'XLF', name: 'Financials', category: 'GICS' },
    { ticker: 'XLV', name: 'Health Care', category: 'GICS' },
    { ticker: 'XLY', name: 'Consumer Discretionary', category: 'GICS' },
    { ticker: 'XLI', name: 'Industrials', category: 'GICS' },
    { ticker: 'XLC', name: 'Communication Services', category: 'GICS' },
    { ticker: 'XLP', name: 'Consumer Staples', category: 'GICS' },
    { ticker: 'XLE', name: 'Energy', category: 'GICS' },
    { ticker: 'XLU', name: 'Utilities', category: 'GICS' },
    { ticker: 'XLRE', name: 'Real Estate', category: 'GICS' },
    { ticker: 'XLB', name: 'Materials', category: 'GICS' },
    { ticker: 'SMH', name: 'Semiconductors', category: 'SubSector' },
    { ticker: 'IBB', name: 'Biotech', category: 'SubSector' },
    { ticker: 'XHB', name: 'Homebuilders', category: 'SubSector' },
    { ticker: 'KRE', name: 'Regional Banking', category: 'SubSector' },
    { ticker: 'IWO', name: 'Small-Cap Growth', category: 'Factor' }
  ];

  constructor() {}

  /**
   * Helper to compute operational date ranges identical to your existing tools
   */
  private getDateRanges(currentDate: string, lookbackDays: number) {
    const current = moment(currentDate);
    // 260 trading days provides roughly 1 full calendar year of sequence depth
    const start = moment(currentDate).subtract(lookbackDays, 'days');
    return {
      end: current.format('YYYY-MM-DD'),
      start: start.format('YYYY-MM-DD')
    };
  }

  /**
   * Calculates the full 16-sector Relative Rotation Engine against SPY
   */
  public async computeSectorRotation(currentDate: string = moment().format(), lookbackDays: number = 360): Promise<SectorRotationResult[]> {
    const { end, start } = this.getDateRanges(currentDate, lookbackDays);
    
    // 1. Fetch benchmark quotes
    const benchmarkQuotes = await QuoteService.getDailyQuotes(this.BENCHMARK, end, start);
    if (!benchmarkQuotes || benchmarkQuotes.length === 0) {
      throw new Error(`Failed to retrieve benchmark quotes for ${this.BENCHMARK}`);
    }

    const benchmarkMap = new Map<string, number>();
    benchmarkQuotes.forEach(q => {
      if (q.date && q.close) {
        benchmarkMap.set(moment(q.date).format('YYYY-MM-DD'), q.close);
      }
    });

    const rotationResults: SectorRotationResult[] = [];

    // 2. Iterate and process all 16 configurations asynchronously
    for (const sector of this.SECTORS) {
      try {
        const sectorQuotes = await QuoteService.getDailyQuotes(sector.ticker, end, start);
        if (!sectorQuotes || sectorQuotes.length === 0) continue;

        // Sync and align dates to protect moving average integrity
        const alignedRawRs: number[] = [];
        let lastValidDate = '';

        sectorQuotes.forEach(q => {
          const dateStr = moment(q.date).format('YYYY-MM-DD');
          if (benchmarkMap.has(dateStr) && q.close) {
            const benchClose = benchmarkMap.get(dateStr)!;
            // Base RS Calculation
            alignedRawRs.push((q.close / benchClose) * 100);
            lastValidDate = dateStr;
          }
        });

        if (alignedRawRs.length < 40) continue; // Ensure statistical relevance deep enough for double-smoothing

        // 3. Compute RS-Ratio via double WMA smoothing
        const basePeriod = 14;
        const firstWma = await tulind.indicators.wma.indicator([alignedRawRs], [basePeriod]);
        const rsRatioSeries = await tulind.indicators.wma.indicator([firstWma[0]], [basePeriod]);

        // 4. Compute RS-Momentum using Rate of Change over the double-smoothed trend
        const momentumSeries = await tulind.indicators.roc.indicator([rsRatioSeries[0]], [basePeriod]);

        // Take last historical coordinates to determine status
        const currentRsRatio = rsRatioSeries[0][rsRatioSeries[0].length - 1];
        const currentMomentumRaw = momentumSeries[0][momentumSeries[0].length - 1];

        // Normalize Momentum around center baseline point of 100
        const normalizedMomentum = 100 + currentMomentumRaw;

        rotationResults.push({
          ticker: sector.ticker,
          name: sector.name,
          category: sector.category,
          rsRatio: _.round(currentRsRatio, 2),
          rsMomentum: _.round(normalizedMomentum, 2),
          quadrant: this.determineQuadrant(currentRsRatio, normalizedMomentum),
          date: lastValidDate
        });
      } catch (err) {
        console.error(`Error processing rotation matrices for ${sector.ticker}:`, err);
      }
    }

    return rotationResults;
  }

  /**
   * Evaluates quadrants based on standard 100-level baseline centers
   */
  private determineQuadrant(rsRatio: number, rsMomentum: number): RotationQuadrant {
    if (rsRatio >= 100 && rsMomentum >= 100) return 'Leading';
    if (rsRatio >= 100 && rsMomentum < 100) return 'Weakening';
    if (rsRatio < 100 && rsMomentum < 100) return 'Lagging';
    return 'Improving';
  }
}

export default new SectorRotationService();