// Create and initialize the tooltip element
console.log("trendlines.js")
// window.trendlinePointTooltip = document.createElement('div');
// window.trendlinePointTooltip.className = 'trendline-point-tooltip';
// window.trendlinePointTooltip.style.position = 'absolute';
// window.trendlinePointTooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
// window.trendlinePointTooltip.style.color = 'white';
// window.trendlinePointTooltip.style.padding = '5px';
// window.trendlinePointTooltip.style.borderRadius = '3px';
// window.trendlinePointTooltip.style.display = 'none';

// window.subtrendPointTooltip = document.createElement('div');
// window.subtrendPointTooltip.className = 'subtrend-point-tooltip';
// window.subtrendPointTooltip.style.position = 'absolute';
// window.subtrendPointTooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
// window.subtrendPointTooltip.style.color = 'white';
// window.subtrendPointTooltip.style.padding = '5px';
// window.subtrendPointTooltip.style.borderRadius = '3px';
// window.subtrendPointTooltip.style.display = 'none';

window.pointTooltip = document.createElement('div');
window.pointTooltip.className = 'point-tooltip';
window.pointTooltip.style.position = 'absolute';
window.pointTooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
window.pointTooltip.style.color = 'white';
window.pointTooltip.style.padding = '5px';
window.pointTooltip.style.borderRadius = '3px';
window.pointTooltip.style.display = 'none';
document.body.appendChild(window.pointTooltip);


document.body.appendChild(window.trendlinePointTooltip);
document.body.appendChild(window.subtrendPointTooltip);

window.showTrendlinePointMenu = function (point, mouseX, mouseY) {
    // console.log("Show TrendlinePoint Menu")
    const menu = document.createElement('div');
    const canvasRect = canvas.getBoundingClientRect();

    window.trendlinePointTooltip.style.display = 'block';
    window.trendlinePointTooltip.innerHTML = `Price: ${point.trendline[point.type].point.toFixed(2)}<br>Time: ${new Date(point.trendline[point.type].time * 1000).toLocaleString()}`;
    window.trendlinePointTooltip.style.left = `${mouseX + 10}px`;
    window.trendlinePointTooltip.style.top = `${mouseY + 10}px`;

    // Position relative to canvas
    menu.style.position = 'absolute';
    menu.style.left = `${canvasRect.left + mouseX + 10}px`;
    menu.style.top = `${canvasRect.top + mouseY - 300}px`;
    menu.style.backgroundColor = 'rgba(0,0,0,0.8)';
    menu.style.color = 'white';
    menu.style.padding = '5px';
    menu.style.borderRadius = '3px';
    menu.style.zIndex = '1000';

    menu.innerHTML = `
      <div>Menu for ${point.type} point</div>
      <div>Price: ${point.trendline[point.type].point.toFixed(8)}</div>
      <div>Time: ${new Date(point.trendline[point.type].time * 1000).toLocaleString()}</div>
      <div class="line-menu-item" data-action="trigger">Set Trigger</div>
      <div class="line-menu-item" data-action="stop">Set as Stop Loss</div>
      <div class="line-menu-item" data-action="entry">Set as Entry</div>
      <div class="line-menu-item" data-action="pt">Set as Profit Target</div>
    `;

    document.body.appendChild(menu);

    // Add event listeners for menu items
    menu.querySelectorAll('.line-menu-item').forEach(item => {
        item.addEventListener('click', function () {
            const action = this.dataset.action;
            const price = point.trendline[point.type].point;
            const tempLine = { price: price };
            handleLineAction(action, tempLine);
            menu.remove();
            drawCandlestickChart(window.stockData, start, end);
        });
    });

    // Remove menu on outside click
    setTimeout(() => {
        document.addEventListener('click', function removeMenu(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', removeMenu);
            }
        });
    }, 0);
}

window.showPointTooltip = function (point, mouseX, mouseY) {
    const trendline = point.trendline;
    const time = point.type === 'start' ? trendline.start.time : trendline.end.time;
    const price = point.type === 'start' ? trendline.start.point : trendline.end.point;

    window.pointTooltip.innerHTML = `
        <div>Trendline Index: ${point.index + 1}</div>
        <div>Point: ${trendline.end.label}</div>
        <div>Time: ${new Date(time * 1000).toLocaleString()}</div>
        <div>Price: ${price.toFixed(8)}</div>
        <div>SubTrends: ${trendline.trends.length}</div>
    `;
    window.pointTooltip.style.left = `${mouseX + 10}px`;
    window.pointTooltip.style.top = `${mouseY + 10}px`; // Adjust as needed
    window.pointTooltip.style.display = 'block';
}

window.hidePointTooltip = function () {
    if (window.pointTooltip) {
        window.pointTooltip.style.display = 'none';
    }
}

// window.showTrendlinePointTooltip = function (point, mouseX, mouseY) {
//     console.log("Show TrendlinePointTooltip", point, trendlinePointTooltip)
//     if (!trendlinePointTooltip) {
//         console.log("Showing Trendline Menu")
//         trendlinePointTooltip = document.createElement('div');
//         trendlinePointTooltip.style.position = 'absolute';
//         trendlinePointTooltip.style.backgroundColor = 'rgba(0,0,0,0.8)';
//         trendlinePointTooltip.style.color = 'white';
//         trendlinePointTooltip.style.padding = '5px';
//         trendlinePointTooltip.style.borderRadius = '3px';
//         trendlinePointTooltip.style.zIndex = '1000';
//         document.body.appendChild(trendlinePointTooltip);
//     }

//     const trendline = point.trendline;
//     const time = point.type === 'start' ? trendline.start.time : trendline.end.time;
//     const price = point.type === 'start' ? trendline.start.point : trendline.end.point;

//     trendlinePointTooltip.innerHTML = `
//     <div>Trendline Index: ${point.index + 1}</div>
//     <div>Point: ${point.trendline.end.label}</div>
//     <div>Time: ${new Date(time * 1000).toLocaleString()}</div>
//     <div>Price: ${price.toFixed(8)}</div>
//     <div>SubTrends: ${point.trendline.trends.length}</div>
//   `;
//     trendlinePointTooltip.style.left = `${mouseX + 10}px`;
//     trendlinePointTooltip.style.top = `${mouseY + 175}px`;
//     trendlinePointTooltip.style.display = 'block';
// }

// window.showSubtrendPointTooltip = function (point, mouseX, mouseY) {
//     console.log("ShowSubtrendPointTooltip ", point, subtrendPointTooltip)
//     if (!subtrendPointTooltip) {
//         console.log("Showing Subtrend Menue")
//         subtrendPointTooltip = document.createElement('div');
//         subtrendPointTooltip.style.position = 'absolute';
//         subtrendPointTooltip.style.backgroundColor = 'rgba(0,0,0,0.8)';
//         subtrendPointTooltip.style.color = 'white';
//         subtrendPointTooltip.style.padding = '5px';
//         subtrendPointTooltip.style.borderRadius = '3px';
//         subtrendPointTooltip.style.zIndex = '1000';
//         document.body.appendChild(subtrendPointTooltip);
//     }

//     const trendline = point.trendline;
//     const time = point.type === 'start' ? trendline.start.time : trendline.end.time;
//     const price = point.type === 'start' ? trendline.start.point : trendline.end.point;

//     subtrendPointTooltip.innerHTML = `
//     <div>Trendline Index: ${point.index + 1}</div>
//     <div>Point: ${point.trendline.end.label}</div>
//     <div>Time: ${new Date(time * 1000).toLocaleString()}</div>
//     <div>Price: ${price.toFixed(8)}</div>
//     <div>SubTrends: ${point.trendline.trends.length}</div>
//   `;
//     subtrendPointTooltip.style.left = `${mouseX + 10}px`;
//     subtrendPointTooltip.style.top = `${mouseY + 175}px`;
//     subtrendPointTooltip.style.display = 'block';
// }


window.toggleTrendline = function (key) {
    console.log("Toggle Trendline", key);
    console.log("Visible Trendlines", visibleTrendlines)
}


// window.hideTrendlinePointTooltip = function () {
//     if (window.trendlinePointTooltip) {
//         window.trendlinePointTooltip.style.display = 'none'
//     }
// }

// window.hideSubtrendPointTooltip = function () {
//     if (window.subtrendPointTooltip) {
//         window.subtrendPointTooltip.style.display = 'none'
//     }
// }