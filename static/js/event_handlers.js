// event_handlers.js

window.mouseX = 0;
window.mouseY = 0;
window.currentTool = null
window.drawingStart = null
window.draw_boxes = []
window.draw_lines = []
window.activeLineIndex = -1;
current_triggers = []


window.setupEventListeners = function() {
	// console.log("Setup Event Listeners")
	canvas.addEventListener('mousemove', function(event) {
		// console.log("MOUSE MOVE INIT")
		const rect = canvas.getBoundingClientRect();
		window.mouseX = event.clientX - rect.left;
		window.mouseY = event.clientY - rect.top;

		if (window.isDragging) {
			let dx = event.clientX - window.startX;
			let panFactor = Math.floor(dx / 10);
			if (panFactor !== 0) {
				window.start = Math.max(0, window.start - panFactor);
				window.end = Math.min(window.stockData.length, window.end - panFactor);
				window.startX = event.clientX;
				drawCandlestickChart(window.stockData, window.start, window.end);
			}
		} else {
			handleMouseMove(event, window.chartState, window.tradeGroups);
			drawCandlestickChart(window.stockData, window.start, window.end)
		}
	});


	canvas.addEventListener('mousedown', function(event) {
		var rect = canvas.getBoundingClientRect();
		mouseX = event.clientX - rect.left;
		mouseY = event.clientY - rect.top;

		// console.log("Current Tool:", window.currentTool)
		if (window.currentTool) {
			if (window.currentTool === 'line' || window.currentTool === 'trigger') {
				chartState = drawCandlestickChart(window.stockData, window.start, window.end);
				const price = calculatePrice(mouseY, chartState.height, chartState.margin, chartState.minPrice, chartState.maxPrice);
				const line = { price: price };

				if (window.currentTool === 'trigger') {
					const lastCandle = window.stockData[window.stockData.length - 1];
					const currentPrice = lastCandle.Close;

					line.type = 'trigger';
					line.color = '#ff00ff';

					const triggerData = {
						product_id: selectedProduct.product_id,
						type: line.price > currentPrice ? 'price_above' : 'price_below',
						price: parseFloat(line.price),
						status: 'active',
						xch_id: exchange.ID
					};

					fetch('create-trigger', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify(triggerData)
					})
						.then(response => response.json())
						.then(data => {
							console.log('2Trigger Created: ', data);
							line.triggerId = data.id;
						})
						.catch(error => {
							console.log('Error creating trigger:', error);
						});
				}

				draw_lines.push(line);
				drawCandlestickChart(window.stockData, window.start, window.end);
			}
			drawingStart = { x: mouseX, y: mouseY };
		} else {
			isDragging = true;
			startX = event.clientX;
			canvas.style.cursor = 'grabbing';
		}
	});
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

	console.warn("[getFillTimestamp] could not parse time:", fill.time,
		"typeof:", typeof fill.time);
	return NaN;
}

window.lineClickHandler = function(e, chartState) {
	if (e.type !== 'click') return;

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

	if (!selectedLine) return;

	// We found one → show menu
	window.activeLineIndex = selectedIndex;

	const menu = document.createElement('div');
	menu.className = 'line-menu';
	menu.style.position = 'absolute';
	menu.style.left = `${e.pageX - 120}px`;
	menu.style.top = `${e.pageY - 8}px`;
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
		item.addEventListener('click', () => {
			const action = item.dataset.action;
			handleLineAction(action, selectedLine, selectedIndex);
			menu.remove();
			drawCandlestickChart(window.stockData, window.start, window.end);
		});
	});
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

	if (!selectedOrder) return;

	// Show menu
	const menu = document.createElement('div');
	menu.className = 'order-menu';
	menu.style.position = 'absolute';
	menu.style.left = `${e.pageX - 140}px`;
	menu.style.top = `${e.pageY - 10}px`;
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
};

window.triggerClickHandler = function(e, chartState) {
	// console.log("Trigger Click Handler")
	if (e.type !== 'click') return; // Only handle click events

	const rect = canvas.getBoundingClientRect();
	const mouseY = e.clientY - rect.top;

	if (!window.current_triggers) return;

	let selectedTrigger = null;
	let triggerY = null;

	console.log("Current Triggers", current_triggers)

	// Find the closest trigger to the click
	window.current_triggers.forEach(trigger => {
		const y = chartState.height - chartState.margin -
			((trigger.price - chartState.minPrice) / (chartState.maxPrice - chartState.minPrice)) *
			(chartState.height - 2 * chartState.margin);

		if (isMouseNearLine(mouseY, y)) {
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
		menu.style.position = 'absolute';
		menu.style.left = `${e.pageX - 150}px`;
		menu.style.top = `${e.pageY - 10}px`;
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
            <div class="trigger-menu-item" onclick="editTrigger(${selectedTrigger.id}); document.querySelector('.trigger-menu').remove();">Edit</div>
            <div class="trigger-menu-item" onclick="deleteTrigger(${selectedTrigger.id}); document.querySelector('.trigger-menu').remove();">Delete</div>
            <div class="trigger-menu-item" onclick="handleTriggerAction('connect', ${selectedTrigger.id}); document.querySelector('.trigger-menu').remove();">Connect to Trade</div>
            <div class="trigger-menu-item" onclick="showTradeOptions(${selectedTrigger.id}); document.querySelector('.trigger-menu').remove();">Upon Trigger...</div>
        `;

		document.body.appendChild(menu);


		const closeMenuOnOutsideClick = (event) => {
			if (!menu.contains(event.target) && !event.target.classList.contains('trigger-menu-item')) {
				menu.remove();
				document.removeEventListener('click', closeMenuOnOutsideClick);
			}
		};

		setTimeout(() => {
			document.addEventListener('click', closeMenuOnOutsideClick);
		}, 0);
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

	if (!selectedFill) return;

	// Create menu
	const menu = document.createElement('div');
	menu.className = 'fill-menu';
	menu.style.position = 'absolute';
	menu.style.left = `${e.pageX - 130}px`;
	menu.style.top = `${e.pageY - 10}px`;
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

	// Auto-close on outside click
	const closeListener = (ev) => {
		if (!menu.contains(ev.target)) {
			menu.remove();
			document.removeEventListener('click', closeListener);
		}
	};
	setTimeout(() => document.addEventListener('click', closeListener), 0);
};

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
	const isFillHover = fillHoverHandler(e, chartState)
	// console.log("Is Fill Hovered", isFillHover)
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

	const rect = canvas.getBoundingClientRect()
	const mouseX = e.clientX - rect.left
	const mouseY = e.clientY - rect.top

	let closestTrend = null
	let minDistance = Infinity

	chartState.trendlines.forEach(trendline => {
		// Main trendline coordinates
		const startX = chartState.margin + ((trendline.start.time - chartState.firstCandleTime) / (chartState.lastCandleTime - chartState.firstCandleTime)) * (chartState.width - 2 * chartState.margin);
		const endX = chartState.margin + ((trendline.end.time - chartState.firstCandleTime) / (chartState.lastCandleTime - chartState.firstCandleTime)) * (chartState.width - 2 * chartState.margin);
		const startY = chartState.height - chartState.margin - ((trendline.start.point - chartState.minPrice) / (chartState.maxPrice - chartState.minPrice)) * (chartState.height - 2 * chartState.margin);
		const endY = chartState.height - chartState.margin - ((trendline.end.point - chartState.minPrice) / (chartState.maxPrice - chartState.minPrice)) * (chartState.height - 2 * chartState.margin);

		const distance = distanceToLineSegment(mouseX, mouseY, startX, startY, endX, endY);
		if (distance < minDistance) {
			minDistance = distance;
			closestTrend = trendline;
		}

		// Subtrend coordinates
		if (trendline.trends && trendline.trends.length > 0) {
			trendline.trends.forEach(subtrend => {
				const subStartX = chartState.margin + ((subtrend.start.time - chartState.firstCandleTime) / (chartState.lastCandleTime - chartState.firstCandleTime)) * (chartState.width - 2 * chartState.margin);
				const subEndX = chartState.margin + ((subtrend.end.time - chartState.firstCandleTime) / (chartState.lastCandleTime - chartState.firstCandleTime)) * (chartState.width - 2 * chartState.margin);
				const subStartY = chartState.height - chartState.margin - ((subtrend.start.point - chartState.minPrice) / (chartState.maxPrice - chartState.minPrice)) * (chartState.height - 2 * chartState.margin);
				const subEndY = chartState.height - chartState.margin - ((subtrend.end.point - chartState.minPrice) / (chartState.maxPrice - chartState.minPrice)) * (chartState.height - 2 * chartState.margin);

				const subDistance = distanceToLineSegment(mouseX, mouseY, subStartX, subStartY, subEndX, subEndY);
				if (subDistance < minDistance) {
					minDistance = subDistance;
					closestTrend = subtrend;
				}
			});
		}
	});


	const threshold = 5
	if (minDistance < threshold) {
		showTrendlineTooltip(closestTrend, mouseX, mouseY)
		// console.log("Trendline Hovered", closestTrend)
		window.current_trend = closestTrend
		return closestTrend
	} else {
		hideTrendlineTooltip()
		window.current_trend = null
		// return false
		return null
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

canvas.addEventListener('mouseup', function() {
	// console.log("MouseUp")
	if (window.currentTool) {
		drawingStart = null
		if (window.currentTool === 'box') {
			console.log(" - _Box end", mouseX, mouseY)
		}
	} else {
		isDragging = false;
		canvas.style.cursor = 'crosshair';
	}
});

canvas.addEventListener('mouseleave', function() {
	// console.log("Canvas Leave2")
	isDragging = false;
	canvas.style.cursor = 'crosshair';
});

canvas.addEventListener('click', function(event) {
	// Always use fresh chart state for accurate coordinates
	const currentChartState = drawCandlestickChart(window.stockData, window.start, window.end);

	window.triggerClickHandler(event, currentChartState);
	window.lineClickHandler(event, currentChartState);
	window.orderClickHandler(event, currentChartState);
	window.fillClickHandler(event, currentChartState);

	// Your trendline navigation logic...
	if (window.hoveredTrendline && window.hoveredTrendline.trends && window.hoveredTrendline.trends.length > 0) {
		window.trendlinePath.push(window.hoveredTrendline);
		window.currentTrendlines = window.hoveredTrendline.trends;
		window.drawCandlestickChart(window.stockData, window.start, window.end);
	} else if (!window.hoveredTrendline && window.trendlinePath.length > 0) {
		window.trendlinePath.pop();
		window.currentTrendlines = window.trendlinePath.length > 0
			? window.trendlinePath[window.trendlinePath.length - 1].trends
			: window.trendlines;
		window.drawCandlestickChart(window.stockData, window.start, window.end);
	}

	if (window.hoveredPoint) {
		const mouseX = event.pageX;
		const mouseY = event.pageY;
		showTrendlinePointMenu(window.hoveredPoint, mouseX, mouseY);
	}
});

function clickTrendline(event, chartState) {
	console.log("Trend Click ChartState", chartState)
}

canvas.addEventListener('mouseleave', function(event) {
	// console.log("Canvas Leave");

	// hideTrendlinePointTooltip()
	hidePointTooltip()
	// Get mouse position
	const mouseX = event.clientX;
	const mouseY = event.clientY;

	// Get canvas and menu boundaries
	const canvasRect = canvas.getBoundingClientRect();
	const menu = document.querySelector('.order-menu');
	const menuRect = menu ? menu.getBoundingClientRect() : null;

	// Check if mouse is still inside canvas or menu
	const isMouseInCanvas =
		mouseX >= canvasRect.left &&
		mouseX <= canvasRect.right &&
		mouseY >= canvasRect.top &&
		mouseY <= canvasRect.bottom;

	const isMouseInMenu =
		menuRect &&
		mouseX >= menuRect.left &&
		mouseX <= menuRect.right &&
		mouseY >= menuRect.top &&
		mouseY <= menuRect.bottom;

	if (!isMouseInCanvas && !isMouseInMenu) {
		// console.log("Mouse has left both canvas and menu");
		document.querySelectorAll('.order-menu').forEach(el => el.remove());
	}
});


document.getElementById('chartContainer').addEventListener('wheel', function(event) {
	event.preventDefault();
	if (event.deltaY < 0) { // Zoom in
		if (window.end - window.start > window.zoomFactor) {
			window.start += window.zoomFactor;
			window.end -= window.zoomFactor;
		}
	} else { // Zoom out
		window.start = Math.max(0, window.start - window.zoomFactor);
		window.end = Math.min(window.stockData.length, window.end + window.zoomFactor);
	}
	window.drawCandlestickChart(window.stockData, window.start, window.end);
});

window.addEventListener('resize', function() {
	chartState = drawCandlestickChart(window.stockData, start, end);
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
	if (chartState) {
		const lineY = chartState.height - chartState.margin -
			((line.price - chartState.minPrice) /
				(chartState.maxPrice - chartState.minPrice)) *
			(chartState.height - 2 * chartState.margin);

		menu.style.display = 'block';
		menu.style.left = `${x}px`;
		menu.style.top = `${lineY}px`;
	}
}

window.hideLineMenu = function() {
	const menu = document.getElementById('lineMenu');
	menu.style.display = 'none';
}

