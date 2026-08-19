window.alertLog = window.alertLog || [];
window.alertUnread = window.alertUnread || 0;

function formatAlertTime(ts) {
    const d = ts ? new Date(ts) : new Date();
    if (Number.isNaN(d.getTime())) return new Date().toLocaleTimeString();
    return d.toLocaleTimeString();
}

function formatAlertPrice(value) {
    if (value == null || value === '') return '';
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    return n < 1 ? n.toFixed(8) : n.toFixed(2);
}

window.recordAlert = function(entry) {
    const row = {
        id: entry.id || ('alert_' + Date.now() + '_' + Math.random().toString(16).slice(2)),
        time: entry.time || Date.now(),
        kind: entry.kind || 'Event',
        product: entry.product || '',
        detail: entry.detail || '',
        status: entry.status || ''
    };
    window.alertLog.unshift(row);
    if (window.alertLog.length > 200) window.alertLog.length = 200;
    const alertsPane = document.getElementById('alerts');
    if (!alertsPane || !alertsPane.classList.contains('active')) {
        window.alertUnread = (window.alertUnread || 0) + 1;
    }
    renderAlertLog();
    return row;
};

window.renderAlertLog = function() {
    const body = document.getElementById('alerts-tbody');
    if (body) {
        if (!window.alertLog.length) {
            body.innerHTML = '<tr><td colspan="5" class="text-secondary">No alerts yet</td></tr>';
        } else {
            body.innerHTML = window.alertLog.map(a => `
                <tr>
                    <td>${formatAlertTime(a.time)}</td>
                    <td>${a.kind}</td>
                    <td>${a.product}</td>
                    <td>${a.detail}</td>
                    <td>${a.status}</td>
                </tr>
            `).join('');
        }
    }
    const badge = document.getElementById('alerts-badge');
    if (badge) {
        if (window.alertUnread > 0) {
            badge.textContent = window.alertUnread;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }
};

function seedTriggeredAlerts() {
    const sources = [
        ...(window.exchange?.Triggers || []),
        ...(window.current_triggers || [])
    ];
    const seen = new Set();
    sources.forEach(t => {
        if (!t || t.status !== 'triggered' || seen.has(t.id)) return;
        seen.add(t.id);
        window.alertLog.push({
            id: 'seed_' + t.id,
            time: t.updated_at || t.created_at || Date.now(),
            kind: 'Trigger',
            product: t.product_id || '',
            detail: `${(t.type || 'trigger').replace(/_/g, ' ')} @ ${formatAlertPrice(t.price)}`,
            status: 'triggered'
        });
    });
    renderAlertLog();
}

function applyTriggerUpdate(data) {
    if (!data) return;
    const lists = [
        window.current_triggers,
        window.exchange?.Triggers,
        window.currentTradeSetup?.chainedTriggers
    ];
    lists.forEach(list => {
        if (!Array.isArray(list)) return;
        const idx = list.findIndex(t => t && Number(t.id) === Number(data.id));
        if (idx !== -1) {
            list[idx] = Object.assign({}, list[idx], data);
        }
    });
}

function handleTriggerEvent(data) {
    if (!data) return;
    applyTriggerUpdate(data);
    if (data.status === 'triggered') {
        const already = (window.alertLog || []).some(a => a.id === data.id || a.id === 'seed_' + data.id);
        if (!already) {
            recordAlert({
                id: data.id,
                kind: 'Trigger',
                product: data.product_id || '',
                detail: `${(data.type || 'trigger').replace(/_/g, ' ')} @ ${formatAlertPrice(data.price)}`,
                status: 'triggered'
            });
            if (typeof showTriggerNotification === 'function') {
                showTriggerNotification(data);
            } else if (typeof showToast === 'function') {
                showToast(`${data.product_id || ''}  ${(data.type || '').replace(/_/g, ' ')}  TRIGGERED`, 5000);
            }
        }
    }
    if (typeof window.updateSidebar === 'function') window.updateSidebar();
    if (window.stockData) {
        drawCandlestickChart(window.stockData, window.start, window.end);
    }
}

function handleFillEvent(data) {
    if (!data) return;
    recordAlert({
        id: data.id || data.trade_id || data.OrderID,
        kind: 'Fill',
        product: data.product_id || data.ProductID || '',
        detail: `${data.side || data.Side || ''} ${data.size || data.Size || ''} @ ${formatAlertPrice(data.price || data.Price)}`,
        status: data.status || 'filled'
    });
    if (typeof showToast === 'function') {
        showToast(`Fill  ${data.product_id || data.ProductID || ''}  @ ${formatAlertPrice(data.price || data.Price)}`, 4000);
    }
}

function connectToBackend() {
    if (window._sseConnecting) return;
    window._sseConnecting = true;
    if (window._eventSource) {
        window._eventSource.close();
        window._eventSource = null;
    }
    console.log("Connect To Backend")
    const backendURL = "http://192.168.1.118:31337";
    const eventSource = new EventSource(`${backendURL}/trigger/stream`);
    window._eventSource = eventSource;

    eventSource.onopen = () => {
        window._sseConnecting = false;
    };

    eventSource.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            switch (message.event) {
                case 'price':
                    updateChartPrice(message.data);
                    break;
                case 'candle':
                    updateChart(message.data);
                    break;
                case 'trigger':
                    handleTriggerEvent(message.data);
                    break;
                case 'fill':
                case 'order':
                    handleFillEvent(message.data);
                    break;
            }
        } catch (err) {
            console.error("Error processing message:", err, "Raw data:", event.data);
        }
    };

    eventSource.onerror = (error) => {
        console.error("SSE connection error:", error);
        window._sseConnecting = false;
        if (window._eventSource) {
            window._eventSource.close();
            window._eventSource = null;
        }
        setTimeout(() => {
            console.log("Attempting to reconnect...");
            connectToBackend();
        }, 5000);
    };

    eventSource.addEventListener('candle', (event) => {
        try {
            const candleUpdate = JSON.parse(event.data)
            updateChart(candleUpdate)
        } catch (err) {
            console.error("Error processing candle update:", err)
        }
    });

    eventSource.addEventListener('trigger', (event) => {
        try {
            handleTriggerEvent(JSON.parse(event.data));
        } catch (err) {
            console.error("Error processing trigger event:", err);
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    seedTriggeredAlerts();
    const alertsTab = document.getElementById('alerts-tab');
    if (alertsTab) {
        alertsTab.addEventListener('shown.bs.tab', () => {
            window.alertUnread = 0;
            renderAlertLog();
        });
    }
});


function updateChartPrice(priceUpdate) {

    if (priceUpdate.product_id !== selectedProduct.product_id) {
        return;
    }

    const latestPrice = priceUpdate.price;

    // Draw base chart first
    drawCandlestickChart(stockData, start, end);

    // Calculate price line position
    const width = canvas.width;
    const height = canvas.height;
    const margin = 50;

    const minPrice = Math.min(...stockData.slice(start, end).map(d => d.Low));
    const maxPrice = Math.max(...stockData.slice(start, end).map(d => d.High));

    const priceY = height - margin - ((latestPrice - minPrice) / (maxPrice - minPrice)) * (height - 2 * margin);

    // Draw price line
    ctx.beginPath();
    ctx.moveTo(margin, priceY);
    ctx.lineTo(width - margin, priceY);
    ctx.strokeStyle = '#00ff00';
    ctx.setLineDash([5, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Add price label
    ctx.fillStyle = '#00ff00';
    ctx.font = '12px Arial';
    ctx.fillText(`${latestPrice.toFixed(5)}`, width - 100, priceY - 5);
}


function updateChart(candleUpdate) {
    // Convert underscores to dashes in ProductID
    const formattedProductID = candleUpdate.ProductID.replace(/_/g, '-');
    // console.log("|", candleUpdate.ProductID, "\n", selectedProduct)

    const newCandle = {
        Timestamp: candleUpdate.Timestamp,
        Open: candleUpdate.Open,
        High: candleUpdate.High,
        Low: candleUpdate.Low,
        Close: candleUpdate.Close,
        Volume: candleUpdate.Volume
    };

    // Check if candle with same timestamp exists
    const existingIndex = stockData.findIndex(candle => candle.Timestamp === candleUpdate.Timestamp);
    // console.log(existingIndex)

    if (existingIndex !== -1) {
        // Update existing candle
        stockData[existingIndex] = newCandle;
    } else {
        // Add new candle
        stockData.push(newCandle);

        // prefer exclusive end === length for "at live edge"
        if (window.end >= window.stockData.length - 1) {
            const count = window.end - window.start;
            window.end = window.stockData.length;
            window.start = Math.max(0, window.end - count);
        }
    }

    // Sort candles by timestamp to ensure proper order
    stockData.sort((a, b) => a.Timestamp - b.Timestamp);

    // Redraw chart with updated data
    drawCandlestickChart(stockData, start, end);
}

