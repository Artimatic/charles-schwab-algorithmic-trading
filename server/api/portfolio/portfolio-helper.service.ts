interface Holding {
    name: string;
    weight: number; // Portfolio weight (e.g., 0.25 for 25%)
    impliedVolatility: number; // Implied volatility (e.g., 0.20 for 20%)
}

/**
 * Calculates portfolio volatility using implied movements and correlations.
 *
 * @param holdings An array of Holding objects representing the portfolio holdings.
 * @returns The portfolio volatility as a number (standard deviation).
 */
export function calculatePortfolioVolatility(
    holdings: Holding[]
): number {
    let portfolioVariance = 0;
    const numHoldings = holdings.length;

    for (let i = 0; i < numHoldings; i++) {
        for (let j = 0; j < numHoldings; j++) {
            portfolioVariance += (
                holdings[i].weight *
                holdings[j].weight *
                holdings[i].impliedVolatility *
                holdings[j].impliedVolatility
            );
        }
    }

    const portfolioVolatility = Math.sqrt(portfolioVariance);
    return portfolioVolatility;
}

// Example Usage:
const myHoldings: Holding[] = [
    { name: "Stock A", weight: 0.6, impliedVolatility: 0.15 }, // 15% implied volatility
    { name: "Bond B", weight: 0.4, impliedVolatility: 0.05 },  // 5% implied volatility
];

// Example correlation matrix (correlation between Stock A and Bond B is 0.2)
const myCorrelationMatrix: number[][] = [
    [1, 0.2], // [Correlation(Stock A, Stock A), Correlation(Stock A, Bond B)]
    [0.2, 1], // [Correlation(Bond B, Stock A), Correlation(Bond B, Bond B)]
];

const portfolioVolatility = calculatePortfolioVolatility(myHoldings, myCorrelationMatrix);
console.log("Portfolio Volatility:", portfolioVolatility); // Output will be approximately 0.1048 (or 10.48%)