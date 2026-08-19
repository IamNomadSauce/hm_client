// event_handlers.js

window.mouseX = 0;
window.mouseY = 0;
window.currentTool = null
window.drawingStart = null
window.draw_boxes = []
window.draw_lines = []
window.measures = window.measures || []
window.measureDraft = null
window.measureHitAreas = []
window.hoveredMeasureId = null
window.activeLineIndex = -1;

// Bracket Dragging Support
window.draggingBracketPoint = null;   // { bracketId, type: 'entry' | 'stop' | 'pt' }
window.hoveredBracketPoint = null;

function getBarCount() {
    return Math.max(1, window.end - window.start)
}

function clampViewport(start, end, dataLen) {
    let count = end -start
    const minB = window.minVisibleBars || 15
    const maxB = dataLen
    count = Math.max(minB, Math.min(maxB, count))

    let s = start
    let e = s + count
    if (s< 0) { s = 0; e = count; }
    if (e > dataLen) { e = dataLen; s = e - count }
    if (s < 0) s = 0
    return { start: s, end: e }
}

function zoomXAroundPixel(mouseX, zoomIn, intensity) {
    const data = window.stockData
    if (!data?.length) return

    const cs = window.chartState
    const margin = cs?.margin ?? 50
    const width = cs?.width ?? canvas.width
    const plotW = width - 2 * margin
    const fraction = Math.min(1, Math.max(0, (mouseX - margin) / plotW))

    const oldCount = getBarCount()
    const factor = zoomIn ? (1 - intensity) : (1 + intensity)
    let newCount = Math.round(oldCount * factor)
    newCount = Math.max(window.minVisibleBars || 15, Math.min(data.length, newCount))

    const anchor  = window.start + fraction * oldCount
    let newStart = anchor - fraction * newCount
    let newEnd  = newStart + newCount

    const v = clampViewport(newStart, newEnd, data.length)
    window.start = Math.round(v.start)
    window.end = Math.round(v.end)
}

function applyYScaleFromDrag(dy, startMin, startMax) {
    const mid = (startMin + startMax) / 2
    const half = (startMax - startMin) / 2
    const scale = Math.exp(dy * 0.01)
    const newHalf = Math.max(half * scale, (Math.abs(mid) || 1) * 1e-8)
    window.priceScale.mode = 'manual'
    window.priceScale.min = mid - newHalf
    window.priceScale.max = mid + newHalf
}

function isOnPriceAxis(mouseX, chartState) {
    if (!chartState) return false
    return mouseX >= chartState.width - chartState.margin
}

// ==================== TOOL SELECTORS ====================

function clearToolbarHighlights() {
    document.querySelectorAll('#chart-toolbar button').forEach(btn => {
        btn.style.boxShadow = 'none';
        btn.style.transform = 'scale(1)';
    });
}

function highlightActiveTool() {
    clearToolbarHighlights();
    document.querySelectorAll('#chart-toolbar button').forEach(btn => {
        const isMeasure = btn.dataset.tool === 'measure' && window.currentTool === 'measure';
        const isLong = window.currentTool === 'bracket' && window.currentBracketSide === 'long' && btn.textContent.includes('LONG');
        const isShort = window.currentTool === 'bracket' && window.currentBracketSide === 'short' && btn.textContent.includes('SHORT');
        if (isMeasure || isLong || isShort) {
            btn.style.boxShadow = '0 0 0 3px white';
            btn.style.transform = 'scale(1.1)';
        }
    });
}

window.setCurrentTool = function(tool) {
    if (window.currentTool === tool) {
        window.currentTool = null;
        window.currentBracketSide = null;
        window.measureDraft = null;
        clearToolbarHighlights();
        if (typeof drawCandlestickChart === 'function' && window.stockData) {
            drawCandlestickChart(window.stockData, window.start, window.end);
        }
        return;
    }

    window.currentTool = tool;
    window.currentBracketSide = null;
    if (tool !== 'measure') window.measureDraft = null;
    highlightActiveTool();
};


window.clearAllDrawings = function() {
    if (confirm("Clear all drawn lines and brackets?")) {
        draw_lines = [];
        window.measures = [];
        window.measureDraft = null;
        window.currentTradeSetup = null;
        drawCandlestickChart(window.stockData, window.start, window.end);
        if (typeof window.updateSidebar === 'function') window.updateSidebar();
    }
};

// Simple toast helper (if not already defined)
function showToast(msg, duration = 2000) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
        background: #1e1e2e; color: #0f0; padding: 12px 20px; border-radius: 8px;
        border: 1px solid #0f0; z-index: 9999; font-weight: bold;
        box-shadow: 0 4px 15px rgba(0,0,0,0.6);
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
}

current_triggers = []

function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

function findMeasureCloseAt(x, y) {
    const hits = window.measureHitAreas || [];
    for (let i = hits.length - 1; i >= 0; i--) {
        const hit = hits[i];
        if (x >= hit.x && x <= hit.x + hit.w && y >= hit.y && y <= hit.y + hit.h) {
            return hit;
        }
    }
    return null;
}

function findHoveredMeasure(x, y) {
    const close = findMeasureCloseAt(x, y);
    if (close) return close.id;
    const measures = window.measures || [];
    const cs = window.chartState;
    if (!cs || !measures.length) return null;
    let closestId = null;
    let closestDist = 8;
    measures.forEach(m => {
        const p1 = measureScreenPoint(m.start, cs);
        const p2 = measureScreenPoint(m.end, cs);
        if (!p1 || !p2) return;
        const dist = distanceToLineSegment(x, y, p1.x, p1.y, p2.x, p2.y);
        if (dist < closestDist) {
            closestDist = dist;
            closestId = m.id;
        }
    });
    return closestId;
}

function measureScreenPoint(pt, chartState) {
    if (!pt || !chartState) return null;
    return {
        x: xFromBarIndex(pt.barIndex, chartState.width, chartState.margin, window.start, window.end),
        y: priceToY(pt.price, chartState.height, chartState.margin, chartState.minPrice, chartState.maxPrice)
    };
}

function removeMeasureById(id) {
    window.measures = (window.measures || []).filter(m => m.id !== id);
    if (window.hoveredMeasureId === id) window.hoveredMeasureId = null;
}

function cancelMeasureDraft() {
    window.measureDraft = null;
    window.currentTool = null;
    window.currentBracketSide = null;
    clearToolbarHighlights();
}

function handleMeasurePointer(x, y, chartState) {
    const point = pointFromMouse(x, y, chartState);
    window.suppressNextChartClick = true;
    if (!window.measureDraft) {
        window.measureDraft = { start: point };
        window.currentTool = 'measure';
        highlightActiveTool();
        return 'started';
    }
    window.measures = window.measures || [];
    window.measures.push({
        id: 'measure_' + Date.now(),
        start: window.measureDraft.start,
        end: point
    });
    window.measureDraft = null;
    window.currentTool = null;
    clearToolbarHighlights();
    return 'committed';
}

window.setupEventListeners = function() {
    if (window._chartListenersBound) return;
    window._chartListenersBound = true;
    console.log("Setup Event Listeners");

    // ==================== MOUSE MOVE ====================
    canvas.addEventListener('mousemove', function(event) {
        const rect = canvas.getBoundingClientRect();
        window.mouseX = event.clientX - rect.left;
        window.mouseY = event.clientY - rect.top;

        if (window.isYScaling) {
            const dy = event.clientY - window.yScaleStartY;
            applyYScaleFromDrag(dy, window.yScaleStartMin, window.yScaleStartMax);
            drawCandlestickChart(window.stockData, window.start, window.end);
            return;
        }
        if (window.isDragging) {
            const dx = event.clientX - window.panStartX;
            if (Math.abs(dx) > 3) window.didPan = true;
            const candleW = ((window.chartState?.width ?? canvas.width) - 2 * (window.chartState?.margin ?? 50))
                / Math.max(1, window.panBarCount);
            const barsMoved = dx / candleW;
            const v = clampViewport(
                window.panStartStart - barsMoved,
                window.panStartStart - barsMoved + window.panBarCount,
                window.stockData.length
            );
            window.start = Math.round(v.start);
            window.end = Math.round(v.end);
            drawCandlestickChart(window.stockData, window.start, window.end);
            return;
        }

        if (window.draggingBracketPoint) {
            handleBracketPointDrag(event);
            return;
        }

        if (window.measureDraft) {
            window.measureDraft.end = pointFromMouse(window.mouseX, window.mouseY, window.chartState);
        }

        handleMouseMove(event, window.chartState, window.tradeGroups);
        drawCandlestickChart(window.stockData, window.start, window.end);
    });

    // ==================== MOUSE DOWN ====================
    canvas.addEventListener('mousedown', function(event) {
        var rect = canvas.getBoundingClientRect();
        mouseX = event.clientX - rect.left;
        mouseY = event.clientY - rect.top;

        const chartState = window.chartState;
        if (!chartState) return;

        const price = calculatePrice(mouseY, chartState.height, chartState.margin, chartState.minPrice, chartState.maxPrice);

        const hoveredPoint = findBracketPointAt(mouseY, chartState);

        if (hoveredPoint && !window.measureDraft && window.currentTool !== 'measure' && !event.shiftKey) {
            console.log("BRACKET DRAGGING")
            window.draggingBracketPoint = hoveredPoint;
            canvas.style.cursor = 'ns-resize';
            return; 
        }

        if (findMeasureCloseAt(mouseX, mouseY)) {
            return;
        }

        if (event.shiftKey || window.currentTool === 'measure' || window.measureDraft) {
            handleMeasurePointer(mouseX, mouseY, chartState);
            drawCandlestickChart(window.stockData, window.start, window.end);
            return;
        }

        if (window.currentTool === 'bracket') {
            handleBracketClick(price);
            return;
        }


        // 3. Normal tools
        if (window.currentTool === 'line' || window.currentTool === 'trigger') {
            const line = { price: price };

            if (window.currentTool === 'trigger') {
                line.type = 'trigger';
                line.color = '#ff00ff';
                line.pending = true

                draw_lines.push(line)
                drawCandlestickChart(window.stockData, window.start, window.end)

                showTriggerTypeMenu(line, event.pageX, event.pageY)

                window.suppressNextLineMenu = true

                window.currentTool = null

                return;

            }

            window.currentTool = null;

            draw_lines.push(line);
            drawCandlestickChart(window.stockData, window.start, window.end);
            return;
        }
        if (isOnPriceAxis(mouseX, chartState)) {
            window.isYScaling = true;
            window.yScaleStartY = event.clientY;
            window.yScaleStartMin = window.priceScale.min ?? chartState.minPrice;
            window.yScaleStartMax = window.priceScale.max ?? chartState.maxPrice;
            canvas.style.cursor = 'ns-resize';
            return;
        }
        window.isDragging = true;
        window.didPan = false;
        window.panStartX = event.clientX;
        window.panStartStart = window.start;
        window.panBarCount = window.end - window.start;
        canvas.style.cursor = 'grabbing';

    });

    // ==================== MOUSE UP ====================
    canvas.addEventListener('mouseup', function() {
        if (window.draggingBracketPoint) {
            window.draggingBracketPoint = null;
            canvas.style.cursor = 'default';
            if (typeof window.updateSidebar === 'function') window.updateSidebar();
        } else {
            if (window.didPan || window.isYScaling) window.suppressNextChartClick = true;
            isDragging = false;
            canvas.style.cursor = 'default';
            window.isDragging = false;
            window.isYScaling = false;
            window.didPan = false;
        }
    });

    canvas.addEventListener('mouseleave', function() {
        if (window.draggingBracketPoint) {
            window.draggingBracketPoint = null;
            canvas.style.cursor = 'default';
        }
        isDragging = false;
        window.isDragging = false;
        window.isYScaling = false;
    });

    document.addEventListener('keydown', function(event) {
        if (event.key !== 'Escape') return;
        if (isTypingTarget(event.target)) return;

        if (window.measureDraft) {
            cancelMeasureDraft();
            drawCandlestickChart(window.stockData, window.start, window.end);
            return;
        }

        if (window.hoveredMeasureId) {
            removeMeasureById(window.hoveredMeasureId);
            drawCandlestickChart(window.stockData, window.start, window.end);
            return;
        }

        if (window.measures && window.measures.length) {
            window.measures.pop();
            drawCandlestickChart(window.stockData, window.start, window.end);
        }
    });
};

function showTriggerTypeMenu(line, pageX, pageY) {
    document.querySelectorAll('.trigger-type-menu, .line-menu, .trigger-menu').forEach(el => el.remove());

    const menu = document.createElement('div');
    menu.className = 'trigger-type-menu';
    menu.style.cssText = `
        position: absolute;
        background: #1e1e2e;
        color: #e0e0ff;
        padding: 10px 14px;
        border: 1px solid #4a4a6a;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.6);
        z-index: 2000;
        min-width: 200px;
        font-size: 13px;
        user-select: none;
    `;

    menu.innerHTML = `
        <div style="font-weight:bold; margin-bottom:10px; color:#ff00ff;">
            Trigger @ ${line.price.toFixed(line.price < 1 ? 8 : 2)}
        </div>
        <div class="menu-item" data-type="price_above">Price Above</div>
        <div class="menu-item" data-type="price_below">Price Below</div>
        <div class="menu-item" data-type="closes_above">Close Above</div>
        <div class="menu-item" data-type="closes_below">Close Below</div>
        <div class="menu-item" data-type="cancel" style="color:#ff6b6b; margin-top:8px;">Cancel</div>
    `;

    document.body.appendChild(menu);
    positionMenuNear(menu, pageX, pageY);

    // Hover styles
    menu.querySelectorAll('.menu-item').forEach(item => {
        item.style.cssText = 'padding:6px 4px; cursor:pointer; border-radius:4px;';
        item.addEventListener('mouseenter', () => item.style.background = '#2a2a3e');
        item.addEventListener('mouseleave', () => item.style.background = 'transparent');
    });

    let ignoreNextClick = true;

    const closeListener = (ev) => {
        if (ignoreNextClick) {
            ignoreNextClick = false;
            return;
        }

        if (!menu.contains(ev.target)) {
            if (line.pending) {
                const idx = draw_lines.indexOf(line);
                if (idx !== -1) {
                    draw_lines.splice(idx, 1);
                    drawCandlestickChart(window.stockData, window.start, window.end);
                }
            }
            menu.remove();
            document.removeEventListener('click', closeListener);
        }
    };

    // Add the listener on the next tick (still needed)
    setTimeout(() => {
        document.addEventListener('click', closeListener);
    }, 0);

    // Handle menu item clicks
    menu.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const type = item.dataset.type;

            if (type === 'cancel') {
                const idx = draw_lines.indexOf(line);
                if (idx !== -1) {
                    draw_lines.splice(idx, 1);
                    drawCandlestickChart(window.stockData, window.start, window.end);
                }
                menu.remove();
                document.removeEventListener('click', closeListener);
                return;
            }

            // Create trigger on backend
            const triggerData = {
                product_id: selectedProduct.product_id,
                type: type,
                price: parseFloat(line.price),
                status: 'active',
                xch_id: exchange.ID
            };

            fetch('create-trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(triggerData)
            })
            .then(r => r.json())
            .then(data => {
                const id = data.id;
                line.triggerId = id;
                line.pending = false;
                line.triggerType = type;
                if (!window.current_triggers) window.current_triggers = [];
                window.current_triggers.push({
                    id: id,
                    product_id: selectedProduct.product_id,
                    type: type,
                    price: line.price,
                    status: data.status || 'active'
                });
                if (!window.currentTradeSetup) {
                    window.currentTradeSetup = { chainedTriggers: [] };
                }
                if (!window.currentTradeSetup.chainedTriggers) {
                    window.currentTradeSetup.chainedTriggers = [];
                }
                window.currentTradeSetup.chainedTriggers.push({
                    id: id,
                    product_id: selectedProduct.product_id,
                    type: type,
                    price: line.price,
                    status: data.status || 'active'
                });
                // optional: remove purple draw_lines copy; gold line comes from current_triggers
                const idx = draw_lines.indexOf(line);
                if (idx !== -1) draw_lines.splice(idx, 1);
                if (typeof window.updateSidebar === 'function') window.updateSidebar();
                showToast(`Trigger created: ${type.replace('_', ' ')}`, 2200);
                drawCandlestickChart(window.stockData, window.start, window.end);
            })
            .catch(err => {
                console.error('Error creating trigger:', err);
                showToast('Failed to create trigger', 2500);
                const idx = draw_lines.indexOf(line);
                if (idx !== -1) {
                    draw_lines.splice(idx, 1);
                    drawCandlestickChart(window.stockData, window.start, window.end);
                }
            });

            menu.remove();
            document.removeEventListener('click', closeListener);
        });
    });
}

// ==================== BRACKET DRAG HELPERS ====================

function findBracketPointAt(mouseY, chartState) {
    console.log("Find BracketPoint", mouseY)
    if (!chartState) return null;

    const threshold = 12;

    for (let line of draw_lines) {
        if (!line.isBracket || !line.bracketId) continue;

        console.log("IS BRACKET")

        const lineY = calculateLineY(line.price, chartState);

        if (Math.abs(mouseY - lineY) < threshold) {
            return {
                bracketId: line.bracketId,
                type: line.type,
                line: line
            };
        }
    }
    return null;
}

function handleBracketPointDrag(event) {
    const rect = canvas.getBoundingClientRect();
    const mouseY = event.clientY - rect.top;
    const chartState = window.chartState;
    if (!chartState) return;

    const newPrice = calculatePrice(mouseY, chartState.height, chartState.margin, chartState.minPrice, chartState.maxPrice);

    const targetLine = draw_lines.find(l => 
        l.isBracket && 
        l.bracketId === window.draggingBracketPoint.bracketId && 
        l.type === window.draggingBracketPoint.type
    );

    if (targetLine) {
        targetLine.price = newPrice;
        if (targetLine.type === 'stop') {
            targetLine.fromRR = false
        }
        drawCandlestickChart(window.stockData, window.start, window.end);
        if (typeof window.updateSidebar === 'function') window.updateSidebar();
    }
}



const showTriggerNotification = function(trigger) {
	const notification = document.createElement('div')
	notification.className = 'trigger-notification'
	notification.innerHTML = `
      <div class="notification-content">
        <strong>${trigger.product_id}</strong>
      </div>
    `
	document.body.appendChild(notification)

	setTimeout(() => notification.remove(), 5000)
}


const triggerHoverHandler = function(e, chartState) {
	const rect = canvas.getBoundingClientRect();
	const mouseY = e.clientY - rect.top;
	let isNearTrigger = false;

	if (window.current_triggers) {
		window.current_triggers.forEach(trigger => {
			const triggerY = chartState.height - chartState.margin -
				((trigger.price - chartState.minPrice) / (chartState.maxPrice - chartState.minPrice)) *
				(chartState.height - 2 * chartState.margin);
			if (isMouseNearLine(mouseY, triggerY)) {
				isNearTrigger = true;
			}
		});
	}
	return isNearTrigger;
};

function calculateLineY(price, chartState) {
	return chartState.height - chartState.margin -
		((price - chartState.minPrice) / (chartState.maxPrice - chartState.minPrice)) *
		(chartState.height - 2 * chartState.margin);
}

function getFillTimestamp(fill) {
	let timeVal = fill.time;

	// 1. If it's already a number → assume seconds (Alpaca native number)
	if (typeof timeVal === 'number' && !isNaN(timeVal)) {
		return timeVal;
	}

	// 2. If it's a string → try to parse it smartly
	if (typeof timeVal === 'string') {
		// Case A: string that looks like a number (e.g. "1711548148")
		if (/^\d{10}$/.test(timeVal.trim())) {   // 10-digit Unix seconds
			const num = Number(timeVal.trim());
			if (!isNaN(num)) {
				return num;
			}
		}

		// Case B: ISO string (Coinbase style)
		const dt = new Date(timeVal);
		if (!isNaN(dt.getTime())) {
			return Math.floor(dt.getTime() / 1000);
		}
	}
    console.log("Current Triggers", window.current_triggers)

	console.warn("[getFillTimestamp] could not parse time:", fill.time,
		"typeof:", typeof fill.time);
	return NaN;
}

window.lineClickHandler = function(e, chartState) {
	if (e.type !== 'click') return;

    if (window.suppressNextLineMenu) {
        window.suppressNextLineMenu = false
        return true
    }

	const rect = canvas.getBoundingClientRect();
	const mouseY = e.clientY - rect.top;
	const mouseX = e.clientX - rect.left;

	// Remove any stale menus first
	document.querySelectorAll('.line-menu').forEach(el => el.remove());

	let selectedLine = null;
	let selectedIndex = -1;

	draw_lines.forEach((line, i) => {
		const lineY = calculateLineY(line.price, chartState);
		if (isMouseNearLine(mouseY, lineY, 8)) {
			selectedLine = line;
			selectedIndex = i;
		}
	});


	if (!selectedLine) return false;
    if (selectedLine.type === 'trigger') {
        if (selectedLine.pending) {
            showTriggerTypeMenu(selectedLine, e.pageX, e.pageY);
        }
        return true;
    }

	// We found one → show menu
	window.activeLineIndex = selectedIndex;

	const menu = document.createElement('div');
	menu.className = 'line-menu';
	menu.style.background = '#1e1e2e';
	menu.style.color = '#e0e0ff';
	menu.style.padding = '8px 12px';
	menu.style.border = '1px solid #4a4a6a';
	menu.style.borderRadius = '6px';
	menu.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
	menu.style.zIndex = '1500';
	menu.style.minWidth = '180px';
	menu.style.pointerEvents = 'auto';
	menu.style.userSelect = 'none';

	menu.innerHTML = `
        <div style="font-weight:bold; margin-bottom:8px; color:#a5d8ff;">
            Line @ ${selectedLine.price.toFixed(selectedLine.price < 1 ? 8 : 2)}
        </div>
        <div class="menu-item" data-action="entry">→ Set as Entry</div>
        <div class="menu-item" data-action="pt">→ Set as Profit Target</div>
        <div class="menu-item" data-action="stop">→ Set as Stop Loss</div>
        <div class="menu-item" data-action="trigger">→ Convert to Trigger</div>
        <div class="menu-item" data-action="delete" style="color:#ff6b6b; margin-top:6px;">
            Delete Line
        </div>
        ${selectedLine.type ? `<div style="margin-top:8px; color:#9ca3af;">Current type: ${selectedLine.type}</div>` : ''}
    `;

	document.body.appendChild(menu);
    positionMenuNear(menu, e.pageX, e.pageY)

	// Close on outside click
	const closeListener = (ev) => {
		if (!menu.contains(ev.target)) {
			menu.remove();
			document.removeEventListener('click', closeListener);
		}
	};
	setTimeout(() => document.addEventListener('click', closeListener), 10);

	// Handle menu clicks
	menu.querySelectorAll('.menu-item').forEach(item => {
		item.addEventListener('click', (ev) => {
			const action = item.dataset.action;
			window.lastMenuPageX = ev.pageX;
			window.lastMenuPageY = ev.pageY;
			handleLineAction(action, selectedLine, selectedIndex);
			menu.remove();
			drawCandlestickChart(window.stockData, window.start, window.end);
		});
	});
	return true;
};

window.orderClickHandler = function(e, chartState) {
	if (e.type !== 'click') return;

	const rect = canvas.getBoundingClientRect();
	const mouseY = e.clientY - rect.top;
	const mouseX = e.clientX - rect.left;  // useful if you ever want x-based logic

	// Clean up any old menus first
	document.querySelectorAll('.order-menu').forEach(el => el.remove());

	let selectedOrder = null;

	current_orders.forEach(order => {
		const orderY = chartState.height - chartState.margin -
			((order.Price - chartState.minPrice) / (chartState.maxPrice - chartState.minPrice)) *
			(chartState.height - 2 * chartState.margin);

		if (Math.abs(mouseY - orderY) <= 10) {   // 10px hit area — adjust if needed
			selectedOrder = order;
			// If multiple orders could overlap, you could add logic to pick closest
			// For now we take the first match (or last — up to you)
		}
	});

	if (!selectedOrder) return false;

	// Show menu
	const menu = document.createElement('div');
	menu.className = 'order-menu';
	menu.style.background = '#1e1e2e';
	menu.style.color = '#e0e0ff';
	menu.style.padding = '10px 14px';
	menu.style.border = '1px solid #4a4a6a';
	menu.style.borderRadius = '6px';
	menu.style.boxShadow = '0 4px 16px rgba(0,0,0,0.6)';
	menu.style.zIndex = '1500';
	menu.style.minWidth = '220px';
	menu.style.pointerEvents = 'auto';
	menu.style.userSelect = 'none';

	menu.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 10px; color: #a5d8ff;">
            Order #${selectedOrder.OrderID.slice(-8)}
        </div>
        <div>Side: <strong>${selectedOrder.Side}</strong></div>
        <div>Product: ${selectedOrder.ProductID}</div>
        <div>Price: ${selectedOrder.Price.toFixed(8)}</div>
        <div>Size: ${selectedOrder.Size}</div>
        <div>Status: <span style="color: ${selectedOrder.Status === 'OPEN' ? '#4ade80' : '#f87171'}">
            ${selectedOrder.Status}
        </span></div>
        <hr style="border-color: #4a4a6a; margin: 10px 0;">
        <div class="menu-item cancel-action" style="color: #ff6b6b; cursor: pointer; padding: 6px 0;">
            Cancel Order
        </div>
        <!-- Add more actions if needed, e.g. Modify, View Details -->
    `;

	document.body.appendChild(menu);
    positionMenuNear(menu, e.pageX, e.pageY)

	// Close when clicking outside
	const closeListener = (ev) => {
		if (!menu.contains(ev.target)) {
			menu.remove();
			document.removeEventListener('click', closeListener);
		}
	};
	setTimeout(() => document.addEventListener('click', closeListener), 0);

	// Handle cancel click
	menu.querySelector('.cancel-action').addEventListener('click', () => {
		if (confirm(`Cancel order ${selectedOrder.OrderID}?`)) {
			cancelOrder(selectedOrder.OrderID, selectedOrder.XchID || exchange?.ID);
			menu.remove();
		}
	});
	return true;
};

window.triggerClickHandler = function(e, chartState) {
	if (e.type !== 'click') return; // Only handle click events

	const rect = canvas.getBoundingClientRect();
	const mouseY = e.clientY - rect.top;

	if (!window.current_triggers) return;

	let selectedTrigger = null;
	let triggerY = null;

	// Find the closest trigger to the click
	window.current_triggers.forEach(trigger => {
		const y = chartState.height - chartState.margin -
			((trigger.price - chartState.minPrice) / (chartState.maxPrice - chartState.minPrice)) *
			(chartState.height - 2 * chartState.margin);

		if (isMouseNearLine(mouseY, y)) {
			console.log("Trigger Click Handler")
			selectedTrigger = trigger;
			triggerY = y;
		}
	});

	// Remove any existing menu
	document.querySelectorAll('.trigger-menu').forEach(el => el.remove());

	// console.log("Selected Trigger", selectedTrigger)


	if (selectedTrigger) {
		const menu = document.createElement('div');
		menu.className = 'trigger-menu';
		menu.style.backgroundColor = '#333';
		menu.style.color = 'white';
		menu.style.padding = '10px';
		menu.style.border = '1px solid #666';
		menu.style.borderRadius = '4px';
		menu.style.display = 'block';
		menu.style.zIndex = '1000';
		menu.style.pointerEvents = 'auto';
		menu.style.minWidth = '200px';

		menu.innerHTML = `
            <div style="margin-bottom: 8px;"><strong>Trigger Details</strong></div>
            <div>Type: ${selectedTrigger.type}</div>
            <div>Price: ${selectedTrigger.price.toFixed(8)}</div>
            <div>Status: ${selectedTrigger.status}</div>
            <!-- <div class="trigger-menu-item" onclick="editTrigger(${selectedTrigger.id}); document.querySelector('.trigger-menu').remove();">Edit</div> -->
            <div class="trigger-menu-item" onclick="showTriggerEditMenu(${selectedTrigger.id}, ${e.pageX}, ${e.pageY}); document.querySelector('.trigger-menu').remove();">Edit</div>
            <div class="trigger-menu-item" onclick="deleteTrigger(${selectedTrigger.id}); document.querySelector('.trigger-menu').remove();">Delete</div>
            <!-- <div class="trigger-menu-item" onclick="handleTriggerAction('connect', ${selectedTrigger.id}); document.querySelector('.trigger-menu').remove();">Connect to Trade</div> -->
            <div class="trigger-menu-item" onclick="showTradeOptions(${selectedTrigger.id}); document.querySelector('.trigger-menu').remove();">Upon Trigger...</div>
        `;

		document.body.appendChild(menu);
        positionMenuNear(menu, e.pageX, e.pageY)


		const closeMenuOnOutsideClick = (event) => {
			if (!menu.contains(event.target) && !event.target.classList.contains('trigger-menu-item')) {
				menu.remove();
				document.removeEventListener('click', closeMenuOnOutsideClick);
			}
		};

		setTimeout(() => {
			document.addEventListener('click', closeMenuOnOutsideClick);
		}, 0);
		return true;
	}
};

window.fillClickHandler = function(e, chartState) {
	if (e.type !== 'click') return;

	const rect = canvas.getBoundingClientRect();
	const mouseX = e.clientX - rect.left;
	const mouseY = e.clientY - rect.top;

	document.querySelectorAll('.fill-menu').forEach(el => el.remove());

	let selectedFill = null;
	let minDistance = Infinity;

	const firstCandleTime = window.stockData[window.start]?.Timestamp;
	const lastCandleTime = window.stockData[window.end - 1]?.Timestamp;

	if (!firstCandleTime || !lastCandleTime || lastCandleTime <= firstCandleTime) {
		console.warn("[fillClick] invalid chart time bounds");
		return;
	}

	const timeRange = lastCandleTime - firstCandleTime;

	current_fills.forEach(fill => {
		const fillTs = getFillTimestamp(fill);

		if (isNaN(fillTs) || fillTs < firstCandleTime || fillTs > lastCandleTime) {
			return;
		}

		const xPosition = chartState.margin +
			((fillTs - firstCandleTime) / timeRange) *
			(chartState.width - 2 * chartState.margin);

		const fillY = chartState.height - chartState.margin -
			((fill.price - chartState.minPrice) / (chartState.maxPrice - chartState.minPrice)) *
			(chartState.height - 2 * chartState.margin);

		const distance = Math.sqrt(
			Math.pow(xPosition - mouseX, 2) +
			Math.pow(fillY - mouseY, 2)
		);

		if (distance < minDistance && distance <= 16) {  // increased slightly for reliability
			minDistance = distance;
			selectedFill = fill;
		}
	});

	if (!selectedFill) return false;

	// Create menu
	const menu = document.createElement('div');
	menu.className = 'fill-menu';
	menu.style.background = '#1e1e2e';
	menu.style.color = '#e0e0ff';
	menu.style.padding = '10px 14px';
	menu.style.border = '1px solid #4a4a6a';
	menu.style.borderRadius = '6px';
	menu.style.boxShadow = '0 4px 16px rgba(0,0,0,0.6)';
	menu.style.zIndex = '1500';
	menu.style.minWidth = '240px';
	menu.style.pointerEvents = 'auto';
	menu.style.userSelect = 'none';

	// Format time nicely
	const fillDate = new Date(selectedFill.time).toLocaleString([], {
		month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
	});

	menu.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 10px; color: #a5d8ff;">
            Fill Details
        </div>
        <div>Price: <strong>${selectedFill.price.toFixed(8)}</strong></div>
        <div>Size: <strong>${selectedFill.size}</strong></div>
        <div>Time: ${fillDate}</div>
        ${selectedFill.side ? `<div>Side: <strong>${selectedFill.side}</strong></div>` : ''}
        ${selectedFill.orderId ? `<div>Order ID: ${selectedFill.orderId.slice(-8)}</div>` : ''}
        ${selectedFill.tradeId ? `<div>Trade/Fill ID: ${selectedFill.tradeId}</div>` : ''}
        ${selectedFill.fee ? `<div>Fee: ${selectedFill.fee} ${selectedFill.feeCurrency || ''}</div>` : ''}
        <hr style="border-color: #4a4a6a; margin: 10px 0;">
        <div style="color: #9ca3af; font-size: 0.9em;">
            Click outside to close
        </div>
    `;

	document.body.appendChild(menu);
    positionMenuNear(menu, e.pageX, e.pageY)

	// Auto-close on outside click
	const closeListener = (ev) => {
		if (!menu.contains(ev.target)) {
			menu.remove();
			document.removeEventListener('click', closeListener);
		}
	};
	setTimeout(() => document.addEventListener('click', closeListener), 0);
	return true;
};

function trendKey(trend) {
	if (!trend?.start || !trend?.end) return null;
	return `${trend.start.time}|${trend.start.point}|${trend.end.time}|${trend.end.point}`;
}

function sameTrend(a, b) {
	if (!a || !b) return false;
	if (a === b) return true;
	const ka = trendKey(a);
	const kb = trendKey(b);
	return !!ka && ka === kb;
}

function isTrendPinned(trend) {
	return (window.pinnedTrends || []).some(t => sameTrend(t, trend));
}

function collectDescendantTrends(trend, acc = []) {
	(trend?.trends || []).forEach(child => {
		acc.push(child);
		collectDescendantTrends(child, acc);
	});
	return acc;
}

function unpinTrendBranch(trend) {
	const remove = [trend, ...collectDescendantTrends(trend)];
	window.pinnedTrends = (window.pinnedTrends || []).filter(t => !remove.some(r => sameTrend(t, r)));
	window.trendlinePath = (window.trendlinePath || []).filter(t => !remove.some(r => sameTrend(t, r)));
}

function pinTrend(trend) {
	if (!trend?.trends?.length || isTrendPinned(trend)) return;
	window.pinnedTrends = window.pinnedTrends || [];
	window.trendlinePath = window.trendlinePath || [];
	window.pinnedTrends.push(trend);
	window.trendlinePath.push(trend);
}

function popLastPinnedTrend() {
	const path = window.trendlinePath || [];
	if (!path.length) return false;
	const last = path[path.length - 1];
	unpinTrendBranch(last);
	return true;
}

function collectHoverableTrends() {
	const roots = window.chartState?.trendlines || window.currentTrendlines || [];
	const seen = new Set();
	const list = [];
	const add = (trend) => {
		if (!trend) return;
		const key = trendKey(trend) || list.length;
		if (seen.has(key)) return;
		seen.add(key);
		list.push(trend);
	};
	roots.forEach(add);
	(window.pinnedTrends || []).forEach(pinned => {
		(pinned.trends || []).forEach(add);
	});
	const hovered = window.hoveredTrendline;
	if (hovered?.trends?.length && !isTrendPinned(hovered)) {
		hovered.trends.forEach(add);
	}
	return list;
}

function trendScreenPoints(trend, chartState) {
	const timeRange = chartState.lastCandleTime - chartState.firstCandleTime;
	if (!timeRange) return null;
	return {
		startX: chartState.margin + ((trend.start.time - chartState.firstCandleTime) / timeRange) * (chartState.width - 2 * chartState.margin),
		endX: chartState.margin + ((trend.end.time - chartState.firstCandleTime) / timeRange) * (chartState.width - 2 * chartState.margin),
		startY: chartState.height - chartState.margin - ((trend.start.point - chartState.minPrice) / (chartState.maxPrice - chartState.minPrice)) * (chartState.height - 2 * chartState.margin),
		endY: chartState.height - chartState.margin - ((trend.end.point - chartState.minPrice) / (chartState.maxPrice - chartState.minPrice)) * (chartState.height - 2 * chartState.margin)
	};
}

function distanceToLineSegment(px, py, x1, y1, x2, y2) {

	const dx = x2 - x1
	const dy = y2 - y1
	if (dx === 0 && dy === 0) {
		return Math.hypot(px - x1, py - y1)
	}

	const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)
	if (t < 0) {
		return Math.hypot(px - x1, py - y1)
	} else if (t > 1) {
		return Math.hypot(px - x2, py - y2)
	} else {
		const nx = x1 + t * dx
		const ny = y1 + t * dy
		return Math.hypot(px - nx, py - ny)
	}
}

handleMouseMove = function(e, chartState, tradeGroups) {
	const rect = canvas.getBoundingClientRect();
	const mx = e.clientX - rect.left;
	const my = e.clientY - rect.top;
	window.hoveredMeasureId = findHoveredMeasure(mx, my);
	const closeHit = findMeasureCloseAt(mx, my);

	if (window.measureDraft || window.currentTool === 'measure') {
		canvas.style.cursor = 'crosshair';
		return;
	}

	if (closeHit || window.hoveredMeasureId) {
		canvas.style.cursor = 'pointer';
		return;
	}

	const isFillHover = fillHoverHandler(e, chartState)
	const isOrderHover = orderHoverHandler(e, chartState);
	const isTradeHover = tradeHoverHandler(e, chartState, tradeGroups);
	const isLineHover = lineHoverHandler(e, chartState);
	const isTriggerHover = triggerHoverHandler(e, chartState);
	const isPointHover = pointHoverHandler(e, chartState);
	const hoveredTrend = trendLineHoverHandler(e, chartState)

	if (isFillHover || isOrderHover || isTradeHover || isLineHover ||
		isTriggerHover || isPointHover || hoveredTrend) {
		canvas.style.cursor = 'pointer';
	} else {
		canvas.style.cursor = 'default';
		hidePointTooltip();
		hideTrendlineTooltip();
		window.hoveredTrendline = null;
	}
};

const pointHoverHandler = function(e, chartState) {
	const rect = canvas.getBoundingClientRect();
	const mouseX = e.clientX - rect.left;
	const mouseY = e.clientY - rect.top;

	let closestPoint = null;
	let minDistance = 5;

	const allPoints = [...trendlinePoints, ...subtrendPoints];
	allPoints.forEach(point => {
		const dx = point.x - mouseX;
		const dy = point.y - mouseY;
		const distance = Math.sqrt(dx * dx + dy * dy);
		if (distance < minDistance) {
			minDistance = distance;
			closestPoint = point;
		}
	});

	if (closestPoint && minDistance < 10) {
		window.hoveredPoint = closestPoint;
		showPointTooltip(closestPoint, mouseX, mouseY);
		// Set specific hovered point variables for rendering
		if (trendlinePoints.includes(closestPoint)) {
			window.hoveredTrendlinePoint = closestPoint;
			window.hoveredSubtrendPoint = null;
		} else if (subtrendPoints.includes(closestPoint)) {
			window.hoveredSubtrendPoint = closestPoint;
			window.hoveredTrendlinePoint = null;
		}
	} else {
		window.hoveredPoint = null;
		window.hoveredTrendlinePoint = null;
		window.hoveredSubtrendPoint = null;
		hidePointTooltip();
	}
	return closestPoint !== null;
};

function trendLineHoverHandler(e, chartState) {
	// console.log("Trendline Hover Handler")
	// console.log("ChartState:", chartState)
    // console.log("Trendline Hover Handler")
    // console.log("ChartState:", chartState)

	const rect = canvas.getBoundingClientRect()
	const mouseX = e.clientX - rect.left
	const mouseY = e.clientY - rect.top

	let closestTrend = null
	let minDistance = Infinity

	collectHoverableTrends().forEach(trendline => {
		const pts = trendScreenPoints(trendline, chartState);
		if (!pts) return;
		const distance = distanceToLineSegment(mouseX, mouseY, pts.startX, pts.startY, pts.endX, pts.endY);
		if (distance < minDistance) {
			minDistance = distance;
			closestTrend = trendline;
		}
	});


	const threshold = 5
	if (minDistance < threshold) {
		showTrendlineTooltip(closestTrend, mouseX, mouseY);
		window.current_trend = closestTrend;
		window.hoveredTrendline = closestTrend;  // ← make sure this is set every time
		// console.log("Hovered trend set:", closestTrend.id || closestTrend, "has subtrends:", !!closestTrend.trends?.length);
		return closestTrend;
	} else {
		hideTrendlineTooltip();
		window.current_trend = null;
		window.hoveredTrendline = null;  // ← explicit clear
		return null;
	}
}

const fillHoverHandler = function(e, chartState) {
	if (!current_fills?.length) return false;
	if (window.end <= window.start + 1) return false;

	const rect = canvas.getBoundingClientRect();
	const mouseX = e.clientX - rect.left;
	const mouseY = e.clientY - rect.top;

	const firstTs = window.stockData[window.start]?.Timestamp;
	const lastTs = window.stockData[window.end - 1]?.Timestamp;

	if (!firstTs || !lastTs || lastTs <= firstTs) {
		// console.warn("[fillHover] invalid chart time bounds");
		return false;
	}

	const timeRange = lastTs - firstTs;

	let isNearAnyFill = false;

	current_fills.forEach(fill => {
		const fillTs = getFillTimestamp(fill);

		if (isNaN(fillTs)) {
			// Already warned inside getFillTimestamp
			return;
		}

		if (fillTs < firstTs || fillTs > lastTs) {
			// console.log(`[fill] skipped - outside range ${fillTs} vs [${firstTs}–${lastTs}]`);
			return;
		}

		if (fill.price < chartState.minPrice || fill.price > chartState.maxPrice) {
			return;
		}

		const x = chartState.margin +
			((fillTs - firstTs) / timeRange) *
			(chartState.width - 2 * chartState.margin);

		const y = calculateLineY(fill.price, chartState);

		const distance = Math.hypot(x - mouseX, y - mouseY);

		if (distance < 16) {
			// console.log(`→ HIT! dist ${distance.toFixed(2)} | fillTs ${fillTs} | price ${fill.price} | time ${fill.time}`);
			isNearAnyFill = true;

			chartState.ctx.save();
			chartState.ctx.fillStyle = 'rgba(20, 25, 40, 0.92)';
			chartState.ctx.fillRect(mouseX + 14, mouseY - 58, 160, 80);
			chartState.ctx.fillStyle = '#a5d8ff';
			chartState.ctx.font = 'bold 13px Arial';
			chartState.ctx.fillText(`Fill @ ${fill.price.toFixed(8)}`, mouseX + 20, mouseY - 40);
			chartState.ctx.font = '12px Arial';
			chartState.ctx.fillStyle = 'white';
			chartState.ctx.fillText(`Size: ${fill.size}`, mouseX + 20, mouseY - 20);
			chartState.ctx.fillText(`Click for details`, mouseX + 20, mouseY);
			chartState.ctx.restore();
		}
	});

	// console.log("[fillHover] final isNearAnyFill =", isNearAnyFill);
	return isNearAnyFill;
};

const orderHoverHandler = function(e, chartState) {
	const rect = canvas.getBoundingClientRect();
	const mouseY = e.clientY - rect.top;

	let nearAnyOrder = false;

	current_orders.forEach(order => {
		const orderY = chartState.height - chartState.margin -
			((order.Price - chartState.minPrice) / (chartState.maxPrice - chartState.minPrice)) *
			(chartState.height - 2 * chartState.margin);

		if (Math.abs(mouseY - orderY) < 8) {          // ← larger hit area for better UX
			nearAnyOrder = true;
			canvas.style.cursor = 'pointer';
			// Optionally: draw thicker line or highlight in your draw function
		}
	});

	if (!nearAnyOrder) {
		canvas.style.cursor = 'default';
	}
};

// Example minimal version
const tradeHoverHandler = function(e, chartState, groups) {
	const rect = canvas.getBoundingClientRect();
	const mouseY = e.clientY - rect.top;

	let nearAnyTrade = false;

	Object.values(groups).forEach(trades => {
		trades.forEach(trade => {
			const entryY = calculateLineY(trade.entry_price, chartState);
			const stopY = calculateLineY(trade.stop_price, chartState);
			const ptY = calculateLineY(trade.pt_price, chartState);

			if (isMouseNearLine(mouseY, entryY, 8) ||
				isMouseNearLine(mouseY, stopY, 8) ||
				isMouseNearLine(mouseY, ptY, 8)) {
				nearAnyTrade = true;
				canvas.style.cursor = 'pointer';
				// Optional: window.hoveredTrade = trade;  // for future click handler
			}
		});
	});

	if (!nearAnyTrade) {
		canvas.style.cursor = 'default';
	}
};

const lineHoverHandler = function(e, chartState) {
	const rect = canvas.getBoundingClientRect();
	const mouseY = e.clientY - rect.top;

	let isNearAnyLine = false;
	window.activeLineIndex = -1;

	draw_lines.forEach((line, index) => {
		const lineY = calculateLineY(line.price, chartState); // ← helper, see below

		if (isMouseNearLine(mouseY, lineY, 6)) {   // slightly larger hit area is ok for hover
			console.log("lineHoverHandler: Hovered")
			isNearAnyLine = true;
			window.activeLineIndex = index;         // still track for click
			canvas.style.cursor = 'pointer';
			// Optional: draw highlight / glow in draw function when activeLineIndex >= 0
		}
	});

	if (!isNearAnyLine) {
		canvas.style.cursor = 'default';
	}

	return isNearAnyLine;
};

window.cancelTrigger = function(triggerID) {
	fetch('/delete-trigger', {
		method: 'DELETE',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ trigger_id: triggerID })
	})
		.then(response => response.json())
		.then(data => {
			console.log('Trigger cancelled:', data)
			window.current_triggers = window.current_triggers.filter(triggers => triggers.id !== triggerID) || []
			drawCandlestickChart(window.stockData, window.start, window.end)
		})
		.catch(error => {
			console.error('Error cancelling trigger:', error);
		})
}

window.cancelOrder = function(orderId, xchId) {
	fetch('/cancel-order', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			order_id: orderId,
			xch_id: xchId
		})
	})
		.then(response => response.json())
		.then(data => {
			const index = current_orders.findIndex(o => o.OrderID === orderId);
			if (index !== -1) {
				current_orders.splice(index, 1);
			}
			drawCandlestickChart(window.stockData, start, end);
			document.querySelectorAll('.order-menu').forEach(el => el.remove());
		})
		.catch(error => console.error('Error canceling order:', error));
}


window.deleteTradeBlock = function(groupId) {
	fetch('/delete-trade-block', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			group_id: groupId
		})
	})
		.then(response => response.json())
		.then(data => {
			current_trades = current_trades.filter(t => t.group_id !== groupId)
			drawCandlestickChart(window.stockData, start, end)
			document.querySelectorAll('.trade-menu').forEach(el => el.remove())
		})
		.catch(error => console.error('Error deleting trade group:', error))
}


canvas.addEventListener('click', function(event) {
    // Skip all click handlers if we just dragged a bracket point
    if (window.draggingBracketPoint !== null) {
        return;
    }

    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    if (window.suppressNextChartClick) {
        window.suppressNextChartClick = false;
        return;
    }

    const closeHit = findMeasureCloseAt(clickX, clickY);
    if (closeHit) {
        removeMeasureById(closeHit.id);
        drawCandlestickChart(window.stockData, window.start, window.end);
        return;
    }

    if (window.measureDraft || window.currentTool) {
        return;
    }

    const hoveredPointAtClick = window.hoveredPoint;
    const hoveredTrendAtClick = window.hoveredTrendline;

    const currentChartState = drawCandlestickChart(window.stockData, window.start, window.end);

    const isBracketClick = findBracketPointAt(event.clientY - canvas.getBoundingClientRect().top, currentChartState);
    let consumedByOverlay = !!isBracketClick;
    if (!isBracketClick) {
        consumedByOverlay = !!(
            window.triggerClickHandler(event, currentChartState) ||
            window.lineClickHandler(event, currentChartState) ||
            window.orderClickHandler(event, currentChartState) ||
            window.fillClickHandler(event, currentChartState)
        );
    }

    if (hoveredPointAtClick) {
        showTrendlinePointMenu(hoveredPointAtClick, event.pageX, event.pageY);
        return;
    }

    const toolActive = window.currentTool || window.measureDraft;
    let needsRedraw = false;
    if (hoveredTrendAtClick && hoveredTrendAtClick.trends && hoveredTrendAtClick.trends.length > 0) {
        if (isTrendPinned(hoveredTrendAtClick)) {
            unpinTrendBranch(hoveredTrendAtClick);
        } else {
            pinTrend(hoveredTrendAtClick);
        }
        needsRedraw = true;
    } else if (!hoveredTrendAtClick && !consumedByOverlay && !toolActive && (window.trendlinePath || []).length > 0) {
        popLastPinnedTrend();
        needsRedraw = true;
    }

    if (needsRedraw) {
        window.drawCandlestickChart(window.stockData, window.start, window.end);
    }
});

function clickTrendline(event, chartState) {
	console.log("Trend Click ChartState", chartState)
}

function panByPixels(dx) {
    const data = window.stockData
    if (!data?.length) return
    const cs = window.chartState
    const margin = cs?.margin ?? 50
    const plotW = (cs?.width ?? canvas.width) - 2 * margin
    const count = getBarCount()
    const candleW = plotW / Math.max(1, count)
    const barsMoved = dx / candleW
    const v = clampViewport(window.start - barsMoved, window.end - barsMoved, data.length)
    window.start = Math.round(v.start)
    window.end = Math.round(v.end)
}

document.getElementById('chartContainer').addEventListener('wheel', function(event) {
    event.preventDefault();
    if (!window.stockData?.length) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const cs = window.chartState;
    if (event.shiftKey || isOnPriceAxis(mouseX, cs)) {
        if (window.priceScale.mode !== 'manual') {
            window.priceScale.mode = 'manual';
            window.priceScale.min = cs.minPrice;
            window.priceScale.max = cs.maxPrice;
        }
        const intensity = Math.min(0.25, Math.abs(event.deltaY) * 0.0015);
        const zoomIn = event.deltaY < 0;
        const min = window.priceScale.min;
        const max = window.priceScale.max;
        const mid = (min + max) / 2;
        const half = (max - min) / 2;
        const scale = zoomIn ? (1 - intensity) : (1 + intensity);
        window.priceScale.min = mid - half * scale;
        window.priceScale.max = mid + half * scale;
        drawCandlestickChart(window.stockData, window.start, window.end);
        return;
    }
    const absX = Math.abs(event.deltaX);
    const absY = Math.abs(event.deltaY);
    if (!event.ctrlKey && absX > absY) {
        panByPixels(event.deltaX);
        drawCandlestickChart(window.stockData, window.start, window.end);
        return;
    }
    const intensity = Math.min(0.35, Math.abs(event.deltaY) * 0.0015);
    const zoomIn = event.deltaY < 0;
    zoomXAroundPixel(mouseX, zoomIn, intensity);
    drawCandlestickChart(window.stockData, window.start, window.end);
}, { passive: false });

window.addEventListener('resize', function() {
    if (window._chartResizeRaf) cancelAnimationFrame(window._chartResizeRaf);
    window._chartResizeRaf = requestAnimationFrame(function() {
        window._chartResizeRaf = null;
        drawCandlestickChart(window.stockData, window.start, window.end);
    });
});

document.getElementById('base-trends').addEventListener('click', function() {
	console.log("base-trends")
	window.base_trends_toggle = !window.base_trends_toggle
	window.drawCandlestickChart(window.stockData, start, end)
})

document.getElementById('meta-trends').addEventListener('click', function() {
	console.log("meta-trends")
	window.meta_trends_toggle = !window.meta_trends_toggle
	window.drawCandlestickChart(window.stockData, start, end)
})

document.querySelectorAll('.line-menu-item').forEach(item => {
	item.addEventListener('click', function(e) {
		const action = this.dataset.action;
		if (activeLineIndex >= 0 && draw_lines[activeLineIndex]) {
			const line = draw_lines[activeLineIndex];

			switch (action) {
				case 'trigger':
					const lastCandle = window.stockData[window.stockData.length - 1]
					const currentPrice = lastCandle.Close

					line.type = 'trigger';
					line.color = '%ff00ff';

					const triggerData = {
						product_id: selectedProduct.product_id,
						type: line.price > currentPrice ? 'price_above' : 'price_below',
						price: parseFloat(line.price),
						status: 'active',
						xch_id: exchange.ID
					}

					fetch('create-trigger', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify(triggerData)
					})
						.then(response => response.json())
						.then(data => {
							console.log('3Trigger Created: ', data)
							line.triggerId = data.id
						})
						.catch(error => {
							console.log('Error creating trigger:', error)
						})
					break;

				case 'entry':
					line.type = 'entry';
					line.color = '#00ff00';
					console.log("Entry line at price:", line.price);
					window.currentTrade = {
						entry: line.price,
						productId: selectedProduct.product_id
					};
					break;

				case 'pt':
					line.type = 'pt';
					line.color = '#ffff00';
					console.log("Profit target at price:", line.price);
					if (window.currentTrade && window.currentTrade.entry) {
						window.currentTrade.target = line.price;
					}
					break;

				case 'stop':
					line.type = 'stop';
					line.color = '#ff0000';
					console.log("Stop loss at price:", line.price);
					if (window.currentTrade && window.currentTrade.entry) {
						window.currentTrade.stop = line.price;
					}
					break;

				case 'delete':
					draw_lines.splice(activeLineIndex, 1);
					console.log("Line deleted at price:", line.price);
					break;

				case 'create':
					const entryLine = draw_lines.find(line => line.type === 'entry')
					const stopLine = draw_lines.find(line => line.type === 'stop')
					const targetLine = draw_lines.find(line => line.type === 'pt')

					if (!entryLine || !stopLine || !targetLine) {
						alert('Please set entry, stop loss, and profit target levels before creating trade')
						return
					}

					const tradeSetup = {
						entry: entryLine.price,
						size: 500,
						stop: stopLine.price,
						target: targetLine.price,
						productId: selectedProduct.product_id
					}
					createTradeGroup(tradeSetup)
					console.log("Trade group created", tradeSetup)
					break;
			}
		}

		hideLineMenu();
		drawCandlestickChart(window.stockData, start, end);
	});
});


document.addEventListener('DOMContentLoaded', function() {
	// console.log("DOM Loaded");
	const trendlineButtons = document.querySelectorAll('.trendline-btn');
	// console.log("Trendline Buttons", trendlineButtons);
	trendlineButtons.forEach(button => {
		button.addEventListener('click', function() {
			console.log("Trendline Dataset", this.dataset);
			const trendlineId = this.dataset.trendlineId;
			if (visibleTrendlines.has(trendlineId)) {
				visibleTrendlines.delete(trendlineId);
				this.classList.remove('btn-primary');
				this.classList.add('btn-secondary');
			} else {
				visibleTrendlines.add(trendlineId);
				this.classList.remove('btn-secondary');
				this.classList.add('btn-primary');
			}
			toggleTrendline(trendlineId);
			drawCandlestickChart(window.stockData, start, end);
		});
	});
});

document.addEventListener('DOMContentLoaded', () => {
	connectToBackend();

	// Initialize Bootstrap tabs if they exist
	const tabElements = document.querySelectorAll('[data-bs-toggle="tab"]');
	if (tabElements.length > 0) {
		tabElements.forEach(el => {
			new bootstrap.Tab(el);
		});
	}
});

document.addEventListener('click', function(e) {
	if (!e.target.closest('lineMenu') && !e.target.closest('#candlestickChart')) {
		window.hideLineMenu();
	}
});

window.showLineMenu = function(x, y) {
	const menu = document.getElementById('lineMenu');
	const line = draw_lines[activeLineIndex];

	// Calculate line's Y position using stored chartState
	if (chartState && line) {
        const rect = canvas.getBoundingClientRext()
        const pageX = rect.left + (x ?? 0) + window.scrollX
        const pageY = rect.top + (
            chartState.height - chartState.margin -
            ((line.price - chartState.minPrice) /
                (chartState.maxPrice - chartState.minPrice)) *
            (chartState.height - 2 * chartState.margin)
        ) + window.scrollY;
        positionMenuNear(menu, pageX, pageY);
	}
}

window.hideLineMenu = function() {
	const menu = document.getElementById('lineMenu');
	menu.style.display = 'none';
}

