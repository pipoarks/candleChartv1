/**
 * Drawings Module
 * Manages drawing tools like Horizontal Ray, Trendlines, etc.
 */

// Global state for drawings
window.drawingStore = {
    horizontalRays: [], // { id, price, startTime, pane, series, config, alerts, number }
    activeTool: null,   // Current active drawing tool
    toolState: {},      // Internal state for current tool (e.g., first click point)
    selectedRayId: null, // ID of the currently selected ray for sticky toolbar
    nextRayNumber: 1    // Global counter for ray identification
};

/**
 * Activate the Horizontal Ray tool
 */
function activateHorizontalRayTool() {
    window.drawingStore.activeTool = 'horizontalRay';
    updateDrawingToolStatus('Horizontal Ray: Click on chart to place');

    // Add temporary crosshair style or cursor if needed
    if (window.chart) {
        window.chart.applyOptions({
            crosshair: {
                mode: 0 // Normal
            }
        });
    }
}

/**
 * Deactivate any active drawing tool
 */
function deactivateDrawingTool() {
    window.drawingStore.activeTool = null;
    window.drawingStore.toolState = {};
    updateDrawingToolStatus('');
}

/**
 * Handle chart clicks for drawing tools
 * This should be hooked into the chart's click event
 */
function handleDrawingChartClick(param) {
    if (!param.point) return;

    // 1. If we have an active tool, place the drawing
    if (window.drawingStore.activeTool) {
        if (param.time) {
            const tool = window.drawingStore.activeTool;
            if (tool === 'horizontalRay') placeHorizontalRay(param);
        }
        return;
    }

    // 2. If no tool is active, check if we clicked a ray to select it
    const sourcePaneId = param.paneId || 'main';
    let clickedRay = null;
    const clickThreshold = 10;

    window.drawingStore.horizontalRays.forEach(ray => {
        if (ray.pane !== sourcePaneId) return;

        let targetSeries = window.candleSeries;
        if (ray.pane !== 'main') {
            const ind = (window.activeIndicators || []).find(i => i.id === ray.pane);
            if (ind && ind.instance) targetSeries = ind.instance.series;
        }

        if (targetSeries) {
            const y = targetSeries.priceToCoordinate(ray.price);
            if (y !== null && Math.abs(y - param.point.y) < clickThreshold) {
                clickedRay = ray;
            }
        }
    });

    if (clickedRay) {
        // Deselect previous
        if (window.drawingStore.selectedRayId) {
            const prevId = window.drawingStore.selectedRayId;
            const prev = window.drawingStore.horizontalRays.find(r => r.id === prevId);
            if (prev && prev.series) {
                prev.series.applyOptions({ lineWidth: prev.config.width });
            }
            // Explicitly remove highlight
            handleRayFocus(prevId, false);
        }

        window.drawingStore.selectedRayId = clickedRay.id;

        // Highlight current
        if (clickedRay.series) {
            clickedRay.series.applyOptions({ lineWidth: 4 }); // Thicker for selection
        }

        handleRayFocus(clickedRay.id, true);
        console.log(`🎯 Ray selected: ${clickedRay.id}`);
    } else {
        // Deselect if clicking empty space
        if (window.drawingStore.selectedRayId) {
            const prevId = window.drawingStore.selectedRayId;
            const prev = window.drawingStore.horizontalRays.find(r => r.id === prevId);
            if (prev && prev.series) {
                prev.series.applyOptions({ lineWidth: prev.config.width });
            }
            window.drawingStore.selectedRayId = null;
            // Explicitly remove highlight
            handleRayFocus(prevId, false);
            console.log('💨 Ray deselected');
        }
    }
}

/**
 * Place a Horizontal Ray at the clicked position
 */
function placeHorizontalRay(param) {
    const paneId = param.paneId || 'main';
    let price = null;

    // Try to get price from the series that was clicked
    if (param.seriesData.size > 0) {
        for (const [series, data] of param.seriesData) {
            price = data.close ?? data.value;
            if (price !== undefined && price !== null) break;
        }
    }

    // Fallback: Use coordinateToPrice if we can find the series
    if (price == null) {
        if (paneId === 'main' && window.candleSeries) {
            price = window.candleSeries.coordinateToPrice(param.point.y);
        } else {
            // Find indicator series for the pane
            const ind = window.activeIndicators.find(i => i.id === paneId);
            if (ind && ind.instance && ind.instance.series) {
                price = ind.instance.series.coordinateToPrice(param.point.y);
            }
        }
    }

    if (price == null || isNaN(price)) return;

    const rayId = `ray_${Date.now()}`;
    const startTime = param.time;

    const config = {
        color: '#6366f1',
        width: 2,
        style: 'solid',
        showLabel: true
    };

    const ray = {
        id: rayId,
        price: price,
        startTime: startTime,
        pane: paneId,
        config: config,
        alerts: [],
        series: null,
        number: getNextRayNumber() // Dynamically find first available number
    };

    window.drawingStore.horizontalRays.push(ray);
    renderHorizontalRay(ray);

    // PERSISTENT LEGEND: Create it immediately
    showDrawingToolbar(ray, null, paneId);

    deactivateDrawingTool();
    saveDrawings();
    console.log(`📍 Ray placed on ${paneId} at ${Number(price).toFixed(2)}`);
}

/**
 * Render a Horizontal Ray on the chart
 */
function renderHorizontalRay(ray) {
    const futureTime = 2524608000;

    // Determine which chart to draw on
    let targetChart = window.chart;
    if (ray.pane !== 'main') {
        const ind = (window.activeIndicators || []).find(i => i.id === ray.pane);
        if (ind && ind.instance && ind.instance.chart) {
            targetChart = ind.instance.chart;
        }
    }

    // [FIX] Cleanup existing series if any to prevent duplicates during re-renders
    if (ray.series) {
        try { targetChart.removeSeries(ray.series); } catch (e) { }
        ray.series = null;
    }

    const raySeries = targetChart.addLineSeries({
        color: ray.config.color,
        lineWidth: ray.config.width,
        lineStyle: getLineStyleConstant(ray.config.style),
        title: 'Horizontal Ray',
        lastValueVisible: ray.config.showLabel,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
        autoscaleInfoProvider: () => null,
    });

    raySeries.setData([
        { time: ray.startTime, value: ray.price },
        { time: futureTime, value: ray.price }
    ]);

    ray.series = raySeries;
}

/**
 * Re-render all drawings for a specific pane
 */
function renderDrawingsForPane(paneId) {
    if (!window.drawingStore || !window.drawingStore.horizontalRays) return;
    window.drawingStore.horizontalRays.forEach(ray => {
        if (ray.pane === paneId) {
            renderHorizontalRay(ray);
        }
    });
}

/**
 * Helper to update status UI
 */
function updateDrawingToolStatus(msg) {
    const statusEl = document.getElementById('drawingToolStatus');
    if (statusEl) {
        statusEl.textContent = msg;
        statusEl.className = msg ? 'tool-status active' : 'tool-status';
    }
}

/**
 * Get LineStyle constant for Lightweight Charts
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
 * Find the lowest available number for a new ray
 */
function getNextRayNumber() {
    if (!window.drawingStore.horizontalRays) return 1;

    // Get all existing numbers
    const existing = new Set(window.drawingStore.horizontalRays.map(r => r.number));

    // Find first free integer starting from 1
    let num = 1;
    while (existing.has(num)) {
        num++;
    }
    return num;
}

// Export functions to window
window.activateHorizontalRayTool = activateHorizontalRayTool;
window.handleDrawingChartClick = handleDrawingChartClick;

/**
 * Handle crosshair move for proximity detection
 */
let hoveredRayId = null;
let isMouseOverToolbar = false;

function handleDrawingCrosshairMove(param) {
    if (!param.point || window.drawingStore.activeTool || isMouseOverToolbar) return;

    // If a ray is selected, DO NOT change the toolbar based on hover
    if (window.drawingStore.selectedRayId) return;

    const sourcePaneId = param.paneId || 'main';

    // Check distance to all rays
    let hoveredRay = null;
    const threshold = 10; // pixels for entry
    const exitThreshold = 25; // larger threshold for exit to avoid flickering

    window.drawingStore.horizontalRays.forEach(ray => {
        if (ray.pane !== sourcePaneId) return;

        let targetSeries = window.candleSeries;
        if (ray.pane !== 'main') {
            const ind = (window.activeIndicators || []).find(i => i.id === ray.pane);
            if (ind && ind.instance) {
                targetSeries = ind.instance.series;
            }
        }

        if (targetSeries) {
            const y = targetSeries.priceToCoordinate(ray.price);
            if (y !== null) {
                const distance = Math.abs(y - param.point.y);

                // If this is already the hovered ray, use a larger threshold to keep it stable
                const currentThreshold = (ray.id === hoveredRayId) ? exitThreshold : threshold;

                if (distance < currentThreshold) {
                    hoveredRay = ray;
                }
            }
        }
    });

    if (hoveredRay) {
        // Just handle highlight/focus
        if (hoveredRay.id !== hoveredRayId) {
            handleRayFocus(hoveredRay.id, true);
            hoveredRayId = hoveredRay.id;
        }
    } else {
        if (hoveredRayId) {
            handleRayFocus(hoveredRayId, false);
            hoveredRayId = null;
        }
    }
}

/**
 * Handle visual focus (highlight) for a ray in the legend
 */
function handleRayFocus(id, active) {
    if (!id) return;
    const item = document.getElementById(`legend_item_ray_${id}`);
    if (!item) return;

    if (active) {
        item.classList.add('drawing-active');
    } else {
        // Don't remove if it's the SELECTED ray
        if (window.drawingStore.selectedRayId !== id) {
            item.classList.remove('drawing-active');
        }
    }
}



function showDrawingToolbar(ray, point, paneId) {
    if (window.updateLegendItem) {
        const title = `Horizontal Ray #${ray.number || ''}`;
        window.updateLegendItem(paneId, `ray_${ray.id}`, title, [], [
            { icon: '⚙️', title: 'Settings', onclick: `openRaySettings('${ray.id}')` },
            { icon: '⏰', title: 'Create Alert', onclick: `openAlertModal('${ray.id}')`, class: 'alert-btn' },
            { icon: '🗑️', title: 'Delete', onclick: `deleteRay('${ray.id}')`, class: 'delete' }
        ]);

        // Add 'drawing-active' class to make it highlight
        const item = document.getElementById(`legend_item_ray_${ray.id}`);
        if (item) item.classList.add('drawing-active');
    }
}


function hideDrawingToolbar(force = false, specificId = null) {
    // DO NOT HIDE the selected ray unless forced
    if (window.drawingStore.selectedRayId && !force) return;

    // Normal behavior: remove focus highlight instead of removing legend
    const idToFocus = hoveredRayId || window.drawingStore.selectedRayId;
    if (idToFocus) {
        handleRayFocus(idToFocus, false);
    }
}

/**
 * Delete a ray
 */
function deleteRay(id) {
    const index = window.drawingStore.horizontalRays.findIndex(r => r.id === id);
    if (index !== -1) {
        const ray = window.drawingStore.horizontalRays[index];

        let targetChart = window.chart;
        if (ray.pane !== 'main') {
            const ind = (window.activeIndicators || []).find(i => i.id === ray.pane);
            if (ind && ind.instance) targetChart = ind.instance.chart;
        }

        if (targetChart && ray.series) {
            targetChart.removeSeries(ray.series);
        }

        if (window.drawingStore.selectedRayId === id) {
            window.drawingStore.selectedRayId = null;
        }

        // Explicitly remove the legend item for this specific ray
        if (window.removeLegendItem) {
            window.removeLegendItem(`ray_${id}`);
        }

        window.drawingStore.horizontalRays.splice(index, 1);

        // Reset counter if all rays are deleted
        if (window.drawingStore.horizontalRays.length === 0) {
            window.drawingStore.nextRayNumber = 1;
            console.log('🔄 Ray counter reset to 1');
        }
        // Invalidate alerts referencing this line
        if (window.alertStore && window.alertStore.alerts) {
            let invalidatedCount = 0;
            window.alertStore.alerts.forEach(alert => {
                if (!alert.isValid) return;

                // Check if ANY condition in the alert references this deleted line
                const affectsAlert = alert.conditions && alert.conditions.some(c => c.horizontalLineId === id);

                if (affectsAlert) {
                    alert.isValid = false;
                    invalidatedCount++;
                    console.warn(`⚠️ Alert "${alert.name}" invalidated - horizontal line deleted`);
                }
            });

            // Notify user if any alerts were invalidated
            if (invalidatedCount > 0 && window.showToast) {
                const msg = invalidatedCount === 1
                    ? '1 alert invalidated - horizontal line deleted'
                    : `${invalidatedCount} alerts invalidated - horizontal line deleted`;
                window.showToast('Alerts Invalidated', msg);
            }
        }

        hideDrawingToolbar(true); // Force hide remaining hovered states
        console.log(`🗑️ Ray deleted: ${id}`);
    }
}



// --- Mouse Event Handling for Dragging ---
let isDragging = false;
let draggedRay = null;

function setupDrawingListeners() {
    if (drawingListenersInitialized) return;

    // Helper to find parent chart container
    const getChartContainer = (el) => {
        const mainEl = document.getElementById('tvchart');
        if (mainEl && mainEl.contains(el)) return { el: mainEl, id: 'main' };

        // Find in indicators
        const indicators = window.activeIndicators || [];
        for (const ind of indicators) {
            const indEl = document.getElementById(ind.elId);
            if (indEl && indEl.contains(el)) return { el: indEl, id: ind.id };
        }
        return null;
    };

    window.addEventListener('mousedown', (e) => {
        if (window.drawingStore.activeTool) return;

        const containerInfo = getChartContainer(e.target);
        if (!containerInfo) return;

        const rect = containerInfo.el.getBoundingClientRect();
        const mouseY = e.clientY - rect.top;

        window.drawingStore.horizontalRays.forEach(ray => {
            // Only consider rays on THIS pane
            if (ray.pane !== containerInfo.id) return;

            let targetSeries = window.candleSeries;
            if (ray.pane !== 'main') {
                const ind = (window.activeIndicators || []).find(i => i.id === ray.pane);
                if (ind && ind.instance) targetSeries = ind.instance.series;
            }

            if (targetSeries) {
                const y = targetSeries.priceToCoordinate(ray.price);
                if (y !== null && Math.abs(y - mouseY) < 10) {
                    isDragging = true;
                    draggedRay = ray;

                    // Disable scroll/scale on the specific chart
                    let targetChart = window.chart;
                    if (ray.pane !== 'main') {
                        const ind = (window.activeIndicators || []).find(i => i.id === ray.pane);
                        if (ind && ind.instance) targetChart = ind.instance.chart;
                    }
                    if (targetChart) {
                        targetChart.applyOptions({ handleScroll: false, handleScale: false });
                    }
                }
            }
        });
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging || !draggedRay) return;

        // Find the container of the dragged ray
        let containerEl = document.getElementById('tvchart');
        if (draggedRay.pane !== 'main') {
            const ind = (window.activeIndicators || []).find(i => i.id === draggedRay.pane);
            if (ind) containerEl = document.getElementById(ind.elId);
        }

        if (!containerEl) return;

        const rect = containerEl.getBoundingClientRect();
        const mouseY = e.clientY - rect.top;

        let targetSeries = window.candleSeries;
        if (draggedRay.pane !== 'main') {
            const ind = (window.activeIndicators || []).find(i => i.id === draggedRay.pane);
            if (ind && ind.instance) targetSeries = ind.instance.series;
        }

        if (targetSeries) {
            const newPrice = targetSeries.coordinateToPrice(mouseY);
            if (newPrice !== null) {
                draggedRay.price = newPrice;
                const futureTime = 2524608000;
                if (draggedRay.series) {
                    draggedRay.series.setData([
                        { time: draggedRay.startTime, value: draggedRay.price },
                        { time: futureTime, value: draggedRay.price }
                    ]);
                }

                // Legend follows if visible
                if (window.updateLegendItem && window.drawingStore.selectedRayId === draggedRay.id) {
                    showDrawingToolbar(draggedRay, null, draggedRay.pane);
                }
            }
        }
    });

    window.addEventListener('mouseup', () => {
        if (isDragging && draggedRay) {
            // Re-enable scroll/scale
            let targetChart = window.chart;
            if (draggedRay.pane !== 'main') {
                const ind = (window.activeIndicators || []).find(i => i.id === draggedRay.pane);
                if (ind && ind.instance) targetChart = ind.instance.chart;
            }
            if (targetChart) {
                targetChart.applyOptions({ handleScroll: true, handleScale: true });
            }

            isDragging = false;
            draggedRay = null;
            triggerSave(); // Save final position
        }
    });

    drawingListenersInitialized = true;
}

let drawingListenersInitialized = false;

// Initial attempt (may fail if script loads early)
if (document.readyState === 'complete') {
    setupDrawingListeners();
} else {
    window.addEventListener('load', setupDrawingListeners);
}

window.setupDrawingListeners = setupDrawingListeners;

/**
 * Settings Modal
 */
function openRaySettings(id) {
    const ray = window.drawingStore.horizontalRays.find(r => r.id === id);
    if (!ray) return;

    // Remove existing if any
    const existing = document.getElementById('ray-settings-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'ray-settings-modal';
    modal.className = 'frvp-settings-modal alert-modal'; // Reuse FRVP modal styles

    modal.innerHTML = `
        <div class="frvp-settings-content">
            <div class="frvp-settings-header">
                <h3>Horizontal Ray Settings</h3>
                <span class="close-btn" onclick="this.closest('#ray-settings-modal').remove()">&times;</span>
            </div>
            <div class="frvp-settings-body">
                <div class="settings-group">
                    <label>Color</label>
                    <input type="color" id="ray-color" value="${ray.config.color}">
                </div>
                <div class="settings-group">
                    <label>Width</label>
                    <input type="number" id="ray-width" value="${ray.config.width}" min="1" max="10">
                </div>
                <div class="settings-group">
                    <label>Style</label>
                    <select id="ray-style">
                        <option value="solid" ${ray.config.style === 'solid' ? 'selected' : ''}>Solid</option>
                        <option value="dotted" ${ray.config.style === 'dotted' ? 'selected' : ''}>Dotted</option>
                        <option value="dashed" ${ray.config.style === 'dashed' ? 'selected' : ''}>Dashed</option>
                    </select>
                </div>
                <div class="settings-group">
                    <label class="checkbox-wrap">
                        <input type="checkbox" id="ray-label" ${ray.config.showLabel ? 'checked' : ''}> Show Price Label
                    </label>
                </div>
            </div>
            <div class="frvp-settings-footer">
                <button class="btn-primary" onclick="applyRaySettings('${ray.id}')">Apply</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

function applyRaySettings(id) {
    const ray = window.drawingStore.horizontalRays.find(r => r.id === id);
    if (!ray) return;

    ray.config.color = document.getElementById('ray-color').value;
    ray.config.width = parseInt(document.getElementById('ray-width').value);
    ray.config.style = document.getElementById('ray-style').value;
    ray.config.showLabel = document.getElementById('ray-label').checked;

    // Re-render
    if (ray.series) {
        ray.series.applyOptions({
            color: ray.config.color,
            lineWidth: ray.config.width,
            lineStyle: getLineStyleConstant(ray.config.style),
            lastValueVisible: ray.config.showLabel
        });
    }

    document.getElementById('ray-settings-modal').remove();
    console.log(`✅ Ray settings applied: ${id}`);
}

/**
 * Alert Modal
 */
function openAlertModal(id) {
    const ray = window.drawingStore.horizontalRays.find(r => r.id === id);
    if (!ray) return;

    // Alert logic will be implemented in alerts.js
    if (window.initAlertModal) {
        window.initAlertModal(ray);
    } else {
        console.warn('Alert module not loaded yet');
    }
}
/**
 * Persistence Logic
 */
function saveDrawings() {
    const raysData = window.drawingStore.horizontalRays.map(ray => {
        const { series, ...rest } = ray;
        return rest;
    });

    const storeToSave = {
        rays: raysData,
        nextRayNumber: window.drawingStore.nextRayNumber
    };

    localStorage.setItem('trading_drawings', JSON.stringify(storeToSave));
}

function restoreDrawings() {
    const saved = localStorage.getItem('trading_drawings');
    if (!saved) return;

    try {
        const parsed = JSON.parse(saved);

        // Handle legacy format (just an array) vs new format (object with metadata)
        const rays = Array.isArray(parsed) ? parsed : (parsed.rays || []);
        if (!Array.isArray(parsed) && parsed.nextRayNumber) {
            window.drawingStore.nextRayNumber = parsed.nextRayNumber;
        }

        window.drawingStore.horizontalRays = [];

        rays.forEach(rayData => {
            const ray = {
                ...rayData,
                series: null
            };
            window.drawingStore.horizontalRays.push(ray);
            renderHorizontalRay(ray);

            // PERSISTENT LEGEND: Restore for all saved rays
            showDrawingToolbar(ray, null, ray.pane);
        });

        // Safety: If no rays exist after restore, ensure counter is 1
        if (window.drawingStore.horizontalRays.length === 0) {
            window.drawingStore.nextRayNumber = 1;
        }

        console.log(`♻️ Restored ${rays.length} drawing(s), Next Number: ${window.drawingStore.nextRayNumber}`);
    } catch (e) {
        console.error('Failed to restore drawings:', e);
    }
}

function triggerSave() {
    saveDrawings();
}

// Function Wrapping for Auto-Save
const originalPlace = window.placeHorizontalRay;
window.placeHorizontalRay = function (param) {
    if (typeof originalPlace === 'function') originalPlace(param);
    triggerSave();
};

// Override globally to catch all ways delete might be called
const originalDelete = window.deleteRay;
window.deleteRay = function (id) {
    if (typeof originalDelete === 'function') originalDelete(id);
    triggerSave();
};

const originalApply = window.applyRaySettings;
window.applyRaySettings = function (id) {
    if (typeof originalApply === 'function') originalApply(id);
    triggerSave();
};

// Style Templates Logic
function saveStyleTemplate(name, config) {
    const templates = JSON.parse(localStorage.getItem('drawing_templates') || '{}');
    templates[name] = config;
    localStorage.setItem('drawing_templates', JSON.stringify(templates));
}

function getStyleTemplates() {
    return JSON.parse(localStorage.getItem('drawing_templates') || '{}');
}

window.restoreDrawings = restoreDrawings;
window.renderHorizontalRay = renderHorizontalRay;
window.renderDrawingsForPane = renderDrawingsForPane;
window.setupDrawingListeners = setupDrawingListeners;
window.deleteRay = deleteRay;
window.applyRaySettings = applyRaySettings;
window.saveStyleTemplate = saveStyleTemplate;
window.getStyleTemplates = getStyleTemplates;
window.handleDrawingCrosshairMove = handleDrawingCrosshairMove;
window.openRaySettings = openRaySettings;
window.openAlertModal = openAlertModal;

/**
 * Clear All Drawings (Reset)
 */
function clearAllDrawings() {
    // 1. Remove series from charts
    if (window.drawingStore && window.drawingStore.horizontalRays) {
        window.drawingStore.horizontalRays.forEach(ray => {
            let targetChart = window.chart;
            if (ray.pane !== 'main') {
                const ind = (window.activeIndicators || []).find(i => i.id === ray.pane);
                if (ind && ind.instance) targetChart = ind.instance.chart;
            }
            if (targetChart && ray.series) {
                try { targetChart.removeSeries(ray.series); } catch (e) { }
            }
            // Remove legend item
            if (window.removeLegendItem) {
                window.removeLegendItem(`ray_${ray.id}`);
            }
        });
    }

    // 2. Clear state
    window.drawingStore.horizontalRays = [];
    window.drawingStore.nextRayNumber = 1;
    window.drawingStore.selectedRayId = null;

    // 3. Invalidate Alerts
    if (window.alertStore && window.alertStore.alerts) {
        window.alertStore.alerts.forEach(a => {
            if (a.isValid) {
                a.isValid = false;
                a.isActive = false; // Disable invalid alerts
            }
        });
        if (window.renderAlertManager) window.renderAlertManager();
    }

    // 4. Save empty state
    triggerSave();

    console.log('🧹 All drawings cleared, counter reset to 1');
}
window.clearAllDrawings = clearAllDrawings;
