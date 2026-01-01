/**
 * MACD Indicator Generator
 */

/**
 * Calculate MACD
 * @param {Array} data - Candle data
 * @param {Object} options - { fastLength, slowLength, signalLength }
 */
const calculateMACD = (data, { fastLength = 12, slowLength = 26, signalLength = 9 } = {}) => {
    const fastEMA = calculateEMA(data, fastLength);
    const slowEMA = calculateEMA(data, slowLength);

    const macdData = [];
    const histogramData = [];

    // MACD Line = Fast EMA - Slow EMA
    const macdLine = [];

    // Map time to values for easy lookup
    const fastMap = new Map(fastEMA.filter(d => d.value !== undefined).map(d => [d.time, d.value]));
    const slowMap = new Map(slowEMA.filter(d => d.value !== undefined).map(d => [d.time, d.value]));

    for (let i = 0; i < data.length; i++) {
        const t = data[i].time;
        const f = fastMap.get(t);
        const s = slowMap.get(t);

        if (f !== undefined && s !== undefined) {
            const val = f - s;
            macdLine.push({ time: t, value: val });
        }
    }

    // Custom EMA for MACD line structure (expects {time, value})
    const calculateEMAFromLine = (lineData, period) => {
        const validData = lineData.filter(d => d.value !== undefined);
        const k = 2 / (period + 1);

        if (validData.length < period) return [];

        let initialSum = 0;
        for (let i = 0; i < period; i++) initialSum += validData[i].value;
        let ema = initialSum / period;

        // Map to store calculated EMAs
        const calculatedMap = new Map();
        calculatedMap.set(validData[period - 1].time, ema);

        for (let i = period; i < validData.length; i++) {
            ema = (validData[i].value * k) + (ema * (1 - k));
            calculatedMap.set(validData[i].time, ema);
        }

        // Return only points where we have a value
        return lineData
            .map(d => ({ time: d.time, value: calculatedMap.get(d.time) }))
            .filter(d => d.value !== undefined);
    };

    const signalLine = calculateEMAFromLine(macdLine, signalLength);

    // Map signal line for easy lookup
    const signalMap = new Map(signalLine.map(d => [d.time, d.value]));

    // Histogram = MACD - Signal
    for (let i = 0; i < macdLine.length; i++) {
        const t = macdLine[i].time;
        const m = macdLine[i].value;
        const s = signalMap.get(t);

        if (m !== undefined && s !== undefined) {
            histogramData.push({ time: t, value: m - s });
        }
    }

    return {
        macd: macdLine,
        signal: signalLine,
        histogram: histogramData
    };
};

/**
 * Create MACD Chart
 */
const createMACDChart = (containerEl, macdData, options = {}) => {
    // Shared chart props
    const chartProperties = {
        layout: { background: { color: 'transparent' }, textColor: '#94a3b8' },
        grid: { vertLines: { color: 'rgba(148, 163, 184, 0.1)' }, horzLines: { color: 'rgba(148, 163, 184, 0.1)' } },
        crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
        rightPriceScale: { borderColor: 'rgba(148, 163, 184, 0.2)' },
        timeScale: {
            borderColor: 'rgba(148, 163, 184, 0.2)',
            timeVisible: true,
            secondsVisible: false,
            visible: true,
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

    const chart = LightweightCharts.createChart(containerEl, chartProperties);

    const histogramSeries = chart.addHistogramSeries({
        title: 'Histogram',
        color: '#26a69a',
        priceFormat: { type: 'volume' },
        priceScaleId: 'right',
    });

    const macdSeries = chart.addLineSeries({
        title: 'MACD',
        color: '#2962FF',
        lineWidth: 2
    });

    const signalSeries = chart.addLineSeries({
        title: 'Signal',
        color: '#FF6D00',
        lineWidth: 2
    });

    // Add Zero Line Anchor to ensure alignment from 09:15
    const zeroLineSeries = chart.addLineSeries({
        color: 'rgba(148, 163, 184, 0.2)',
        lineWidth: 1,
        lineStyle: 2,
        lastValueVisible: false,
        priceLineVisible: false,
    });
    const anchorData = options.fullData || macdData.macd;
    zeroLineSeries.setData(anchorData.map(d => ({ time: d.time, value: 0 })));

    // Style histogram based on value
    // Handle potential missing values in previous data for color calc
    const coloredHistogram = macdData.histogram.map((d, i, arr) => {
        const prevVal = i > 0 ? arr[i - 1].value : 0;
        return {
            time: d.time,
            value: d.value,
            color: d.value >= 0 ? (d.value >= prevVal ? '#26a69a' : '#b2dfdb') : (d.value < prevVal ? '#ef5350' : '#ffcdd2')
        };
    });

    histogramSeries.setData(coloredHistogram);
    macdSeries.setData(macdData.macd);
    signalSeries.setData(macdData.signal);

    return { chart, series: macdSeries, extraSeries: [signalSeries, histogramSeries] };
};
