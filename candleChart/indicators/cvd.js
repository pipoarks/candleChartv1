/**
 * Cumulative Volume Delta (CVD) Indicator
 * Follows TradingView's CVD calculation methodology
 */

/**
 * Fetch 1-minute candle data from the API
 * @param {string} symbol - Trading symbol
 * @param {string} fromDate - Start date (YYYY-MM-DD)
 * @param {string} toDate - End date (YYYY-MM-DD)
 * @returns {Promise<Array>} Array of 1-minute candles
 */
const fetchOneMinuteData = async (symbol, fromDate, toDate) => {
    try {
        const url = `http://localhost:3000/history-1min?symbol=${encodeURIComponent(symbol)}&date_format=1&range_from=${fromDate}&range_to=${toDate}&cont_flag=1`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.s !== 'ok') {
            throw new Error(data.message || 'API returned error status');
        }

        if (!data.candles || !Array.isArray(data.candles)) {
            throw new Error('Invalid API response: missing candles array');
        }

        // Transform to standard format
        const candles = data.candles.map(candle => {
            const [timestamp, open, high, low, close, volume] = candle;
            return {
                time: timestamp,
                open: parseFloat(open),
                high: parseFloat(high),
                low: parseFloat(low),
                close: parseFloat(close),
                volume: parseFloat(volume || 0)
            };
        });

        // Sort by timestamp
        candles.sort((a, b) => a.time - b.time);

        console.log(`📊 Fetched ${candles.length} 1-minute candles for CVD`);
        return candles;

    } catch (error) {
        console.error('Error fetching 1-minute data:', error);
        throw error;
    }
};

/**
 * Calculate delta for a single bar using TradingView's CVD rules
 * @param {Object} bar - Current bar {open, high, low, close, volume}
 * @param {Object} previousBar - Previous bar (can be null for first bar)
 * @param {number} previousDelta - Previous bar's delta (for doji inheritance)
 * @returns {number} Delta value
 */
const calculateDeltaForBar = (bar, previousBar, previousDelta) => {
    const { open, close, volume } = bar;

    // Rule 1: If close ≠ open
    if (close > open) {
        return volume; // Bullish bar
    } else if (close < open) {
        return -volume; // Bearish bar
    }

    // Rule 2: If close == open (Doji)
    if (previousBar) {
        if (close > previousBar.close) {
            return volume; // Close higher than previous
        } else if (close < previousBar.close) {
            return -volume; // Close lower than previous
        }
    }

    // If no previous bar or close == previousClose, inherit previous delta direction
    // If previousDelta is positive, use +volume, else -volume
    if (previousDelta !== undefined && previousDelta !== 0) {
        return previousDelta > 0 ? volume : -volume;
    }

    // Default: neutral (shouldn't happen often)
    return 0;
};

/**
 * Calculate deltas for an array of 1-minute candles
 * @param {Array} oneMinCandles - Array of 1-minute candles
 * @returns {Array} Array of {time, delta, cumulativeDelta}
 */
const calculate1MinuteDeltas = (oneMinCandles) => {
    const results = [];
    let cumulativeDelta = 0;
    let previousBar = null;
    let previousDelta = 0;

    for (let i = 0; i < oneMinCandles.length; i++) {
        const bar = oneMinCandles[i];
        const delta = calculateDeltaForBar(bar, previousBar, previousDelta);
        cumulativeDelta += delta;

        results.push({
            time: bar.time,
            delta: delta,
            cumulativeDelta: cumulativeDelta
        });

        previousBar = bar;
        previousDelta = delta;
    }

    return results;
};

/**
 * Calculate CVD OHLC for a single target timeframe candle
 * @param {Object} targetCandle - The target timeframe candle (e.g., 5-min)
 * @param {Array} oneMinCandles - Array of 1-minute candles within this period
 * @param {number} previousCloseCVD - Previous candle's close CVD
 * @returns {Object} {openCVD, highCVD, lowCVD, closeCVD}
 */
const calculateCVDForCandle = (targetCandle, oneMinCandles, previousCloseCVD) => {
    if (!oneMinCandles || oneMinCandles.length === 0) {
        // No 1-min data available, return zeros
        return {
            openCVD: previousCloseCVD,
            highCVD: previousCloseCVD,
            lowCVD: previousCloseCVD,
            closeCVD: previousCloseCVD
        };
    }

    // Calculate deltas for all 1-min bars in this period
    const deltas = calculate1MinuteDeltas(oneMinCandles);

    // Open CVD = Previous candle's Close CVD
    const openCVD = previousCloseCVD;

    // Track min/max during the period
    let highCVD = openCVD;
    let lowCVD = openCVD;
    let runningCVD = openCVD;

    for (const deltaData of deltas) {
        runningCVD += deltaData.delta;
        highCVD = Math.max(highCVD, runningCVD);
        lowCVD = Math.min(lowCVD, runningCVD);
    }

    // Close CVD = Final cumulative delta
    const closeCVD = runningCVD;

    return { openCVD, highCVD, lowCVD, closeCVD };
};

/**
 * Get anchor period start timestamp
 * @param {number} timestamp - Current timestamp
 * @param {string} anchorPeriod - Anchor period ('1D', '1H', '4H', '1W')
 * @returns {number} Start timestamp of the anchor period
 */
const getAnchorPeriodStart = (timestamp, anchorPeriod) => {
    const date = new Date(timestamp * 1000);

    // Convert to IST
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });

    const parts = formatter.formatToParts(date);
    const istParts = {};
    parts.forEach(p => istParts[p.type] = p.value);

    if (anchorPeriod === '1D') {
        // Reset at 9:15 AM IST (market open)
        const marketOpen = new Date(
            `${istParts.year}-${istParts.month}-${istParts.day}T09:15:00+05:30`
        );
        return Math.floor(marketOpen.getTime() / 1000);
    } else if (anchorPeriod === '1H') {
        // Reset at the start of each hour
        const hourStart = new Date(
            `${istParts.year}-${istParts.month}-${istParts.day}T${istParts.hour}:00:00+05:30`
        );
        return Math.floor(hourStart.getTime() / 1000);
    } else if (anchorPeriod === '4H') {
        // Reset every 4 hours from market open (9:15, 13:15)
        const hour = parseInt(istParts.hour);
        let anchorHour = 9;
        if (hour >= 13) anchorHour = 13;

        const anchorStart = new Date(
            `${istParts.year}-${istParts.month}-${istParts.day}T${anchorHour.toString().padStart(2, '0')}:15:00+05:30`
        );
        return Math.floor(anchorStart.getTime() / 1000);
    } else if (anchorPeriod === '1W') {
        // Reset at the start of the week (Monday 9:15 AM)
        const dayOfWeek = date.getDay();
        const daysToMonday = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek);
        const monday = new Date(date);
        monday.setDate(date.getDate() + daysToMonday);

        const weekStart = new Date(
            `${monday.getFullYear()}-${(monday.getMonth() + 1).toString().padStart(2, '0')}-${monday.getDate().toString().padStart(2, '0')}T09:15:00+05:30`
        );
        return Math.floor(weekStart.getTime() / 1000);
    }

    // Default: daily
    return Math.floor(date.setHours(9, 15, 0, 0) / 1000);
};

/**
 * Main CVD calculation function
 * @param {Array} candles - Array of target timeframe candles (e.g., 5-min)
 * @param {Array} oneMinCandles - Array of all 1-minute candles
 * @param {Object} options - Configuration {anchorPeriod: '1D', chartTimeframe: '5'}
 * @returns {Array} Array of CVD candles with OHLC
 */
const calculateCVD = (candles, oneMinCandles, options = {}) => {
    const { anchorPeriod = '1D' } = options;
    const cvdData = [];

    let cumulativeCVD = 0; // Running CVD across the anchor period
    let currentAnchorStart = null;

    for (let i = 0; i < candles.length; i++) {
        const candle = candles[i];
        const candleTime = candle.time;

        // Check if we need to reset CVD for new anchor period
        const anchorStart = getAnchorPeriodStart(candleTime, anchorPeriod);
        if (currentAnchorStart === null || anchorStart !== currentAnchorStart) {
            currentAnchorStart = anchorStart;
            cumulativeCVD = 0; // Reset CVD
            console.log(`🔄 CVD Reset at ${new Date(candleTime * 1000).toISOString()} (Anchor: ${anchorPeriod})`);
        }

        // Get the timeframe in minutes
        const resolution = parseInt(options.chartTimeframe || '5');
        const timeframeSeconds = resolution * 60;

        // Find 1-minute candles that fall within this target candle's timeframe
        const candleStart = candleTime;
        const candleEnd = candleTime + timeframeSeconds;

        const relevantOneMinCandles = oneMinCandles.filter(c =>
            c.time >= candleStart && c.time < candleEnd
        );

        // Calculate CVD OHLC for this candle
        const cvdOHLC = calculateCVDForCandle(candle, relevantOneMinCandles, cumulativeCVD);

        // Update cumulative CVD
        cumulativeCVD = cvdOHLC.closeCVD;

        cvdData.push({
            time: candleTime,
            open: cvdOHLC.openCVD,
            high: cvdOHLC.highCVD,
            low: cvdOHLC.lowCVD,
            close: cvdOHLC.closeCVD,
            // Store underlying candle data for reference
            underlyingCandle: {
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
                volume: candle.volume
            }
        });
    }

    console.log(`✅ Calculated CVD for ${cvdData.length} candles`);
    return cvdData;
};

/**
 * Create CVD chart and render it
 * @param {Object} el - DOM element
 * @param {Array} cvdData - Calculated CVD data
 * @param {Object} options - UI Settings
 * @returns {Object} {chart, series}
 */
const createCVDChart = (el, cvdData, options = {}) => {
    const chartProperties = {
        layout: {
            background: { color: 'transparent' },
            textColor: '#94a3b8',
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
        localization: {
            priceFormatter: (price) => {
                const absPrice = Math.abs(price);
                if (absPrice >= 1000000) {
                    return (price / 1000000).toFixed(2) + 'M';
                } else if (absPrice >= 1000) {
                    return (price / 1000).toFixed(1) + 'K';
                }
                return price.toFixed(0);
            }
        }
    };

    const chart = LightweightCharts.createChart(el, chartProperties);

    // Zero reference line
    const zeroLine = chart.addLineSeries({
        color: 'rgba(148, 163, 184, 0.5)',
        lineWidth: 1,
        lineStyle: 2, // Dashed
        priceLineVisible: false,
        lastValueVisible: false,
    });

    const anchorData = options.fullData || cvdData;
    zeroLine.setData(anchorData.map(d => ({ time: d.time, value: 0 })));

    // CVD Candlestick Series
    const cvdSeries = chart.addCandlestickSeries({
        upColor: '#10b981',
        downColor: '#ef4444',
        borderUpColor: '#10b981',
        borderDownColor: '#ef4444',
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
        title: `CVD (${options.anchorPeriod || '1D'})`,
    });

    cvdSeries.setData(cvdData);

    return { chart, series: cvdSeries };
};
