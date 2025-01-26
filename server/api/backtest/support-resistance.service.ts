interface StockData {
    high: number;
    low: number;
    close: number;
}

class SupportResistanceService {

    constructor(){}
    
    calculateSupportResistance(
        data: StockData[],
        windowSize: number = 5,
        tolerance: number = 0.005,  // 0.5%
        levelsToReturn: number = 5
    ): { support: number[]; resistance: number[] } {
        // Identify swing highs and lows
        const swingHighs: number[] = [];
        const swingLows: number[] = [];

        for (let i = windowSize; i < data.length - windowSize; i++) {
            let isSwingHigh = true;
            let isSwingLow = true;

            // Check surrounding window
            for (let j = i - windowSize; j <= i + windowSize; j++) {
                if (j === i) continue;

                // Check swing high condition
                if (data[j].high >= data[i].high) {
                    isSwingHigh = false;
                }

                // Check swing low condition
                if (data[j].low <= data[i].low) {
                    isSwingLow = false;
                }
            }

            if (isSwingHigh) swingHighs.push(data[i].high);
            if (isSwingLow) swingLows.push(data[i].low);
        }

        // Cluster similar levels together
        const clusterLevels = (levels: number[], tolerance: number): number[] => {
            if (levels.length === 0) return [];
            const sorted = levels.concat().sort((a, b) => a - b);
            const clusters: number[][] = [];
            let currentCluster: number[] = [sorted[0]];

            for (let i = 1; i < sorted.length; i++) {
                const lastInCluster = currentCluster[currentCluster.length - 1];

                // Check if within tolerance of last element in current cluster
                if (sorted[i] - lastInCluster <= tolerance * lastInCluster) {
                    currentCluster.push(sorted[i]);
                } else {
                    clusters.push(currentCluster);
                    currentCluster = [sorted[i]];
                }
            }
            clusters.push(currentCluster);

            // Calculate cluster averages and sort by size
            return clusters
                .map(cluster => ({
                    level: cluster.reduce((a, b) => a + b, 0) / cluster.length,
                    size: cluster.length
                }))
                .sort((a, b) => b.size - a.size || b.level - a.level)
                .map(c => Number(c.level.toFixed(2)));  // Round to 2 decimal places
        };

        // Get clustered levels
        const resistanceLevels = clusterLevels(swingHighs, tolerance);
        const supportLevels = clusterLevels(swingLows, tolerance);

        return {
            support: supportLevels.slice(0, levelsToReturn),
            resistance: resistanceLevels.slice(0, levelsToReturn)
        };
    }
}
export default new SupportResistanceService();