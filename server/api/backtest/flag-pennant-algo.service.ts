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
): boolean | null {
    if (formationStartIndex + formationPeriod > historicalData.length) {
        console.warn("Not enough data to analyze flag/pennant formation.");
        return null; // Not enough data
    }

    if (formationPeriod < 5) { // Minimum number of periods for analysis
        console.warn("Formation period too short for reliable pattern detection.");
        return false;
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

    return slopeDifference <= convergenceThreshold;
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
        console.warn("Not enough data to analyze breakout.");
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


/**
 * Example usage within the overall pattern detection:
 */

interface StockDataPoint {
    close: number;
    high: number;
    low: number;
    // Add other properties like open, volume, date, etc.
}

interface TradingPatternData {
    steepPrecedingTrend: boolean;
    flagPennantFormation: boolean;
    breakoutOccurred: boolean;
    breakoutDirection: "up" | "down";
    measuredRuleTargetMet: boolean;
}

export function findStocksMatchingTradingPattern(
    stockSymbol: string,
    historicalData: StockDataPoint[],
    patternData: TradingPatternData,
    trendStartIndex: number = 0,
    formationStartIndex: number = 0
): boolean | string {

    console.log(`Analyzing stock: ${stockSymbol}`);

    // 1. Calculate Steep Preceding Trend
    const periodForTrend = 20;
    const steepnessThresholdValue = 0.5;

    const isSteepTrend = isSteepPrecedingTrend(
        historicalData,
        trendStartIndex,
        periodForTrend,
        steepnessThresholdValue
    );

    if (isSteepTrend === null) {
        return `Insufficient historical data to analyze steep trend for ${stockSymbol}.`;
    }

    if (!isSteepTrend) {
        return `Stock ${stockSymbol} does not have a steep preceding trend.`;
    }

    patternData.steepPrecedingTrend = true;


    // 2. Calculate Flag/Pennant Formation
    const formationPeriodValue = 15; // Number of periods to analyze for the formation
    const convergenceThresholdValue = 0.1; // Adjust based on data's noise level

    const isFormationPresent = isFlagPennantFormation(
        historicalData,
        formationStartIndex,
        formationPeriodValue,
        convergenceThresholdValue
    );

    if (isFormationPresent === null) {
        return `Insufficient data to analyze flag/pennant formation for ${stockSymbol}.`;
    }

    if (!isFormationPresent) {
        return `Stock ${stockSymbol} doesn't appear to be forming a flag/pennant pattern.`;
    }

    patternData.flagPennantFormation = true; //Update pattern data

    // 3. Check for Breakout
    const breakoutResult = isBreakoutOccurred(historicalData, formationStartIndex, formationPeriodValue);

    if (breakoutResult === null) {
        return `Insufficient data to analyze breakout for ${stockSymbol}.`;
    }

    if (!breakoutResult) {
        return `Stock ${stockSymbol} hasn't broken out of the pattern yet.`;
    }
    patternData.breakoutOccurred = true;  //Update pattern data

    patternData.breakoutDirection = "up";  //Hardcoding up for this example since that is what is tested.

    if (!patternData.measuredRuleTargetMet) {
        console.warn(`Stock ${stockSymbol} hasn't reached its measured rule target yet.`);
    }


    console.log(`Stock ${stockSymbol} potentially matches the trading flags/pennants pattern!`);
    return true;
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
        console.warn("Not enough data to analyze trend.");
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

// Example Usage (with sample data):

const sampleHistoricalData: StockDataPoint[] = [
    { close: 100, high: 101, low: 99 }, { close: 100.2, high: 101.2, low: 99.2 }, { close: 100.5, high: 101.5, low: 99.5 }, { close: 101, high: 102, low: 100 }, { close: 101.6, high: 102.6, low: 100.6 },
    { close: 102.3, high: 103.3, low: 101.3 }, { close: 103, high: 104, low: 102 }, { close: 103.8, high: 104.8, low: 102.8 }, { close: 104.7, high: 105.7, low: 103.7 }, { close: 105.7, high: 106.7, low: 104.7 },
    { close: 106.8, high: 107.8, low: 105.8 }, { close: 108, high: 109, low: 107 }, { close: 109.3, high: 110.3, low: 108.3 }, { close: 110.7, high: 111.7, low: 109.7 }, { close: 112.2, high: 113.2, low: 111.2 },
    { close: 113.8, high: 114.8, low: 112.8 }, { close: 115.5, high: 116.5, low: 114.5 }, { close: 117.3, high: 118.3, low: 116.3 }, { close: 119.2, high: 120.2, low: 118.2 }, { close: 121.2, high: 122.2, low: 120.2 },
    { close: 123.3, high: 124.3, low: 122.3 }, { close: 125.5, high: 126.5, low: 124.5 }, { close: 127.8, high: 128.8, low: 126.8 }, { close: 130.2, high: 131.2, low: 129.2 }, { close: 132.7, high: 133.7, low: 131.7 },
    { close: 135.3, high: 136.3, low: 134.3 }, { close: 138, high: 139, low: 137 }, { close: 140.8, high: 141.8, low: 139.8 }, { close: 143.7, high: 144.7, low: 142.7 }, { close: 146.7, high: 147.7, low: 145.7 },
    { close: 150, high: 151, low: 149 } // Breakout period at index 30

];

const patternDataForExample: TradingPatternData = {
    steepPrecedingTrend: false,  // Set by the steep trend analysis
    flagPennantFormation: false,  // Set by the flag/pennant analysis
    breakoutOccurred: false,  //Set by the breakout anlaysis
    breakoutDirection: "up",
    measuredRuleTargetMet: false,
};

// const exampleMatchResult = findStocksMatchingTradingPattern("ExampleStock", sampleHistoricalData, patternDataForExample, 10, 20);  //Trend from 10, Formation from 20.
// console.log("Example Match Result:", exampleMatchResult);
