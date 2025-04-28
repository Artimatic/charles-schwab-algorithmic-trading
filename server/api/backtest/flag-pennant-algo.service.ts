import { Indicators } from "./backtest.constants";

/**
 * Helper function to detect a flag or pennant formation.
 *
 * This function analyzes historical stock data to identify potential flag or
 * pennant chart patterns.  It looks for converging trendlines (or nearly
 * converging lines) after a preceding trend. This implementation is a
 * simplification. Real-world pattern recognition requires more robust
 * techniques, including handling noise, variations in pattern shape, and
 * confirmation signals.
 *
 * NOTE: This example focuses on the *geometric* shape. Volume analysis is
 * typically a critical part of flag/pennant identification, which this example omits.
 *
 * @param historicalData An array of historical stock price data. Each element
 *                       should be an object with `high` and `low` properties
 *                       representing the high and low prices for that period.
 * @param formationStartIndex The index in the historicalData array where the
 *                            flag/pennant formation is suspected to begin.
 * @param formationPeriod The number of periods to consider for the formation.
 * @param convergenceThreshold The maximum allowed difference in slope between
 *                             the upper and lower trendlines for the pattern to
 *                             be considered a flag or pennant.  Adjust this
 *                             based on the data's noise level.
 * @returns True if a flag or pennant formation is detected, false otherwise.
 *          Returns null if there isn't enough data to analyze.
 */
function isFlagPennantFormation(
    historicalData: any[],
    formationStartIndex: number,
    formationPeriod: number,
    convergenceThreshold: number
): FlagPennantFormationResult | null {
    if (formationStartIndex + formationPeriod > historicalData.length) {
        return { status: false}; // Not enough data
    }

    if (formationPeriod < 5) { // Minimum number of periods for analysis
        console.warn("Formation period too short for reliable pattern detection.");
        return { status: false};
    }

    // 1. Calculate Upper Trendline (connecting highs)
    const upperTrendlinePoints: { x: number; y: number }[] = [];
    for (let i = formationStartIndex; i < formationStartIndex + formationPeriod; i++) {
        upperTrendlinePoints.push({ x: i - formationStartIndex, y: historicalData[i].high }); //Normalize X to 0.
    }
    const upperTrendline = calculateLinearRegression(upperTrendlinePoints);

    // 2. Calculate Lower Trendline (connecting lows)
    const lowerTrendlinePoints: { x: number; y: number }[] = [];
    for (let i = formationStartIndex; i < formationStartIndex + formationPeriod; i++) {
        lowerTrendlinePoints.push({ x: i - formationStartIndex, y: historicalData[i].low }); //Normalize X to 0.
    }
    const lowerTrendline = calculateLinearRegression(lowerTrendlinePoints);

    // 3. Check for Convergence (or near-convergence)
    const slopeDifference = Math.abs(upperTrendline.slope - lowerTrendline.slope);

    return {
        status: slopeDifference <= convergenceThreshold,
        lowerTrendline,
        upperTrendline
    }
}


/**
 * Helper function to determine if a breakout has occurred from a flag or pennant formation.
 *
 * This function checks if the price has broken out above the upper trendline
 * of a flag or pennant formation. It's a simplified implementation; real-world
 * breakout detection often involves additional considerations like volume surges
 * and candlestick patterns.
 *
 * @param historicalData An array of historical stock price data. Each element
 *                       should be an object with `close`, `high`, and `low`
 *                       properties.
 * @param formationStartIndex The index in the historicalData array where the
 *                            flag/pennant formation begins.
 * @param formationPeriod The number of periods to consider for the formation.
 * @returns `true` if a breakout is detected, `false` otherwise.  Returns
 *           `null` if there's insufficient data.
 */
function isBreakoutOccurred(
    historicalData: any[],
    formationStartIndex: number,
    formationPeriod: number
): boolean | null {

    if (formationStartIndex + formationPeriod >= historicalData.length) {
        return null; // Not enough data.  Need data *after* formation.
    }


    // 1. Calculate Upper Trendline
    const upperTrendlinePoints: { x: number; y: number }[] = [];
    for (let i = formationStartIndex; i < formationStartIndex + formationPeriod; i++) {
        upperTrendlinePoints.push({ x: i - formationStartIndex, y: historicalData[i].high });
    }
    const upperTrendline = calculateLinearRegression(upperTrendlinePoints);

    // 2. Check if the price broke above the upper trendline *after* the formation period.
    //   We check one period *after* the formation end to allow for a true breakout.
    const breakoutIndex = formationStartIndex + formationPeriod;

    if (historicalData[breakoutIndex].close > (upperTrendline.slope * formationPeriod + upperTrendline.intercept)) {
        return true; // Breakout confirmed
    } else {
        return false; // No breakout
    }
}

interface FlagPennantFormationResult {
    status: boolean;
    lowerTrendline?: { slope: number; intercept: number; };
    upperTrendline?: { slope: number; intercept: number; };
}

export interface TradingPatternData {
    steepPrecedingTrend: boolean;
    lowerTrendline?: { slope: number; intercept: number; };
    upperTrendline?: { slope: number; intercept: number; };
    flagPennantFormation: boolean;
    breakoutOccurred: boolean;
    breakoutDirection: 'up' | 'down';
    measuredRuleTargetMet: boolean;
}

export function findStocksMatchingTradingPattern(
    historicalData: Indicators[],
    patternData: TradingPatternData,
    trendStartIndex: number = 0,
    formationStartIndex: number = 0
): TradingPatternData {
    // 1. Calculate Steep Preceding Trend
    const periodForTrend = 20;
    const steepnessThresholdValue = 0.5;

    const isSteepTrend = isSteepPrecedingTrend(
        historicalData,
        trendStartIndex,
        periodForTrend,
        steepnessThresholdValue
    );

    if (!isSteepTrend) {
        return patternData;
    }

    patternData.steepPrecedingTrend = true;


    // 2. Calculate Flag/Pennant Formation
    const formationPeriodValue = 15; // Number of periods to analyze for the formation
    const convergenceThresholdValue = 0.1; // Adjust based on data's noise level

    const formation = isFlagPennantFormation(
        historicalData,
        formationStartIndex,
        formationPeriodValue,
        convergenceThresholdValue
    );

    if (!formation.status) {
        return patternData;
    }

    patternData.lowerTrendline = formation.lowerTrendline;
    patternData.upperTrendline = formation.upperTrendline;

    patternData.flagPennantFormation = true; //Update pattern data

    // 3. Check for Breakout
    const breakoutResult = isBreakoutOccurred(historicalData, formationStartIndex, formationPeriodValue);

    if (!breakoutResult) {
        return patternData;
    }
    patternData.breakoutOccurred = true;  //Update pattern data
    patternData.measuredRuleTargetMet = true;

    return patternData;
}


/**
 * Helper function to calculate linear regression (least squares)
 * y = mx + b
 */
function calculateLinearRegression(data: { x: number; y: number }[]): { slope: number; intercept: number } {
    // Implementation is the same as in the previous responses
    const n = data.length;

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    for (const point of data) {
        sumX += point.x;
        sumY += point.y;
        sumXY += point.x * point.y;
        sumX2 += point.x * point.x;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
}

/**
 * Helper function to calculate the steepness of a preceding trend.
 * This function analyzes a portion of historical stock data to determine if a steep
 * uptrend exists. It calculates the average price increase over a specified
 * period and compares it to a threshold.  This is a simplified implementation.
 * Real-world implementations require more sophisticated techniques for trend
 * detection and smoothing.
 * @param historicalData An array of historical stock price data. Each element
 *                       should be an object with a `close` property representing
 *                       the closing price for that period.
 * @param startIndex The index in the historicalData array where the trend analysis
 *                   should begin.
 * @param period The number of periods to consider for the trend analysis.
 * @param steepnessThreshold The minimum average price increase per period required
 *                           to consider the trend "steep".  This value should be
 *                           calibrated based on the typical volatility of the
 *                           stocks being analyzed.
 * @returns True if a steep uptrend is detected, false otherwise.  Returns null
 *          if there isn't enough data to analyze.
 */
function isSteepPrecedingTrend(
    historicalData: any[],
    startIndex: number,
    period: number,
    steepnessThreshold: number
): boolean | null {
    if (startIndex + period > historicalData.length) {
        return null; // Not enough data
    }

    let totalPriceIncrease = 0;
    for (let i = startIndex; i < startIndex + period - 1; i++) {
        const priceIncrease = historicalData[i + 1].close - historicalData[i].close;
        totalPriceIncrease += priceIncrease;
    }

    const averagePriceIncrease = totalPriceIncrease / period;

    return averagePriceIncrease >= steepnessThreshold;
}

// const exampleMatchResult = findStocksMatchingTradingPattern("ExampleStock", sampleHistoricalData, patternDataForExample, 10, 20);  //Trend from 10, Formation from 20.
// console.log("Example Match Result:", exampleMatchResult);
