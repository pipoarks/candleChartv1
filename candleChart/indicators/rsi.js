/**
 * RSI Indicator Generator
 */

/**
 * Calculate RSI (Relative Strength Index)
 * @param {Array} data - Array of candle data with close prices
 * @param {number} period - RSI period (default: 14)
 * @returns {Array} Array of RSI values
 */
const calculateRSI = (data, period = 14) => {
    const rsiData = [];

    // Do not initialize with nulls/empty objects. 
    // The library handles gaps based on time.

    if (data.length <= period) return rsiData;

    const gains = [];
    const losses = [];

    // Calculate price changes
    for (let i = 1; i < data.length; i++) {
        const change = data[i].close - data[i - 1].close;
        gains.push(change > 0 ? change : 0);
        losses.push(change < 0 ? Math.abs(change) : 0);
    }

    // Calculate initial average gain and loss
    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

    // First RSI value
    let rsi;
    if (avgLoss === 0) {
        rsi = avgGain === 0 ? 50 : 100;
    } else {
        const rs = avgGain / avgLoss;
        rsi = 100 - (100 / (1 + rs));
    }

    // First RSI value corresponds to data[period] (we need period price changes to calculate first RSI)
    // gains[0] is the change from data[0] to data[1], so gains[period-1] is the change from data[period-1] to data[period]
    // Therefore, the first RSI value is for data[period]
    if (data[period]) {
        rsiData.push({ time: data[period].time, value: rsi });
    }

    // Calculate subsequent RSI values using smoothed averages
    for (let i = period; i < gains.length; i++) {
        avgGain = (avgGain * (period - 1) + gains[i]) / period;
        avgLoss = (avgLoss * (period - 1) + losses[i]) / period;

        if (avgLoss === 0) {
            rsi = avgGain === 0 ? 50 : 100;
        } else {
            const rs = avgGain / avgLoss;
            rsi = 100 - (100 / (1 + rs));
        }

        rsi = Math.max(0, Math.min(100, rsi));

        // gains[i] is the change from data[i] to data[i+1]
        // So the RSI value calculated using gains[i] corresponds to data[i+1]
        if (data[i + 1]) {
            rsiData.push({ time: data[i + 1].time, value: rsi });
        }
    }

    return rsiData;
};

/**
 * Create RSI chart and render it
 * @param {Object} rsiChartEl - DOM element for RSI chart
 * @param {Array} rsiData - RSI data points
 * @returns {Object} RSI chart instance and series
 */
const createRSIChart = (rsiChartEl, rsiData, options = {}) => {
    const {
        rsiPeriod = 14,
        showSma = false,
        smaPeriod = 14,
        smaColor = '#f59e0b'
    } = options;

    // RSI Chart configuration
    const rsiChartProperties = {
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
            borderColor: 'rgba(148, 163, 184, 0.2)',
            timeVisible: true,
            secondsVisible: false,
            visible: true, // Enable time scale for proper rendering
            tickMarkFormatter: (time, tickMarkType) => {
                const date = new Date(time * 1000);

                // For day/month labels (tickMarkType 0-2)
                if (tickMarkType <= 2) {
                    return new Intl.DateTimeFormat('en-US', {
                        timeZone: 'Asia/Kolkata',
                        day: '2-digit',
                        month: 'short'
                    }).format(date);
                }

                // For time labels (tickMarkType 3+) - show in "DD MMM HH:mm" format
                return new Intl.DateTimeFormat('en-US', {
                    timeZone: 'Asia/Kolkata',
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                }).format(date);
            },
        },
        localization: {
            locale: 'en-IN',
            timeFormatter: (time) => {
                const date = new Date(time * 1000);
                return new Intl.DateTimeFormat('en-US', {
                    timeZone: 'Asia/Kolkata',
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                }).format(date);
            },
        },
    };

    // Create RSI chart
    const rsiChart = LightweightCharts.createChart(rsiChartEl, rsiChartProperties);

    // Add overbought line (70) - Use fullData to ensure time scale alignment from 09:15
    const overboughtLine = rsiChart.addLineSeries({
        color: 'rgba(239, 68, 68, 0.4)',
        lineWidth: 1,
        lineStyle: 2, // Dashed line
        title: '70',
        lastValueVisible: false,
        priceLineVisible: false,
    });

    // Use options.fullData if provided to anchor the chart to 09:15 AM
    const anchorData = options.fullData || rsiData;
    overboughtLine.setData(anchorData.map(d => ({ time: d.time, value: 70 })));

    // Add oversold line (30)
    const oversoldLine = rsiChart.addLineSeries({
        color: 'rgba(16, 185, 129, 0.4)',
        lineWidth: 1,
        lineStyle: 2, // Dashed line
        title: '30',
        lastValueVisible: false,
        priceLineVisible: false,
    });
    oversoldLine.setData(anchorData.map(d => ({ time: d.time, value: 30 })));

    // Add RSI line series (graph chart instead of bars)
    const rsiSeries = rsiChart.addLineSeries({
        color: '#8b5cf6',
        lineWidth: 2,
        title: `RSI (${rsiPeriod})`,
        priceFormat: {
            type: 'price',
            precision: 2,
            minMove: 0.01,
        },
    });
    rsiSeries.setData(rsiData);

    // Optional RSI SMA
    let rsiSmaSeries = null;
    if (showSma) {
        const smaData = calculateSMA(rsiData, smaPeriod);
        rsiSmaSeries = rsiChart.addLineSeries({
            color: smaColor,
            lineWidth: 1.5,
            title: `SMA (${smaPeriod})`,
            priceLineVisible: false,
        });
        rsiSmaSeries.setData(smaData);
    }

    return { chart: rsiChart, series: rsiSeries, smaSeries: rsiSmaSeries };
};
