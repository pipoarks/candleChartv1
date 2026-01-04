window.alertStore = {
    alerts: [], // Enhanced alert objects
    lastValues: {}, // Track last values
    logs: [] // Webhook logs
};

/**
 * Comparison Operators
 */
const comparisonOperators = {
    greater_than: { label: 'Greater Than (>)', symbol: '>', evaluate: (current, target, last) => current > target, requiresHistory: false },
    less_than: { label: 'Less Than (<)', symbol: '<', evaluate: (current, target, last) => current < target, requiresHistory: false },
    crosses_above: { label: 'Crosses Above', symbol: '↗', evaluate: (current, target, last) => last !== null && last <= target && current > target, requiresHistory: true },
    crosses_below: { label: 'Crosses Below', symbol: '↘', evaluate: (current, target, last) => last !== null && last >= target && current < target, requiresHistory: true }
};

/** AVAILABLE RESOURCES HELPERS */
function getAvailableHorizontalLines() {
    const lines = [];
    if (!window.drawingStore || !window.drawingStore.horizontalRays) return lines;
    window.drawingStore.horizontalRays.forEach(ray => {
        let paneName = 'Main Chart';
        let dataType = 'Price';
        if (ray.pane !== 'main') {
            const indicator = (window.activeIndicators || []).find(ind => ind.id === ray.pane);
            if (indicator) { paneName = indicator.type; dataType = indicator.type; }
        }
        lines.push({
            id: ray.id,
            name: `Horizontal Ray #${ray.number}`,
            value: ray.price,
            pane: ray.pane,
            paneName: paneName,
            dataType: dataType,
            displayText: `Ray #${ray.number} - ${paneName} (${Number(ray.price).toFixed(2)})`
        });
    });
    return lines;
}

function getAvailableDataSources() {
    const sources = [{ id: 'price', name: 'Price (Main Chart)', pane: 'main', displayText: 'Price Close' }];
    if (window.activeIndicators) {
        window.activeIndicators.forEach(ind => {
            sources.push({ id: ind.type.toLowerCase(), name: `${ind.type} Close`, pane: ind.id, displayText: `${ind.type} Close` });
        });
    }
    return sources;
}

function evaluateComparison(comparisonType, currentValue, targetValue, lastValue = null) {
    const operator = comparisonOperators[comparisonType];
    if (!operator) return false;
    if (operator.requiresHistory && lastValue === null) return false;
    return operator.evaluate(currentValue, targetValue, lastValue);
}

/** UI: INIT ALERT MODAL (Create or Edit) */
function initAlertModal(preselectedRayId = null, alertToEdit = null) {
    const existing = document.getElementById('alert-modal');
    if (existing) existing.remove();

    const horizontalLines = getAvailableHorizontalLines();
    const hasLines = horizontalLines.length > 0;

    // Defaults or Existing Values
    let title = `Create Alert on ${document.getElementById('symbol').value}`;
    let btnText = "Create Alert";
    let nameVal = document.getElementById('symbol').value;
    let limitVal = "1"; // Default to Once
    let expVal = "";
    let msgVal = "Alert Triggered: {{symbol}} conditions met.";
    let toastChecked = true;
    let soundChecked = true;
    let webhookChecked = true; // Enable by default as requested
    let webhookUrl = "http://nihongotranslator.online/postOrder";
    let webhookBody = '{\n  "ticker": "{{symbol}}",\n  "close": "{{close}}",\n  "action": "BUY"\n}';

    if (alertToEdit) {
        title = "Edit Alert";
        btnText = "Save Changes";
        nameVal = alertToEdit.name;
        limitVal = alertToEdit.triggerLimit.toString();
        expVal = alertToEdit.expiration;
        msgVal = alertToEdit.message;
        toastChecked = alertToEdit.notifyToast;
        soundChecked = alertToEdit.notifySound;
        webhookChecked = !!alertToEdit.webhook;
        webhookUrl = alertToEdit.webhook || "";
        if (alertToEdit.webhookBody) webhookBody = alertToEdit.webhookBody;
    } else {
        const expDate = new Date(); expDate.setMonth(expDate.getMonth() + 1);
        expVal = expDate.toISOString().slice(0, 16);
    }

    const modal = document.createElement('div');
    modal.id = 'alert-modal';
    modal.className = 'frvp-settings-modal alert-modal';
    // Store ID if editing
    if (alertToEdit) modal.dataset.editingId = alertToEdit.id;

    modal.innerHTML = `
        <div class="frvp-settings-content" style="max-width: 1000px; padding: 2rem;">
            <div class="frvp-settings-header" style="flex-direction: column; align-items: flex-start; gap: 1rem; margin-bottom: 2rem;">
                <h3>${title}</h3>
                <div class="alert-tabs">
                    <div class="alert-tab active" data-tab="settings" onclick="switchAlertTab(this)">Settings</div>
                    <div class="alert-tab" data-tab="message" onclick="switchAlertTab(this)">Message</div>
                    <div class="alert-tab" data-tab="notifications" onclick="switchAlertTab(this)">Notifications</div>
                </div>
                <span class="close-btn" style="top:1.5rem;" onclick="this.closest('#alert-modal').remove()">&times;</span>
            </div>
            
            <div class="frvp-settings-body">
                <!-- Settings Tab -->
                <div id="alert-tab-settings" class="alert-tab-content active">
                    ${(!hasLines && !alertToEdit) ? `<div class="alert-warning"><strong>⚠️ No Horizontal Lines</strong><p>Draw lines first.</p></div>` : ''}
                    
                    <div style="margin-bottom:1rem;">
                        <label style="font-size:0.9rem; color:var(--text-secondary);">Conditions (ALL must be true)</label>
                        <div id="conditions-list" style="display:flex; flex-direction:column; gap:0.5rem; margin-top:0.5rem;"></div>
                        <button class="btn-secondary" onclick="addConditionRow()" ${(!hasLines && !alertToEdit) ? 'disabled' : ''} style="margin-top:0.5rem; width:100%;">+ Add Condition</button>
                    </div>

                    <div class="settings-group">
                        <label>Trigger Frequency / Limit</label>
                        <select id="alert-trigger-limit">
                            <option value="1" ${limitVal === "1" ? "selected" : ""}>Only Once (1)</option>
                            <option value="2" ${limitVal === "2" ? "selected" : ""}>Twice (2)</option>
                            <option value="3" ${limitVal === "3" ? "selected" : ""}>3 Times</option>
                            <option value="-1" ${limitVal === "-1" ? "selected" : ""}>None (Unlimited)</option>
                        </select>
                        <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:0.25rem;">Checking on candle close.</div>
                    </div>

                    <div class="settings-group">
                        <label>Expiration</label>
                        <input type="datetime-local" id="alert-expiration" value="${expVal}" ${(!hasLines && !alertToEdit) ? 'disabled' : ''}>
                    </div>
                </div>

                <!-- Message Tab -->
                <div id="alert-tab-message" class="alert-tab-content">
                    <div class="settings-group"><label>Alert Name</label><input type="text" id="alert-name" placeholder="Alert Name" value="${nameVal}" ${(!hasLines && !alertToEdit) ? 'disabled' : ''}></div>
                    <div class="settings-group"><label>Message</label><textarea id="alert-message" style="width:100%; height:80px; background:rgba(0,0,0,0.2); border:1px solid var(--border-color); border-radius:8px; color:white; padding:10px;">${msgVal}</textarea></div>
                    <div class="alert-placeholder-list">
                         <span class="placeholder-chip" onclick="insertPlaceholder('alert-message', '{{symbol}}')">{{symbol}}</span>
                         <span class="placeholder-chip" onclick="insertPlaceholder('alert-message', '{{timeframe}}')">{{timeframe}}</span>
                    </div>
                </div>

                <!-- Notifications Tab -->
                <div id="alert-tab-notifications" class="alert-tab-content">
                    <div class="notification-item"><div class="notification-info"><div>Toast</div></div><input type="checkbox" id="notify-toast" ${toastChecked ? 'checked' : ''} ${(!hasLines && !alertToEdit) ? 'disabled' : ''}></div>
                    <div class="notification-item"><div class="notification-info"><div>Sound</div></div><input type="checkbox" id="notify-sound" ${soundChecked ? 'checked' : ''} ${(!hasLines && !alertToEdit) ? 'disabled' : ''}></div>
                    
                    <div class="notification-item"><div class="notification-info"><div>Webhook</div></div><input type="checkbox" id="notify-webhook" ${webhookChecked ? 'checked' : ''} ${(!hasLines && !alertToEdit) ? 'disabled' : ''}></div>
                    <div class="settings-group">
                        <input type="text" id="webhook-url" placeholder="https://..." value="${webhookUrl}" ${(!hasLines && !alertToEdit) ? 'disabled' : ''}>
                    </div>
                    
                    <div class="settings-group" style="margin-top:0.5rem;">
                        <label>Request Body (JSON)</label>
                        <textarea id="webhook-body" style="width:100%; height:120px; background:rgba(0,0,0,0.2); border:1px solid var(--border-color); border-radius:8px; color:white; padding:10px; font-family:monospace; font-size:0.8rem;">${webhookBody}</textarea>
                         <div class="alert-placeholder-list">
                              <span class="placeholder-chip" onclick="insertPlaceholder('webhook-body', '{{symbol}}')">{{symbol}}</span>
                              <span class="placeholder-chip" onclick="insertPlaceholder('webhook-body', '{{close}}')">{{close}}</span>
                              <span class="placeholder-chip" onclick="insertPlaceholder('webhook-body', '{{message}}')">{{message}}</span>
                              <span class="placeholder-chip" onclick="insertPlaceholder('webhook-body', '{{alert_name}}')">{{alert_name}}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="frvp-settings-footer">
                <button class="btn-primary" onclick="createAlert()" ${(!hasLines && !alertToEdit) ? 'disabled' : ''}>${btnText}</button>
            </div>
        </div>`;
    document.body.appendChild(modal);

    // Populate Conditions
    if (alertToEdit) {
        alertToEdit.conditions.forEach(c => addConditionRow(null, c));
    } else {
        addConditionRow(preselectedRayId);
    }
}

function addConditionRow(preselectedRayId = null, conditionData = null) {
    const list = document.getElementById('conditions-list');
    const sources = getAvailableDataSources();
    const lines = getAvailableHorizontalLines();
    const operators = comparisonOperators;

    let sourceVal = conditionData ? conditionData.dataSource : sources[0]?.id;
    let opVal = conditionData ? conditionData.comparisonType : 'greater_than';
    let lineVal = conditionData ? conditionData.horizontalLineId : (preselectedRayId || '');

    let sourceOptions = sources.map(s => `<option value="${s.id}" ${s.id === sourceVal ? 'selected' : ''}>${s.displayText}</option>`).join('');

    let lineOptions = '<option value="" disabled>Select Line...</option>';
    const linesByPane = {};
    lines.forEach(l => { if (!linesByPane[l.paneName]) linesByPane[l.paneName] = []; linesByPane[l.paneName].push(l); });

    Object.keys(linesByPane).forEach(pane => {
        lineOptions += `<optgroup label="${pane}">`;
        linesByPane[pane].forEach(l => {
            const isSel = l.id === lineVal ? 'selected' : '';
            lineOptions += `<option value="${l.id}" ${isSel}>${l.displayText}</option>`;
        });
        lineOptions += `</optgroup>`;
    });

    let opOptions = Object.keys(operators).map(k => `<option value="${k}" ${k === opVal ? 'selected' : ''}>${operators[k].label}</option>`).join('');

    const row = document.createElement('div');
    row.className = 'condition-row';
    row.style.cssText = `display:grid; grid-template-columns: 1.5fr 1fr 2fr 30px; gap:8px; align-items:center; background:rgba(255,255,255,0.05); padding:8px; border-radius:6px;`;
    row.innerHTML = `
        <select class="cond-source" style="width:100%;">${sourceOptions}</select>
        <select class="cond-op" style="width:100%;">${opOptions}</select>
        <select class="cond-line" style="width:100%;">${lineOptions}</select>
        <button onclick="this.closest('.condition-row').remove()" style="background:none; border:none; color:#ef4444; cursor:pointer;">✖</button>
    `;
    list.appendChild(row);
}

/** TABS & PLACEHOLDERS */
function switchAlertTab(el) {
    const tabName = el.getAttribute('data-tab');
    document.querySelectorAll('.alert-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.alert-tab-content').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    document.getElementById(`alert-tab-${tabName}`).classList.add('active');
}
function insertPlaceholder(targetId, val) {
    const ta = document.getElementById(targetId);
    if (ta) {
        ta.value = ta.value.slice(0, ta.selectionStart) + val + ta.value.slice(ta.selectionEnd);
        ta.focus();
    }
}

/** CREATE OR UPDATE ALERT */
function createAlert() {
    const modal = document.getElementById('alert-modal');
    const editingId = modal.dataset.editingId;

    const alertName = document.getElementById('alert-name').value;
    const triggerLimit = parseInt(document.getElementById('alert-trigger-limit').value);
    const webhookBodyRaw = document.getElementById('webhook-body').value;

    // Validate JSON
    try {
        // We only validate it parses if it doesn't contain placeholders that break syntax
        // Simple check: minimal validation
    } catch (e) {
        // alert('Invalid JSON in Request Body'); return; 
    }

    const rows = document.querySelectorAll('.condition-row');
    if (rows.length === 0) return alert('Add at least one condition');

    const conditions = [];
    let isValid = true;
    rows.forEach((row, i) => {
        const sourceId = row.querySelector('.cond-source').value;
        const opId = row.querySelector('.cond-op').value;
        const lineId = row.querySelector('.cond-line').value;
        if (!lineId) { alert(`Row ${i + 1}: Select line`); isValid = false; return; }
        const source = getAvailableDataSources().find(s => s.id === sourceId);
        const line = getAvailableHorizontalLines().find(l => l.id === lineId);

        if (!source || !line) {
            alert('Source or Line data missing. Please try again.'); isValid = false; return;
        }

        conditions.push({
            id: `cond_${Date.now()}_${i}`,
            dataSource: sourceId, dataSourceName: source.name, paneId: source.pane,
            comparisonType: opId, comparisonLabel: comparisonOperators[opId].label, comparisonSymbol: comparisonOperators[opId].symbol,
            horizontalLineId: lineId, horizontalLineName: line.name, horizontalLineValue: line.value
        });
    });
    if (!isValid) return;

    if (editingId) {
        // UPDATE EXISTING
        const alertObj = window.alertStore.alerts.find(a => a.id === editingId);
        if (alertObj) {
            alertObj.name = alertName || document.getElementById('symbol').value;
            alertObj.conditions = conditions;
            alertObj.triggerLimit = triggerLimit;
            if (alertObj.triggerLimit !== -1 && alertObj.triggerCount >= alertObj.triggerLimit) {
                alertObj.isActive = true;
            }
            alertObj.expiration = document.getElementById('alert-expiration').value;
            alertObj.message = document.getElementById('alert-message').value;
            alertObj.notifyToast = document.getElementById('notify-toast').checked;
            alertObj.notifySound = document.getElementById('notify-sound').checked;
            alertObj.webhook = document.getElementById('notify-webhook').checked ? document.getElementById('webhook-url').value : null;
            alertObj.webhookBody = webhookBodyRaw;

            showToast('Alert Updated', `Alert "${alertObj.name}" saved.`);
        }
    } else {
        // CREATE NEW
        const alertObj = {
            id: `alert_${Date.now()}`,
            name: alertName || document.getElementById('symbol').value,
            conditions: conditions,
            triggerMode: 'once_per_bar_close',
            triggerLimit: triggerLimit,
            triggerCount: 0,
            expiration: document.getElementById('alert-expiration').value,
            message: document.getElementById('alert-message').value,
            notifyToast: document.getElementById('notify-toast').checked,
            notifySound: document.getElementById('notify-sound').checked,
            webhook: document.getElementById('notify-webhook').checked ? document.getElementById('webhook-url').value : null,
            webhookBody: webhookBodyRaw,
            isActive: true,
            isValid: true,
            lastTriggeredBar: -1
        };
        window.alertStore.alerts.push(alertObj);
        showToast('Alert Created', `Alert "${alertObj.name}" created.`);
    }

    modal.remove();
    // Refresh Alert Manager if open
    if (document.getElementById('alert-manager-panel')) renderAlertManager();
}


/** EVALUATE ALERTS */
function evaluateAlerts(candleCloseData) {
    const symbol = document.getElementById('symbol').value;
    const timeframe = document.getElementById('resolution').value;
    const lines = getAvailableHorizontalLines();

    window.alertStore.alerts.forEach(alert => {
        if (!alert.isActive || !alert.isValid) return;
        if (new Date(alert.expiration) < new Date()) { alert.isActive = false; renderAlertManager(); return; }

        if (alert.triggerLimit !== -1 && alert.triggerCount >= alert.triggerLimit) {
            alert.isActive = false;
            return;
        }

        const allConditionsMet = alert.conditions.every((cond, i) => {
            const line = lines.find(l => l.id === cond.horizontalLineId);
            if (!line) return false;
            cond.horizontalLineValue = line.value;

            let val = null;
            if (cond.dataSource === 'price') val = candleCloseData.price?.close;
            else if (cond.dataSource === 'cvd') val = candleCloseData.cvd?.close;
            else if (candleCloseData[cond.dataSource]) val = candleCloseData[cond.dataSource]?.close;
            if (val === null || val === undefined) return false;

            const trackingKey = `${alert.id}_${i}`;
            const lastVal = window.alertStore.lastValues[trackingKey] || null;
            return evaluateComparison(cond.comparisonType, val, cond.horizontalLineValue, lastVal);
        });

        if (allConditionsMet) {
            handleAlertTrigger(alert, candleCloseData, symbol, timeframe);
        }

        alert.conditions.forEach((cond, i) => {
            let val = null;
            if (cond.dataSource === 'price') val = candleCloseData.price?.close;
            else if (cond.dataSource === 'cvd') val = candleCloseData.cvd?.close;
            else if (candleCloseData[cond.dataSource]) val = candleCloseData[cond.dataSource]?.close;
            if (val !== null) window.alertStore.lastValues[`${alert.id}_${i}`] = val;
        });
    });
}

function handleAlertTrigger(alert, data, symbol, timeframe) {
    if (alert.lastTriggeredBar === data.barIndex) return;
    alert.lastTriggeredBar = data.barIndex;
    alert.triggerCount++;

    let msg = alert.message.replace(/{{symbol}}/g, symbol).replace(/{{timeframe}}/g, timeframe);
    if (alert.notifyToast) showToast(`🔔 ${alert.name}`, msg);
    if (alert.notifySound) playAlertSound();

    // Create log entry for the trigger
    const logId = `log_${Date.now()}`;
    const logEntry = {
        id: logId,
        time: new Date(),
        alertName: alert.name,
        message: msg,
        url: alert.webhook || 'No Webhook',
        status: alert.webhook ? 'Pending' : 'Triggered',
        statusCode: null,
        error: null,
        body: null,
        price: data.price?.close?.toFixed(2) || 'N/A',
        cvd: data.cvd?.close ? (Math.abs(data.cvd.close) >= 1000 ? (data.cvd.close / 1000).toFixed(1) + 'K' : data.cvd.close.toFixed(0)) : null
    };

    window.alertStore.logs.unshift(logEntry);
    if (window.alertStore.logs.length > 50) window.alertStore.logs.pop();

    // SEND WEBHOOK
    if (alert.webhook) {
        let bodyToSend = {};
        if (alert.webhookBody) {
            let processedStr = alert.webhookBody
                .replace(/{{symbol}}/g, symbol)
                .replace(/{{message}}/g, msg)
                .replace(/{{alert_name}}/g, alert.name)
                .replace(/{{close}}/g, data.price?.close || "0");

            try {
                bodyToSend = JSON.parse(processedStr);
            } catch (e) {
                console.error("Failed to parse custom webhook body", e);
                bodyToSend = { error: "Invalid Custom Body", raw: processedStr };
            }
        } else {
            bodyToSend = {
                alertId: alert.id,
                alertName: alert.name,
                symbol: symbol,
                message: msg,
                time: new Date().toISOString(),
                data: data
            };
        }

        logEntry.body = JSON.stringify(bodyToSend, null, 2);
        sendWebhookProxy(alert.webhook, bodyToSend, logId);
    }

    if (alert.triggerLimit !== -1 && alert.triggerCount >= alert.triggerLimit) {
        alert.isActive = false;
        showToast('Info', `Alert "${alert.name}" limit reached (disabled).`);
    }

    renderAlertManager();
}

function sendWebhookProxy(targetUrl, payloadData, existingLogId) {
    const entry = window.alertStore.logs.find(l => l.id === existingLogId);

    fetch('http://localhost:3000/proxy_webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            url: targetUrl,
            method: 'POST',
            body: payloadData
        })
    })
        .then(async res => {
            const text = await res.text();
            if (entry) {
                entry.status = res.ok ? 'Success' : 'Failed';
                entry.statusCode = res.status;
                if (!res.ok) entry.error = text;
            }
        })
        .catch(err => {
            if (entry) {
                entry.status = 'Failed';
                entry.error = err.message;
            }
        })
        .finally(() => {
            if (activeSidebarTab === 'logs') renderSideLogs();
        });
}

function showAlertLogs() {
    let modal = document.getElementById('log-viewer-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'log-viewer-modal';
        modal.className = 'frvp-settings-modal';
        modal.style.zIndex = '1001'; // Above Alert Manager
        modal.innerHTML = `
            <div class="frvp-settings-content" style="max-width:800px; height:80vh; display:flex; flex-direction:column;">
                <div class="frvp-settings-header">
                    <h3>Webhook Logs</h3>
                    <span class="close-btn" onclick="this.closest('#log-viewer-modal').remove()">&times;</span>
                </div>
                <div style="padding:10px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between;">
                    <span style="color:var(--text-secondary); font-size:0.9rem;">Recent attempts (Max 50)</span>
                    <button onclick="clearAlertLogs()" style="background:none; border:none; color:#ef4444; cursor:pointer;">Clear Logs</button>
                </div>
                <div id="log-list-content" style="flex:1; overflow-y:auto; padding:0; background:rgba(0,0,0,0.2);"></div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    const container = document.getElementById('log-list-content');
    if (!container) return;

    if (window.alertStore.logs.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:50px; color:var(--text-secondary);">No logs record yet.</div>`;
        return;
    }

    container.innerHTML = window.alertStore.logs.map(log => {
        const color = log.status === 'Success' ? '#10b981' : (log.status === 'Pending' ? '#f59e0b' : '#ef4444');
        return `
            <div style="border-bottom:1px solid var(--border-color); padding:10px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <div style="font-weight:600; color:${color};">${log.status} ${log.statusCode ? `(${log.statusCode})` : ''}</div>
                    <div style="color:var(--text-secondary); font-size:0.8rem;">${log.time.toLocaleTimeString()}</div>
                </div>
                <div style="font-family:monospace; font-size:0.85rem; color:#e2e8f0; margin-bottom:4px; word-break:break-all;">${log.method} ${log.url}</div>
                ${log.error ? `<div style="color:#ef4444; font-size:0.85rem;">Error: ${log.error}</div>` : ''}
                <details style="margin-top:5px;">
                    <summary style="cursor:pointer; color:var(--text-secondary); font-size:0.8rem;">View Body</summary>
                    <pre style="background:rgba(0,0,0,0.3); padding:8px; border-radius:4px; overflow-x:auto; font-size:0.8rem; color:#94a3b8; margin-top:5px;">${log.body}</pre>
                </details>
            </div>
        `;
    }).join('');
}

function clearAlertLogs() {
    window.alertStore.logs = [];
    showAlertLogs(); // Refresh
}

// ALERT MANAGER COMPATIBILITY
function toggleAlertManager() {
    toggleSidebarTab('alerts');
}

function renderAlertManager() {
    renderSideAlerts();
}

function toggleAlertStatus(id, newStatus) {
    const alert = window.alertStore.alerts.find(a => a.id === id);
    if (alert) {
        alert.isActive = newStatus;
        renderSideAlerts();
    }
}

function deleteAlert(id) {
    if (confirm('Delete this alert?')) {
        window.alertStore.alerts = window.alertStore.alerts.filter(a => a.id !== id);
        renderSideAlerts();
    }
}

function editAlert(id) {
    const alert = window.alertStore.alerts.find(a => a.id === id);
    if (alert) {
        // Correct signature: initAlertModal(preselectedRayId, alertToEdit)
        initAlertModal(null, alert);
    }
}

// UTILS
function showToast(title, msg) { const t = document.createElement('div'); t.style.cssText = `position:fixed; top:20px; right:20px; background:var(--bg-secondary); border-left:4px solid var(--accent-primary); padding:15px 25px; border-radius:8px; box-shadow:0 5px 15px rgba(0,0,0,0.5); z-index:9999; animation:slideIn 0.3s ease-out; color:white; font-family:sans-serif;`; t.innerHTML = `<strong style="color:var(--accent-primary);display:block;margin-bottom:5px">${title}</strong><div style="font-size:0.9rem">${msg}</div>`; document.body.appendChild(t); setTimeout(() => t.remove(), 5000); }
function playAlertSound() { new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(() => { }); }

/**
 * SIDEBAR LOGIC
 */
let activeSidebarTab = 'alerts';

function toggleSidebarTab(tab) {
    const sidebar = document.getElementById('right-sidebar');
    const isOpen = sidebar.classList.contains('open');

    if (isOpen && activeSidebarTab === tab) {
        closeSidebar();
    } else {
        openSidebar(tab);
    }
}

function openSidebar(tab) {
    const sidebar = document.getElementById('right-sidebar');
    sidebar.classList.add('open');
    if (tab) switchSidebarTab(tab);
}

function closeSidebar() {
    const sidebar = document.getElementById('right-sidebar');
    sidebar.classList.remove('open');
}

function switchSidebarTab(tab) {
    activeSidebarTab = tab;

    // Update UI Tabs
    document.querySelectorAll('.sidebar-tab-btn').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');

    // Render Content
    if (tab === 'alerts') renderSideAlerts();
    else if (tab === 'logs') renderSideLogs();
}

function renderSideAlerts() {
    const container = document.getElementById('sidebar-content');
    if (!container) return;

    const alerts = window.alertStore.alerts;

    // Update Navbar Badge
    const activeCount = alerts.filter(a => a.isActive).length;
    const badge = document.getElementById('alert-badge');
    if (badge) {
        badge.textContent = activeCount;
        badge.style.display = activeCount > 0 ? 'block' : 'none';
    }

    if (alerts.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:50px 20px; color:var(--text-secondary);">
            <div style="font-size:2rem; margin-bottom:1rem;">⏰</div>
            <p>No alerts created yet.</p>
            <button class="btn-primary" onclick="initAlertModal()" style="margin-top:1rem; padding:0.5rem 1rem;">Create One</button>
        </div>`;
        return;
    }

    container.innerHTML = alerts.map(alert => {
        const statusColor = alert.isValid ? (alert.isActive ? 'var(--accent-success)' : 'var(--text-secondary)') : 'var(--accent-danger)';
        const statusText = alert.isValid ? (alert.isActive ? 'Active' : 'Stopped') : 'Invalid';
        const limitText = alert.triggerLimit === -1 ? '∞' : `${alert.triggerCount}/${alert.triggerLimit}`;

        return `
            <div class="sidebar-alert-item" style="border-left: 3px solid ${statusColor}">
                <div class="alert-item-header">
                    <div class="alert-item-name">${alert.name}</div>
                    <label class="switch" style="width: 30px; height: 16px;">
                        <input type="checkbox" ${alert.isActive && alert.isValid ? 'checked' : ''} onchange="toggleAlertStatus('${alert.id}', this.checked)" ${!alert.isValid ? 'disabled' : ''}>
                        <span class="slider round"></span>
                    </label>
                </div>
                
                <div class="alert-item-conditions">
                    ${alert.conditions.map(c => `<div>${c.dataSourceName} ${c.comparisonSymbol} ${c.horizontalLineName}</div>`).join('')}
                </div>

                <div class="alert-item-footer">
                    <div class="alert-status-pill">
                        <span class="status-dot" style="background: ${statusColor}"></span>
                        <span style="color: ${statusColor}">${statusText}</span>
                        <span style="margin-left: 8px; color: var(--text-secondary)">(${limitText})</span>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="editAlert('${alert.id}')" style="background:none; border:none; color:var(--accent-primary); cursor:pointer; font-size:0.75rem;">Edit</button>
                        <button onclick="deleteAlert('${alert.id}')" style="background:none; border:none; color:var(--accent-danger); cursor:pointer; font-size:0.75rem;">Delete</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderSideLogs() {
    const container = document.getElementById('sidebar-content');
    if (!container) return;

    const logs = window.alertStore.logs;

    // Update Log Badge
    const logBadge = document.getElementById('log-badge');
    if (logBadge) {
        logBadge.textContent = logs.length;
    }

    if (logs.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:50px 20px; color:var(--text-secondary);">
            <div style="font-size:2.5rem; margin-bottom:1rem;">📜</div>
            <p style="font-size:2.2rem;">No logs yet.</p>
        </div>`;
        return;
    }

    container.innerHTML = `
        <div style="display:flex; justify-content:flex-end; margin-bottom:1.5rem;">
            <button onclick="clearAlertLogs()" style="background:none; border:none; color:var(--accent-danger); cursor:pointer; font-size:2rem; font-weight:600;">Clear All Logs</button>
        </div>
        ${logs.map(log => {
        const color = log.status === 'Success' ? 'var(--accent-success)' : (log.status === 'Pending' ? '#f59e0b' : 'var(--accent-danger)');
        const alertName = log.alertName || 'Unknown Alert';
        return `
                <div class="sidebar-log-item" style="border-left: 3px solid ${color}; margin-bottom: 1rem; background: rgba(255,255,255,0.02); border-radius: 8px;">
                    <div style="display:flex; justify-content:space-between; align-items: center; margin-bottom: 8px;">
                        <span class="log-status" style="color:${color}; font-size: 2.2rem;">${log.status} ${log.statusCode ? `(${log.statusCode})` : ''}</span>
                        <span class="log-time" style="font-size: 1.8rem;">${log.time.toLocaleTimeString()}</span>
                    </div>
                    
                    <div style="margin-bottom: 8px;">
                        <div style="font-weight: 700; color: var(--text-primary); font-size: 2.1rem;">${alertName}</div>
                        <div style="color: var(--text-secondary); font-size: 1.9rem; margin-top: 4px;">${log.message}</div>
                    </div>

                    <div style="color:var(--accent-primary); font-family:monospace; word-break:break-all; font-size:1.7rem; margin-bottom:8px; opacity: 0.8;">
                        URL: ${log.url}
                    </div>

                    <div style="display:flex; flex-direction: column; gap: 10px; font-family: monospace; font-size: 1.8rem; margin-bottom: 12px; background: rgba(0,0,0,0.2); padding: 10px 15px; border-radius: 4px;">
                        ${log.price ? `<span>Price: <b style="color:white">${log.price}</b></span>` : ''}
                        ${log.cvd ? `<span>CVD: <b style="color:white">${log.cvd}</b></span>` : ''}
                    </div>

                    ${log.error ? `
                        <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px; padding: 12px; margin-bottom: 8px; color: #fca5a5; font-size: 1.8rem;">
                            <strong>Error:</strong> ${log.error}
                        </div>
                    ` : ''}

                    <details style="margin-top: 8px;">
                        <summary style="font-size:1.7rem; color:var(--text-secondary); cursor:pointer; font-weight: 500;">View Raw Payload</summary>
                        <pre style="background:rgba(0,0,0,0.4); padding:15px; border-radius:6px; font-size:1.7rem; margin-top:10px; overflow-x:auto; color: #94a3b8;">${log.body || 'No payload body'}</pre>
                    </details>
                </div>
            `;
    }).join('')}
    `;
}

// Override existing functions to sync with sidebar
const originalRenderAlertManager = window.renderAlertManager;
window.renderAlertManager = function () {
    if (originalRenderAlertManager) originalRenderAlertManager();
    renderSideAlerts();
};

const originalShowAlertLogs = window.showAlertLogs;
window.showAlertLogs = function () {
    if (originalShowAlertLogs) originalShowAlertLogs();
    if (activeSidebarTab === 'logs') renderSideLogs();
};

const originalClearLogs = window.clearAlertLogs;
window.clearAlertLogs = function () {
    if (originalClearLogs) originalClearLogs();
    renderSideLogs();
};

// Expose functions
window.initAlertModal = initAlertModal;
window.evaluateAlerts = evaluateAlerts;
window.getAvailableHorizontalLines = getAvailableHorizontalLines;
window.getAvailableDataSources = getAvailableDataSources;
window.switchAlertTab = switchAlertTab;
window.insertPlaceholder = insertPlaceholder;
window.createAlert = createAlert;
window.addConditionRow = addConditionRow;
window.toggleAlertManager = toggleAlertManager;
window.toggleAlertStatus = toggleAlertStatus;
window.deleteAlert = deleteAlert;
window.editAlert = editAlert;
window.showAlertLogs = showAlertLogs;
window.clearAlertLogs = clearAlertLogs;

window.toggleSidebarTab = toggleSidebarTab;
window.switchSidebarTab = switchSidebarTab;
window.closeSidebar = closeSidebar;
window.renderSideAlerts = renderSideAlerts;
window.renderSideLogs = renderSideLogs;

// Initial Badge Sync
setTimeout(() => {
    if (window.alertStore) {
        const badge = document.getElementById('alert-badge');
        if (badge) {
            const activeCount = window.alertStore.alerts.filter(a => a.isActive).length;
            badge.textContent = activeCount;
            badge.style.display = activeCount > 0 ? 'block' : 'none';
        }
    }
}, 1000);

console.log('✅ Sidebar Alert Management Logic Loaded');

