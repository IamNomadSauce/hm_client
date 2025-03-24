
function calculatePrice(y, height, margin, minPrice, maxPrice) {
    return maxPrice - ((y - margin) / (height - 2 * margin)) * (maxPrice - minPrice);
}

function isMouseNearLine(mouseY, lineY, threshold = 5) {
    return Math.abs(mouseY - lineY) < threshold;
}

function calculateRR(entry, stop, target) {
    if (!entry || !stop || !target) return 0;
    const risk = Math.abs(entry - stop)
    const reward = Math.abs(target - entry)
    return (reward / risk).toFixed(2)
}

function calculateRisk(entry, stop) {
    if (!entry || !stop) return 0;
    return (Math.abs(entry - stop) / entry * 100).toFixed(2)
}

