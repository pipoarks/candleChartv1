/**
 * Overlay Indicators (SMA, EMA, Markers, Volume)
 */

/**
 * Add SMA indicator to chart
 * @param {Object} chart - Chart instance
 * @param {Array} klinedata - Candle data
 */
const addSMAIndicator = (chart, klinedata) => {
    const smaData = klinedata
        .filter(d => d.sma !== undefined && d.sma !== null)
        .map(d => ({ time: d.time, value: d.sma }));

    if (smaData.length > 0) {
        const smaSeries = chart.addLineSeries({
            color: '#ef4444',
            lineWidth: 2,
            title: 'SMA',
        });
        smaSeries.setData(smaData);
    }
};

/**
 * Add EMA indicator to chart
 * @param {Object} chart - Chart instance
 * @param {Array} klinedata - Candle data
 */
const addEMAIndicator = (chart, klinedata) => {
    const emaData = klinedata
        .filter(d => d.ema !== undefined && d.ema !== null)
        .map(d => ({ time: d.time, value: d.ema }));

    if (emaData.length > 0) {
        const emaSeries = chart.addLineSeries({
            color: '#10b981',
            lineWidth: 2,
            title: 'EMA',
        });
        emaSeries.setData(emaData);
    }
};

/**
 * Add trade markers to chart
 * @param {Object} candleSeries - Candlestick series
 * @param {Array} klinedata - Candle data
 */
const addTradeMarkers = (candleSeries, klinedata) => {
    const markers = klinedata
        .filter(d => d.long || d.short)
        .map(d => {
            if (d.long) {
                return {
                    time: d.time,
                    position: 'belowBar',
                    color: '#10b981',
                    shape: 'arrowUp',
                    text: 'LONG',
                };
            } else {
                return {
                    time: d.time,
                    position: 'aboveBar',
                    color: '#ef4444',
                    shape: 'arrowDown',
                    text: 'SHORT',
                };
            }
        });

    if (markers.length > 0) {
        candleSeries.setMarkers(markers);
    }
};

/**
 * Add Volume Overlay to the main chart
 * @param {Object} chart - Chart instance
 * @param {Array} data - Candle data (containing volume)
 * @param {Object} options - { showSma, smaPeriod }
 */
const addVolumeOverlay = (chart, data, options = {}) => {
    const { showSma = true, smaPeriod = 20 } = options;

    // 1. Create the Volume Series FIRST to instantiate the 'volume_overlay' scale
    const volumeSeries = chart.addHistogramSeries({
        color: '#26a69a',
        priceFormat: {
            type: 'volume',
        },
        priceScaleId: 'volume_overlay', // Distinct ID, attached to new scale
    });

    // 2. NOW apply options to the scales
    // Strict partitioning:
    // Main Chart (Right Scale): Ends at 70% height (30% bottom margin)
    // Volume Chart (Overlay Scale): Starts at 80% height (80% top margin)
    // Gap: 10% empty space

    chart.priceScale('right').applyOptions({
        scaleMargins: {
            top: 0.1,
            bottom: 0.3,
        },
    });

    chart.priceScale('volume_overlay').applyOptions({
        scaleMargins: {
            top: 0.8,
            bottom: 0,
        },
    });

    const volumeData = data.map(d => {
        const val = parseFloat(d.volume);
        return {
            time: d.time,
            value: isNaN(val) ? 0 : val,
            color: d.close >= d.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)',
        };
    });

    volumeSeries.setData(volumeData);

    if (showSma) {
        // We need separate calculation for Volume SMA
        // calculateSMA expects {time, value} objects
        // volumeData already has this structure
        const smaData = calculateSMA(volumeData, smaPeriod);

        const smaSeries = chart.addLineSeries({
            color: '#f59e0b',
            lineWidth: 1,
            title: `Vol MA (${smaPeriod})`,
            priceScaleId: 'volume_overlay', // Match the new ID
        });
        smaSeries.setData(smaData);
    }

    return volumeSeries; // Return series if needed for later updates
};
