console.log("Main Function")
// window.stockData = {{ .Candles }};
// console.log("Main Function", window.stockData)
// window.selectedProduct = {{ .SelectedProduct | json }};
// window.exchange = {{.SelectedExchange | json }};
// window.selectedTimeframe = {{ .SelectedTimeframe | json }}
// window.portfolioSize = {{ .TotalValue | json }}
// window.filteredTrendlines = {{.FilteredTrendlines | json }}
// window.trendlines = {{ .Trendlines | json }}

console.log("selected product", window.selectedProduct)
//Test
window.end = window.stockData.length
window.start = Math.max(0, end - 250);
window.zoomFactor = 10;
window.draw_lines = []
window.currentTool = null
window.isDragging = false
window.currentRiskPercentage = 0.5

window.current_fills = window.exchange.Fills.filter(p => filter(p => p.product_id == window.selectedProduct.product_id))
window.current_orders = window.exchange.Orders.filter(p => filter(p => p.product_id == window.selectedProduct.product_id))
window.current_trades = window.exchange.Trades.filter(t => filter(p => p.product_id == window.selectedProduct.product_id))
window.current_triggers = window.exchange.Triggers.filter(t => filter(p => p.product_id == window.selectedProduct.product_id)) || []

window.drawCandlestickChart(stockData, start, end);

function init() {
    console.log("main.js INIT")
    drawCandlestickChart(window.start, window.end)
    setupEventListeners()
    connectToBackend()
    window.updateSidebar = createTradeSetupSidebar()
}

document.addEventListener('DOMContentLoaded', init)
window.addEventListener('resize', () => drawCandlestickChart(window.start, window.end))

