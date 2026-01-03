/**
 * Fixed Volume Profile Renderer
 * Canvas-based rendering for histogram and indicator lines
 */

class FRVPRenderer {
    constructor(chart, series, config) {
        this.chart = chart;
        this.series = series;
        this.config = config;
        this.primitives = []; // Store custom primitives for cleanup
    }

    /**
     * Render the complete FRVP visualization
     * @param {Object} profileData - Calculated profile data
     * @param {Object} config - Configuration settings
     */
    render(profileData, config) {
        this.config = config;

        // Clear existing primitives
        this.clear();

        const { rows, poc, vah, val, valueAreaRows } = profileData;

        // Render histogram if enabled
        if (config.volumeProfile?.enabled) {
            this.renderHistogram(rows, valueAreaRows, config);
        }

        // Render indicator lines
        if (config.indicators?.VAH?.enabled) {
            this.renderLine(vah.priceLevel, config.indicators.VAH, 'VAH');
        }

        if (config.indicators?.VAL?.enabled) {
            this.renderLine(val.priceLevel, config.indicators.VAL, 'VAL');
        }

        if (config.indicators?.POC?.enabled) {
            this.renderLine(poc.priceLevel, config.indicators.POC, 'POC');
        }

        // Render developing indicators if enabled
        if (config.indicators?.developingPOC?.enabled && profileData.developing) {
            this.renderDevelopingPOC(profileData.developing, config.indicators.developingPOC);
        }

        if (config.indicators?.developingVA?.enabled && profileData.developing) {
            this.renderDevelopingVA(profileData.developing, config.indicators.developingVA);
        }
    }

    /**
     * Render histogram bars
     * @param {Array} rows - Formatted row data
     * @param {Set} valueAreaRows - Set of row indices in value area
     * @param {Object} config - Configuration settings
     */
    renderHistogram(rows, valueAreaRows, config) {
        const { width, placement, showValues, valuesColor } = config.volumeProfile;
        const maxVolume = Math.max(...rows.map(r => r.totalVolume));

        if (maxVolume === 0) {
            console.warn('FRVP: No volume data to render');
            return;
        }

        rows.forEach(row => {
            if (row.totalVolume === 0) return;

            // Calculate bar width as percentage
            const volumeRatio = row.totalVolume / maxVolume;
            const barWidthPercent = volumeRatio * width;

            // Determine colors based on value area membership
            const isInVA = valueAreaRows.has(row.index);
            const upColor = isInVA ? config.colors.valueAreaUp : config.colors.upVolume;
            const downColor = isInVA ? config.colors.valueAreaDown : config.colors.downVolume;

            // Create histogram bar data
            const barData = {
                priceLevel: row.priceLevel,
                priceLow: row.priceLow,
                priceHigh: row.priceHigh,
                upVolume: row.upVolume,
                downVolume: row.downVolume,
                totalVolume: row.totalVolume,
                delta: row.delta,
                barWidthPercent,
                upColor,
                downColor,
                placement,
                showValues,
                valuesColor,
                volumeMode: config.volume
            };

            // Note: Actual rendering would use lightweight-charts custom primitives
            // For now, we'll store the data for rendering
            this.primitives.push({
                type: 'histogram-bar',
                data: barData
            });
        });
    }

    /**
     * Render a horizontal indicator line
     * @param {number} priceLevel - Price level for the line
     * @param {Object} style - Line style configuration
     * @param {string} label - Line label (VAH/VAL/POC)
     */
    renderLine(priceLevel, style, label) {
        const { color, lineStyle, width, enabled } = style;

        if (!enabled) return;

        // Create price line on the series
        const priceLine = {
            price: priceLevel,
            color: color,
            lineWidth: width,
            lineStyle: this.getLineStyle(lineStyle),
            axisLabelVisible: true,
            title: label
        };

        // Add to primitives for tracking
        this.primitives.push({
            type: 'price-line',
            data: priceLine,
            label
        });
    }

    /**
     * Render developing POC line series
     * @param {Array} developing - Developing data points
     * @param {Object} style - Style configuration
     */
    renderDevelopingPOC(developing, style) {
        const pocData = developing.map(d => ({
            time: d.timestamp,
            value: d.poc
        }));

        this.primitives.push({
            type: 'developing-poc',
            data: pocData,
            style
        });
    }

    /**
     * Render developing VA area
     * @param {Array} developing - Developing data points
     * @param {Object} style - Style configuration
     */
    renderDevelopingVA(developing, style) {
        const vahData = developing.map(d => ({
            time: d.timestamp,
            value: d.vah
        }));

        const valData = developing.map(d => ({
            time: d.timestamp,
            value: d.val
        }));

        this.primitives.push({
            type: 'developing-va',
            data: { vah: vahData, val: valData },
            style
        });
    }

    /**
     * Convert line style string to lightweight-charts constant
     * @param {string} styleStr - Style string ('solid', 'dashed', 'dotted')
     * @returns {number} Line style constant
     */
    getLineStyle(styleStr) {
        const styles = {
            'solid': 0,
            'dotted': 1,
            'dashed': 2,
            'large-dashed': 3,
            'sparse-dotted': 4
        };
        return styles[styleStr] || 0;
    }

    /**
     * Convert hex color to RGBA
     * @param {string} hex - Hex color code
     * @param {number} opacity - Opacity (0-100)
     * @returns {string} RGBA color string
     */
    hexToRgba(hex, opacity) {
        // Remove # if present
        hex = hex.replace('#', '');

        // Parse RGB values
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        // Convert opacity from 0-100 to 0-1
        const alpha = opacity / 100;

        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    /**
     * Format volume for display
     * @param {number} volume - Volume value
     * @returns {string} Formatted volume string
     */
    formatVolume(volume) {
        if (volume >= 1000000) {
            return `${(volume / 1000000).toFixed(1)}M`;
        } else if (volume >= 1000) {
            return `${(volume / 1000).toFixed(1)}K`;
        }
        return volume.toFixed(0);
    }

    /**
     * Clear all rendered primitives
     */
    clear() {
        // Remove all price lines and custom primitives
        this.primitives.forEach(primitive => {
            if (primitive.type === 'price-line' && primitive.seriesRef) {
                try {
                    primitive.seriesRef.removePriceLine(primitive.lineRef);
                } catch (e) {
                    // Ignore if already removed
                }
            }
        });

        this.primitives = [];
    }

    /**
     * Destroy renderer and cleanup
     */
    destroy() {
        this.clear();
        this.chart = null;
        this.series = null;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FRVPRenderer;
}
