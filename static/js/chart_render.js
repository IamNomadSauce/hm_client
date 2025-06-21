window.hoveredPoint = null
window.point = null
window.hoveredTrendlinePoint = null
window.hoveredSubtrendPoint = null
window.trendlinePoints = []
window.subtrendPoints = []
var price = 0.0

window.canvas = document.getElementById('candlestickChart');
window.ctx = canvas.getContext('2d');

window.chartState = null;

window.updateChartState = function (ctx, width, height, margin, minPrice, maxPrice, firstCandleTime, lastCandleTime) {
    chartState = {
        ctx,
        width,
        height,
        margin,
        minPrice,
        maxPrice,
        firstCandleTime,
        lastCandleTime
    }
}

window.drawCandlestickChart = function (data, start, end) {
    // console.log("DrawCandlestickChart\n", data, start, end)
    // console.log(data, start, end)
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const width = canvas.width;
    const height = canvas.height;
    const margin = 50;

    const visibleData = data.slice(start, end);
    // let visibleData = data
    const candleWidth = (width - 2 * margin) / visibleData.length;
    const firstCandleTime = visibleData[0].Timestamp;
    const lastCandleTime = visibleData[visibleData.length - 1].Timestamp;
    const timeRange = lastCandleTime - firstCandleTime;

    const minPrice = Math.min(...visibleData.map(d => d.Low));
    const maxPrice = Math.max(...visibleData.map(d => d.High));

    window.updateChartState(ctx, width, height, margin, minPrice, maxPrice, firstCandleTime, lastCandleTime);

    // Draw candles
    visibleData.forEach((d, i) => {
        const x = margin + i * candleWidth;
        const openY = height - margin - ((d.Open - minPrice) / (maxPrice - minPrice)) * (height - 2 * margin);
        const closeY = height - margin - ((d.Close - minPrice) / (maxPrice - minPrice)) * (height - 2 * margin);
        const highY = height - margin - ((d.High - minPrice) / (maxPrice - minPrice)) * (height - 2 * margin);
        const lowY = height - margin - ((d.Low - minPrice) / (maxPrice - minPrice)) * (height - 2 * margin);

        // Draw candlestick
        ctx.beginPath();
        ctx.moveTo(x + candleWidth / 2, highY);
        ctx.lineTo(x + candleWidth / 2, lowY);
        ctx.strokeStyle = 'gray';
        ctx.stroke();

        ctx.beginPath();
        ctx.rect(x, Math.min(openY, closeY), candleWidth, Math.abs(openY - closeY));
        ctx.fillStyle = d.Close >= d.Open ? 'green' : 'red';
        ctx.strokeStyle = 'black';
        ctx.fill();
        ctx.stroke();
    });

    // Draw fills
    if (current_fills) {
        current_fills.forEach(fill => {
            const fillTime = new Date(fill.time).getTime() / 1000;
            const firstCandleTime = visibleData[0].Timestamp;
            const timeRange = visibleData[visibleData.length - 1].Timestamp - firstCandleTime;
            const xPosition = margin + ((fillTime - firstCandleTime) / timeRange) * (width - 2 * margin);
            const fillY = height - margin - ((fill.price - minPrice) / (maxPrice - minPrice)) * (height - 2 * margin);

            ctx.beginPath();
            ctx.arc(xPosition, fillY, 4, 0, 2 * Math.PI);
            ctx.fillStyle = fill.side.toLowerCase() === 'buy' ? 'lime' : 'red';
            ctx.fill();
        });
    }

    // Draw orders
    if (current_orders) {
        current_orders.forEach(order => {
            const orderY = height - margin - ((order.Price - minPrice) / (maxPrice - minPrice)) * (height - 2 * margin);
            ctx.beginPath();
            ctx.moveTo(margin, orderY);
            ctx.lineTo(width - margin, orderY);
            ctx.strokeStyle = order.Side.toLowerCase() === 'buy' ? 'rgba(0, 255, 0, 0.5)' : 'rgba(255, 0, 0, 0.5)';
            ctx.stroke();
        });
    }

    // Draw trade groups
    tradeGroups = {};

    if (current_trades) {
        current_trades.forEach(trade => {
            if (!tradeGroups[trade.group_id]) {
                tradeGroups[trade.group_id] = [];
            }
            tradeGroups[trade.group_id].push(trade);
        });

        Object.values(tradeGroups).forEach(trades => {
            // Calculate Y positions for entry/stop/targets
            const entryY = height - margin - ((trades[0].entry_price - minPrice) / (maxPrice - minPrice)) * (height - 2 * margin);
            const stopY = height - margin - ((trades[0].stop_price - minPrice) / (maxPrice - minPrice)) * (height - 2 * margin);
            const ptYs = trades.map(trade =>
                height - margin - ((trade.pt_price - minPrice) / (maxPrice - minPrice)) * (height - 2 * margin)
            );

            // Draw entry line
            ctx.beginPath();
            ctx.moveTo(margin, entryY);
            ctx.lineTo(width - margin, entryY);
            ctx.strokeStyle = trades[0].entry_status === 'FILLED' ? 'rgba(0, 255, 0, 0.8)' : 'rgba(0, 255, 0, 0.5)';
            ctx.stroke();

            // Draw stop loss line
            ctx.beginPath();
            ctx.moveTo(margin, stopY);
            ctx.lineTo(width - margin, stopY);
            ctx.strokeStyle = trades[0].stop_status === 'FILLED' ? 'rgba(255, 0, 0, 0.8)' : 'rgba(255, 0, 0, 0.5)';
            ctx.stroke();

            // Draw profit target lines
            trades.forEach((trade, i) => {
                const ptY = ptYs[i];
                ctx.beginPath();
                ctx.moveTo(margin, ptY);
                ctx.lineTo(width - margin, ptY);
                ctx.strokeStyle = trade.pt_status === 'FILLED' ? 'rgba(255, 255, 0, 0.8)' : 'rgba(255, 255, 0, 0.5)';
                ctx.stroke();
            });

            // Draw connecting lines between targets
            ctx.beginPath();
            ctx.setLineDash([5, 5]);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ptYs.forEach((ptY, i) => {
                if (i > 0) {
                    ctx.moveTo(margin, ptYs[i - 1]);
                    ctx.lineTo(width - margin, ptY);
                }
            });
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw R:R ratios
            trades.forEach((trade, i) => {
                const ptY = ptYs[i];
                const riskAmount = Math.abs(trade.entry_price - trade.stop_price);
                const rewardAmount = Math.abs(trade.pt_price - trade.entry_price);
                const rrRatio = (rewardAmount / riskAmount).toFixed(2);

                ctx.fillStyle = 'white';
                ctx.font = '12px Arial';
                ctx.fillText(`R:R ${rrRatio}`, width - 80, ptY - 5);
            });
        });
    }

    // Draw triggers
    if (window.current_triggers) {
        window.current_triggers.forEach(trigger => {
            // Skip triggered triggers
            if (trigger.status === 'triggered') {
                return;
            }

            const triggerY = height - margin - ((trigger.price - minPrice) / (maxPrice - minPrice)) * (height - 2 * margin);

            // Draw the trigger line
            ctx.beginPath();
            ctx.moveTo(margin, triggerY);
            ctx.lineTo(width - margin, triggerY);
            ctx.setLineDash([5, 5]);
            ctx.strokeStyle = '#b87100';
            ctx.stroke();
            ctx.setLineDash([]);

            // Add label
            ctx.fillStyle = 'white';
            ctx.font = '12px Arial';
            const triggerType = trigger.type
            ctx.fillText(`${triggerType}: ${trigger.price.toFixed(8)}`, width - 200, triggerY - 5);
        });
    }

    // Draw trends and metatrends
    if (trendlines && window.meta_trends_toggle) {
        trendlinePoints = []; // Reset points array each redraw
        subtrendPoints = [];

        trendlines.forEach((trendline, index) => {
            // Draw subtrends
            trendline.trends.forEach(subtrend => {
                const startX = margin + ((subtrend.start.time - firstCandleTime) / timeRange) * (width - 2 * margin);
                const endX = margin + ((subtrend.end.time - firstCandleTime) / timeRange) * (width - 2 * margin);
                const startY = height - margin - ((subtrend.start.point - minPrice) / (maxPrice - minPrice)) * (height - 2 * margin);
                const endY = height - margin - ((subtrend.end.point - minPrice) / (maxPrice - minPrice)) * (height - 2 * margin);

                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.strokeStyle = subtrend.status === "done" ? "gray" : "gray";
                ctx.lineWidth = 2;
                ctx.stroke();

                // Draw start point
                const isStartHovered = window.hoveredSubtrendPoint && window.hoveredSubtrendPoint.trend === subtrend && window.hoveredSubtrendPoint.type === 'start';
                ctx.beginPath();
                ctx.arc(startX, startY, isStartHovered ? 8 : 4, 0, 2 * Math.PI);
                ctx.fillStyle = 'gold';
                ctx.fill();

                // Draw end point
                const isEndHovered = window.hoveredSubtrendPoint && window.hoveredSubtrendPoint.trend === subtrend && window.hoveredSubtrendPoint.type === 'end';
                ctx.beginPath();
                ctx.arc(endX, endY, isEndHovered ? 8 : 4, 0, 2 * Math.PI);
                ctx.fillStyle = 'white';
                ctx.fill();

                // Store subtrend points with explicit price
                if (startX >= margin && startX <= width - margin && startY >= margin && startY <= height - margin) {
                    subtrendPoints.push({
                        x: startX,
                        y: startY,
                        trend: subtrend, // Reference to the subtrend object
                        index: index,
                        type: 'start',
                        price: subtrend.start.point // Explicitly store the subtrend’s start price
                    });
                }
                if (endX >= margin && endX <= width - margin && endY >= margin && endY <= height - margin) {
                    subtrendPoints.push({
                        x: endX,
                        y: endY,
                        trend: subtrend,
                        index: index,
                        type: 'end',
                        price: subtrend.end.point // Explicitly store the subtrend’s end price
                    });
                }
            });

            // Draw main trendline
            const startX = margin + ((trendline.start.time - firstCandleTime) / timeRange) * (width - 2 * margin);
            const endX = margin + ((trendline.end.time - firstCandleTime) / timeRange) * (width - 2 * margin);
            const startY = height - margin - ((trendline.start.point - minPrice) / (maxPrice - minPrice)) * (height - 2 * margin);
            const endY = height - margin - ((trendline.end.point - minPrice) / (maxPrice - minPrice)) * (height - 2 * margin);

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.strokeStyle = trendline.status === "done" ? "gray" : "gold";
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw start point
            const isStartHovered = window.hoveredTrendlinePoint && window.hoveredTrendlinePoint.trend === trendline && window.hoveredTrendlinePoint.type === 'start';
            ctx.beginPath();
            ctx.arc(startX, startY, isStartHovered ? 8 : 4, 0, 2 * Math.PI);
            ctx.fillStyle = 'gold';
            ctx.fill();

            // Draw end point
            const isEndHovered = window.hoveredTrendlinePoint && window.hoveredTrendlinePoint.trend === trendline && window.hoveredTrendlinePoint.type === 'end';
            ctx.beginPath();
            ctx.arc(endX, endY, isEndHovered ? 8 : 4, 0, 2 * Math.PI);
            ctx.fillStyle = 'white';
            ctx.fill();

            // Store main trendline points with explicit price
            if (startX >= margin && startX <= width - margin && startY >= margin && startY <= height - margin) {
                trendlinePoints.push({
                    x: startX,
                    y: startY,
                    trend: trendline, // Reference to the main trendline object
                    index: index,
                    type: 'start',
                    price: trendline.start.point // Explicitly store the main trendline’s start price
                });
            }
            if (endX >= margin && endX <= width - margin && endY >= margin && endY <= height - margin) {
                trendlinePoints.push({
                    x: endX,
                    y: endY,
                    trend: trendline,
                    index: index,
                    type: 'end',
                    price: trendline.end.point // Explicitly store the main trendline’s end price
                });
            }
        });
    }

    if (basetrends && window.base_trends_toggle) {

        // console.log("DX_Trendlines: ", dxtrendlines)

        trendlinePoints = []; // Reset points array each redraw
        basetrends.forEach((trendline, index) => {
            const startX = margin + ((trendline.start.time - firstCandleTime) / timeRange) * (width - 2 * margin);
            const endX = margin + ((trendline.end.time - firstCandleTime) / timeRange) * (width - 2 * margin);
            const startY = height - margin - ((trendline.start.point - minPrice) / (maxPrice - minPrice)) * (height - 2 * margin);
            const endY = height - margin - ((trendline.end.point - minPrice) / (maxPrice - minPrice)) * (height - 2 * margin);
            // console.log("Trendline", trendline)

            // Draw trendline
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.strokeStyle = trendline.status == "done" ? "gray" : "gray";
            // ctx.strokeStyle = trendline.status == "done" ? (trendline.direction == "up" ? "green" : "red") : "gold";
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw start point
            const isStartHovered = window.hoveredTrendlinePoint && window.hoveredTrendlinePoint.trendline === trendline && window.hoveredTrendlinePoint.type === 'start';
            ctx.beginPath();
            ctx.arc(startX, startY, isStartHovered ? 8 : 4, 0, 2 * Math.PI);
            ctx.fillStyle = trendline.end.color;
            ctx.fill();

            // Draw end point
            const isEndHovered = window.hoveredTrendlinePoint && window.hoveredTrendlinePoint.trendline === trendline && window.hoveredTrendlinePoint.type === 'end';
            ctx.beginPath();
            ctx.arc(endX, endY, isEndHovered ? 8 : 4, 0, 2 * Math.PI);
            ctx.fillStyle = trendline.end.color;
            ctx.fill();

            // Store points if within visible bounds
            if (startX >= margin && startX <= width - margin && startY >= margin && startY <= height - margin) {
                trendlinePoints.push({ x: startX, y: startY, trendline, index, type: 'start' });
            }
            if (endX >= margin && endX <= width - margin && endY >= margin && endY <= height - margin) {
                trendlinePoints.push({ x: endX, y: endY, trendline, index, type: 'end' });
            }
        });

        let last_trend = basetrends[basetrends.length - 1]
        // console.log("Last Trendline", last_trend)
    }

    drawToolbar(ctx, width, height, margin, minPrice, maxPrice);
    drawCrosshair(ctx, width, height, margin, minPrice, maxPrice);

    return { ctx, width, height, margin, minPrice, maxPrice };
}

function drawCrosshair(ctx, width, height, margin, minPrice, maxPrice) {
    // Draw vertical line
    ctx.beginPath();
    ctx.moveTo(mouseX, margin);
    ctx.lineTo(mouseX, height - margin);
    ctx.strokeStyle = 'rgba(100,100,100,0.5)';
    ctx.stroke();

    // Draw horizontal line
    ctx.beginPath();
    ctx.moveTo(margin, mouseY);
    ctx.lineTo(width - margin, mouseY);
    ctx.strokeStyle = 'rgba(100,100,100,0.5)';
    ctx.stroke();

    // Calculate price - fixed formula to match the candlestick scaling
    price = minPrice + ((height - margin - mouseY) / (height - 2 * margin)) * (maxPrice - minPrice);
    ctx.fillStyle = 'white';
    ctx.fillText(price.toFixed(2), width - 40, mouseY - 5);
}

window.showPointMenu = function(x, y) {
    console.log("X", x)
    console.log("Y", y)
    console.log("Price", price)

    document.querySelectorAll('.chart-point-menu').forEach(el => el.remove())

    const menu = document.createElement('div')
    menu.className = 'trendline-point-menu';
    menu.style.position = 'absolute';
    menu.style.left = `${mouseX - 100}px`;
    menu.style.top = `${mouseY + 50}px`;
    menu.style.backgroundColor = '#333';
    menu.style.color = 'white';
    menu.style.padding = '10px';
    menu.style.border = '1px solid #666';
    menu.style.borderRadius = '4px';
    menu.style.display = 'block';
    menu.style.zIndex = '1000';
    menu.style.pointerEvents = 'auto';
    menu.style.minWidth = '150px';

    menu.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <strong>Point Menu</strong>
            <span class="close-menu" style="cursor: pointer; padding: 0 5px;">×</span>
        </div>
        <div class="line-menu-item" data-action="entry">Entry</div>
        <div class="line-menu-item" data-action="stop">Stop Loss</div>
        <div class="line-menu-item" data-action="pt">Profit Target</div>
        <div class="line-menu-item" data-action="trigger">Trigger</div>
    `;

    document.body.appendChild(menu);

    // Close menu when clicking the X button
    menu.querySelector('.close-menu').addEventListener('click', () => {
        menu.remove();
    });

    // Close menu when hovering off
    menu.addEventListener('mouseleave', () => {
        menu.remove();
    });

    menu.querySelectorAll('.line-menu-item').forEach(item => {
        item.addEventListener('click', function () {
            const action = this.dataset.action;
            const line = { price: price };
            handleLineAction(action, line);
            menu.remove();
            drawCandlestickChart(window.stockData, window.start, window.end);
        });
    });

    // Close menu when clicking outside
    const closeMenuOnOutsideClick = (event) => {
        if (!menu.contains(event.target) && !event.target.classList.contains('line-menu-item')) {
            menu.remove();
            document.removeEventListener('click', closeMenuOnOutsideClick);
        }
    };
    setTimeout(() => {
        document.addEventListener('click', closeMenuOnOutsideClick);
    }, 0);
}

function drawToolbar(ctx, width, height, margin, minPrice, maxPrice) {
    let activeLineIndex = -1;
    draw_lines.forEach((line, index) => {
        // Convert price back to Y coordinate
        const y = height - margin - ((line.price - minPrice) / (maxPrice - minPrice)) * (height - 2 * margin);

        if (line.type === 'trigger') {
            ctx.setLineDash([5, 5])
        } else {
            ctx.setLineDash([])
        }

        ctx.beginPath();
        ctx.moveTo(margin, y);
        ctx.lineTo(width - margin, y);
        ctx.strokeStyle = line.color || 'yellow';
        ctx.stroke();

        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        if (line.type === 'trigger') {
            const lastCandle = stockData[stockData.length - 1]
            const currentPrice = lastCandle.Close
            const triggerType = line.price > currentPrice ? 'Trigger Above' : 'Trigger Below'
            ctx.fillText(`${triggerType}: ${line.price.toFixed(8)}`, width - 200, y - 5)
        } else {
            ctx.fillText(`${line.type ? line.type + ' - ' : ''}${line.price.toFixed(2)}`, width - 120, y - 5);
        }
    });

    if (currentTool === 'line' && drawingStart) {
        ctx.beginPath();
        ctx.moveTo(margin, drawingStart.y);
        ctx.lineTo(width - margin, drawingStart.y);
        ctx.strokeStyle = 'yellow';
        ctx.stroke();
    } else if (currentTool === 'box' && drawingStart) {
        ctx.beginPath();
        ctx.rect(drawingStart.x, drawingStart.y, mouseX - drawingStart.x, mouseY - drawingStart.y);
        ctx.strokeStyle = 'yellow';
        ctx.stroke();
    }
}
