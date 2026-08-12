console.log("Utilities.js")
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

function positionMenuNear(menu, pageX, pageY, opts = {}) {
    const pad = opts.pad ?? 8;
    const offsetX = opts.offsetX ?? 12;
    const offsetY = opts.offsetY ?? 8;
    menu.style.position = 'fixed';
    menu.style.left = '0px';
    menu.style.top = '0px';
    menu.style.visibility = 'hidden';
    const rect = menu.getBoundingClientRect();
    let left = pageX + offsetX;
    let top = pageY + offsetY;
    if (left + rect.width > window.innerWidth - pad) {
        left = pageX - rect.width - offsetX;
    }
    if (top + rect.height > window.innerHeight - pad) {
        top = pageY - rect.height - offsetY;
    }
    left = Math.max(pad, Math.min(left, window.innerWidth - rect.width - pad));
    top = Math.max(pad, Math.min(top, window.innerHeight - rect.height - pad));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.visibility = 'visible';
}
window.positionMenuNear = positionMenuNear;
