window.mouseX = 0;
window.mouseY = 0;
window.currentTool = null
window.drawingStart = null
window.draw_boxes = []
window.draw_lines = []
window.activeLineIndex = -1;

window.setupEventListeners = function() {
    console.log("Setup Event Listeners")
    canvas.addEventListener('mousemove', function (event) {
        const rect = canvas.getBoundingClientRect();
        window.mouseX = event.clientX - rect.left;
        window.mouseY = event.clientY - rect.top;

        if (isDragging) {
            let dx = event.clientX - startX;
            let panFactor = Math.floor(dx / 10);
            if (panFactor !== 0) {
                window.start = Math.max(0, start - panFactor);
                window.end = Math.min(stockData.length, end - panFactor);
                window.startX = event.clientX;
                drawCandlestickChart(stockData, start, end);
            }
        } else {
            window.handleMouseMove(event, chartState, tradeGroups);
            window.drawCandlestickChart(stockData, start, end)
        }
    });


    canvas.addEventListener('mousedown', function (event) {
        var rect = canvas.getBoundingClientRect();
        mouseX = event.clientX - rect.left;
        mouseY = event.clientY - rect.top;

        if (currentTool) {
            if (currentTool === 'line' || currentTool === 'trigger') {
                chartState = drawCandlestickChart(stockData, start, end);
                const price = calculatePrice(mouseY, chartState.height, chartState.margin, chartState.minPrice, chartState.maxPrice);
                const line = { price: price };

                if (currentTool === 'trigger') {
                    const lastCandle = stockData[stockData.length - 1];
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
                drawCandlestickChart(stockData, start, end);
            }
            drawingStart = { x: mouseX, y: mouseY };
        } else {
            isDragging = true;
            startX = event.clientX;
            canvas.style.cursor = 'grabbing';
        }
    });
}

window.handleMouseMove = function (e, chartState, tradeGroups) {
    fillHoverHandler(e, chartState)
    orderHoverHandler(e, chartState)
    tradeHoverHandler(e, chartState, tradeGroups)
    lineHoverHandler(e, chartState)
    triggerHoverHandler(e, chartState)
    window.trendlinePointHoverHandler(e, chartState)
}

window.showTriggerNotification = function (trigger) {
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

window.trendlinePointHoverHandler = function (e, chartState) {
    // console.log("Hover Trendline")
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Reset trendlinePoints if necessary (assuming it's a global array)
    // If trendlinePoints is not global, ensure it's accessible here
    let closestPoint = null;
    let minDistance = Infinity;

    trendlinePoints.forEach(point => {
        const dx = point.x - mouseX;
        const dy = point.y - mouseY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < minDistance) {
            minDistance = distance;
            closestPoint = point;
        }
    });

    if (closestPoint && minDistance < 10) { // 10px threshold
        window.hoveredTrendlinePoint = closestPoint;
        showTrendlinePointTooltip(closestPoint, mouseX, mouseY);
        canvas.style.cursor = 'pointer';
    } else {
        window.hoveredTrendlinePoint = null;
        hideTrendlinePointTooltip();
        canvas.style.cursor = 'default';
    }
}


const fillHoverHandler = function (e, chartState) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    current_fills.forEach(fill => {
        const fillTime = new Date(fill.time).getTime() / 1000;
        const firstCandleTime = stockData[start].Timestamp;
        const timeRange = stockData[end - 1].Timestamp - firstCandleTime;
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

                menu.addEventListener('mouseenter', () => {
                    menu.dataset.hovering = 'true';
                });

                menu.addEventListener('mouseleave', () => {
                    menu.dataset.hovering = 'false';
                    menu.remove();
                });

                // Add click handlers to menu items
                menu.querySelectorAll('.line-menu-item').forEach(item => {
                    item.addEventListener('click', function (e) {
                        const action = this.dataset.action;
                        console.log("handle_line_action", draw_lines[activeLineIndex])
                        handleLineAction(action, draw_lines[activeLineIndex]);
                        menu.remove();
                        drawCandlestickChart(stockData, start, end);
                    });
                });

                document.body.appendChild(menu);
            }

            canvas.style.cursor = 'pointer';
            isNearLine = true;
            activeLineIndex = index;
        }
    });

    if (!isNearLine) {
        canvas.style.cursor = 'default';
        activeLineIndex = -1;
        const menu = document.querySelector('.line-menu');
        if (menu && menu.dataset.hovering !== 'true') {
            menu.remove();
        }
    }
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
            current_triggers = current_triggers.filter(triggers => triggers.id !== triggerID)
            drawCandlestickChart(stockData, start, end)
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
            drawCandlestickChart(stockData, start, end);
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
            drawCandlestickChart(stockData, start, end)
            document.querySelectorAll('.trade-menu').forEach(el => el.remove())
        })
        .catch(error => console.error('Error deleting trade group:', error))
}

canvas.addEventListener('mouseup', function () {
    console.log("MouseUp")
    if (currentTool) {
        drawingStart = null
        if (currentTool === 'box') {
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

canvas.addEventListener('click', function (event) {
    if (window.hoveredTrendlinePoint) {
        const mouseX = event.pageX;
        const mouseY = event.pageY;
        // Find the current point object since trendlinePoints is recalculated on redraw
        const point = trendlinePoints.find(p =>
            p.trendline === window.hoveredTrendlinePoint.trendline &&
            p.type === window.hoveredTrendlinePoint.type
        );
        if (point) {
            showTrendlinePointMenu(point, mouseX, mouseY);
        }
    }
});

canvas.addEventListener('mouseleave', function (event) {
    // console.log("Canvas Leave");

    hideTrendlinePointTooltip()
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
        if (end - start > zoomFactor) {
            start += zoomFactor;
            end -= zoomFactor;
        }
    } else { // Zoom out
        start = Math.max(0, start - zoomFactor);
        end = Math.min(stockData.length, end + zoomFactor);
    }
    drawCandlestickChart(stockData, start, end);
});

window.addEventListener('resize', function () {
    chartState = drawCandlestickChart(window.stockData, start, end);
});

document.getElementById('line').addEventListener('click', function () {
    console.log("Line Selected")
    if (currentTool == 'line' || currentTool == 'box') {
        currentTool = null
    }
    else {

        currentTool = 'line'
    }
})
document.getElementById('box').addEventListener('click', function () {
    if (currentTool == 'line' || currentTool == 'box') {
        currentTool = null
    }
    else {
        console.log("Box Selected")
        currentTool = 'box'
    }
})
document.querySelectorAll('.line-menu-item').forEach(item => {
    item.addEventListener('click', function (e) {
        const action = this.dataset.action;
        if (activeLineIndex >= 0 && draw_lines[activeLineIndex]) {
            const line = draw_lines[activeLineIndex];

            switch (action) {
                case 'trigger':
                    const lastCandle = stockData[stockData.length - 1]
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
        drawCandlestickChart(stockData, start, end);
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
            drawCandlestickChart(stockData, start, end);
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
    if (!e.target.closest('#lineMenu') && !e.target.closest('#candlestickChart')) {
        hideLineMenu();
    }
});

document.getElementById('trigger').addEventListener('click', function () {
    if (currentTool === 'trigger') {
        currentTool = null;
    } else {
        currentTool = 'trigger';
        console.log("Trigger tool selected");
    }
});

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
