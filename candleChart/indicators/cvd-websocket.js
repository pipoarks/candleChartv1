/**
 * CVD WebSocket Implementation (Optional)
 * Real-time Cumulative Volume Delta updates using WebSocket
 * 
 * USAGE:
 * 1. Import this file in index.html: <script src="indicators/cvd-websocket.js"></script>
 * 2. Call startCVDWebSocket(symbol, cvdInstance, settings) to start real-time updates
 * 3. Call stopCVDWebSocket() to stop updates
 */

let cvdWebSocket = null;
let cvdReconnectTimer = null;
let cvdRealtimeData = {
    oneMinBuffer: [],
    currentCVD: 0,
    lastAnchorReset: null
};

/**
 * Start WebSocket connection for real-time CVD updates
 * @param {string} symbol - Trading symbol (e.g., 'NSE:SBIN-EQ')
 * @param {Object} cvdInstance - CVD chart instance {chart, series}
 * @param {Object} settings - CVD settings {anchorPeriod, chartTimeframe}
 */
const startCVDWebSocket = (symbol, cvdInstance, settings) => {
    if (cvdWebSocket) {
        console.warn('CVD WebSocket already running');
        return;
    }

    console.log(`🔌 Starting CVD WebSocket for ${symbol}`);

    // Fyers WebSocket URL (Note: This is a placeholder - replace with actual Fyers WebSocket endpoint)
    // Fyers API v3 uses: wss://api-t1.fyers.in/socket/v3/dataSock
    const wsUrl = 'wss://api-t1.fyers.in/socket/v3/dataSock';

    cvdWebSocket = new WebSocket(wsUrl);

    cvdWebSocket.onopen = () => {
        console.log('✅ CVD WebSocket connected');

        // Subscribe to 1-minute candle updates
        // Note: Actual subscription format depends on Fyers WebSocket API
        const subscribeMessage = {
            T: 'SUB_L2',
            SLIST: [symbol],
            SUB_T: 1 // 1-minute candles
        };

        cvdWebSocket.send(JSON.stringify(subscribeMessage));
    };

    cvdWebSocket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);

            // Handle different message types
            if (data.T === 'cn') {
                // Candle update
                handleCandleUpdate(data, cvdInstance, settings);
            } else if (data.T === 'ack') {
                console.log('📡 CVD WebSocket subscription acknowledged');
            }
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    };

    cvdWebSocket.onerror = (error) => {
        console.error('❌ CVD WebSocket error:', error);
    };

    cvdWebSocket.onclose = () => {
        console.log('🔌 CVD WebSocket disconnected');
        cvdWebSocket = null;

        // Auto-reconnect after 5 seconds
        cvdReconnectTimer = setTimeout(() => {
            console.log('🔄 Reconnecting CVD WebSocket...');
            startCVDWebSocket(symbol, cvdInstance, settings);
        }, 5000);
    };
};

/**
 * Stop CVD WebSocket connection
 */
const stopCVDWebSocket = () => {
    if (cvdReconnectTimer) {
        clearTimeout(cvdReconnectTimer);
        cvdReconnectTimer = null;
    }

    if (cvdWebSocket) {
        cvdWebSocket.close();
        cvdWebSocket = null;
        console.log('🛑 CVD WebSocket stopped');
    }

    // Reset buffer
    cvdRealtimeData = {
        oneMinBuffer: [],
        currentCVD: 0,
        lastAnchorReset: null
    };
};

/**
 * Handle incoming candle update from WebSocket
 * @param {Object} data - Candle data from WebSocket
 * @param {Object} cvdInstance - CVD chart instance
 * @param {Object} settings - CVD settings
 */
const handleCandleUpdate = (data, cvdInstance, settings) => {
    // Parse candle data (format depends on Fyers WebSocket API)
    // Example format: { T: 'cn', s: 'NSE:SBIN-EQ', t: timestamp, o: open, h: high, l: low, c: close, v: volume }
    const candle = {
        time: data.t,
        open: parseFloat(data.o),
        high: parseFloat(data.h),
        low: parseFloat(data.l),
        close: parseFloat(data.c),
        volume: parseFloat(data.v || 0)
    };

    // Check if we need to reset CVD for new anchor period
    const anchorStart = getAnchorPeriodStart(candle.time, settings.anchorPeriod);
    if (cvdRealtimeData.lastAnchorReset === null || anchorStart !== cvdRealtimeData.lastAnchorReset) {
        cvdRealtimeData.lastAnchorReset = anchorStart;
        cvdRealtimeData.currentCVD = 0;
        cvdRealtimeData.oneMinBuffer = [];
        console.log(`🔄 CVD Reset (Real-time) at ${new Date(candle.time * 1000).toISOString()}`);
    }

    // Add to 1-minute buffer
    cvdRealtimeData.oneMinBuffer.push(candle);

    // Calculate delta for this bar
    const previousBar = cvdRealtimeData.oneMinBuffer.length > 1
        ? cvdRealtimeData.oneMinBuffer[cvdRealtimeData.oneMinBuffer.length - 2]
        : null;
    const previousDelta = 0; // Simplified - should track actual previous delta

    const delta = calculateDeltaForBar(candle, previousBar, previousDelta);
    cvdRealtimeData.currentCVD += delta;

    // Check if we should update the chart (when target timeframe candle completes)
    const resolution = parseInt(settings.chartTimeframe || '5');
    const timeframeSeconds = resolution * 60;
    const candleStartTime = Math.floor(candle.time / timeframeSeconds) * timeframeSeconds;

    // If this is the last 1-min bar in the target timeframe, update the chart
    const nextCandleTime = candle.time + 60; // Next 1-min bar
    const nextCandleStartTime = Math.floor(nextCandleTime / timeframeSeconds) * timeframeSeconds;

    if (nextCandleStartTime !== candleStartTime) {
        // Target timeframe candle is complete, update chart
        updateCVDChart(cvdInstance, candleStartTime, cvdRealtimeData.currentCVD);

        // Clear buffer for next period
        cvdRealtimeData.oneMinBuffer = [];
    }
};

/**
 * Update CVD chart with new data point
 * @param {Object} cvdInstance - CVD chart instance
 * @param {number} time - Candle timestamp
 * @param {number} cvdValue - CVD value
 */
const updateCVDChart = (cvdInstance, time, cvdValue) => {
    if (!cvdInstance || !cvdInstance.series) {
        console.warn('CVD instance not available for update');
        return;
    }

    try {
        // Update the chart with new CVD candle
        // Note: For real-time updates, you might want to use update() instead of setData()
        cvdInstance.series.update({
            time: time,
            open: cvdValue, // Simplified - should track actual OHLC
            high: cvdValue,
            low: cvdValue,
            close: cvdValue
        });

        console.log(`📊 CVD updated: ${cvdValue} at ${new Date(time * 1000).toISOString()}`);
    } catch (error) {
        console.error('Error updating CVD chart:', error);
    }
};

/**
 * Example usage function (call this from your main chart code)
 */
const enableRealtimeCVD = (symbol, cvdInstance, settings) => {
    console.log('🚀 Enabling real-time CVD updates');
    startCVDWebSocket(symbol, cvdInstance, settings);

    // Return cleanup function
    return () => {
        stopCVDWebSocket();
    };
};

// Export functions for use in main application
if (typeof window !== 'undefined') {
    window.startCVDWebSocket = startCVDWebSocket;
    window.stopCVDWebSocket = stopCVDWebSocket;
    window.enableRealtimeCVD = enableRealtimeCVD;
}

/**
 * IMPORTANT NOTES:
 * 
 * 1. Fyers WebSocket API Details:
 *    - This implementation is a template and needs to be adapted to Fyers' actual WebSocket API
 *    - Check Fyers API documentation for:
 *      * Correct WebSocket URL
 *      * Authentication method (token in URL or separate auth message)
 *      * Message format for subscription
 *      * Data format for candle updates
 * 
 * 2. Authentication:
 *    - You'll need to pass the Fyers access token to the WebSocket
 *    - This might be done via URL parameter or initial auth message
 * 
 * 3. Error Handling:
 *    - Add more robust error handling for network issues
 *    - Implement exponential backoff for reconnection
 *    - Handle rate limiting
 * 
 * 4. Data Validation:
 *    - Validate incoming data before processing
 *    - Handle missing or malformed data gracefully
 * 
 * 5. Performance:
 *    - Consider throttling updates if receiving too many messages
 *    - Batch updates if needed to avoid overwhelming the chart
 * 
 * 6. Integration:
 *    - To use this in your application:
 *      a) Import this file in index.html
 *      b) After creating CVD indicator, call: enableRealtimeCVD(symbol, cvdInstance, settings)
 *      c) Store the cleanup function and call it when removing the indicator
 */
