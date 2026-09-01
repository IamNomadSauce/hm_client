console.log("Utilities.js")
function calculatePrice(y, height, margin, minPrice, maxPrice) {
    return maxPrice - ((y - margin) / (height - 2 * margin)) * (maxPrice - minPrice);
}

function isMouseNearLine(mouseY, lineY, threshold = 5) {
    return Math.abs(mouseY - lineY) < threshold;
}

function calculateRR(entry, stop, target) {
    if (!entry || !stop || !target) return 0;
    const risk = Math.abs(entry - stop)
    const reward = Math.abs(target - entry)
    return (reward / risk).toFixed(2)
}

function calculateRisk(entry, stop) {
    if (!entry || !stop) return 0;
    return (Math.abs(entry - stop) / entry * 100).toFixed(2)
}

function priceToY(price, height, margin, minPrice, maxPrice) {
    return height - margin - ((price - minPrice) / (maxPrice - minPrice)) * (height - 2 * margin);
}

function barIndexFromX(x, chartState) {
    const margin = chartState.margin;
    const plotW = chartState.width - 2 * margin;
    const start = window.start || 0;
    const end = window.end || start + 1;
    const count = Math.max(1, end - start);
    const dataLen = window.stockData?.length ?? 0;
    if (dataLen <= 0) return 0;
    const idx = start + (x - margin) / (plotW / count);
    return Math.max(0, Math.min(dataLen - 1, Math.round(idx)));
}

function xFromBarIndex(barIndex, width, margin, viewStart, viewEnd) {
    const count = Math.max(1, viewEnd - viewStart);
    const candleWidth = (width - 2 * margin) / count;
    return margin + (barIndex - viewStart) * candleWidth + candleWidth / 2;
}

function indexFromTimestamp(ts) {
    const data = window.stockData;
    if (!data?.length || ts == null) return 0;
    let lo = 0;
    let hi = data.length - 1;
    if (ts <= data[lo].Timestamp) return lo;
    if (ts >= data[hi].Timestamp) return hi;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const t = data[mid].Timestamp;
        if (t === ts) return mid;
        if (t < ts) lo = mid + 1;
        else hi = mid - 1;
    }
    const before = Math.max(0, hi);
    const after = Math.min(data.length - 1, lo);
    return (Math.abs(data[after].Timestamp - ts) < Math.abs(data[before].Timestamp - ts)) ? after : before;
}

function xFromTimestamp(ts, width, margin, viewStart, viewEnd) {
    return xFromBarIndex(indexFromTimestamp(ts), width, margin, viewStart, viewEnd);
}

function trendFullyOutside(t0, t1, firstTs, lastTs) {
    if (firstTs == null || lastTs == null || t0 == null || t1 == null) return true;
    const lo = Math.min(t0, t1);
    const hi = Math.max(t0, t1);
    return hi < firstTs || lo > lastTs;
}

function pointFromMouse(x, y, chartState) {
    const barIndex = barIndexFromX(x, chartState);
    const candle = window.stockData?.[barIndex];
    return {
        barIndex,
        timestamp: candle?.Timestamp ?? null,
        price: calculatePrice(y, chartState.height, chartState.margin, chartState.minPrice, chartState.maxPrice)
    };
}

function measureStats(start, end) {
    const p1 = start.price;
    const p2 = end.price;
    const delta = p2 - p1;
    const pct = p1 !== 0 ? (delta / p1) * 100 : 0;
    const bars = Math.abs(end.barIndex - start.barIndex);
    return { delta, pct, bars };
}

function formatMeasurePrice(value) {
    const abs = Math.abs(value);
    const digits = abs < 1 ? 8 : 2;
    return value.toFixed(digits);
}

function positionMenuNear(menu, pageX, pageY, opts = {}) {
    const pad = opts.pad ?? 8;
    const offsetX = opts.offsetX ?? 12;
    const offsetY = opts.offsetY ?? 8;
    menu.style.position = 'fixed';
    menu.style.left = '0px';
    menu.style.top = '0px';
    menu.style.visibility = 'hidden';
    const rect = menu.getBoundingClientRect();
    let left = pageX + offsetX;
    let top = pageY + offsetY;
    if (left + rect.width > window.innerWidth - pad) {
        left = pageX - rect.width - offsetX;
    }
    if (top + rect.height > window.innerHeight - pad) {
        top = pageY - rect.height - offsetY;
    }
    left = Math.max(pad, Math.min(left, window.innerWidth - rect.width - pad));
    top = Math.max(pad, Math.min(top, window.innerHeight - rect.height - pad));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.visibility = 'visible';
}
window.positionMenuNear = positionMenuNear;
