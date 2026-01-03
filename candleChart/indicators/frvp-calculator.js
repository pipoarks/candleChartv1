/**
 * Fixed Volume Profile Calculator
 * Implements TradingView's Volume Profile calculation methodology
 */

class FRVPCalculator {
    constructor(config = {}) {
        this.config = config;
    }

    /**
     * Main calculation method
     * @param {Array} minuteBars - Array of 1-minute OHLCV bars
     * @param {Object} config - Configuration object
     * @returns {Object} Complete profile data with POC, VAH, VAL, rows
     */
    calculateProfile(minuteBars, config = {}) {
        if (!minuteBars || minuteBars.length === 0) {
            throw new Error('No data provided for FRVP calculation');
        }

        // Merge config with instance config
        const settings = { ...this.config, ...config };

        // Step 1: Determine price range
        const profileHigh = Math.max(...minuteBars.map(b => b.high));
        const profileLow = Math.min(...minuteBars.map(b => b.low));

        console.log(`📊 FRVP: Price range ${profileLow.toFixed(2)} - ${profileHigh.toFixed(2)}`);

        // Step 2: Create price level rows
        const rows = this.createPriceLevelRows(profileLow, profileHigh, settings);

        // Step 3: Distribute volume across rows
        this.distributeVolume(minuteBars, rows);

        // Step 4: Calculate key levels
        const poc = this.calculatePOC(rows);
        const { vah, val, valueAreaRows } = this.calculateValueArea(
            rows,
            poc,
            settings.valueAreaVolume || 70
        );

        // Step 5: Calculate developing indicators if enabled
        let developing = null;
        if (settings.developingPOC || settings.developingVA) {
            developing = this.calculateDeveloping(minuteBars, settings);
        }

        const totalVolume = rows.reduce((sum, r) => sum + r.totalVolume, 0);

        console.log(`✅ FRVP: POC at ${poc.priceLevel.toFixed(2)}, VAH: ${vah.priceLevel.toFixed(2)}, VAL: ${val.priceLevel.toFixed(2)}`);
        console.log(`📈 FRVP: Total volume: ${totalVolume.toFixed(0)}, Rows: ${rows.length}`);

        return {
            rows,
            poc,
            vah,
            val,
            valueAreaRows,
            profileHigh,
            profileLow,
            developing,
            metadata: {
                totalVolume,
                totalBars: minuteBars.length,
                priceRange: profileHigh - profileLow,
                rowCount: rows.length
            }
        };
    }

    /**
     * Create price level rows based on rowSize and layout type
     * @param {number} low - Lowest price in range
     * @param {number} high - Highest price in range
     * @param {Object} settings - Configuration settings
     * @returns {Array} Array of row objects
     */
    createPriceLevelRows(low, high, settings) {
        const { rowSize = 200, rowsLayout = 'Number' } = settings;
        const rows = [];

        // Calculate number of rows needed
        const priceRange = high - low;
        let numRows;

        switch (rowsLayout) {
            case 'Number':
                // rowSize represents number of rows
                numRows = rowSize;
                break;
            case 'Tick':
                // rowSize represents price units per row
                numRows = Math.ceil(priceRange / rowSize);
                break;
            case 'Percentage':
                // rowSize represents percentage of price range per row
                const rowHeight = (priceRange * rowSize) / 100;
                numRows = Math.ceil(priceRange / rowHeight);
                break;
            default:
                numRows = rowSize;
        }

        // Ensure at least 1 row
        numRows = Math.max(1, numRows);
        const actualRowSize = priceRange / numRows;

        for (let i = 0; i < numRows; i++) {
            const priceLow = low + (i * actualRowSize);
            const priceHigh = Math.min(priceLow + actualRowSize, high);

            rows.push({
                index: i,
                priceLow,
                priceHigh,
                priceLevel: (priceLow + priceHigh) / 2, // Mid-price
                upVolume: 0,
                downVolume: 0,
                totalVolume: 0,
                delta: 0
            });
        }

        return rows;
    }

    /**
     * Distribute volume from bars into price level rows
     * Uses TradingView methodology: close >= open = up bar, close < open = down bar
     * @param {Array} bars - 1-minute OHLCV bars
     * @param {Array} rows - Price level rows
     */
    distributeVolume(bars, rows) {
        bars.forEach(bar => {
            // Determine if bar is up or down based on TradingView methodology
            const isUpBar = bar.close >= bar.open;

            // Find all rows that this bar touches
            rows.forEach(row => {
                // Check if bar's price range intersects with row's price range
                if (this.rangesOverlap(bar.low, bar.high, row.priceLow, row.priceHigh)) {
                    // Calculate what portion of the bar falls in this row
                    const overlapRatio = this.calculateOverlapRatio(
                        bar.low,
                        bar.high,
                        row.priceLow,
                        row.priceHigh
                    );

                    const volumeForRow = bar.volume * overlapRatio;

                    // Classify volume as up or down
                    if (isUpBar) {
                        row.upVolume += volumeForRow;
                    } else {
                        row.downVolume += volumeForRow;
                    }

                    row.totalVolume += volumeForRow;
                    row.delta = row.upVolume - row.downVolume;
                }
            });
        });
    }

    /**
     * Check if two price ranges overlap
     * @param {number} low1 - Low of first range
     * @param {number} high1 - High of first range
     * @param {number} low2 - Low of second range
     * @param {number} high2 - High of second range
     * @returns {boolean} True if ranges overlap
     */
    rangesOverlap(low1, high1, low2, high2) {
        return low1 <= high2 && high1 >= low2;
    }

    /**
     * Calculate what ratio of range1 overlaps with range2
     * @param {number} low1 - Low of first range
     * @param {number} high1 - High of first range
     * @param {number} low2 - Low of second range
     * @param {number} high2 - High of second range
     * @returns {number} Overlap ratio (0-1)
     */
    calculateOverlapRatio(low1, high1, low2, high2) {
        const overlapLow = Math.max(low1, low2);
        const overlapHigh = Math.min(high1, high2);
        const overlapRange = Math.max(0, overlapHigh - overlapLow);
        const totalRange = high1 - low1;
        return totalRange > 0 ? overlapRange / totalRange : 0;
    }

    /**
     * Calculate Point of Control (row with highest volume)
     * @param {Array} rows - Price level rows
     * @returns {Object} POC row
     */
    calculatePOC(rows) {
        if (!rows || rows.length === 0) {
            throw new Error('No rows provided for POC calculation');
        }

        return rows.reduce((maxRow, currentRow) =>
            currentRow.totalVolume > maxRow.totalVolume ? currentRow : maxRow
            , rows[0]);
    }

    /**
     * Calculate Value Area using TradingView's exact algorithm
     * CRITICAL: Must follow steps 1-9 exactly as documented
     * @param {Array} rows - Price level rows
     * @param {Object} poc - Point of Control row
     * @param {number} vaPercentage - Value area percentage (default 70)
     * @returns {Object} { vah, val, valueAreaRows }
     */
    calculateValueArea(rows, poc, vaPercentage = 70) {
        // Step 1: Calculate total volume
        const totalVolume = rows.reduce((sum, r) => sum + r.totalVolume, 0);

        if (totalVolume === 0) {
            console.warn('FRVP: Total volume is zero, returning POC as VA');
            return { vah: poc, val: poc, valueAreaRows: new Set([poc.index]) };
        }

        // Step 2: Calculate target volume for VA
        const targetVolume = totalVolume * (vaPercentage / 100);

        // Step 3: Start at POC
        let accumulatedVolume = poc.totalVolume;
        const valueAreaRows = new Set([poc.index]);

        const pocIndex = rows.indexOf(poc);
        let aboveIndex = pocIndex - 1;
        let belowIndex = pocIndex + 1;

        // Steps 4-7: Iteratively expand value area
        while (accumulatedVolume < targetVolume &&
            (aboveIndex >= 0 || belowIndex < rows.length)) {

            const aboveRow = aboveIndex >= 0 ? rows[aboveIndex] : null;
            const belowRow = belowIndex < rows.length ? rows[belowIndex] : null;

            if (!aboveRow && !belowRow) break;

            let chosenRow = null;
            let chosenSide = null;

            // Step 5: Compare volumes and choose larger
            if (!belowRow) {
                chosenRow = aboveRow;
                chosenSide = 'above';
            } else if (!aboveRow) {
                chosenRow = belowRow;
                chosenSide = 'below';
            } else if (aboveRow.totalVolume > belowRow.totalVolume) {
                chosenRow = aboveRow;
                chosenSide = 'above';
            } else if (belowRow.totalVolume > aboveRow.totalVolume) {
                chosenRow = belowRow;
                chosenSide = 'below';
            } else {
                // Step 8: Tie-breaking rules
                const aboveDist = pocIndex - aboveIndex;
                const belowDist = belowIndex - pocIndex;

                if (aboveDist < belowDist) {
                    chosenRow = aboveRow;
                    chosenSide = 'above';
                } else if (belowDist < aboveDist) {
                    chosenRow = belowRow;
                    chosenSide = 'below';
                } else {
                    // Equal distance - choose above
                    chosenRow = aboveRow;
                    chosenSide = 'above';
                }
            }

            // Step 6: Check if adding exceeds target
            if (accumulatedVolume + chosenRow.totalVolume > targetVolume) {
                break;
            }

            // Add to value area
            valueAreaRows.add(chosenRow.index);
            accumulatedVolume += chosenRow.totalVolume;

            // Update indices
            if (chosenSide === 'above') {
                aboveIndex--;
            } else {
                belowIndex++;
            }
        }

        // Step 9: Determine VAH and VAL
        const vaRowsArray = Array.from(valueAreaRows)
            .map(idx => rows[idx])
            .sort((a, b) => b.priceLevel - a.priceLevel);

        const vah = vaRowsArray[0]; // Highest price
        const val = vaRowsArray[vaRowsArray.length - 1]; // Lowest price

        return { vah, val, valueAreaRows };
    }

    /**
     * Calculate developing POC and VA throughout the session
     * @param {Array} minuteBars - 1-minute OHLCV bars
     * @param {Object} settings - Configuration settings
     * @returns {Array} Array of developing data points
     */
    calculateDeveloping(minuteBars, settings) {
        const developingData = [];
        const step = Math.max(1, Math.floor(minuteBars.length / 50)); // Sample 50 points max

        for (let i = step; i <= minuteBars.length; i += step) {
            const partialBars = minuteBars.slice(0, i);

            try {
                const partialProfile = this.calculateProfile(partialBars, {
                    ...settings,
                    developingPOC: false, // Prevent infinite recursion
                    developingVA: false
                });

                developingData.push({
                    timestamp: partialBars[partialBars.length - 1].time,
                    poc: partialProfile.poc.priceLevel,
                    vah: partialProfile.vah.priceLevel,
                    val: partialProfile.val.priceLevel
                });
            } catch (e) {
                console.warn('Failed to calculate developing profile at index', i, e);
            }
        }

        return developingData;
    }

    /**
     * Get formatted data for rendering
     * @param {Object} calculatedProfile - Profile data from calculateProfile()
     * @param {Object} config - Configuration settings
     * @returns {Array} Formatted rows for rendering
     */
    getFormattedData(calculatedProfile, config) {
        const { rows, poc, vah, val, valueAreaRows } = calculatedProfile;
        const maxVolume = Math.max(...rows.map(r => r.totalVolume));
        const { width = 30, placement = 'Left' } = config.volumeProfile || {};

        return rows.map(row => {
            // Calculate bar width as percentage of max
            const volumeRatio = maxVolume > 0 ? row.totalVolume / maxVolume : 0;
            const barWidth = volumeRatio * width; // Width % of box

            return {
                ...row,
                barWidth,
                isPOC: row.index === poc.index,
                isVAH: row.index === vah.index,
                isVAL: row.index === val.index,
                isInValueArea: valueAreaRows.has(row.index),
                placement
            };
        });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FRVPCalculator;
}
