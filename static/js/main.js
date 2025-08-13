// console.log("Main Function")


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

// Corrected block for Orders
try {
    const orders = window.exchange?.Orders || [];
    const selectedProductId = window.selectedProduct?.product_id;

    if (selectedProductId) {
        // Filter orders where the order's product_id matches the selected one.
        window.current_orders = orders.filter(order => order.product_id == selectedProductId);
    } else {
        window.current_orders = [];
    }
} catch (error) {
    console.error("Error filtering orders:", error);
    window.current_orders = [];
}

try {
    window.current_trades = (window.exchange.Trades || []).filter(t => filter(p => p.product_id == window.selectedProduct.product_id))
} catch (error) {
    console.log(error)
}



// ---------------

console.log("Trigger Check")

try {
    const triggers = (window.exchange.Triggers || []);
    console.log("Triggers", triggers)
    triggers.forEach(element => {
        console.log("Trigger:", element)
    });
    console.log("Selected Product", window.selectedProduct.product_id)
    window.current_triggers = triggers.filter(p => p.product_id == window.selectedProduct.product_id) || []
    console.log("Current Triggers1", window.current_triggers)
} catch (error) {
    console.log(error)
}


// try {
//     const triggers = window.exchange?.Triggers || [];
//     const selectedProductId = window.selectedProduct?.product_id;
//
//     console.log("Triggers", triggers);
//     console.log("Selected Product ID", selectedProductId);
//
//     if (selectedProductId) {
//         // Filter the main triggers array
//         window.current_triggers = triggers.filter(t => {
//             // 't' is a trigger object from the 'triggers' array.
//             // We assume it has a property, likely named 'products' or 'conditions',
//             // which is an array. Check your console to confirm the property name.
//             // We use .some() to return true if any product in the array matches.
//             return Array.isArray(t.products) && t.products.some(p => p.product_id == selectedProductId);
//         });
//     } else {
//         window.current_triggers = [];
//     }
//
//     console.log("Current Triggers", window.current_triggers);
//
// } catch (error) {
//     console.error("Error processing triggers:", error);
//     window.current_triggers = []; // Best practice to set a default value on error
// }
//
console.log("Current Triggers2", window.current_triggers)

// drawCandlestickChart(stockData, start, end);

function init() {
    // console.log("main.js INIT")
    drawCandlestickChart(window.stockData, window.start, window.end)
    setupEventListeners()
    connectToBackend()
    window.updateSidebar = createTradeSetupSidebar()
}

document.addEventListener('DOMContentLoaded', init)
window.addEventListener('resize', () => drawCandlestickChart(window.start, window.end))

