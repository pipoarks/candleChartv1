/**
 * Chaikin Money Flow (CMF) Indicator
 */

/**
 * Helper function for math.sum equivalent
 */
const sumLast = (arr, length) => {
    let sum = 0;
    const start = Math.max(0, arr.length - length);
    for (let i = start; i < arr.length; i++) {
        sum += arr[i];
    }
    return sum;
};

/**
 * Calculate Chaikin Money Flow (CMF)
 * @param {Array} candles - Array of candle data
 * @param {number} length - Lookback period (default: 20)
 * @returns {Array} Array of CMF values {time, value}
 */
const calculateCMF = (candles, length = 20) => {
    let cumVol = 0;
    const adValues = [];
    const volValues = [];
    const cmfData = [];

    for (let i = 0; i < candles.length; i++) {
        const { high, low, close, volume, time } = candles[i];

        const vol = volume ?? 0;
        cumVol += vol;

        let ad = 0;
        if (high !== low) {
            ad = ((2 * close - low - high) / (high - low)) * vol;
        }

        adValues.push(ad);
        volValues.push(vol);

        if (i >= length - 1) {
            const adSum = sumLast(adValues, length);
            const volSum = sumLast(volValues, length);
            const cmf = volSum !== 0 ? adSum / volSum : 0;
            cmfData.push({ time, value: cmf });
        }
    }

    if (cumVol === 0) {
        console.warn("Chaikin Money Flow: No volume data provided.");
    }

    return cmfData;
};

/**
 * Create CMF chart and render it
 * @param {Object} el - DOM element
 * @param {Array} cmfData - Calculated CMF data
 * @param {Object} options - UI Settings
 */
const createCMFChart = (el, cmfData, options = {}) => {
    const chartProperties = {
        layout: {
            background: { color: 'transparent' },
            textColor: '#94a3b8',
            fontSize: 20,
        },
        grid: {
            vertLines: { color: 'rgba(148, 163, 184, 0.1)' },
            horzLines: { color: 'rgba(148, 163, 184, 0.1)' },
        },
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
        },
        rightPriceScale: {
            borderColor: 'rgba(148, 163, 184, 0.2)',
        },
        timeScale: {
            visible: true,
            borderColor: 'rgba(148, 163, 184, 0.2)',
        },
    };

    const chart = LightweightCharts.createChart(el, chartProperties);

    // Zero Line & Reference Lines
    const zeroLine = chart.addLineSeries({
        color: 'rgba(148, 163, 184, 0.5)',
        lineWidth: 1,
        lineStyle: 2, // Dashed
        priceLineVisible: false,
        lastValueVisible: false,
    });

    const refColor = options.refColor || 'rgba(239, 68, 68, 0.8)';

    const upperRef = chart.addLineSeries({
        color: refColor,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        title: '0.05',
    });

    const lowerRef = chart.addLineSeries({
        color: refColor,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        title: '-0.05',
    });

    const anchorData = options.fullData || cmfData;
    zeroLine.setData(anchorData.map(d => ({ time: d.time, value: 0 })));
    upperRef.setData(anchorData.map(d => ({ time: d.time, value: 0.05 })));
    lowerRef.setData(anchorData.map(d => ({ time: d.time, value: -0.05 })));

    // CMF Line Series (No background fill)
    const cmfSeries = chart.addLineSeries({
        color: '#22c55e',
        lineWidth: 2,
        title: `CMF (${options.length || 20})`,
    });

    cmfSeries.setData(cmfData);

    return { chart, series: cmfSeries };
};
