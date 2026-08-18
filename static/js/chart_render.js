// chart_render.js

window.hoveredPoint = null
window.point = null
window.hoveredTrendline = null
window.hoveredTrendlinePoint = null
window.hoveredSubtrendPoint = null
window.trendlinePoints = []
window.subtrendPoints = []
window.trendstartlines = []
window.currentTrendlines = window.trendlines || []
window.trendlinePath = []
var price = 0.0

window.canvas = document.getElementById('candlestickChart');
window.ctx = canvas.getContext('2d');

window.chartState = null;

window.updateChartState = function (ctx, width, height, margin, minPrice, maxPrice, firstCandleTime, lastCandleTime, trendlines) {
    chartState = {
        ctx,
        width,
        height,
        margin,
        minPrice,
        maxPrice,
        firstCandleTime,
        lastCandleTime,
        trendlines
    }
}

window.drawCandlestickChart = function (data, start, end) {
    // console.log("DrawCandlestickChart\n", data, start, end)
    // console.log("DrawCandlestickChart\n" )
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

    const dataMin = Math.min(...visibleData.map(d => d.Low));
    const dataMax = Math.max(...visibleData.map(d => d.High));
    let minPrice, maxPrice;
    const ps = window.priceScale || { mode: 'auto', padding: 0.08 };
    if (ps.mode === 'manual' && ps.min != null && ps.max != null && ps.max > ps.min) {
        minPrice = ps.min;
        maxPrice = ps.max;
    } else {
        const pad = (dataMax - dataMin) * (ps.padding ?? 0.08) || dataMin * 0.001;
        minPrice = dataMin - pad;
        maxPrice = dataMax + pad;
        if (ps.mode !== 'manual') {
            ps.min = minPrice;
            ps.max = maxPrice;
        }
    }

    window.chartState = window.chartState || {}

    window.updateChartState(ctx, width, height, margin, minPrice, maxPrice, firstCandleTime, lastCandleTime, window.currentTrendlines);

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
    // console.log("Current Fills:", current_fills)
    if (current_fills) {
        current_fills.forEach(fill => {
	    let fillTime;

	    if (typeof fill.time === 'string' && fill.time.includes('-')) {
		    // Looks like ISO / date string
		fillTime = new Date(fill.time).getTime() / 1000;
	    } else {
		    // Assume it's unix timestamp in seconds (number or numeric string)
	    const timestamp = Number(fill.time);
	   	 fillTime = Number.isFinite(timestamp) ? timestamp : NaN;
	    }
            const firstCandleTime = visibleData[0].Timestamp;
            const timeRange = visibleData[visibleData.length - 1].Timestamp - firstCandleTime;
            const xPosition = margin + ((fillTime - firstCandleTime) / timeRange) * (width - 2 * margin);
            const fillY = height - margin - ((fill.price - minPrice) / (maxPrice - minPrice)) * (height - 2 * margin);
	    // console.log("FILL:", fill.time, xPosition)

            ctx.beginPath();
            ctx.arc(xPosition, fillY, 4, 0, 2 * Math.PI);
            ctx.fillStyle = fill.side.toLowerCase() === 'buy' ? 'lime' : 'red';
            ctx.fill();
        });
    }

    // Draw orders
	// console.log("Current Orders", current_orders)
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

    if (window.current_trend) {
        trend = window.current_trend
        // console.log("Render current_trend", trend)


        // ------------- Range Lines

        const start_inv_Y = height - margin - ((trend.start.inv - minPrice) / (maxPrice - minPrice)) * (height - 2 * margin);
        ctx.beginPath();
        ctx.moveTo(margin, start_inv_Y);
        ctx.lineTo(width - margin, start_inv_Y);
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = '#b87100';
        ctx.stroke();
        ctx.setLineDash([]);
        //
        const end_inv_Y = height - margin - ((trend.end.inv - minPrice) / (maxPrice - minPrice)) * (height - 2 * margin);
        ctx.beginPath();
        ctx.moveTo(margin, end_inv_Y);
        ctx.lineTo(width - margin, end_inv_Y);
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = '#b87100';
        ctx.stroke();
        ctx.setLineDash([]);
        //
        // const start_ts_Y = height - margin - ((trend.start.trendStart - minPrice) / (maxPrice - minPrice)) * (height - 2 * margin);
        // ctx.beginPath();
        // ctx.moveTo(margin, start_ts_Y);
        // ctx.lineTo(width - margin, start_ts_Y);
        // ctx.setLineDash([5, 5]);
        // ctx.strokeStyle = '#b87100';
        // ctx.stroke();
        // ctx.setLineDash([]);
        //
        // const end_ts_Y = height - margin - ((trend.end.trendStart - minPrice) / (maxPrice - minPrice)) * (height - 2 * margin);
        // ctx.beginPath();
        // ctx.moveTo(margin, end_ts_Y);
        // ctx.lineTo(width - margin, end_ts_Y);
        // ctx.setLineDash([5, 5]);
        // ctx.strokeStyle = '#b87100';
        // ctx.stroke();
        // ctx.setLineDash([]);
        //



        // ------------- Range Boxes
        
        const getY = (price) => height - margin - ((price - minPrice) / (maxPrice - minPrice)) * (height - 2 * margin);

        // --- Draw Start Box ---
        const startPointY = getY(trend.start.point);
        const startTrendStartY = getY(trend.start.trendStart);
        const startBoxY = Math.min(startPointY, startTrendStartY);
        const startBoxHeight = Math.abs(startPointY - startTrendStartY);

        // Set the color for the start box (e.g., semi-transparent green)
        ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
        ctx.fillRect(margin, startBoxY, width - 2 * margin, startBoxHeight);

        // --- Draw End Box ---
        const endPointY = getY(trend.end.point);
        const endTrendStartY = getY(trend.end.trendStart);
        const endBoxY = Math.min(endPointY, endTrendStartY);
        const endBoxHeight = Math.abs(endPointY - endTrendStartY);

        // Set the color for the end box (e.g., semi-transparent red)
        ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        ctx.fillRect(margin, endBoxY, width - 2 * margin, endBoxHeight);



        const l2hY = height - margin - ((trend.l2h.point - minPrice) / (maxPrice - minPrice)) * (height - 2 * margin);
        ctx.beginPath();
        ctx.moveTo(margin, l2hY);
        ctx.lineTo(width - margin, l2hY);
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        const l2gY = height - margin - ((trend.l2g.point - minPrice) / (maxPrice - minPrice)) * (height - 2 * margin);
        ctx.beginPath();
        ctx.moveTo(margin, l2gY);
        ctx.lineTo(width - margin, l2gY);
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

    }

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
    // console.log("Current_Triggers: ", window.current_triggers.length)
    if (window.current_triggers) {
        // console.log("There are Current Triggers available")
        window.current_triggers.forEach(trigger => {
            // console.log("Trigger:", trigger)
            // Skip triggered triggers
            // console.log("WINDOW TRIGGERS", window.exchange.Triggers)
            if (trigger.status === 'triggered') {
                return;
            }

            const triggerY = height - margin - ((trigger.price - minPrice) / (maxPrice - minPrice)) * (height - 2 * margin);
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
    if (chartState.trendlines && window.meta_trends_toggle) {
        trendlinePoints = []; // Reset points array each redraw
        subtrendPoints = [];

        chartState.trendlines.forEach((trendline, index) => {
            // Draw subtrends
            // trendline.trends.forEach(subtrend => {
            //     const startX = margin + ((subtrend.start.time - firstCandleTime) / timeRange) * (width - 2 * margin);
            //     const endX = margin + ((subtrend.end.time - firstCandleTime) / timeRange) * (width - 2 * margin);
            //     const startY = height - margin - ((subtrend.start.point - minPrice) / (maxPrice - minPrice)) * (height - 2 * margin);
            //     const endY = height - margin - ((subtrend.end.point - minPrice) / (maxPrice - minPrice)) * (height - 2 * margin);
            //
            //     ctx.beginPath();
            //     ctx.moveTo(startX, startY);
            //     ctx.lineTo(endX, endY);
            //     ctx.strokeStyle = subtrend.status === "done" ? "gray" : "gray";
            //     ctx.lineWidth = 2;
            //     ctx.stroke();
            //
            //     // Draw start point
            //     const isStartHovered = window.hoveredSubtrendPoint && window.hoveredSubtrendPoint.trend === subtrend && window.hoveredSubtrendPoint.type === 'start';
            //     ctx.beginPath();
            //     ctx.arc(startX, startY, isStartHovered ? 8 : 4, 0, 2 * Math.PI);
            //     ctx.fillStyle = 'gold';
            //     ctx.fill();
            //
            //     // Draw end point
            //     const isEndHovered = window.hoveredSubtrendPoint && window.hoveredSubtrendPoint.trend === subtrend && window.hoveredSubtrendPoint.type === 'end';
            //     ctx.beginPath();
            //     ctx.arc(endX, endY, isEndHovered ? 8 : 4, 0, 2 * Math.PI);
            //     ctx.fillStyle = 'white';
            //     ctx.fill();
            //
            //     // Store subtrend points with explicit price
            //     if (startX >= margin && startX <= width - margin && startY >= margin && startY <= height - margin) {
            //         subtrendPoints.push({
            //             x: startX,
            //             y: startY,
            //             trend: subtrend, // Reference to the subtrend object
            //             index: index,
            //             type: 'start',
            //             price: subtrend.start.point // Explicitly store the subtrend’s start price
            //         });
            //     }
            //     if (endX >= margin && endX <= width - margin && endY >= margin && endY <= height - margin) {
            //         subtrendPoints.push({
            //             x: endX,
            //             y: endY,
            //             trend: subtrend,
            //             index: index,
            //             type: 'end',
            //             price: subtrend.end.point // Explicitly store the subtrend’s end price
            //         });
            //     }
            // });

            // Draw main trendline
            const startX = margin + ((trendline.start.time - firstCandleTime) / timeRange) * (width - 2 * margin);
            const endX = margin + ((trendline.end.time - firstCandleTime) / timeRange) * (width - 2 * margin);
            const startY = height - margin - ((trendline.start.point - minPrice) / (maxPrice - minPrice)) * (height - 2 * margin);
            const endY = height - margin - ((trendline.end.point - minPrice) / (maxPrice - minPrice)) * (height - 2 * margin);

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.strokeStyle = trendline.status === "done" ? trendline.end.color : trendline.end.color;
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw start point
            const isStartHovered = window.hoveredTrendlinePoint && window.hoveredTrendlinePoint.trend === trendline && window.hoveredTrendlinePoint.type === 'start';
            ctx.beginPath();
            ctx.arc(startX, startY, isStartHovered ? 8 : 4, 0, 2 * Math.PI);
            ctx.fillStyle = trendline.end.color;
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
            ctx.strokeStyle = trendline.status == "done" ? "pink" : "white";
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

    // TODO
    if (window.hoveredTrendline && window.hoveredTrendline.trends && window.hoveredTrendline.trends.length > 0) {
        // console.log("Hovering Over Trendline Show Subtrends", window.hoveredTrendline.trends.length)
        // console.log("Subtrends len", window.hoveredTrendline.trends.length)
        window.hoveredTrendline.trends.forEach(subtrend => {
            // console.log("Cycling...", subtrend)
            const startX = margin + ((subtrend.start.time - firstCandleTime) / timeRange) * (width -2 * margin)
            const endx = margin + ((subtrend.end.time - firstCandleTime) / timeRange) * (width - 2 * margin)
            const startY = height - margin - ((subtrend.start.point - minPrice) / (maxPrice - minPrice)) * (height - 2 * margin)
            const endY = height - margin - ((subtrend.end.point - minPrice) / (maxPrice - minPrice)) * (height - 2 * margin)
        //
            ctx.beginPath()
            ctx.moveTo(startX, startY)
            ctx.lineTo(endx, endY)
            ctx.strokeStyle = "rgba(255, 215, 0, 0.5)"
            ctx.lineWidth = 1
            ctx.stroke()
        //
        })
    }

    // if (trendstartlines) {
    //     trendstartlines.forEach(subtrend => {
    //
    //         // console.log("|TREND|", trend)
    //         console.log("|TREND|",subtrend)
    //
    //
    //         const startX = margin + ((subtrend.start.time - firstCandleTime) / timeRange) * (width - 2 * margin);
    //         const endX = margin + ((subtrend.end.time - firstCandleTime) / timeRange) * (width - 2 * margin);
    //         const startY = height - margin - ((subtrend.start.point - minPrice) / (maxPrice - minPrice)) * (height - 2 * margin);
    //         const endY = height - margin - ((subtrend.end.point - minPrice) / (maxPrice - minPrice)) * (height - 2 * margin);
    //
    //         ctx.beginPath();
    //         ctx.moveTo(startX, startY);
    //         ctx.lineTo(endX, endY);
    //         ctx.strokeStyle = subtrend.status === "done" ? "gold" : "gold";
    //         ctx.lineWidth = 5;
    //         ctx.stroke();
    //
    //         // const trendY = height - margin - ((trend - minPrice) / (maxPrice - minPrice)) * (height - 2 * margin);
    //         // ctx.beginPath();
    //         // ctx.moveTo(margin, trendY);
    //         // ctx.lineTo(width - margin, trendY);
    //         // ctx.strokeStyle = 'rgba(100,100,100,0.5)';
    //         // ctx.stroke();
    //     })
    // }
	
    drawToolbar(ctx, width, height, margin, minPrice, maxPrice);
    drawMeasures(ctx, width, height, margin, minPrice, maxPrice);
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

function measurePointXY(pt, width, height, margin, minPrice, maxPrice) {
    return {
        x: xFromBarIndex(pt.barIndex, width, margin, window.start, window.end),
        y: priceToY(pt.price, height, margin, minPrice, maxPrice)
    };
}

function drawMeasureOverlay(ctx, start, end, width, height, margin, minPrice, maxPrice, opts) {
    const p1 = measurePointXY(start, width, height, margin, minPrice, maxPrice);
    const p2 = measurePointXY(end, width, height, margin, minPrice, maxPrice);
    const stats = measureStats(start, end);
    const up = stats.delta >= 0;
    const color = up ? '#26a69a' : '#ef5350';
    const fill = up ? 'rgba(38, 166, 154, 0.12)' : 'rgba(239, 83, 80, 0.12)';
    const x = Math.min(p1.x, p2.x);
    const y = Math.min(p1.y, p2.y);
    const w = Math.abs(p2.x - p1.x);
    const h = Math.abs(p2.y - p1.y);

    ctx.save();
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = opts.preview ? 1 : 1.5;
    ctx.setLineDash(opts.preview ? [5, 4] : []);
    ctx.strokeRect(x, y, w, h);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.setLineDash([]);

    const sign = stats.delta >= 0 ? '+' : '';
    const lines = [
        `${sign}${stats.pct.toFixed(2)}%`,
        `${sign}${formatMeasurePrice(stats.delta)}`,
        `${stats.bars} bar${stats.bars === 1 ? '' : 's'}`
    ];
    const padX = 8;
    const padY = 6;
    const lineH = 14;
    const boxW = 92;
    const boxH = padY * 2 + lineH * lines.length + (opts.showClose ? 2 : 0);
    let labelX = (p1.x + p2.x) / 2 - boxW / 2;
    let labelY = (p1.y + p2.y) / 2 - boxH / 2;
    labelX = Math.max(margin, Math.min(labelX, width - margin - boxW));
    labelY = Math.max(margin, Math.min(labelY, height - margin - boxH));

    ctx.fillStyle = 'rgba(20, 25, 40, 0.92)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(labelX, labelY, boxW, boxH);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = color;
    ctx.fillText(lines[0], labelX + padX, labelY + padY + 11);
    ctx.font = '11px Arial';
    ctx.fillStyle = '#e0e0e0';
    ctx.fillText(lines[1], labelX + padX, labelY + padY + 11 + lineH);
    ctx.fillText(lines[2], labelX + padX, labelY + padY + 11 + lineH * 2);

    if (opts.showClose) {
        const closeSize = 12;
        const closeX = labelX + boxW - closeSize - 4;
        const closeY = labelY + 4;
        const hovered = window.hoveredMeasureId === opts.id;
        ctx.fillStyle = hovered ? '#ff6666' : '#888';
        ctx.font = 'bold 12px Arial';
        ctx.fillText('✕', closeX, closeY + 10);
        window.measureHitAreas.push({
            id: opts.id,
            x: closeX - 2,
            y: closeY - 2,
            w: closeSize + 4,
            h: closeSize + 4
        });
    }
    ctx.restore();
}

function drawMeasures(ctx, width, height, margin, minPrice, maxPrice) {
    window.measureHitAreas = [];
    const committed = window.measures || [];
    committed.forEach(m => {
        if (!m?.start || !m?.end) return;
        drawMeasureOverlay(ctx, m.start, m.end, width, height, margin, minPrice, maxPrice, {
            id: m.id,
            showClose: true,
            preview: false
        });
    });

    const draft = window.measureDraft;
    if (draft?.start) {
        const end = draft.end || pointFromMouse(window.mouseX, window.mouseY, window.chartState);
        if (end) {
            drawMeasureOverlay(ctx, draft.start, end, width, height, margin, minPrice, maxPrice, {
                preview: true,
                showClose: false
            });
        }
    }
}

function drawToolbar(ctx, width, height, margin, minPrice, maxPrice) {
    let activeLineIndex = -1;
    const entryLine = draw_lines.find(l => l.type === 'entry');
    const stopLine = draw_lines.find(l => l.type === 'stop');
    const firstPt = draw_lines.find(l => l.type === 'pt')
    
    if (entryLine && firstPt && typeof window.getIdealStopPrice === 'function') {
        const ratio = window.rr || 4;
        const ideal = window.getIdealStopPrice(entryLine.price, firstPt.price, ratio);
        if (ideal != null && isFinite(ideal)) {
            const y = height - margin - ((ideal - minPrice) / (maxPrice - minPrice)) * (height - 2 * margin);
            ctx.save();
            ctx.setLineDash([6, 4]);
            ctx.strokeStyle = '#ff9800';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(margin, y);
            ctx.lineTo(width - margin, y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#ff9800';
            ctx.font = '12px Arial';
            ctx.fillText(`R:R stop ${ratio}R @ ${ideal.toFixed(ideal < 1 ? 8 : 2)}`, width - 200, y - 5);
            ctx.restore();
        }
    }

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
        } else if (line.type === 'pt' && entryLine && stopLine && typeof calculateRR === 'function') {
            const rrRatio = calculateRR(entryLine.price, stopLine.price, line.price);
            ctx.fillText(`pt - ${line.price.toFixed(2)}  R:R ${rrRatio}`, width - 160, y - 5);
        } else {
            ctx.fillText(`${line.type ? line.type + ' - ' : ''}${line.price.toFixed(2)}`, width - 120, y - 5);
        }
    });

    drawBracketBoxes(ctx, width, height, margin, minPrice, maxPrice);

}

// Draw filled boxes + draggable handles
window.drawBracketBoxes = function(ctx, width, height, margin, minPrice, maxPrice) {
    const brackets = {};

    draw_lines.forEach(line => {
        if (!line.isBracket || !line.bracketId) return;
        if (!brackets[line.bracketId]) brackets[line.bracketId] = {};
        brackets[line.bracketId][line.type] = line;
    });

    Object.values(brackets).forEach(b => {
        const entryLine = b.entry;
        const stopLine = b.stop;
        const tpLine = b.pt;

        if (!entryLine || !stopLine || !tpLine) return;

        const getY = (price) => height - margin - ((price - minPrice) / (maxPrice - minPrice)) * (height - 2 * margin);

        const entryY = getY(entryLine.price);
        const stopY = getY(stopLine.price);
        const tpY = getY(tpLine.price);

        // Green box: Entry → TP
        ctx.fillStyle = 'rgba(0, 255, 0, 0.12)';
        ctx.fillRect(margin, Math.min(entryY, tpY), width - 2 * margin, Math.abs(entryY - tpY));

        // Red box: Entry → Stop
        ctx.fillStyle = 'rgba(255, 0, 0, 0.12)';
        ctx.fillRect(margin, Math.min(entryY, stopY), width - 2 * margin, Math.abs(entryY - stopY));

        // Horizontal lines
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(margin, entryY); ctx.lineTo(width - margin, entryY); ctx.strokeStyle = '#00ff88'; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(margin, stopY);  ctx.lineTo(width - margin, stopY);  ctx.strokeStyle = '#ff4444'; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(margin, tpY);    ctx.lineTo(width - margin, tpY);    ctx.strokeStyle = '#ffff00'; ctx.stroke();

        // Draggable handles (circles)
        const drawHandle = (y, color, isHovered = false) => {
            ctx.beginPath();
            ctx.arc(width - margin - 20, y, isHovered ? 7 : 5, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        };

        drawHandle(entryY, '#00ff88', window.hoveredBracketPoint?.type === 'entry');
        drawHandle(stopY,  '#ff4444', window.hoveredBracketPoint?.type === 'stop');
        drawHandle(tpY,    '#ffff00', window.hoveredBracketPoint?.type === 'pt');
    });
};



