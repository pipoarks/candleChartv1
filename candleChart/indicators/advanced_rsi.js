/**
 * Advanced RSI Indicator Generator
 * Implements standard RSI + Divergence + Smoothing MAs + Bollinger Bands
 */

/**
 * Calculate RMA (Relative Moving Average)
 * Used by RSI and optional SMMA
 */
const calculateRMA = (data, period) => {
    const rmaData = [];
    let alpha = 1 / period;
    let sum = 0;

    for (let i = 0; i < data.length; i++) {
        const val = typeof data[i] === 'object' ? data[i].value : data[i];
        if (i < period) {
            sum += val;
            if (i === period - 1) {
                const initialRma = sum / period;
                rmaData.push({ time: data[i].time, value: initialRma });
            }
        } else {
            const prevRma = rmaData[rmaData.length - 1].value;
            const rma = alpha * val + (1 - alpha) * prevRma;
            rmaData.push({ time: data[i].time, value: rma });
        }
    }
    return rmaData;
};

/**
 * Calculate WMA (Weighted Moving Average)
 */
const calculateWMA = (data, period) => {
    const wmaData = [];
    const weightSum = (period * (period + 1)) / 2;

    for (let i = period - 1; i < data.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) {
            const val = typeof data[i - j] === 'object' ? data[i - j].value : data[i - j];
            sum += val * (period - j);
        }
        wmaData.push({ time: data[i].time, value: sum / weightSum });
    }
    return wmaData;
};

/**
 * Calculate VWMA (Volume Weighted Moving Average)
 */
const calculateVWMA = (data, priceSource = 'close', period = 14) => {
    const vwmaData = [];
    for (let i = period - 1; i < data.length; i++) {
        let pvSum = 0;
        let vSum = 0;
        for (let j = 0; j < period; j++) {
            const candle = data[i - j];
            pvSum += candle[priceSource] * candle.volume;
            vSum += candle.volume;
        }
        vwmaData.push({ time: data[i].time, value: vSum === 0 ? 0 : pvSum / vSum });
    }
    return vwmaData;
};

/**
 * Calculate Standard Deviation
 */
const calculateSTDEV = (data, period) => {
    const stdevData = [];
    for (let i = period - 1; i < data.length; i++) {
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += data[i - j].value;
        }
        const mean = sum / period;
        let sqDiffSum = 0;
        for (let j = 0; j < period; j++) {
            sqDiffSum += Math.pow(data[i - j].value - mean, 2);
        }
        stdevData.push({ time: data[i].time, value: Math.sqrt(sqDiffSum / period) });
    }
    return stdevData;
};

/**
 * Find Pivot Lows
 */
const findPivotLows = (data, left, right) => {
    const pivots = [];
    for (let i = left; i < data.length - right; i++) {
        let isLow = true;
        const val = data[i].value;
        for (let j = i - left; j <= i + right; j++) {
            if (j === i) continue;
            if (data[j].value <= val) {
                isLow = false;
                break;
            }
        }
        if (isLow) {
            pivots.push({ index: i, time: data[i].time, value: val });
        }
    }
    return pivots;
};

/**
 * Find Pivot Highs
 */
const findPivotHighs = (data, left, right) => {
    const pivots = [];
    for (let i = left; i < data.length - right; i++) {
        let isHigh = true;
        const val = data[i].value;
        for (let j = i - left; j <= i + right; j++) {
            if (j === i) continue;
            if (data[j].value >= val) {
                isHigh = false;
                break;
            }
        }
        if (isHigh) {
            pivots.push({ index: i, time: data[i].time, value: val });
        }
    }
    return pivots;
};

/**
 * Calculate Advanced RSI Data
 */
const calculateAdvancedRSI = (data, settings) => {
    const period = settings.rsiPeriod || 14;
    const source = settings.rsiSource || 'close';

    // 1. Calculate RSI (Wilder's method)
    const gains = [];
    const losses = [];
    for (let i = 1; i < data.length; i++) {
        const change = data[i][source] - data[i - 1][source];
        gains.push({ time: data[i].time, value: Math.max(change, 0) });
        losses.push({ time: data[i].time, value: Math.max(-change, 0) });
    }

    const avgGains = calculateRMA(gains, period);
    const avgLosses = calculateRMA(losses, period);

    const rsiValues = [];
    // Align RMA results back to timestamps
    for (let i = 0; i < avgGains.length; i++) {
        const up = avgGains[i].value;
        const down = avgLosses[i].value;
        let rsi = 0;
        if (down === 0) {
            rsi = 100;
        } else if (up === 0) {
            rsi = 0;
        } else {
            rsi = 100 - (100 / (1 + up / down));
        }
        rsiValues.push({ time: avgGains[i].time, value: rsi });
    }

    // 2. Smoothing MA
    let maValues = [];
    const maLen = settings.maLength || 14;
    const maType = settings.maType || 'None';

    if (maType === 'SMA' || maType === 'BB') {
        maValues = calculateSMA(rsiValues, maLen);
    } else if (maType === 'EMA') {
        // Special EMA for values (utils.js calculateEMA expects candles, so we implement simple one here)
        let ema = rsiValues[0].value;
        const k = 2 / (maLen + 1);
        maValues.push({ time: rsiValues[0].time, value: ema });
        for (let i = 1; i < rsiValues.length; i++) {
            ema = rsiValues[i].value * k + ema * (1 - k);
            maValues.push({ time: rsiValues[i].time, value: ema });
        }
    } else if (maType === 'SMMA') {
        maValues = calculateRMA(rsiValues, maLen);
    } else if (maType === 'WMA') {
        maValues = calculateWMA(rsiValues, maLen);
    } else if (maType === 'VWMA') {
        // VWMA is usually on price, but Pine Script says ma(rsi, len, type)
        // For VWMA(rsi), we need volumes.
        // We'll use a Map to quickly look up candle volume by time
        const timeToVolumeMap = new Map();
        data.forEach(c => timeToVolumeMap.set(c.time, c.volume));

        const vwmaResult = [];
        for (let i = maLen - 1; i < rsiValues.length; i++) {
            let rvSum = 0;
            let vSum = 0;
            for (let j = 0; j < maLen; j++) {
                const item = rsiValues[i - j];
                const volume = timeToVolumeMap.get(item.time) || 0;
                rvSum += item.value * volume;
                vSum += volume;
            }
            vwmaResult.push({ time: rsiValues[i].time, value: vSum === 0 ? 0 : rvSum / vSum });
        }
        maValues = vwmaResult;
    }

    // 3. Bollinger Bands (if SMA + BB)
    let bbUpper = [];
    let bbLower = [];
    if (maType === 'BB') {
        const std = calculateSTDEV(rsiValues, maLen);
        const mult = settings.bbMult || 2.0;
        // Align SMA and STDEV
        maValues.forEach(m => {
            const s = std.find(sd => sd.time === m.time);
            if (s) {
                bbUpper.push({ time: m.time, value: m.value + s.value * mult });
                bbLower.push({ time: m.time, value: m.value - s.value * mult });
            }
        });
    }

    // 4. Divergence
    let bullDivergences = [];
    let bearDivergences = [];

    if (settings.calculateDivergence) {
        const lbLeft = 5;
        const lbRight = 5;
        const rangeUpper = 60;
        const rangeLower = 5;

        const timeToCandleMap = new Map();
        data.forEach(c => timeToCandleMap.set(c.time, c));

        const rsiPivotsL = findPivotLows(rsiValues, lbLeft, lbRight);
        const rsiPivotsH = findPivotHighs(rsiValues, lbLeft, lbRight);

        // Bullish Divergence
        for (let i = 1; i < rsiPivotsL.length; i++) {
            const curr = rsiPivotsL[i];
            const prev = rsiPivotsL[i - 1];

            const barsBetween = curr.index - prev.index;
            if (barsBetween >= rangeLower && barsBetween <= rangeUpper) {
                // Find matching prices in original data
                const currCandle = timeToCandleMap.get(curr.time);
                const prevCandle = timeToCandleMap.get(prev.time);

                if (currCandle && prevCandle) {
                    const priceLL = currCandle.low < prevCandle.low;
                    const rsiHL = curr.value > prev.value;

                    if (priceLL && rsiHL) {
                        bullDivergences.push({ time: curr.time, value: curr.value, text: 'Bull' });
                    }
                }
            }
        }

        // Bearish Divergence
        for (let i = 1; i < rsiPivotsH.length; i++) {
            const curr = rsiPivotsH[i];
            const prev = rsiPivotsH[i - 1];

            const barsBetween = curr.index - prev.index;
            if (barsBetween >= rangeLower && barsBetween <= rangeUpper) {
                const currCandle = timeToCandleMap.get(curr.time);
                const prevCandle = timeToCandleMap.get(prev.time);

                if (currCandle && prevCandle) {
                    const priceHH = currCandle.high > prevCandle.high;
                    const rsiLH = curr.value < prev.value;

                    if (priceHH && rsiLH) {
                        bearDivergences.push({ time: curr.time, value: curr.value, text: 'Bear' });
                    }
                }
            }
        }
    }

    return {
        rsi: rsiValues,
        ma: maValues,
        bbUpper,
        bbLower,
        bullDivergences,
        bearDivergences
    };
};

/**
 * Create Advanced RSI Chart
 */
const createAdvancedRSIChart = (el, rsiData, settings) => {
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
    };

    const chart = LightweightCharts.createChart(el, chartProperties);

    // Overbought/Oversold Bands
    const h70 = chart.addLineSeries({ color: 'rgba(120, 123, 134, 0.5)', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
    const h50 = chart.addLineSeries({ color: 'rgba(120, 123, 134, 0.2)', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
    const h30 = chart.addLineSeries({ color: 'rgba(120, 123, 134, 0.5)', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });

    const anchorData = settings.fullData || rsiData.rsi;
    h70.setData(anchorData.map(d => ({ time: d.time, value: 70 })));
    h50.setData(anchorData.map(d => ({ time: d.time, value: 50 })));
    h30.setData(anchorData.map(d => ({ time: d.time, value: 30 })));

    // RSI Line
    const rsiSeries = chart.addLineSeries({
        color: '#7E57C2',
        lineWidth: 2,
        title: `RSI (${settings.rsiPeriod})`,
    });
    rsiSeries.setData(rsiData.rsi);

    // Smoothing MA
    let maSeries = null;
    if (settings.maType !== 'None' && rsiData.ma.length > 0) {
        maSeries = chart.addLineSeries({
            color: '#FFD54F',
            lineWidth: 1.5,
            title: `${settings.maType} (${settings.maLength})`,
        });
        maSeries.setData(rsiData.ma);
    }

    // Bollinger Bands
    let bbUpperSeries = null;
    let bbLowerSeries = null;
    if (settings.maType === 'BB' && rsiData.bbUpper.length > 0) {
        bbUpperSeries = chart.addLineSeries({ color: 'rgba(16, 185, 129, 0.4)', lineWidth: 1, title: 'Upper BB' });
        bbLowerSeries = chart.addLineSeries({ color: 'rgba(16, 185, 129, 0.4)', lineWidth: 1, title: 'Lower BB' });
        bbUpperSeries.setData(rsiData.bbUpper);
        bbLowerSeries.setData(rsiData.bbLower);
    }

    // Divergence Markers
    if (settings.calculateDivergence) {
        const markers = [];
        rsiData.bullDivergences.forEach(d => {
            markers.push({
                time: d.time,
                position: 'belowBar',
                color: '#10b981',
                shape: 'arrowUp',
                text: 'Bull'
            });
        });
        rsiData.bearDivergences.forEach(d => {
            markers.push({
                time: d.time,
                position: 'aboveBar',
                color: '#ef4444',
                shape: 'arrowDown',
                text: 'Bear'
            });
        });
        // We set markers on the RSI series
        rsiSeries.setMarkers(markers);
    }

    return { chart, series: rsiSeries, maSeries, bbUpperSeries, bbLowerSeries };
};
