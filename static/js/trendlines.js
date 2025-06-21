// Create and initialize the tooltip element
console.log("trendlines.js")

window.pointTooltip = document.createElement('div');
window.pointTooltip.className = 'point-tooltip';
window.pointTooltip.style.position = 'absolute';
window.pointTooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
window.pointTooltip.style.color = 'white';
window.pointTooltip.style.padding = '5px';
window.pointTooltip.style.borderRadius = '3px';
window.pointTooltip.style.display = 'none';
document.body.appendChild(window.pointTooltip);

window.trendLineTooltip = document.createElement('div');
window.trendLineTooltip.className = 'trend-line-tooltip';
window.trendLineTooltip.style.position = 'absolute';
window.trendLineTooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
window.trendLineTooltip.style.color = 'white';
window.trendLineTooltip.style.padding = '5px';
window.trendLineTooltip.style.borderRadius = '3px';
window.trendLineTooltip.style.display = 'none';
document.body.appendChild(window.trendLineTooltip);

function getTrendStartFinish(trend) {
    if (trend.trends.length() > 0) {



    }

}

function showTrendlineTooltip(trend, mouseX, mouseY) {
    let html = `
        <div>TrendDetails</div>
        <div>Start: ${trend.start.point.toFixed(8)} at ${new Date(trend.start.time * 1000).toLocaleString()}</div>
        <div>End: ${trend.end.point.toFixed(8)} at ${new Date(trend.end.time * 1000).toLocaleString()}</div>
        <div>Status: ${trend.status || 'N/A'}</div>
    `

    if (trend.trends && trend.trends.length > 0) {
        html += `<div>Subtrends: ${trend.trends.length}</div><ul>`
        trend.trends.forEach(subtrend => {
            html += `<li>${subtrend.start.point.toFixed(8)} to ${subtrend.end.point.toFixed(8)}</li>`
        })
        html += '</ul>'
    }

    console.log("|TREND_Start|",trend.start.trendStart, trend.end.trendStart)

    window.trendLineTooltip.innerHTML = html
    window.trendLineTooltip.style.left = `${mouseX + 10}px`
    window.trendLineTooltip.style.top = `${mouseY + 10}px`
    window.trendLineTooltip.style.display = 'block'
}

function hideTrendlineTooltip() {
    window.trendLineTooltip.style.display = 'none'
}

window.showPointTooltip = function (point, mouseX, mouseY) {
    const trend = point.trend; // Use point.trend instead of point.trendline
    const time = point.type === 'start' ? trend.start.time : trend.end.time;
    const price = point.price; // Use the stored price directly

    // Safely determine subtrends count, default to 0 if trend.trends is undefined
    const subTrendsCount = trend.trends ? trend.trends.length : 0;

    window.pointTooltip.innerHTML = `
        <div>Trendline Index: ${point.index + 1}</div>
        <div>Point: ${point.type}</div>
        <div>Time: ${new Date(time * 1000).toLocaleString()}</div>
        <div>Price: ${price.toFixed(8)}</div>
        <div>SubTrends: ${subTrendsCount}</div>
    `;
    window.pointTooltip.style.left = `${mouseX + 10}px`;
    window.pointTooltip.style.top = `${mouseY + 10}px`;
    window.pointTooltip.style.display = 'block';
};

window.hidePointTooltip = function () {
    if (window.pointTooltip) {
        window.pointTooltip.style.display = 'none';
    }
}

window.toggleTrendline = function (key) {
    console.log("Toggle Trendline", key);
    console.log("Visible Trendlines", visibleTrendlines)
}

window.showTrendlinePointMenu = function (point, mouseX, mouseY) {
    // Remove any existing menu
    document.querySelectorAll('.trendline-point-menu').forEach(el => el.remove());

    const menu = document.createElement('div');
    menu.className = 'trendline-point-menu';
    menu.style.position = 'absolute';
    menu.style.left = `${mouseX - 100}px`;
    menu.style.top = `${mouseY - 10}px`;
    menu.style.backgroundColor = '#333';
    menu.style.color = 'white';
    menu.style.padding = '10px';
    menu.style.border = '1px solid #666';
    menu.style.borderRadius = '4px';
    menu.style.display = 'block';
    menu.style.zIndex = '1000';
    menu.style.pointerEvents = 'auto';
    menu.style.minWidth = '150px';

    // Use the point's stored price
    const price = point.price;

    menu.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <strong>Trend Point Menu</strong>
            <span class="close-menu" style="cursor: pointer; padding: 0 5px;">×</span>
        </div>
        <div>Price: ${price.toFixed(8)}</div>
        <div class="line-menu-item" data-action="entry">Set as Entry</div>
        <div class="line-menu-item" data-action="stop">Set as Stop Loss</div>
        <div class="line-menu-item" data-action="pt">Set as Profit Target</div>
        <div class="line-menu-item" data-action="trigger">Set as Trigger</div>
    `;

    document.body.appendChild(menu);

    // Add event listeners to menu items
    menu.querySelectorAll('.line-menu-item').forEach(item => {
        item.addEventListener('click', function () {
            const action = this.dataset.action;
            const line = { price: price }; // Create a line object with the correct price
            handleLineAction(action, line);
            menu.remove();
            drawCandlestickChart(window.stockData, window.start, window.end);
        });
    });

    menu.querySelector('.close-menu').addEventListener('click', () => {
        menu.remove();
    });

    // Close menu when hovering off
    menu.addEventListener('mouseleave', () => {
        menu.remove();
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
};
