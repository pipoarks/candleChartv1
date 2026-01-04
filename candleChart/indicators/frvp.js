/**
 * Fixed Volume Profile (FRVP) Main Module
 * Orchestrates calculation, rendering, and chart integration
 */

/**
 * Fetch 1-minute candle data for FRVP calculation
 * @param {string} symbol - Trading symbol
 * @param {string} rangeFrom - Start date (YYYY-MM-DD)
 * @param {string} rangeTo - End date (YYYY-MM-DD)
 * @returns {Promise<Array>} Array of 1-minute OHLCV bars
 */
async function fetchOneMinuteDataForFRVP(symbol, rangeFrom, rangeTo) {
    // [SAFETY]: Ensure technical symbol format (NSE:SYMBOL-EQ)
    if (window.getTechnicalSymbol) {
        symbol = window.getTechnicalSymbol(symbol);
    }

    const url = `http://localhost:3000/history-1min?symbol=${encodeURIComponent(symbol)}&date_format=1&range_from=${rangeFrom}&range_to=${rangeTo}&cont_flag=1`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.s !== 'ok') {
            throw new Error(data.message || 'API returned error status');
        }

        // Transform to OHLCV format
        const bars = data.candles.map(candle => {
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

        // Filter for market hours (9:15 AM - 3:30 PM IST)
        const filteredBars = bars.filter(bar => {
            const date = new Date(bar.time * 1000);
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: 'Asia/Kolkata',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
            const parts = formatter.formatToParts(date);
            const timeParts = {};
            parts.forEach(p => timeParts[p.type] = p.value);

            const hours = parseInt(timeParts.hour);
            const minutes = parseInt(timeParts.minute);
            const timeInMinutes = hours * 60 + minutes;

            const marketOpenTime = 9 * 60 + 15; // 9:15 AM
            const marketCloseTime = 15 * 60 + 30; // 3:30 PM

            return timeInMinutes >= marketOpenTime && timeInMinutes <= marketCloseTime;
        });

        console.log(`📊 FRVP: Fetched ${filteredBars.length} 1-minute bars for ${symbol}`);
        return filteredBars;

    } catch (error) {
        console.error('FRVP: Failed to fetch 1-minute data:', error);
        throw error;
    }
}

/**
 * Calculate FRVP profile data
 * @param {Array} candles - Main chart candles (for time reference)
 * @param {number} startTime - Start Unix timestamp
 * @param {number} endTime - End Unix timestamp
 * @param {string} symbol - Trading symbol
 * @param {string} rangeFrom - Start date
 * @param {string} rangeTo - End date
 * @param {Object} config - FRVP configuration
 * @returns {Promise<Object>} Calculated profile data
 */
async function calculateFRVP(candles, startTime, endTime, symbol, rangeFrom, rangeTo, config) {
    try {
        // Fetch 1-minute data
        const minuteBars = await fetchOneMinuteDataForFRVP(symbol, rangeFrom, rangeTo);

        if (!minuteBars || minuteBars.length === 0) {
            throw new Error('No 1-minute data available for FRVP calculation');
        }

        // Merge with default config
        const settings = mergeFRVPConfig(DEFAULT_FRVP_CONFIG, config);

        // Validate settings
        const validatedSettings = validateFRVPConfig(settings);

        // Create calculator instance
        const calculator = new FRVPCalculator(validatedSettings);

        // Calculate profile - pass exact timestamps for filtering
        const profileData = calculator.calculateProfile(minuteBars, startTime, endTime, validatedSettings);

        // Get formatted data for rendering
        const formattedRows = calculator.getFormattedData(profileData, validatedSettings);

        return {
            ...profileData,
            formattedRows,
            config: validatedSettings
        };

    } catch (error) {
        console.error('FRVP: Calculation failed:', error);
        throw error;
    }
}

/**
 * Create FRVP chart instance
 * @param {HTMLElement} el - Container element
 * @param {Object} profileData - Calculated profile data
 * @param {Object} config - FRVP configuration
 * @returns {Object} Chart instance with series and renderer
 */
function createFRVPChart(el, profileData, config) {
    // Chart properties matching other indicators
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
        height: 300,
    };

    // Create chart
    const chart = LightweightCharts.createChart(el, chartProperties);

    // Create a baseline series for price levels (invisible, just for structure)
    const baselineSeries = chart.addBaselineSeries({
        baseValue: { type: 'price', price: profileData.poc.priceLevel },
        topLineColor: 'transparent',
        bottomLineColor: 'transparent',
        topFillColor1: 'transparent',
        topFillColor2: 'transparent',
        bottomFillColor1: 'transparent',
        bottomFillColor2: 'transparent',
        lineWidth: 0,
        priceLineVisible: false,
        lastValueVisible: false,
    });

    // Set dummy data to establish price scale
    // Use simple timestamps - the baseline is invisible anyway
    const currentTime = Math.floor(Date.now() / 1000);
    const dummyData = [
        { time: currentTime - 3600, value: profileData.profileLow },  // 1 hour ago
        { time: currentTime, value: profileData.profileHigh }
    ];
    baselineSeries.setData(dummyData);

    // Add POC price line
    if (config.indicators?.POC?.enabled) {
        const pocLine = baselineSeries.createPriceLine({
            price: profileData.poc.priceLevel,
            color: config.indicators.POC.color,
            lineWidth: config.indicators.POC.width,
            lineStyle: getLineStyleConstant(config.indicators.POC.lineStyle),
            axisLabelVisible: true,
            title: 'POC',
        });
    }

    // Add VAH price line
    if (config.indicators?.VAH?.enabled) {
        const vahLine = baselineSeries.createPriceLine({
            price: profileData.vah.priceLevel,
            color: config.indicators.VAH.color,
            lineWidth: config.indicators.VAH.width,
            lineStyle: getLineStyleConstant(config.indicators.VAH.lineStyle),
            axisLabelVisible: true,
            title: 'VAH',
        });
    }

    // Add VAL price line
    if (config.indicators?.VAL?.enabled) {
        const valLine = baselineSeries.createPriceLine({
            price: profileData.val.priceLevel,
            color: config.indicators.VAL.color,
            lineWidth: config.indicators.VAL.width,
            lineStyle: getLineStyleConstant(config.indicators.VAL.lineStyle),
            axisLabelVisible: true,
            title: 'VAL',
        });
    }

    // Note: Histogram rendering would require custom primitives
    // For now, we'll use a workaround with multiple histogram series
    if (config.volumeProfile?.enabled) {
        renderHistogramWithSeries(chart, profileData, config);
    }

    return {
        chart,
        series: baselineSeries,
        profileData,
        config
    };
}

/**
 * Render histogram using histogram series (workaround for custom primitives)
 * @param {Object} chart - Chart instance
 * @param {Object} profileData - Profile data
 * @param {Object} config - Configuration
 */
function renderHistogramWithSeries(chart, profileData, config) {
    const { formattedRows } = profileData;
    const { width, placement } = config.volumeProfile;

    // Create histogram series for visualization
    const histogramSeries = chart.addHistogramSeries({
        color: '#26a69a',
        priceFormat: {
            type: 'volume',
        },
        priceScaleId: 'volume',
        scaleMargins: {
            top: 0.1,
            bottom: 0.1,
        },
    });

    // Convert rows to histogram data
    // Note: This is a simplified representation
    // Full implementation would use custom primitives for horizontal bars
    const histogramData = formattedRows
        .filter(row => row.totalVolume > 0)
        .map(row => ({
            time: Math.floor(Date.now() / 1000), // Placeholder time
            value: row.totalVolume,
            color: row.upVolume > row.downVolume
                ? hexToRgba(config.colors.upVolume.color, config.colors.upVolume.opacity)
                : hexToRgba(config.colors.downVolume.color, config.colors.downVolume.opacity)
        }));

    // Note: This is a placeholder - actual histogram rendering needs custom implementation
    console.log('📊 FRVP: Histogram data prepared (custom rendering needed for horizontal bars)');
}

/**
 * Convert line style string to constant
 * @param {string} style - Style string
 * @returns {number} Line style constant
 */
function getLineStyleConstant(style) {
    const styles = {
        'solid': 0,
        'dotted': 1,
        'dashed': 2,
        'large-dashed': 3,
        'sparse-dotted': 4
    };
    return styles[style] || 0;
}

/**
 * Convert hex color to RGBA
 * @param {string} hex - Hex color
 * @param {number} opacity - Opacity (0-100)
 * @returns {string} RGBA string
 */
function hexToRgba(hex, opacity) {
    hex = hex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const alpha = opacity / 100;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Update FRVP settings and re-render
 * @param {Object} instance - FRVP chart instance
 * @param {Object} newConfig - New configuration
 * @param {Array} candles - Main chart candles
 * @param {string} symbol - Trading symbol
 * @param {string} rangeFrom - Start date
 * @param {string} rangeTo - End date
 * @returns {Promise<Object>} Updated instance
 */
async function updateFRVPSettings(instance, newConfig, candles, symbol, rangeFrom, rangeTo) {
    try {
        // Merge new config
        const updatedConfig = mergeFRVPConfig(instance.config, newConfig);

        // Recalculate with new settings
        const profileData = await calculateFRVP(candles, symbol, rangeFrom, rangeTo, updatedConfig);

        // Remove old chart
        if (instance.chart) {
            instance.chart.remove();
        }

        // Create new chart with updated data
        const newInstance = createFRVPChart(instance.chart.container, profileData, updatedConfig);

        return newInstance;

    } catch (error) {
        console.error('FRVP: Failed to update settings:', error);
        throw error;
    }
}

// Export functions (no module.exports needed for browser)
console.log('✅ FRVP module loaded');
