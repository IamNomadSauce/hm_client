// trade_setup.js
console.log("trade_setup.js");

window.portfolioSize = window.portfolioSize || 10000
const updateSidebar = createTradeSetupBar();
window.updateSidebar = updateSidebar

let rr = 4
window.rr = rr
window.autoStopDismissed = false
window.rrStopPrice = null
window.rrStopVisible = false



function createTradeSetupBar() {
    // Remove old sidebar UI if present
    document.getElementById('trade-setup-sidebar')?.remove();
    document.getElementById('trade-setup-tab')?.remove();
    document.getElementById('trade-setup-bar')?.remove();

    // Styles
    if (!document.getElementById('trade-setup-bar-styles')) {
        const style = document.createElement('style');
        style.id = 'trade-setup-bar-styles';
        style.textContent = `
            #trade-setup-bar {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                z-index: 2500;
                display: none;
                align-items: center;
                gap: 12px;
                padding: 8px 14px;
                background: linear-gradient(180deg, #1a1a24 0%, #14141c 100%);
                border-bottom: 1px solid #33334a;
                box-shadow: 0 4px 18px rgba(0,0,0,0.45);
                color: #e8e8ff;
                font-size: 12px;
                font-family: system-ui, -apple-system, sans-serif;
                overflow-x: auto;
                white-space: nowrap;
            }
            #trade-setup-bar.visible { display: flex; }

            #trade-setup-bar .chip {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 4px 10px;
                border-radius: 999px;
                background: #222233;
                border: 1px solid #3a3a55;
                line-height: 1.2;
            }
            #trade-setup-bar .chip.entry { border-color: #00c853; color: #7dffb3; }
            #trade-setup-bar .chip.stop  { border-color: #ff5252; color: #ff8a80; }
            #trade-setup-bar .chip.pt    { border-color: #ffd600; color: #ffe57f; }
            #trade-setup-bar .chip.trigger { border-color: #e040fb; color: #ea80fc; }
            #trade-setup-bar .chip.side-long  { background: #0d3b22; border-color: #00c853; color: #7dffb3; }
            #trade-setup-bar .chip.side-short { background: #3b0d0d; border-color: #ff5252; color: #ff8a80; }

            #trade-setup-bar .label { opacity: 0.65; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
            #trade-setup-bar .value { font-weight: 600; font-variant-numeric: tabular-nums; }

            #trade-setup-bar .chain {
                display: inline-flex;
                align-items: center;
                gap: 4px;
            }
            #trade-setup-bar .chain-arrow { opacity: 0.4; margin: 0 2px; }

            #trade-setup-bar .spacer { flex: 1; min-width: 8px; }

            #trade-setup-bar input[type="range"] {
                width: 90px; vertical-align: middle;
            }

            #trade-setup-bar .btn {
                border: none; border-radius: 6px; padding: 5px 12px;
                cursor: pointer; font-size: 12px; font-weight: 600;
            }
            #trade-setup-bar .btn-exec {
                background: #00c853; color: #04140a;
            }
            #trade-setup-bar .btn-exec:disabled {
                background: #2a2a33; color: #666; cursor: not-allowed;
            }
            #trade-setup-bar .btn-clear {
                background: transparent; color: #aaa; border: 1px solid #444;
            }
            #trade-setup-bar .btn-close {
                background: transparent; color: #888; font-size: 16px; padding: 0 6px;
            }
            #trade-setup-bar .btn-close:hover { color: #fff; }

            body.has-trade-bar { padding-top: 44px; }
        `;
        document.head.appendChild(style);
    }

    const bar = document.createElement('div');
    bar.id = 'trade-setup-bar';
    document.body.appendChild(bar);

    function fmt(price) {
        if (price == null || isNaN(price)) return '—';
        return Number(price).toFixed(price < 1 ? 8 : 2);
    }

    function hasSetup() {
        const entry = draw_lines.find(l => l.type === 'entry');
        const stop = draw_lines.find(l => l.type === 'stop');
        const pts = draw_lines.filter(l => l.type === 'pt');
        const triggers = window.currentTradeSetup?.chainedTriggers || [];
        return !!(entry || stop || pts.length || triggers.length);
    }

    function buildTradeSetupData() {
        const entryLine = draw_lines.find(l => l.type === 'entry');
        const stopLine = draw_lines.find(l => l.type === 'stop');
        const ptLines = draw_lines.filter(l => l.type === 'pt');
        if (!entryLine || !stopLine || !ptLines.length) return null;

        const riskAmount = (window.portfolioSize || 0) * (currentRiskPercentage / 100);
        const priceDiff = Math.abs(entryLine.price - stopLine.price) || 1;
        const positionSize = (riskAmount / priceDiff).toFixed(4);

        return {
            entry: { price: entryLine.price, size: positionSize },
            stopLoss: { price: stopLine.price, riskPercent: currentRiskPercentage, riskAmount },
            profitTargets: ptLines.map(pt => ({
                price: pt.price,
                rr: typeof calculateRR === 'function'
                    ? calculateRR(entryLine.price, stopLine.price, pt.price)
                    : ((Math.abs(pt.price - entryLine.price) / priceDiff) || 0).toFixed(2)
            })),
            triggers: window.currentTradeSetup?.chainedTriggers || [],
            product: selectedProduct?.product_id,
            exchange_id: exchange?.ID
        };
    }

    function render() {
        const entryLine = draw_lines.find(l => l.type === 'entry');
        const stopLine = draw_lines.find(l => l.type === 'stop');
        const ptLines = draw_lines.filter(l => l.type === 'pt');
        const chained = window.currentTradeSetup?.chainedTriggers || [];

        const show = hasSetup();
        bar.classList.toggle('visible', show);
        document.body.classList.toggle('has-trade-bar', show);

        if (!show) {
            bar.innerHTML = '';
            return;
        }

        // Infer side from entry vs stop if both exist
        let sideChip = '';
        if (entryLine && stopLine) {
            const isLong = stopLine.price < entryLine.price;
            sideChip = `<span class="chip ${isLong ? 'side-long' : 'side-short'}">${isLong ? 'LONG' : 'SHORT'}</span>`;
        }

        const entryChip = `
            <span class="chip entry">
                <span class="label">Entry</span>
                <span class="value">${fmt(entryLine?.price)}</span>
            </span>`;

        const stopChip = `
            <span class="chip stop">
                <span class="label">Stop</span>
                <span class="value">${fmt(stopLine?.price)}</span>
            </span>`;

        const ptChips = ptLines.length
            ? ptLines.map((pt, i) => {
                const rrVal = (entryLine && stopLine && typeof calculateRR === 'function')
                    ? calculateRR(entryLine.price, stopLine.price, pt.price)
                    : null;
                const rrSuffix = (rrVal != null && rrVal !== 0) ? ` · ${rrVal}R` : '';
                return `
                <span class="chip pt">
                    <span class="label">PT${i + 1}</span>
                    <span class="value">${fmt(pt.price)}${rrSuffix}</span>
                </span>`;
            }).join('')
            : `<span class="chip pt"><span class="label">PT</span><span class="value">—</span></span>`;

        const triggerChips = chained.length
            ? `<span class="chain">${chained.map((t, i) => `
                    <span class="chip trigger" title="Trigger ${i + 1}">
                        <span class="label">T${i + 1}</span>
                        <span class="value">${(t.type || '').replace(/_/g, ' ')} @ ${fmt(t.price)}</span>
                    </span>
                    ${i < chained.length - 1 ? '<span class="chain-arrow">→</span>' : ''}
               `).join('')}</span>`
            : `<span class="chip trigger"><span class="label">Triggers</span><span class="value">none</span></span>`;

        const canExecute = !!(entryLine && stopLine && ptLines.length);
        window.tradeSetupData = buildTradeSetupData();

        bar.innerHTML = `
            ${sideChip}
            ${entryChip}
            ${stopChip}
            ${ptChips}
            ${triggerChips}

            <span class="chip">
                <span class="label">Risk</span>
                <input type="range" min="0.1" max="2" step="0.1" value="${currentRiskPercentage}"
                       oninput="window.updateRisk(this.value)">
                <span class="value">${currentRiskPercentage}%</span>
            </span>
            <span class="chip">
                <span class="label">R:R</span>
                <input type="range" min="1" max="10" step="0.5" value="${window.rr || 4}"
                       oninput="window.updateRR(this.value)">
                <span class="value">${window.rr || 4}R</span>
            </span>

            <span class="spacer"></span>

            <button class="btn btn-exec" ${canExecute ? '' : 'disabled'}
                    onclick="window.tradeSetupData && executeTradeSetup(window.tradeSetupData)">
                Execute
            </button>
            <button class="btn btn-clear" onclick="window.clearTradeSetup()">Clear</button>
            <button class="btn btn-close" title="Hide" onclick="window.hideTradeBar()">×</button>
        `;
    }

    window.updateRisk = function (value) {
        currentRiskPercentage = parseFloat(value);
        render();
        if (window.stockData) {
            drawCandlestickChart(window.stockData, window.start, window.end);
        }
    };

    window.updateRR = function (v) {
        rr = parseFloat(v)
        window.rr = rr
        maybeAutoStopFromEntryAndFirstPt()
        render()
        if (window.stockData) {
            drawCandlestickChart(window.stockData, window.start, window.end)
        }
    }

    window.clearTradeSetup = function () {
        // Remove trade-related lines only (keep plain lines if you want)
        draw_lines = draw_lines.filter(l => !['entry', 'stop', 'pt', 'trigger'].includes(l.type) && !l.isBracket);
        window.currentTradeSetup = null;
        window.currentTrade = null;
        window.tradeSetupData = null;
        render();
        if (window.stockData) {
            drawCandlestickChart(window.stockData, window.start, window.end);
        }
    };

    window.hideTradeBar = function () {
        bar.classList.remove('visible');
        document.body.classList.remove('has-trade-bar');
    };

    // Public updater (same signature as old updateSidebar)
    return function updateTradeBar() {
        render();
    };
}

// function maybeAutoStopFromEntryAndFirstPt() {
//     const entryLine = draw_lines.find(l => l.type === 'entry');
//     const existingStop = draw_lines.find(l => l.type === 'stop');
//     const firstPt = draw_lines.find(l => l.type === 'pt');
//     if (!entryLine || !firstPt || existingStop) return;
//     const reward = Math.abs(firstPt.price - entryLine.price);
//     if (!reward) return;
//     const risk = reward / rr;
//     const stopPrice = firstPt.price > entryLine.price
//         ? entryLine.price - risk
//         : entryLine.price + risk;
//     draw_lines.push({ price: stopPrice, type: 'stop', color: '#ff0000' });
//     if (window.currentTrade) window.currentTrade.stop = stopPrice;
// }

function getIdealStopPrice(entryPrice, ptPrice, ratio) {
    const reward = Math.abs(ptPrice - entryPrice);
    if (!reward || !ratio) return null;
    const risk = reward / ratio;
    return ptPrice > entryPrice
        ? entryPrice - risk   // long
        : entryPrice + risk;  // short
}
window.getIdealStopPrice = getIdealStopPrice;
function maybeAutoStopFromEntryAndFirstPt() {
    const entryLine = draw_lines.find(l => l.type === 'entry');
    const existingStop = draw_lines.find(l => l.type === 'stop');
    const firstPt = draw_lines.find(l => l.type === 'pt');
    if (!entryLine || !firstPt) return;
    const ratio = window.rr || rr || 4;
    const stopPrice = getIdealStopPrice(entryLine.price, firstPt.price, ratio);
    if (stopPrice == null) return;
    // Manual stop: leave it alone
    if (existingStop && existingStop.fromRR === false) return;
    if (existingStop && existingStop.fromRR) {
        existingStop.price = stopPrice;
        if (window.currentTrade) window.currentTrade.stop = stopPrice;
        return;
    }
    if (!existingStop) {
        draw_lines.push({
            price: stopPrice,
            type: 'stop',
            color: '#ff0000',
            fromRR: true
        });
        if (window.currentTrade) window.currentTrade.stop = stopPrice;
    }
}
function applyRRToAutoStop() {
    maybeAutoStopFromEntryAndFirstPt();
}
window.applyRRToAutoStop = applyRRToAutoStop;

// function createTradeSetupSidebar() {
//     console.log("Create Trade Setup Sidebar");
//     const chained = window.currentTradeSetup?.chainedTriggers || [];
//     // Remove existing sidebars
//     const existingSidebar = document.getElementById('trade-setup-sidebar');
//     const existingTab = document.getElementById('trade-setup-tab');
//     if (existingSidebar) existingSidebar.remove();
//     if (existingTab) existingTab.remove();
//
//     let currentRiskPercentage = 0.5;
//
//     // CSS
//     const style = document.createElement('style');
//     style.textContent = `
//         .risk-slider { -webkit-appearance: none; width: 100%; height: 10px; border-radius: 5px; background: #444; outline: none; margin: 10px 0; }
//         .risk-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; background: #666; cursor: pointer; }
//         .risk-slider::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; background: #666; cursor: pointer; }
//         .setup-section { cursor: pointer; padding: 10px; border-radius: 4px; margin-bottom: 10px; }
//         .setup-section.active { background-color: #555; border: 1px solid #777; }
//         .setup-section:hover { background-color: #444; }
//         .trigger-details { background: #222; padding: 10px; border-radius: 4px; margin: 8px 0; }
//     `;
//     document.head.appendChild(style);
//
//     const tab = document.createElement('div');
//     tab.id = 'trade-setup-tab';
//     tab.style.cssText = `position: fixed; right: 0; bottom: 0; background-color: #333; color: white; padding: 10px; border-radius: 4px 0 0 0; cursor: pointer; z-index: 1001;`;
//     tab.innerHTML = '▶ Trade Setup';
//
//     const sidebar = document.createElement('div');
//     sidebar.id = 'trade-setup-sidebar';
//     sidebar.style.cssText = `
//         position: fixed; right: -350px; top: 0; bottom: 0; width: 350px; background-color: #333; color: white;
//         padding: 15px; border-left: 1px solid #444; overflow-y: auto; z-index: 1000; transition: right 0.3s ease;
//     `;
//
//     window.toggleSidebar = function () {
//         const isExpanded = sidebar.style.right === '0px';
//         sidebar.style.right = isExpanded ? '-350px' : '0px';
//         tab.innerHTML = isExpanded ? '▶ Trade Setup' : '◀ Trade Setup';
//
//         const chartContainer = document.getElementById('chartContainer');
//         if (chartContainer) {
//             chartContainer.style.marginRight = isExpanded ? '0' : '350px';
//             chartContainer.style.width = isExpanded ? '100%' : 'calc(100% - 350px)';
//             setTimeout(() => drawCandlestickChart(stockData, start, end), 300);
//         }
//     };
//
//     window.updateRisk = function (value) {
//         currentRiskPercentage = parseFloat(value);
//         updateSidebarContent();
//         drawCandlestickChart(stockData, start, end);
//     };
//
//     tab.addEventListener('click', window.toggleSidebar);
//
//     function updateSidebarContent() {
//         console.log("Update Sidebar Content");
//
//         const chained = window.currentTradeSetup?.chainedTriggers || [];
//         const entryLine = draw_lines.find(l => l.type === 'entry');
//         const stopLine = draw_lines.find(l => l.type === 'stop');
//         const ptLines = draw_lines.filter(l => l.type === 'pt');
//
//         let riskAmount = window.portfolioSize * (currentRiskPercentage / 100);
//         let positionSize = 0;
//
//         if (entryLine && stopLine) {
//             const priceDiff = Math.abs(entryLine.price - stopLine.price);
//             positionSize = (riskAmount / priceDiff).toFixed(2);
//         }
//
//         sidebar.innerHTML = `
//             <div style="text-align: right;">
//                 <span onclick="toggleSidebar()" style="cursor: pointer; padding: 5px;">✕</span>
//             </div>
//             <h3>Trade Setup</h3>
//
//             <!-- Triggers -->
//             <div class="setup-section ${window.currentTool === 'trigger' ? 'active' : ''}" onclick="setTradeTool('trigger')">
//                 <h4>Trigger Conditions</h4>
//                 ${chained.length > 0 ? chained.map((trigger, index) => `
//                     <div class="trigger-details">
//                         <div class="trigger-header" style="display:flex; justify-content:space-between; align-items:center;">
//                             <div>
//                                 <button onclick="moveTrigger(${index}, -1)" ${index === 0 ? 'disabled' : ''}>↑</button>
//                                 <span>Trigger ${index + 1}</span>
//                                 <button onclick="moveTrigger(${index}, 1)" ${index === chained.length - 1 ? 'disabled' : ''}>↓</button>
//                             </div>
//                             <button onclick="removeTrigger(${index})" style="background:none; border:none; color:red; cursor:pointer;">✕</button>
//                         </div>
//
//                         <select onchange="updateChainedTriggerField(${index}, 'type', this.value)" style="width:100%; margin:5px 0;">
//                             <option value="price_above" ${trigger.type === 'price_above' ? 'selected' : ''}>Price Above</option>
//                             <option value="price_below" ${trigger.type === 'price_below' ? 'selected' : ''}>Price Below</option>
//                             <option value="closes_above" ${trigger.type === 'closes_above' ? 'selected' : ''}>Closes Above</option>
//                             <option value="closes_below" ${trigger.type === 'closes_below' ? 'selected' : ''}>Closes Below</option>
//                             <option value="wicks_above" ${trigger.type === 'wicks_above' ? 'selected' : ''}>Wicks Above</option>
//                             <option value="wicks_below" ${trigger.type === 'wicks_below' ? 'selected' : ''}>Wicks Below</option>
//                         </select>
//
//                         <div>Price: ${Number(trigger.price || 0).toFixed(8)}</div>
//                         <div>Timeframe: ${trigger.timeframe || '1m'}</div>
//                         <div>Candles: ${trigger.candles || trigger.candle_count || 1}</div>
//
//                         <div style="display:flex; gap:5px; margin-top:5px;">
//                             <select onchange="updateChainedTriggerField(${index}, 'timeframe', this.value)" style="flex:1;">
//                                 <option value="1m" ${trigger.timeframe === '1m' ? 'selected' : ''}>1m</option>
//                                 <option value="5m" ${trigger.timeframe === '5m' ? 'selected' : ''}>5m</option>
//                                 <option value="15m" ${trigger.timeframe === '15m' ? 'selected' : ''}>15m</option>
//                                 <option value="1h" ${trigger.timeframe === '1h' ? 'selected' : ''}>1h</option>
//                             </select>
//                             <input type="number" value="${trigger.candles || trigger.candle_count || 1}" 
//                                    min="1" style="width:80px;"
//                                    onchange="updateChainedTriggerField(${index}, 'candles', this.value)">
//                         </div>
//                     </div>
//                 `).join('') : '<div>No triggers set</div>'}
//
//                 <small style="display:block; margin-top:8px;">Click chart to add new trigger</small>
//             </div>
//
//             <!-- Entry, Stop, PT, Risk Calculator sections (unchanged) -->
//             <div class="setup-section ${window.currentTool === 'entry' ? 'active' : ''}" onclick="setTradeTool('entry')">
//                 <h4>Entry</h4>
//                 ${entryLine ? `
//                     <div>Price: ${entryLine.price.toFixed(8)}</div>
//                     <div>Position Size: ${positionSize} units</div>
//                 ` : '<div>Not Set</div>'}
//             </div>
//
//             <div class="setup-section ${window.currentTool === 'stop' ? 'active' : ''}" onclick="setTradeTool('stop')">
//                 <h4>Stop Loss</h4>
//                 ${stopLine ? `<div>Price: ${stopLine.price.toFixed(8)}</div>` : '<div>Not Set</div>'}
//             </div>
//
//             <div class="setup-section ${window.currentTool === 'pt' ? 'active' : ''}" onclick="setTradeTool('pt')">
//                 <h4>Profit Targets</h4>
//                 ${ptLines.length ? ptLines.map((pt, i) => `
//                     <div>Target ${i+1}: ${pt.price.toFixed(8)}</div>
//                 `).join('') : '<div>Not Set</div>'}
//             </div>
//
//             <div class="setup-section">
//                 <h4>Risk Calculator</h4>
//                 <div>Portfolio: $${window.portfolioSize.toLocaleString()}</div>
//                 <input type="range" class="risk-slider" min="0.1" max="2" step="0.1" 
//                        value="${currentRiskPercentage}" oninput="updateRisk(this.value)">
//                 <div>Risk: ${currentRiskPercentage}%</div>
//             </div>
//
//             ${entryLine && stopLine && ptLines.length ? `
//                 <button onclick="executeTradeSetup(tradeSetupData)" style="width:100%; padding:10px; background:#0a0; color:white; border:none; border-radius:4px;">
//                     Execute Trade Setup
//                 </button>
//             ` : ''}
//         `;
//     }
//
//     document.body.appendChild(tab);
//     document.body.appendChild(sidebar);
//     updateSidebarContent();
//
//     return () => {
//         console.log("Refreshing Sidebar");
//         updateSidebarContent();
//         sidebar.style.right = '0px';
//     };
// }

window.updateChainedTriggerField = function (index, field, value) {
    const trigger = window.currentTradeSetup?.chainedTriggers?.[index];
    if (!trigger) return;

    // Optimistic update
    if (field === 'candles') {
        trigger.candles = parseInt(value);
    } else {
        trigger[field] = value;
    }

    const triggerId = trigger.id;
    if (!triggerId) {
        console.warn("Trigger has no ID yet (local only)");
        updateSidebar(); // or window.updateSidebar()
        return;
    }

    fetch('/update-trigger', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            trigger_id: triggerId,
            updates: { [field]: value }
        })
    })
    .then(r => {
        if (!r.ok) throw new Error("Update failed");
        return r.json();
    })
    .then(data => {
        Object.assign(trigger, data);
        updateSidebar();
    })
    .catch(err => {
        console.error("Failed to update trigger:", err);
    });
};


window.setTradeTool = function (tool) {
    window.currentTool = window.currentTool === tool ? null : tool;
    console.log(`Selected tool: ${window.currentTool || 'none'}`);
    updateSidebar();
};



function handleLineAction(action, line) {
    console.log("\n-------------------\nhandleLineAction")

    console.log("action:", action, "\nLine:", line);
    switch (action) {
        case 'trigger':
            line.type = 'trigger';
            line.color = '#ff00ff';
            line.pending = true;
            if (!draw_lines.includes(line)) {
                draw_lines.push(line);
            }
            showTriggerTypeMenu(line, window.lastMenuPageX || window.mouseX, window.lastMenuPageY || window.mouseY);
            break;

        case 'entry':
            console.log("ENTRY")
            line.type = 'entry';
            line.color = '#00ff00';
            window.currentTrade = {
                entry: line.price,
                productId: selectedProduct.product_id
            };
            console.log("CURRENT _ TRADE", window.currentTrade)
            console.log("CURRENT _ TRADE _ SETUP", window.currentTradeSetup)
            // Add same margin adjustment for entry
            const chartContainer = document.getElementById('chartContainer');
            if (chartContainer) {
                // chartContainer.style.marginRight = '350px';
                // chartContainer.style.width = 'calc(100% - 350px)';
                // chartContainer.style.transition = 'all 0.3s ease';
                setTimeout(() => {
                    console.log("candlestick_chart_draw")
                    drawCandlestickChart(stockData, start, end);
                }, 300);
            }
            if (!draw_lines.includes(line)) {
                draw_lines.push(line);
            }
            maybeAutoStopFromEntryAndFirstPt()
            break;

        case 'pt':
            console.log("PT")
            line.type = 'pt';
            line.color = '#ffff00';
            console.log("CURRENT _ TRADE", window.currentTrade)
            console.log("CURRENT _ TRADE _ SETUP", window.currentTradeSetup)
            if (window.currentTrade && window.currentTrade.entry) {
                window.currentTrade.target = line.price;
            }
            if (!draw_lines.includes(line)) {
                draw_lines.push(line);
            }
            maybeAutoStopFromEntryAndFirstPt()
            break;

        case 'stop':
            console.log("STOP")
            line.type = 'stop';
            line.color = '#ff0000';
            line.fromRR = false
            console.log("CURRENT _ TRADE", window.currentTrade)
            console.log("CURRENT _ TRADE _ SETUP", window.currentTradeSetup)
            if (window.currentTrade && window.currentTrade.entry) {
                window.currentTrade.stop = line.price;
            }
            if (!draw_lines.includes(line)) {
                draw_lines.push(line);
            }
            break;

        case 'delete':
            draw_lines.splice(activeLineIndex, 1);
            break;

        case 'create':
            const entryLine = draw_lines.find(l => l.type === 'entry');
            const stopLine = draw_lines.find(l => l.type === 'stop');
            const targetLine = draw_lines.find(l => l.type === 'pt');

            if (!entryLine || !stopLine || !targetLine) {
                alert('Please set entry, stop loss, and profit target levels before creating trade');
                return;
            }

            const tradeSetup = {
                entry: entryLine.price,
                size: 500,
                stop: stopLine.price,
                target: targetLine.price,
                productId: selectedProduct.product_id
            };
            createTradeGroup(tradeSetup);
            break;
    }
    window.currentTool = null; // Reset tool
    console.log("update_sidebar")
    window.updateSidebar()
    console.log("handleLineAction Finised")
}

function executeTradeSetup(tradeSetupData) {
    console.log("Execute Trade Setup", tradeSetupData);

    // Format data to match TradeBlock model
    const formattedData = {
        product_id: tradeSetupData.product,
        group_id: "", // Generated by backend
        side: "buy", // Add logic for determining side
        size: parseFloat(tradeSetupData.entry.size),
        entry_price: tradeSetupData.entry.price,
        stop_price: tradeSetupData.stopLoss.price,
        profit_targets: tradeSetupData.profitTargets.map(pt => pt.price),
        risk_reward: tradeSetupData.profitTargets[0].rr,
        xch_id: tradeSetupData.exchange_id,
        triggers: tradeSetupData.triggers.map(t => t.id)
    };

    fetch('/create-trade', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(formattedData)
    })
        .then(response => response.json())
        .then(data => {
            console.log('Trade setup created:', data);
            if (typeof window.recordAlert === 'function') {
                window.recordAlert({
                    kind: 'Trade',
                    product: tradeSetupData.product || '',
                    detail: `${formattedData.side} ${formattedData.size} @ ${formattedData.entry_price}`,
                    status: 'submitted'
                });
            }
            if (typeof showToast === 'function') {
                showToast(`Trade submitted  ${tradeSetupData.product || ''}  @ ${formattedData.entry_price}`, 4000);
            }
            draw_lines = [];
            window.currentTradeSetup = null;
            drawCandlestickChart(stockData, start, end);
            window.updateSidebar();
        })
        .catch(error => {
            console.error('Error creating trade:', error);
        });
}


function createTradeGroup(trade) {
    const side = trade.target > trade.entry ? 'BUY' : 'SELL';
    const riskAmount = Math.abs(trade.entry - trade.stop);
    const rewardAmount = Math.abs(trade.target - trade.entry);
    const riskRewardRatio = parseFloat((rewardAmount / riskAmount).toFixed(2));

    const ptLines = draw_lines.filter(line => line.type === "pt");
    const profitTargets = ptLines.map(line => parseFloat(line.price))

    const tradeData = {
        product_id: trade.productId,
        side: side,
        size: parseFloat(trade.size || "0"),
        entry_price: parseFloat(trade.entry),
        stop_price: parseFloat(trade.stop),
        profit_targets: profitTargets,
        risk_reward: riskRewardRatio,
        xch_id: exchange.ID,

    };
    console.log("CreateTradeGroup tradeData", tradeData)

    fetch('/bracket-order', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(tradeData)
    })
        .then(response => response.json())
        .then(data => {
            console.log('Trade group created:', data);
            if (typeof window.recordAlert === 'function') {
                window.recordAlert({
                    kind: 'Trade',
                    product: trade.productId || '',
                    detail: `${side} ${trade.size || ''} @ ${trade.entry}`,
                    status: 'submitted'
                });
            }
            if (typeof showToast === 'function') {
                showToast(`Trade submitted  ${trade.productId || ''}  @ ${trade.entry}`, 4000);
            }
        })
        .catch(error => {
            console.error('Error creating trade:', error);
        });
}

window.addChainedTrigger = function () {
    if (!window.currentTradeSetup) {
        window.currentTradeSetup = { chainedTriggers: [] };
    }
    if (!window.currentTradeSetup.chainedTriggers) {
        window.currentTradeSetup.chainedTriggers = [];
    }

    window.currentTradeSetup.chainedTriggers.push({
        type: 'price_above',
        price: 0,
        timeframe: '1m',
        candles: 1
    });

    window.updateSidebar();
}

window.updateTriggerCondition = function (index, value) {
    window.currentTradeSetup.chainedTriggers[index].type = value;
    window.updateSidebar();
}

window.updateTriggerPrice = function (index, value) {
    window.currentTradeSetup.chainedTriggers[index].price = parseFloat(value);
    window.updateSidebar();
}

window.updateTriggerTimeframe = function (index, value) {
    window.currentTradeSetup.chainedTriggers[index].timeframe = value;
    window.updateSidebar();
}

window.updateTriggerCandles = function (index, value) {
    window.currentTradeSetup.chainedTriggers[index].candles = parseInt(value);
    window.updateSidebar();
}

window.removeTrigger = function (index) {
    window.currentTradeSetup.chainedTriggers.splice(index, 1);
    window.updateSidebar();
}

// window.updateRisk = function (value) {
//     window.updateRisk = function (value) {
//         currentRiskPercentage = parseFloat(value);
//         // Force full sidebar refresh
//         const updateFn = createTradeSetupSidebar();
//         updateFn();
//         // Update chart to reflect any changes
//         drawCandlestickChart(stockData, start, end);
//     };
// }
//


// ------------------------//

window.editTrigger = function (triggerId) {
    console.log("Edit Trigger", triggerId);
        // Force fresh lookup every time
    const trigger = window.exchange?.Triggers?.find(t => t.id === triggerId) 
                 || window.all_triggers?.find(t => t.id === triggerId)
                 || window.current_triggers?.find(t => t.id === triggerId);
    
    if (!trigger) {
        console.error("Trigger not found:", triggerId);
        return;
    }

    document.querySelectorAll('#trigger-edit-sidebar').forEach(el => el.remove());


    // Remove old one if exists
    let sidebar = document.getElementById('trigger-edit-sidebar');
    if (sidebar) sidebar.remove();

    sidebar = document.createElement('div');
    sidebar.id = 'trigger-edit-sidebar';
    sidebar.style.cssText = `
        position: fixed; right: -350px; top: 0; bottom: 0; width: 350px;
        background-color: #333; color: white; padding: 15px;
        border-left: 1px solid #444; overflow-y: auto; z-index: 1000;
        transition: right 0.3s ease;
    `;

    sidebar.innerHTML = `
        <div style="text-align: right;">
            <span onclick="closeTriggerEditor()" style="cursor: pointer; padding: 5px; font-size:18px;">✕</span>
        </div>
        <h3>Edit Trigger #${triggerId}</h3>
        
        <div style="margin-top:20px;">
            <div><strong>Product:</strong> ${trigger.product_id}</div>
            
            <div style="margin:15px 0;">
                <label>Type:</label>
                <select onchange="updateTriggerField(${triggerId}, 'type', this.value)" style="width:100%;padding:6px;background:#444;color:white;border:1px solid #666;">
                    <option value="price_above" ${trigger.type === 'price_above' ? 'selected' : ''}>Price Above</option>
                    <option value="price_below" ${trigger.type === 'price_below' ? 'selected' : ''}>Price Below</option>
                    <option value="close_above" ${trigger.type === 'close_above' || trigger.type === 'closes_above' ? 'selected' : ''}>Closes Above</option>
                    <option value="close_below" ${trigger.type === 'close_below' || trigger.type === 'closes_below' ? 'selected' : ''}>Closes Below</option>
                    <option value="wicks_above" ${trigger.type === 'wicks_above' ? 'selected' : ''}>Wicks Above</option>
                    <option value="wicks_below" ${trigger.type === 'wicks_below' ? 'selected' : ''}>Wicks Below</option>
                </select>
            </div>

            <div style="margin:15px 0;">
                <label>Price:</label>
                <input type="number" value="${trigger.price}" step="0.00000001" 
                       onchange="updateTriggerField(${triggerId}, 'price', this.value)" 
                       style="width:100%;padding:6px;background:#444;color:white;border:1px solid #666;">
            </div>

            <div style="margin:15px 0;">
                <label>Timeframe:</label>
                <select onchange="updateTriggerField(${triggerId}, 'timeframe', this.value)" style="width:100%;padding:6px;background:#444;color:white;border:1px solid #666;">
                    <option value="1m" ${trigger.timeframe === '1m' ? 'selected' : ''}>1m</option>
                    <option value="5m" ${trigger.timeframe === '5m' ? 'selected' : ''}>5m</option>
                    <option value="15m" ${trigger.timeframe === '15m' ? 'selected' : ''}>15m</option>
                    <option value="1h" ${trigger.timeframe === '1h' ? 'selected' : ''}>1h</option>
                </select>
            </div>

            <div style="margin:15px 0;">
                <label>Candles:</label>
                <input type="number" value="${trigger.candle_count || trigger.candles || 1}" min="1" 
                       onchange="updateTriggerField(${triggerId}, 'candles', this.value)" 
                       style="width:100%;padding:6px;background:#444;color:white;border:1px solid #666;">
            </div>

            <div style="margin:15px 0;">
                <label>Status:</label>
                <select onchange="updateTriggerField(${triggerId}, 'status', this.value)" style="width:100%;padding:6px;background:#444;color:white;border:1px solid #666;">
                    <option value="active" ${trigger.status === 'active' ? 'selected' : ''}>Active</option>
                    <option value="inactive" ${trigger.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                </select>
            </div>
        </div>
    `;

    document.body.appendChild(sidebar);
    setTimeout(() => { sidebar.style.right = '0px'; }, 10);
};

window.closeTriggerEditor = function () {
    console.log("Close Trigger Editor")
    const sidebar = document.getElementById('trigger-edit-sidebar');
    if (sidebar) {
        sidebar.style.right = '-350px';

        // Reset ALL content margins
        document.body.style.marginRight = '0';

        const chartContainer = document.getElementById('chartContainer');
        if (chartContainer) {
            chartContainer.style.width = '100%';
        }

        // Redraw chart after transition
        setTimeout(() => {
            drawCandlestickChart(stockData, start, end);
            sidebar.remove();
        }, 300);
    }
}

window.updateTriggerField = function (triggerId, field, value) {
    console.log("Update Trigger Field", triggerId, field, value);

    if (!triggerId) return;

    fetch('/update-trigger', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            trigger_id: triggerId,
            updates: { [field]: value }
        })
    })
    .then(response => {
        if (!response.ok) throw new Error("Server error");
        return response.json();
    })
    .then(data => {
        console.log("✅ Trigger updated on server", data);

        // === Update window.current_triggers (this is what the chart uses) ===
        if (window.current_triggers) {
            const trig = window.current_triggers.find(t => t.id === triggerId);
            if (trig) {
                console.log("Update Triggers current_triggers", trig, data);
                Object.assign(trig, data);
            }
        }

        // Update other possible sources too
        const sources = [
            window.all_triggers,
            window.exchange?.Triggers,
            window.currentTradeSetup?.chainedTriggers
        ].filter(Boolean);

        sources.forEach(source => {
            const t = Array.isArray(source) ? source.find(tr => tr.id === triggerId) : null;
            if (t) Object.assign(t, data);
        });

        // Update any associated draw_line
        const line = draw_lines.find(l => l.triggerId === triggerId);
        if (line) {
            console.log("There is a line", line)
            Object.assign(line, data);
        }

        // === This is the critical line that deleteTrigger uses ===
        drawCandlestickChart(stockData, start, end);

        // Close the menu after successful update
        document.querySelectorAll('.trigger-edit-menu').forEach(el => el.remove());
    })
    .catch(err => {
        console.error("Update failed", err);
        alert("Failed to update trigger: " + err.message);
    });
};


window.quickUpdateTrigger = function (triggerId, field, value) {
    window.updateTriggerField(triggerId, field, value);
};

window.showTriggerEditMenu = function (triggerId, pageX, pageY) {
    console.log(`Show edit menu for trigger ${triggerId} at (${pageX}, ${pageY})`);

    document.querySelectorAll('.trigger-edit-menu').forEach(el => el.remove());

    const trigger = window.exchange?.Triggers?.find(t => t.id === triggerId) 
                 || window.all_triggers?.find(t => t.id === triggerId)
                 || window.current_triggers?.find(t => t.id === triggerId);

    if (!trigger) return;

    const menu = document.createElement('div');
    menu.className = 'trigger-edit-menu';
    menu.style.cssText = `
        position: fixed; 
        background: #222; 
        color: white; 
        border: 1px solid #666; 
        border-radius: 6px; 
        padding: 12px; 
        z-index: 2000; 
        min-width: 240px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.6);
    `;

    menu.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #444; padding-bottom: 6px;">
            Edit Trigger #${triggerId}
        </div>

        <div style="margin: 10px 0;">
            <label style="display:block; margin-bottom:4px;">Type:</label>
            <select onchange="quickUpdateTrigger(${triggerId}, 'type', this.value); this.closest('.trigger-edit-menu').remove()" 
                    style="width:100%; padding:6px; background:#333; color:white; border:1px solid #555;">
                <option value="price_above" ${trigger.type === 'price_above' ? 'selected' : ''}>Price Above</option>
                <option value="price_below" ${trigger.type === 'price_below' ? 'selected' : ''}>Price Below</option>
                <option value="close_above" ${trigger.type === 'close_above' || trigger.type === 'closes_above' ? 'selected' : ''}>Closes Above</option>
                <option value="close_below" ${trigger.type === 'close_below' || trigger.type === 'closes_below' ? 'selected' : ''}>Closes Below</option>
                <option value="wicks_above" ${trigger.type === 'wicks_above' ? 'selected' : ''}>Wicks Above</option>
                <option value="wicks_below" ${trigger.type === 'wicks_below' ? 'selected' : ''}>Wicks Below</option>
            </select>
        </div>

        <div style="margin: 10px 0;">
            <label style="display:block; margin-bottom:4px;">Timeframe:</label>
            <select onchange="quickUpdateTrigger(${triggerId}, 'timeframe', this.value); this.closest('.trigger-edit-menu').remove()" 
                    style="width:100%; padding:6px; background:#333; color:white; border:1px solid #555;">
                <option value="1m" ${trigger.timeframe === '1m' ? 'selected' : ''}>1m</option>
                <option value="5m" ${trigger.timeframe === '5m' ? 'selected' : ''}>5m</option>
                <option value="15m" ${trigger.timeframe === '15m' ? 'selected' : ''}>15m</option>
                <option value="1h" ${trigger.timeframe === '1h' ? 'selected' : ''}>1h</option>
            </select>
        </div>

        <div style="margin: 10px 0;">
            <label style="display:block; margin-bottom:4px;">Candles:</label>
            <input type="number" value="${trigger.candle_count || trigger.candles || 1}" min="1"
                   onchange="quickUpdateTrigger(${triggerId}, 'candles', this.value); this.closest('.trigger-edit-menu').remove()" 
                   style="width:100%; padding:6px; background:#333; color:white; border:1px solid #555;">
        </div>

        <button onclick="this.closest('.trigger-edit-menu').remove()" 
                style="margin-top:12px; width:100%; padding:8px; background:#444; color:white; border:none; border-radius:4px;">
            Close
        </button>
    `;

    document.body.appendChild(menu);
    positionMenuNear(menu, pageX, pageY)

    // Close on outside click
    setTimeout(() => {
        const handler = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', handler);
            }
        };
        document.addEventListener('click', handler);
    }, 100);
};


window.moveTrigger = function (index, direction) {
    const triggers = window.currentTradeSetup.chainedTriggers;
    const newIndex = index + direction;

    if (newIndex >= 0 && newIndex < triggers.length) {
        [triggers[index], triggers[newIndex]] = [triggers[newIndex], triggers[index]];
        window.updateSidebar();
    }
}

window.updateTriggerType = function (triggerId, newType) {
    const trigger = window.currentTradeSetup.chainedTriggers.find(t => t.id === triggerId);
    console.log("Update Trigger Type", trigger, triggerId, newType)
    if (trigger) {
        fetch('/update-trigger', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                trigger_id: triggerId,
                updates: { type: newType }
            })
        })
            .then(response => response.json())
            .then(data => {
                // Get fresh trigger data from all_triggers
                const freshTrigger = window.all_triggers.find(t => t.id === triggerId);

                // Update local trigger data with fresh data
                Object.assign(trigger, freshTrigger);

                // Update trigger line on chart with fresh data
                const line = draw_lines.find(l => l.triggerId === triggerId);
                if (line) {
                    line.type = freshTrigger.type;
                    line.price = freshTrigger.price;
                    line.timeframe = freshTrigger.timeframe;
                    line.candles = freshTrigger.candle_count;

                    // Force chart redraw
                    drawCandlestickChart(stockData, start, end);
                }

                // Refresh sidebar
                window.updateSidebar();
            })
            .catch(error => console.error('Error updating trigger:', error));
    }
}

window.updateTriggerTimeframe = function (triggerId, timeframe) {
    const trigger = window.currentTradeSetup.chainedTriggers.find(t => t.id === triggerId);
    if (trigger) {
        fetch('/update-trigger', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                trigger_id: triggerId,
                updates: { timeframe: timeframe }
            })
        })
            .then(response => response.json())
            .then(data => {
                // Update local trigger data
                trigger.timeframe = timeframe;

                // Refresh sidebar
                window.updateSidebar();
            })
            .catch(error => console.error('Error updating trigger:', error));
    }
}

window.updateTriggerCandles = function (triggerId, candles) {
    const trigger = window.currentTradeSetup.chainedTriggers.find(t => t.id === triggerId);
    if (trigger) {
        fetch('/update-trigger', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                trigger_id: triggerId,
                updates: { candles: parseInt(candles) }
            })
        })
            .then(response => response.json())
            .then(data => {
                // Update local trigger data
                trigger.candles = parseInt(candles);

                // Refresh sidebar
                window.updateSidebar();
            })
            .catch(error => console.error('Error updating trigger:', error));
    }
}


window.deleteTrigger = function (triggerId) {
    console.log("Chart: deleteTrigger", triggerId);
    fetch(`/delete-trigger/${triggerId}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ trigger_id: triggerId })  // Properly format the request body
    })
        .then(response => {
            if (response.ok) {
                const index = window.current_triggers.findIndex(t => t.id === triggerId);
                if (index !== -1) {
                    window.current_triggers.splice(index, 1);
                }
                drawCandlestickChart(stockData, start, end);
            } else {
                console.error('Chart: Failed to delete trigger');
            }
        })
        .catch(error => console.error('Error:', error));
}

window.handleTriggerAction = function (action, triggerId) {

    const trigger = window.current_triggers.find(t => t.id === triggerId);
    // console.log("Trigger:", trigger)

    switch (action) {
        case 'connect':
            if (!window.currentTradeSetup) {
                window.currentTradeSetup = {
                    chainedTriggers: []
                };
            }

            // Check if trigger already exists in chain
            const exists = window.currentTradeSetup.chainedTriggers.some(t => t.id === trigger.id);
            if (!exists) {
                // Create complete trigger object with all database fields
                const triggerData = {
                    id: trigger.id,
                    product_id: trigger.product_id,
                    type: trigger.type,
                    price: trigger.price,
                    timeframe: trigger.timeframe || '1m',  // Use actual DB value
                    candles: trigger.candle_count || 1,    // Use actual DB value
                    condition: trigger.condition,
                    status: trigger.status
                };

                window.currentTradeSetup.chainedTriggers.push(triggerData);

                // Force sidebar update
                window.updateSidebar();

                // Open sidebar if closed
                // if (document.getElementById('trade-setup-sidebar').style.right === '-350px') {
                //     toggleSidebar();
                // }
            }
            break;

        case 'trade':
            // Enable line drawing mode for trade setup
            currentTool = 'line';
            window.currentTrade = {
                triggerId: trigger.id,
                entry: trigger.price,
                productId: selectedProduct.product_id
            };

            // Add trigger to currentTradeSetup
            window.currentTradeSetup = {
                trigger: trigger
            };

            // Show instructions for trade setup
            const instructions = document.createElement('div');
            instructions.className = 'trade-setup-instructions';
            instructions.style.position = 'fixed';
            instructions.style.top = '10px';
            instructions.style.left = '50%';
            instructions.style.transform = 'translateX(-50%)';
            instructions.style.backgroundColor = '#333';
            instructions.style.color = 'white';
            instructions.style.padding = '10px';
            instructions.style.borderRadius = '4px';
            instructions.style.zIndex = '2000';
            instructions.innerHTML = `
                <div>Draw lines for:</div>
                <div>1. Stop Loss (red)</div>
                <div>2. Profit Target(s) (yellow)</div>
                <div>Click Create Trade when done</div>
            `;
            document.body.appendChild(instructions);
            break;
    }
}

window.showTradeOptions = function (triggerId) {
    const trigger = window.current_triggers.find(t => t.id === triggerId);
    if (!trigger) return;

    // Remove any existing submenus
    document.querySelectorAll('.trigger-submenu').forEach(el => el.remove());

    const parentMenu = document.querySelector('.trigger-menu');
    const rect = parentMenu.getBoundingClientRect();

    const submenu = document.createElement('div');
    submenu.className = 'trigger-submenu';
    submenu.style.left = `${rect.right}px`;
    submenu.style.top = `${rect.top}px`;

    submenu.innerHTML = `
        <div class="trigger-submenu-item" onclick="handleTriggerAction('alert', ${triggerId})">Alert Only</div>
        <div class="trigger-submenu-item" onclick="handleTriggerAction('trade', ${triggerId})">Enter Trade</div>
    `;

    submenu.addEventListener('mouseenter', () => {
        submenu.dataset.hovering = 'true';
        parentMenu.dataset.hovering = 'true';
    });

    submenu.addEventListener('mouseleave', () => {
        submenu.dataset.hovering = 'false';
        submenu.remove();
    });

    document.body.appendChild(submenu);
    positionMenuNear(menu, pageX, pageY)
}

window.showTradeSetupDialog = function (trigger) {
    const dialog = document.createElement('div');
    dialog.className = 'edit-trigger-form';
    dialog.style.transform = 'translate(-50%, -50%)';
    dialog.style.backgroundColor = '#333';
    dialog.style.padding = '20px';
    dialog.style.borderRadius = '8px';
    dialog.style.zIndex = '2000';

    dialog.innerHTML = `
        <h3>Trade Setup</h3>
        <div>
            <label>Size:</label>
            <input type="number" id="tradeSize" value="100">
        </div>
        <div>
            <label>Stop Loss (%):</label>
            <input type="number" id="stopLoss" value="1" step="0.1">
        </div>
        <div>
            <label>Take Profit (%):</label>
            <input type="number" id="takeProfit" value="2" step="0.1">
        </div>
        <div style="margin-top: 10px;">
            <button onclick="createTriggerTrade(${trigger.id})">Create</button>
            <button onclick="this.parentElement.parentElement.remove()">Cancel</button>
        </div>
    `;

    document.body.appendChild(dialog);
    positionMenuNear(menu, pageX, pageY)
}
