/**
 * Volume Indicator Generator
 */

/**
 * Create Volume Chart
 * @param {HTMLElement} containerEl - Container element
 * @param {Array} data - formatted candle data
 * @param {Object} options - settings { showSma, smaPeriod }
 */
const createVolumeChart = (containerEl, data, options = {}) => {
    const {
        showSma = true,
        smaPeriod = 20
    } = options;

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

    const volumeSeries = chart.addHistogramSeries({
        color: '#26a69a',
        priceFormat: {
            type: 'volume',
        },
        priceScaleId: 'right',
    });

    // Map data to volume format with colors
    const volumeData = data.map(d => {
        const val = parseFloat(d.volume);
        return {
            time: d.time,
            value: isNaN(val) ? 0 : val,
            color: d.close >= d.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)',
        };
    });

    volumeSeries.setData(volumeData);

    let smaSeries = null;
    if (showSma) {
        // Calculate SMA of Volume
        // calculateSMA expects { time, value }
        const smaData = calculateSMA(volumeData, smaPeriod);

        smaSeries = chart.addLineSeries({
            color: '#f59e0b',
            lineWidth: 2,
            title: `MA (${smaPeriod})`
        });
        smaSeries.setData(smaData);
    }

    return { chart, series: volumeSeries, extraSeries: smaSeries ? [smaSeries] : [] };
};
