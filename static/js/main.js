console.log("Main Function")


console.log("selected product", window.selectedProduct.product_id)
//Test
window.end = window.stockData.length
window.start = Math.max(0, end - 250);
window.zoomFactor = 10;
window.draw_lines = []
window.currentTool = null
window.isDragging = false
window.currentRiskPercentage = 0.5
window.all_triggers = []


// window.current_fills = window.exchange.Fills.filter(p => filter(p => p.product_id == window.selectedProduct.product_id))
window.current_fills = (window.exchange.Fills || []).filter(p => p.product_id === window.selectedProduct?.product_id || '');

try {
    window.current_orders = (window.exchange.Orders || []).filter(p => filter(p => p.product_id == window.selectedProduct.product_id))
} catch (error) {
    console.log(error)
    
}
try {
    window.current_trades = (window.exchange.Trades || []).filter(t => filter(p => p.product_id == window.selectedProduct.product_id))
} catch (error) {
    console.log(error)
}
console.log("Trigger Check")

try {
    const triggers = (window.exchange.Triggers || []);
    console.log("Triggers", triggers)
    triggers.forEach(element => {
        console.log(element)
    });
    console.log("Selected Product", window.selectedProduct.product_id)
    
    window.current_triggers = (window.exchange.Triggers || []).filter(t => filter(p => p.product_id == window.selectedProduct.product_id)) || []
    console.log("Current Triggers1", window.current_triggers)
} catch (error) {
    console.log(error)
    
}
console.log("Current Triggers2", window.current_triggers)

// drawCandlestickChart(stockData, start, end);

function init() {
    console.log("main.js INIT")
    drawCandlestickChart(window.stockData, window.start, window.end)
    setupEventListeners()
    connectToBackend()
    window.updateSidebar = createTradeSetupSidebar()
}

document.addEventListener('DOMContentLoaded', init)
window.addEventListener('resize', () => drawCandlestickChart(window.start, window.end))

