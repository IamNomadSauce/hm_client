window.mouseX = 0;
window.mouseY = 0;
window.currentTool = null
window.drawingStart = null
window.draw_boxes = []
window.draw_lines = []
window.activeLineIndex = -1;
current_triggers = []


window.setupEventListeners = function () {
    console.log("Setup Event Listeners")
    canvas.addEventListener('mousemove', function (event) {
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


    canvas.addEventListener('mousedown', function (event) {
        var rect = canvas.getBoundingClientRect();
        mouseX = event.clientX - rect.left;
        mouseY = event.clientY - rect.top;

        console.log("Current Tool:", window.currentTool)
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



canvas.addEventListener('click', function (event) {
    console.log("Canvas Clicked")
    showPointMenu(event.x, event.y)
    if (window.hoveredPoint) {
        const mouseX = event.pageX
        const mouseY = event.pageY
        showTrendlinePointMenu(window.hoveredPoint, mouseX, mouseY)
    }
})

const showTriggerNotification = function (trigger) {
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


window.triggerHoverHandler = function (e, chartState) {
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

window.triggerClickHandler = function (e, chartState) {
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
            selectedTrigger = trigger;
            triggerY = y;
        }
    });

    // Remove any existing menu
    document.querySelectorAll('.trigger-menu').forEach(el => el.remove());

    // If a trigger was clicked, show the menu
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

        // Add a global click listener to close the menu when clicking outside
        const closeMenuOnOutsideClick = (event) => {
            if (!menu.contains(event.target) && !event.target.classList.contains('trigger-menu-item')) {
                menu.remove();
                document.removeEventListener('click', closeMenuOnOutsideClick);
            }
        };
        // Delay to avoid immediate closure from the current click
        setTimeout(() => {
            document.addEventListener('click', closeMenuOnOutsideClick);
        }, 0);
    }
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

handleMouseMove = function (e, chartState, tradeGroups) {
    fillHoverHandler(e, chartState);
    orderHoverHandler(e, chartState);
    tradeHoverHandler(e, chartState, tradeGroups);
    const isLineHover = lineHoverHandler(e, chartState);
    const isTriggerHover = window.triggerHoverHandler(e, chartState);
    const isPointHover = pointHoverHandler(e, chartState);
    const isTrendLineHover = trendLineHoverHandler(e, chartState)

    if (isPointHover) {
        canvas.style.cursor = 'pointer'; // Point tooltip is shown by pointHoverHandler
    } else if (isTrendLineHover) {
        canvas.style.cursor = 'pointer'; // Trend line tooltip is shown by trendLineHoverHandler
    } else if (isLineHover || isTriggerHover) {
        canvas.style.cursor = 'pointer';
    } else {
        hidePointTooltip(); // Assuming this exists for point tooltips
        hideTrendlineTooltip();
        canvas.style.cursor = 'default';
    }
};

const pointHoverHandler = function (e, chartState) {
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
    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    let closestTrend = null
    let minDistance = Infinity

    trendlines.forEach(trendline => {
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
    });
    const threshold = 5
    if (minDistance < threshold) {
        showTrendlineTooltip(closestTrend, mouseX, mouseY)
        return true
    } else {
        hideTrendlineTooltip()
        return false
    }
}

const fillHoverHandler = function (e, chartState) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    current_fills.forEach(fill => {
        const fillTime = new Date(fill.time).getTime() / 1000;
        const firstCandleTime = window.stockData[start].Timestamp;
        const timeRange = window.stockData[end - 1].Timestamp - firstCandleTime;
        const xPosition = chartState.margin + ((fillTime - firstCandleTime) / timeRange) * (chartState.width - 2 * chartState.margin);
        const fillY = chartState.height - chartState.margin - ((fill.price - chartState.minPrice) / (chartState.maxPrice - chartState.minPrice)) * (chartState.height - 2 * chartState.margin);

        const distance = Math.sqrt(Math.pow(xPosition - mouseX, 2) + Math.pow(fillY - mouseY, 2));
        if (distance < 8) {
            chartState.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            chartState.ctx.fillRect(mouseX + 10, mouseY - 40, 120, 60);
            chartState.ctx.fillStyle = 'white';
            chartState.ctx.font = '12px Arial';
            chartState.ctx.fillText(`Fill Price: ${fill.price}`, mouseX + 15, mouseY - 20);
            chartState.ctx.fillText(`Size: ${fill.size}`, mouseX + 15, mouseY);
        }
    });
};

const orderHoverHandler = function (e, chartState) {
    const rect = canvas.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;

    current_orders.forEach(order => {
        const orderY = chartState.height - chartState.margin -
            ((order.Price - chartState.minPrice) / (chartState.maxPrice - chartState.minPrice)) *
            (chartState.height - 2 * chartState.margin);

        if (Math.abs(mouseY - orderY) < 5) {
            // Check if a menu already exists
            let existingMenu = document.querySelector('.order-menu');

            if (!existingMenu) {
                // Remove any existing menus
                document.querySelectorAll('.order-menu').forEach(el => el.remove());

                // Create a new menu
                const menu = document.createElement('div');
                menu.className = 'order-menu';
                menu.style.position = 'absolute';
                menu.style.left = `${e.pageX - 150}px`;
                menu.style.top = `${e.pageY - 10}px`;
                menu.style.zIndex = '1000';
                menu.style.pointerEvents = 'auto';

                // Populate menu content
                menu.innerHTML = `
          <div><strong>Order Details</strong></div>
          <div>Side: ${order.Side}</div>
          <div>Product: ${order.ProductID}</div>
          <div>Price: ${order.Price}</div>
          <div>Size: ${order.Size}</div>
          <div>Status: ${order.Status}</div>
          <div class="cancel-button" onclick="cancelOrder('${order.OrderID}', ${order.XchID})">Cancel Order</div>
        `;

                // Add hover behavior to prevent premature removal
                let isMouseOverMenu = false;

                // Keep track of hover state for the menu
                menu.addEventListener('mouseenter', () => {
                    // console.log("Menu enter");
                    isMouseOverMenu = true;
                });

                // Remove menu on mouse leave
                menu.addEventListener('mouseleave', function () {
                    // console.log("Menu leave");
                    this.remove(); // Remove the menu when the mouse leaves it
                });

                // Append the menu to the body
                document.body.appendChild(menu);
            }
        }
    });
};

const tradeHoverHandler = function (e, chartState, groups) {
    const rect = canvas.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;

    Object.values(groups).forEach(trades => {
        trades.forEach(trade => {
            const entryY = chartState.height - chartState.margin -
                ((trade.entry_price - chartState.minPrice) / (chartState.maxPrice - chartState.minPrice)) *
                (chartState.height - 2 * chartState.margin);
            const stopY = chartState.height - chartState.margin -
                ((trade.stop_price - chartState.minPrice) / (chartState.maxPrice - chartState.minPrice)) *
                (chartState.height - 2 * chartState.margin);
            const ptY = chartState.height - chartState.margin -
                ((trade.pt_price - chartState.minPrice) / (chartState.maxPrice - chartState.minPrice)) *
                (chartState.height - 2 * chartState.margin);

            if (isMouseNearLine(mouseY, entryY) || isMouseNearLine(mouseY, stopY) || isMouseNearLine(mouseY, ptY)) {
                let existingMenu = document.querySelector('.trade-menu');

                if (!existingMenu) {
                    document.querySelectorAll('.trade-menu').forEach(el => el.remove());

                    const menu = document.createElement('div');
                    menu.className = 'trade-menu';
                    menu.style.position = 'absolute';
                    menu.style.left = `${e.pageX - 150}px`;
                    menu.style.top = `${e.pageY - 10}px`;
                    menu.style.zIndex = '1000';
                    menu.style.pointerEvents = 'auto';

                    const groupTrades = groups[trade.group_id];
                    menu.innerHTML = `
                <div><strong>Trade Block ${trade.group_id}</strong></div>
                <div>Side: ${trade.side}</div>
                <div>Entry: ${trade.entry_price.toFixed(8)} (${trade.entry_status || 'PENDING'})</div>
                <div>Stop: ${trade.stop_price.toFixed(8)} (${trade.stop_status || 'PENDING'})</div>
                <div>Size: ${trade.size}</div>
                <div>Created: ${new Date(trade.created_at).toLocaleString()}</div>
                <div>Targets:</div>
                ${groupTrades.map(t => {
                        const rr = ((Math.abs(t.pt_price - t.entry_price)) /
                            (Math.abs(t.entry_price - t.stop_price))).toFixed(2);
                        return `<div>PT${t.pt_amount}: ${t.pt_price.toFixed(8)} (${t.pt_status || 'PENDING'})
                            <span style="color: #ffff00"> R:R ${rr}</span></div>`;
                    }).join('')}
                <div class="cancel-button" onclick="deleteTradeBlock('${trade.group_id}')">Delete Trade Block</div>
            `;

                    menu.addEventListener('mouseenter', () => {
                        // console.log("Trade Menu enter");
                        menu.dataset.hovering = 'true';
                    });

                    menu.addEventListener('mouseleave', function () {
                        // console.log("Trade Menu leave");
                        this.remove();
                    });

                    document.body.appendChild(menu);
                }
            }
        });
    });
};

const lineHoverHandler = function (e, chartState) {
    const rect = canvas.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;

    let isNearLine = false;
    draw_lines.forEach((line, index) => {
        const lineY = chartState.height - chartState.margin -
            ((line.price - chartState.minPrice) / (chartState.maxPrice - chartState.minPrice)) *
            (chartState.height - 2 * chartState.margin);

        if (isMouseNearLine(mouseY, lineY)) {
            console.log("near::lineHoverHandler");
            let existingMenu = document.querySelector('.line-menu');

            if (!existingMenu) {
                document.querySelectorAll('.line-menu').forEach(el => el.remove());

                const menu = document.createElement('div');
                menu.className = 'line-menu';
                menu.style.position = 'absolute';
                menu.style.left = `${e.pageX - 100}px`;
                menu.style.top = `${e.pageY - 10}px`;
                menu.style.display = 'block';
                menu.style.zIndex = '1000';
                menu.style.pointerEvents = 'auto';

                menu.innerHTML = `
                    <div class="line-menu-item" data-action="entry">Trade Entry</div>
                    <div class="line-menu-item" data-action="pt">Profit Target</div>
                    <div class="line-menu-item" data-action="stop">Stop Loss</div>
                    <div class="line-menu-item" data-action="trigger">Trigger</div>
                    <div class="line-menu-item" data-action="delete">Delete</div>
                    <div class="line-menu-item create-trade-btn" data-action="create">Create Trade</div>
                `;

                menu.addEventListener('click', () => {
                    console.log("click::lineHoverHandler");
                    menu.dataset.hovering = 'true';
                });

                menu.addEventListener('mouseleave', () => {
                    console.log("mouse-leave::lineHoverHandler");
                    menu.dataset.hovering = 'false';
                    menu.remove();
                });

                menu.querySelectorAll('.line-menu-item').forEach(item => {
                    item.addEventListener('click', function (e) {
                        const action = this.dataset.action;
                        console.log("handle_line_action", draw_lines[activeLineIndex]);
                        handleLineAction(action, draw_lines[activeLineIndex]);
                        menu.remove();
                        drawCandlestickChart(window.stockData, window.start, window.end);
                    });
                });

                document.body.appendChild(menu);
            }

            isNearLine = true;
            activeLineIndex = index;
        }
    });

    if (!isNearLine) {
        activeLineIndex = -1;
        const menu = document.querySelector('.line-menu');
        if (menu && menu.dataset.hovering !== 'true') {
            menu.remove();
        }
    }
    return isNearLine;
};

window.cancelTrigger = function (triggerID) {
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

window.cancelOrder = function (orderId, xchId) {
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


window.deleteTradeBlock = function (groupId) {
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

canvas.addEventListener('mouseup', function () {
    console.log("MouseUp")
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

canvas.addEventListener('mouseleave', function () {
    // console.log("Canvas Leave2")
    isDragging = false;
    canvas.style.cursor = 'crosshair';
});

// canvas.addEventListener('click', function (event) {
//     if (window.hoveredTrendlinePoint) {
//         const mouseX = event.pageX;
//         const mouseY = event.pageY;
//         // Find the current point object since trendlinePoints is recalculated on redraw
//         const point = trendlinePoints.find(p =>
//             p.trendline === window.hoveredTrendlinePoint.trendline &&
//             p.type === window.hoveredTrendlinePoint.type
//         );
//         if (point) {
//             showTrendlinePointMenu(point, mouseX, mouseY);
//         }
//     }
// });


canvas.addEventListener('click', (e) => window.triggerClickHandler(e, chartState));
canvas.addEventListener('mouseleave', function (event) {
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


document.getElementById('chartContainer').addEventListener('wheel', function (event) {
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

window.addEventListener('resize', function () {
    chartState = drawCandlestickChart(window.stockData, start, end);
});

// document.getElementById('line').addEventListener('click', function () {
//     console.log("Line Selected")
//     if (window.currentTool == 'line' || window.currentTool == 'box') {
//         window.currentTool = null
//     }
//     else {

//         window.currentTool = 'line'
//     }
// })
// document.getElementById('box').addEventListener('click', function () {
//     if (window.currentTool == 'line' || window.currentTool == 'box') {
//         window.currentTool = null
//     }
//     else {
//         console.log("Box Selected")
//         window.currentTool = 'box'
//     }
// })

document.getElementById('base-trends').addEventListener('click', function () {
    console.log("base-trends")
    window.base_trends_toggle = !window.base_trends_toggle
    window.drawCandlestickChart(window.stockData, start, end)
})

document.getElementById('meta-trends').addEventListener('click', function () {
    console.log("meta-trends")
    window.meta_trends_toggle = !window.meta_trends_toggle
    window.drawCandlestickChart(window.stockData, start, end)
})

document.querySelectorAll('.line-menu-item').forEach(item => {
    item.addEventListener('click', function (e) {
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

canvas.addEventListener('click', function (event) {
    console.log("Line Clicked", draw_lines)
    if (activeLineIndex >= 0 && draw_lines[activeLineIndex]) {
        showLineMenu(event.pageX, event.pageY);
        console.log("Line clicked - Price:", draw_lines[activeLineIndex].price);
        console.log("Line type", draw_lines[activeLineIndex].type)
        if (draw_lines[activeLineIndex].type) {
            console.log("Line type:", draw_lines[activeLineIndex].type);
        }
    }
});

document.addEventListener('DOMContentLoaded', function () {
    console.log("DOM Loaded");
    const trendlineButtons = document.querySelectorAll('.trendline-btn');
    console.log("Trendline Buttons", trendlineButtons);
    trendlineButtons.forEach(button => {
        button.addEventListener('click', function () {
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

document.addEventListener('click', function (e) {
    if (!e.target.closest('lineMenu') && !e.target.closest('#candlestickChart')) {
        window.hideLineMenu();
    }
});

// document.getElementById('trigger').addEventListener('click', function () {
//     if (window.currentTool === 'trigger') {
//         console.log("TRIGGER_DESELECTED")
//         window.currentTool = null;
//     } else {
//         window.currentTool = 'trigger';
//         console.log("TRIGGER_SELECTED")
//     }
// });

window.showLineMenu = function (x, y) {
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

window.hideLineMenu = function () {
    const menu = document.getElementById('lineMenu');
    menu.style.display = 'none';
}

canvas.addEventListener('click', function (event) {
    if (window.currentTool && ['trigger', 'entry', 'stop', 'pt'].includes(window.currentTool)) {
        const rect = canvas.getBoundingClientRect();
        const mouseY = event.clientY - rect.top;
        const chartState = drawCandlestickChart(stockData, start, end);
        const price = calculatePrice(mouseY, chartState.height, chartState.margin, chartState.minPrice, chartState.maxPrice);

        const line = { price: price };
        handleLineAction(window.currentTool, line);
        drawCandlestickChart(stockData, start, end);
        window.updateSidebar();
    }
});

canvas.addEventListener('click', function (event) {
    // Existing trigger menu handler
    window.triggerClickHandler(event, chartState);

    // New trade tool handler
    if (window.currentTool && ['trigger', 'entry', 'stop', 'pt'].includes(window.currentTool)) {
        const rect = canvas.getBoundingClientRect();
        const mouseY = event.clientY - rect.top;
        const chartState = drawCandlestickChart(stockData, start, end);
        const price = calculatePrice(mouseY, chartState.height, chartState.margin, chartState.minPrice, chartState.maxPrice);
        const line = { price: price };
        handleLineAction(window.currentTool, line);
        drawCandlestickChart(stockData, start, end);
        window.updateSidebar();
    }
});

