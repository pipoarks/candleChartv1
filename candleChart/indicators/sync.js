/**
 * Chart Synchronization Logic
 */

/**
 * Synchronize crosshairs between main chart and RSI chart
 * @param {Object} chart - Main candlestick chart
 * @param {Object} rsiChart - RSI chart
 * @param {Object} candleSeries - Candlestick series
 * @param {Object} rsiSeries - RSI series
 */
const synchronizeCharts = (mainChart, mainSeries, indicators) => {
    // indicators = [{ chart, series }, ...]
    const allCharts = [mainChart, ...indicators.map(i => i.chart)];

    // 1. CLEANUP: Remove old listeners to prevent memory leaks and ghost logic
    // We attach handlers to the chart object itself to track them
    allCharts.forEach(chart => {
        if (chart._syncTimeHandler) {
            chart.timeScale().unsubscribeVisibleLogicalRangeChange(chart._syncTimeHandler);
            chart._syncTimeHandler = null;
        }
        if (chart._syncCrosshairHandler) {
            chart.unsubscribeCrosshairMove(chart._syncCrosshairHandler);
            chart._syncCrosshairHandler = null;
        }
        if (chart._syncWidthHandler) {
            chart.timeScale().unsubscribeVisibleLogicalRangeChange(chart._syncWidthHandler);
            chart._syncWidthHandler = null;
        }
    });

    // 2. DEFINE NEW HANDLERS
    // We create closures that capture the CURRENT list of 'allCharts'

    // A. Time Scale Sync
    allCharts.forEach(sourceChart => {
        const timeHandler = (range) => {
            try {
                if (!range) return;
                allCharts.forEach(targetChart => {
                    if (sourceChart !== targetChart) {
                        try {
                            // Split access to catch getter errors if chart is disposed
                            const ts = targetChart.timeScale();
                            ts.setVisibleLogicalRange(range);
                        } catch (e) { }
                    }
                });
            } catch (e) { /* Top level catch for disposed source */ }
        };

        sourceChart.timeScale().subscribeVisibleLogicalRangeChange(timeHandler);
        sourceChart._syncTimeHandler = timeHandler;
    });

    // B. Crosshair Sync
    // Determine the 'main series' for the main chart for value syncing
    // For indicators, we often don't have a distinct 'series' object easily accessible here unless passed map
    // So we primarily sync TIME (vertical line) for all, and Value for Main->Others if possible? 
    // Actually, maintaining the "Clear" logic is safest basic implementation.

    allCharts.forEach(sourceChart => {
        const crosshairHandler = (param) => {
            try {
                if (!param || !param.time) {
                    // Clear all others
                    allCharts.forEach(target => {
                        if (sourceChart !== target) try { target.clearCrosshairPosition(); } catch (e) { }
                    });
                    return;
                }

                // Sync logic
                allCharts.forEach(target => {
                    if (sourceChart !== target) {
                        try {
                            let targetSeries = null;
                            if (target === mainChart) targetSeries = mainSeries;
                            else {
                                const found = indicators.find(i => i.chart === target);
                                if (found) targetSeries = found.series;
                            }

                            if (targetSeries) {
                                try {
                                    const sourcePrice = param.seriesData.size > 0 ? param.seriesData.values().next().value.value : 0;
                                    target.setCrosshairPosition(sourcePrice, param.time, targetSeries);
                                } catch (e) { }
                            }
                        } catch (e) { }
                    }
                });
            } catch (e) { /* Top level catch */ }
        };

        sourceChart.subscribeCrosshairMove(crosshairHandler);
        sourceChart._syncCrosshairHandler = crosshairHandler;
    });

    // C. Width Alignment
    const alignWidths = () => {
        try {
            const widths = allCharts.map(c => c.priceScale('right').width());
            const maxWidth = Math.max(...widths);
            if (maxWidth > 0) {
                allCharts.forEach(c => c.priceScale('right').applyOptions({ minimumWidth: maxWidth }));
            }
        } catch (e) { }
    };

    // Initial alignment
    setTimeout(alignWidths, 50);

    // Responsive alignment (hook into time scale changes as a proxy for updates)
    allCharts.forEach(chart => {
        chart.timeScale().subscribeVisibleLogicalRangeChange(alignWidths);
        chart._syncWidthHandler = alignWidths; // Re-use the function as handler ID
    });
};
