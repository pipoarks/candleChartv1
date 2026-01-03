/**
 * Fixed Volume Profile Settings
 * Default configuration and settings management
 */

/**
 * Default FRVP Configuration
 */
const DEFAULT_FRVP_CONFIG = {
    // Inputs Tab
    rowsLayout: 'Number',           // 'Number', 'Tick', 'Percentage'
    rowSize: 200,                   // Number of rows or price units per row
    volume: 'Up/Down',              // 'Total', 'Up/Down', 'Delta'
    valueAreaVolume: 70,            // Percentage (default 70%)
    extendRight: false,             // Extend indicator lines to right

    // Style Tab - Volume Profile
    volumeProfile: {
        enabled: true,
        showValues: false,
        valuesColor: '#808080',
        width: 30,                  // % of box width (0-100)
        placement: 'Left',          // 'Left' or 'Right'
    },

    // Style Tab - Colors
    colors: {
        upVolume: {
            color: '#26a69a',
            opacity: 80
        },
        downVolume: {
            color: '#ef5350',
            opacity: 80
        },
        valueAreaUp: {
            color: '#00bcd4',
            opacity: 40
        },
        valueAreaDown: {
            color: '#e91e63',
            opacity: 40
        },
    },

    // Style Tab - Indicators
    indicators: {
        VAH: {
            enabled: true,
            color: '#ffc107',
            lineStyle: 'solid',     // 'solid', 'dashed', 'dotted'
            width: 2
        },
        VAL: {
            enabled: true,
            color: '#ffc107',
            lineStyle: 'solid',
            width: 2
        },
        POC: {
            enabled: true,
            color: '#000000',
            lineStyle: 'dotted',
            width: 2
        },
        developingPOC: {
            enabled: false,
            color: '#666666',
            opacity: 50
        },
        developingVA: {
            enabled: false,
            color: '#999999',
            opacity: 30
        },
    },

    // Style Tab - Histogram Box
    histogramBox: {
        backgroundColor: '#ffffff',
        opacity: 10
    },

    // Coordinates Tab (simplified for now)
    coordinates: {
        x: 0,
        y: 0
    },

    // Visibility Tab (simplified for now)
    visibility: {
        allTimeframes: true
    }
};

/**
 * Validate FRVP configuration
 * @param {Object} config - Configuration to validate
 * @returns {Object} Validated configuration
 */
function validateFRVPConfig(config) {
    const validated = { ...config };

    // Validate rowSize
    if (validated.rowSize !== undefined) {
        validated.rowSize = Math.max(1, parseInt(validated.rowSize) || 200);
    }

    // Validate valueAreaVolume (0-100)
    if (validated.valueAreaVolume !== undefined) {
        validated.valueAreaVolume = Math.max(0, Math.min(100, parseInt(validated.valueAreaVolume) || 70));
    }

    // Validate width (0-100)
    if (validated.volumeProfile?.width !== undefined) {
        validated.volumeProfile.width = Math.max(0, Math.min(100, parseInt(validated.volumeProfile.width) || 30));
    }

    // Validate opacity values (0-100)
    if (validated.colors) {
        Object.keys(validated.colors).forEach(key => {
            if (validated.colors[key]?.opacity !== undefined) {
                validated.colors[key].opacity = Math.max(0, Math.min(100, parseInt(validated.colors[key].opacity) || 80));
            }
        });
    }

    // Validate indicator opacity
    if (validated.indicators) {
        Object.keys(validated.indicators).forEach(key => {
            if (validated.indicators[key]?.opacity !== undefined) {
                validated.indicators[key].opacity = Math.max(0, Math.min(100, parseInt(validated.indicators[key].opacity) || 50));
            }
        });
    }

    return validated;
}

/**
 * Merge FRVP configurations (deep merge)
 * @param {Object} base - Base configuration
 * @param {Object} override - Override configuration
 * @returns {Object} Merged configuration
 */
function mergeFRVPConfig(base, override) {
    const merged = JSON.parse(JSON.stringify(base)); // Deep clone

    // Deep merge function
    function deepMerge(target, source) {
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                target[key] = target[key] || {};
                deepMerge(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
        return target;
    }

    return deepMerge(merged, override);
}

/**
 * Get preset configurations
 * @returns {Object} Preset configurations
 */
function getFRVPPresets() {
    return {
        default: DEFAULT_FRVP_CONFIG,

        compact: {
            ...DEFAULT_FRVP_CONFIG,
            rowSize: 100,
            volumeProfile: {
                ...DEFAULT_FRVP_CONFIG.volumeProfile,
                width: 20
            }
        },

        detailed: {
            ...DEFAULT_FRVP_CONFIG,
            rowSize: 300,
            volumeProfile: {
                ...DEFAULT_FRVP_CONFIG.volumeProfile,
                width: 40,
                showValues: true
            }
        },

        minimal: {
            ...DEFAULT_FRVP_CONFIG,
            volumeProfile: {
                ...DEFAULT_FRVP_CONFIG.volumeProfile,
                enabled: false
            },
            indicators: {
                VAH: { enabled: true, color: '#ffc107', lineStyle: 'solid', width: 2 },
                VAL: { enabled: true, color: '#ffc107', lineStyle: 'solid', width: 2 },
                POC: { enabled: true, color: '#000000', lineStyle: 'solid', width: 3 },
                developingPOC: { enabled: false },
                developingVA: { enabled: false }
            }
        }
    };
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        DEFAULT_FRVP_CONFIG,
        validateFRVPConfig,
        mergeFRVPConfig,
        getFRVPPresets
    };
}
