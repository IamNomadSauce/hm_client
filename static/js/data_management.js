
function connectToBackend() {
    console.log("Connect To Backend")
    const backendURL = "http://192.168.0.22:31337";
    console.log("Connecting to SSE at:", backendURL);

    const eventSource = new EventSource(`${backendURL}/trigger/stream`);

    eventSource.onopen = (event) => {
        console.log("SSE Connection opened:", event);
    };

    eventSource.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            console.log(message.event)
            switch (message.event) {
                case 'price':
                    // console.log("Price:", message) // Passes Test
                    updateChartPrice(message.data);
                    break;
                case 'candle':
                    // console.log("Candle:", message, "\nSelected_Product:", selectedProduct, "\nExchange:",exchange, selectedTimeframe) // Passes Test, need to filter out to only get the product_timeframe
                    let parsed_product = `${window.selectedProduct.product_id}_${selectedTimeframe.TF}_${exchange.Name}`.toLowerCase().replace("-", "_")
                    // console.log(parsed_product, message.data.ProductID)
                    updateChart(message.data);
                    break;
                case 'trigger':
                    console.log("Trigger:", message);
                    if (window.current_triggers) {
                        // Find and update the triggered trigger
                        const triggerIndex = window.current_triggers.findIndex(t => t.id === message.data.id);
                        if (triggerIndex !== -1) {
                            if (message.data.status === 'triggered') {
                                // Remove triggered trigger from array
                                window.current_triggers.splice(triggerIndex, 1)
                            } else {
                                // Update trigger data
                                window.current_triggers[triggerIndex] = message.data;
                            }
                            // Redraw the chart to reflect the changes
                            drawCandlestickChart(stockData, start, end);
                        }
                    }
                    break;
            }
        } catch (err) {
            console.error("Error processing message:", err, "Raw data:", event.data);
        }
    };

    eventSource.onerror = (error) => {
        console.error("SSE connection error:", error);
        setTimeout(() => {
            console.log("Attempting to reconnect...");
            connectToBackend();
        }, 5000);
    };

    eventSource.addEventListener('candle', (event) => {
        try {
            const candleUpdate = JSON.parse(event.data)
            console.log("Raw Candle From Stream", event.data)
            console.log("Candle Update:", {
                product: candleUpdate.product_id,
                open: candleUpdate.Open,
                high: candleUpdate.High,
                low: candleUpdate.Low,
                close: candleUpdate.Close,
                volume: candleUpdate.Volume,
                time: new Date(candleUpdate.Timestamp * 1000).toLocaleTimeString(),
            })
            updateChart(candleUpdate)
        } catch (err) {
            console.error("Error processing candle update:", err)
        }
    })
}


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

        // If we're at the end of the view, shift the window
        if (end === stockData.length - 1) {
            start++;
            end++;
        }
    }

    // Sort candles by timestamp to ensure proper order
    stockData.sort((a, b) => a.Timestamp - b.Timestamp);

    // Redraw chart with updated data
    drawCandlestickChart(stockData, start, end);
}

