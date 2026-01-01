/**
 * Indicator Utility Functions
 */

/**
 * Format timestamp to IST (Indian Standard Time) format
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string} Formatted time string in IST (HH:MM)
 */
const formatTimeIST = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit', minute: '2-digit', hour12: false
    }).format(date);
};

/**
 * Calculate SMA for a given dataset
 * @param {Array} data - Array of objects with value property
 * @param {number} period - SMA period
 * @returns {Array} Array of SMA values
 */
const calculateSMA = (data, period) => {
    const smaData = [];
    for (let i = 0; i < data.length; i++) {
        // Skip initial bars where SMA cannot be calculated
        if (i < period - 1) {
            continue;
        }

        let sum = 0;
        let count = 0;
        for (let j = 0; j < period; j++) {
            const val = data[i - j]?.value;
            if (val !== undefined && val !== null && !isNaN(val)) {
                sum += val;
                count++;
            }
        }

        if (count === period) {
            smaData.push({ time: data[i].time, value: sum / period });
        }
    }
    return smaData;
};

/**
 * Calculate EMA for a given dataset (helper for MACD)
 */
const calculateEMA = (data, period) => {
    const k = 2 / (period + 1);
    const emaData = [];
    let initialSum = 0;

    // Simple MA for first value
    if (data.length < period) return [];

    for (let i = 0; i < period; i++) {
        initialSum += data[i].close;
    }
    let ema = initialSum / period;

    // Skip initial nulls - do NOT push objects without value
    // for (let i = 0; i < period - 1; i++) {
    //    emaData.push({ time: data[i].time });
    // }

    // First valid EMA point
    emaData.push({ time: data[period - 1].time, value: ema });

    for (let i = period; i < data.length; i++) {
        ema = (data[i].close * k) + (ema * (1 - k));
        emaData.push({ time: data[i].time, value: ema });
    }
    return emaData;
};
