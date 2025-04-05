console.log("trade_setup.js")

const updateSidebar = createTradeSetupSidebar();

function createTradeSetupSidebar() {
    console.log("Create Trade Setup Sidebar")
    // Remove any existing sidebars first
    const existingSidebar = document.getElementById('trade-setup-sidebar');
    const existingTab = document.getElementById('trade-setup-tab');
    if (existingSidebar) existingSidebar.remove();
    if (existingTab) existingTab.remove();

    let currentRiskPercentage = 0.5;

    // Add CSS for slider
    const style = document.createElement('style');
    style.textContent = `
        .risk-slider {
            -webkit-appearance: none;
            width: 100%;
            height: 10px;
            border-radius: 5px;
            background: #444;
            outline: none;
            margin: 10px 0;
        }

        .risk-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #666;
            cursor: pointer;
        }

        .risk-slider::-moz-range-thumb {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #666;
            cursor: pointer;
        }
    `;
    document.head.appendChild(style);

    // Create collapsed sidebar tab
    const tab = document.createElement('div');
    tab.id = 'trade-setup-tab';
    tab.style.cssText = `
        position: fixed;
        right: 0;
        bottom: 0;
        background-color: #333;
        color: white;
        padding: 10px;
        border-radius: 4px 0 0 0;
        cursor: pointer;
        z-index: 1001;
    `;
    tab.innerHTML = '▶ Trade Setup';


    const sidebar = document.createElement('div');
    sidebar.id = 'trade-setup-sidebar';
    sidebar.style.cssText = `
        position: fixed;
        right: -350px;
        top: 0;
        bottom: 0;
        width: 350px;
        background-color: #333;
        color: white;
        padding: 15px;
        border-left: 1px solid #444;
        overflow-y: auto;
        z-index: 1000;
        transition: right 0.3s ease;
    `;


    window.toggleSidebar = function () {
        const isExpanded = sidebar.style.right === '0px';
        sidebar.style.right = isExpanded ? '-350px' : '0px';
        tab.innerHTML = isExpanded ? '▶ Trade Setup' : '◀ Trade Setup';

        // Get chart container
        const chartContainer = document.getElementById('chartContainer');
        if (chartContainer) {
            // Set margin and width together
            chartContainer.style.marginRight = isExpanded ? '0' : '350px';
            chartContainer.style.width = isExpanded ? '100%' : 'calc(100% - 350px)';
            chartContainer.style.transition = 'all 0.3s ease';

            // Redraw chart after transition to ensure proper sizing
            setTimeout(() => {
                drawCandlestickChart(stockData, start, end);
            }, 300);
        }
    };

    // Make updateRisk globally accessible
    window.updateRisk = function (value) {
        currentRiskPercentage = parseFloat(value);
        updateSidebarContent();
    };

    tab.addEventListener('click', window.toggleSidebar);

    window.tradeSetupData = null

    function updateSidebarContent() {
        console.log("Update Sidebar Content")
        const trigger = window.currentTradeSetup?.trigger;
        const entryLine = draw_lines.find(l => l.type === 'entry');
        const stopLine = draw_lines.find(l => l.type === 'stop');
        const ptLines = draw_lines.filter(l => l.type === 'pt');
        console.log("Entry line", entryLine)
        console.log("Stop line", stopLine)
        console.log("PT lines", ptLines)

        // let tradeSetupData = null;

        // Calculate risk if entry and stop are set
        let riskAmount = 0;
        let positionSize = 0;
        let stopLossRiskPercent = 0;

        riskAmount = window.portfolioSize * (currentRiskPercentage / 100);
        // console.log("Risk Amount", riskAmount)

        if (entryLine && stopLine) {
            const entryPrice = entryLine.price;
            const stopPrice = stopLine.price;
            const priceDiff = Math.abs(entryPrice - stopPrice);

            // Calculate position sizing
            riskAmount = portfolioSize * (currentRiskPercentage / 100);
            positionSize = (riskAmount / priceDiff).toFixed(2);

            // Calculate stop loss risk percentage (price-based risk)
            stopLossRiskPercent = ((priceDiff / entryPrice) * 100).toFixed(2);

            console.log("Risk Calculations", portfolioSize, currentRiskPercentage, riskAmount)

            if (ptLines.length > 0) {
                tradeSetupData = {
                    entry: {
                        price: entryLine.price,
                        size: positionSize
                    },
                    stopLoss: {
                        price: stopLine.price,
                        riskPercent: currentRiskPercentage,
                        riskAmount: riskAmount
                    },
                    profitTargets: ptLines.map(pt => ({
                        price: pt.price,
                        rr: calculateRR(entryLine.price, stopLine.price, pt.price)
                    })),
                    triggers: window.currentTradeSetup?.chainedTriggers || [],
                    product: selectedProduct.product_id,
                    exchange_id: exchange.ID
                };
            }
        }


        sidebar.innerHTML = `
            <div style="text-align: right;">
                <span onclick="toggleSidebar()" style="cursor: pointer; padding: 5px;">✕</span>
            </div>
            <h3>Trade Setup</h3>
            
            <div class="setup-section">
                <h4>Trigger Conditions</h4>
                ${window.currentTradeSetup?.chainedTriggers?.length > 0 ? `
                    ${window.currentTradeSetup.chainedTriggers.map((trigger, index) => `
                        <div class="trigger-details">
                          <div class="trigger-header">
                              <div class="trigger-order">
                                  <button onclick="moveTrigger(${index}, -1)" ${index === 0 ? 'disabled' : ''}>↑</button>
                                  <span>Trigger ${index + 1}</span>
                                  <button onclick="moveTrigger(${index}, 1)" ${index === window.currentTradeSetup.chainedTriggers.length - 1 ? 'disabled' : ''}>↓</button>
                              </div>
                              <button class="btn-remove" onclick="removeTrigger(${index})">✕</button>
                          </div>
                          <div class="trigger-settings">
                              <select onchange="updateTriggerType(${trigger.id}, this.value)">
                                  <option value="price_above" ${trigger.type === 'price_above' ? 'selected' : ''}>Price Above</option>
                                  <option value="price_below" ${trigger.type === 'price_below' ? 'selected' : ''}>Price Below</option>
                                  <option value="closes_above" ${trigger.type === 'closes_above' ? 'selected' : ''}>Closes Above</option>
                                  <option value="closes_below" ${trigger.type === 'closes_below' ? 'selected' : ''}>Closes Below</option>
                                  <option value="wicks_above" ${trigger.type === 'wicks_above' ? 'selected' : ''}>Wicks Above</option>
                                  <option value="wicks_below" ${trigger.type === 'wicks_below' ? 'selected' : ''}>Wicks Below</option>
                              </select>
                          </div>
                          <div>Price: ${trigger.price.toFixed(8)}</div>
                          <div>Timeframe: ${trigger.timeframe || '1m'}</div>
                          <div>Candles: ${trigger.candles || 1}</div>
                          <div>Status: ${trigger.status}</div>
                          <div class="trigger-settings">
                              <select onchange="updateTriggerTimeframe(${trigger.id}, this.value)">
                                  <option value="1m" ${trigger.timeframe === '1m' ? 'selected' : ''}>1m</option>
                                  <option value="5m" ${trigger.timeframe === '5m' ? 'selected' : ''}>5m</option>
                                  <option value="15m" ${trigger.timeframe === '15m' ? 'selected' : ''}>15m</option>
                                  <option value="1h" ${trigger.timeframe === '1h' ? 'selected' : ''}>1h</option>
                              </select>
                              <input type="number" 
                                    value="${trigger.candles || 1}" 
                                    min="1" 
                                    onchange="updateTriggerCandles(${trigger.id}, this.value)"
                                    placeholder="Candles">
                          </div>
                        </div>

                    `).join('')}
                ` : '<div>No triggers set</div>'}

                          <div style="margin-top: 10px;">
                              <small>Draw trigger lines on chart to add conditions</small>
                          </div>
                      </div>


            <div class="setup-section">
                <h4>Risk Calculator</h4>
                <div class="risk-calculator">
                    <div>Portfolio Size: $${window.portfolioSize.toLocaleString()}</div>
                    <div style="margin: 10px 0;">
                      <div class="d-flex">
                        <label class="pe-2">Risk %: <span id="riskValue">${currentRiskPercentage}</span>%</label>
                        <div class="pe-2">$${riskAmount.toFixed(2)}</div>
                      </div>
                        <input type="range" 
                               class="risk-slider"
                               id="riskSlider" 
                               min="0.1" 
                               max="2" 
                               step="0.1" 
                               value="${currentRiskPercentage}"
                               oninput="updateRisk(this.value)">
                    </div>
                    ${entryLine && stopLine ? `
                    ` : '<div>Set entry and stop loss to calculate position size</div>'}
                </div>
            </div>

            <div class="setup-section">
                <h4>Entry </h4>
                ${entryLine ? `
                    <div>Price: ${entryLine.price.toFixed(8)}</div>
                    <div>Position Size: ${positionSize} units</div>
                    <div>Total Value: $${(positionSize * entryLine.price).toFixed(2)}</div>
                    
                ` : '<div>Not Set</div>'}
            </div>

            <div class="setup-section">
                  <h4>Stop Loss</h4>
                  ${stopLine ? `
                      <div>Price: ${stopLine.price.toFixed(8)}</div>
                      <div>Risk: ${currentRiskPercentage}%</div>
                      <div>Total Value2: $${(positionSize * stopLine.price).toFixed(2)}</div>
                  ` : '<div>Not Set</div>'}
            </div>

            <div class="setup-section">
                <h4>Profit Targets</h4>,
      
                ${ptLines.length > 0 ? ptLines.map((pt, i) => `
                    <div class="pt-item">
                        <div>Target ${i + 1}: ${pt.price.toFixed(8)}</div>
                        <div>R:R ${calculateRR(entryLine?.price, stopLine?.price, pt.price)}</div>
                    </div>
                `).join('') : '<div>Not Set</div>'}
            </div>

            ${entryLine && stopLine && ptLines.length > 0 ? `
                <button class="execute-btn" onclick="executeTradeSetup(tradeSetupData)">
                    Execute Trade Setup
                </button>
            ` : ''}
        `;
    }

    document.body.appendChild(tab);
    document.body.appendChild(sidebar);

    // Reset main content margin when sidebar is created
    const chartContainer = document.getElementById('chartContainer');
    if (chartContainer) {
        chartContainer.style.marginRight = '0';
    }


    // Initial render
    console.log("Initial Sidebar Render")
    updateSidebarContent();
    // Return refresh function
    return () => {
        console.log("Why is this here?")
        updateSidebarContent();
        sidebar.style.right = '0px'; // Changed from left to right
    };
}

function handleLineAction(action, line) {
    console.log("\n-------------------\nhandleLineAction")
    console.log("action:", action, "\nLine:", line);
    switch (action) {
        case 'trigger':
            const lastCandle = stockData[stockData.length - 1];
            const currentPrice = lastCandle.Close;

            line.type = 'trigger';
            line.color = '#ff00ff';

            const triggerData = {
                product_id: selectedProduct.product_id,
                type: line.price > currentPrice ? 'price_above' : 'price_below',
                price: parseFloat(line.price),
                status: 'active',
                xch_id: exchange.ID
            };

            // Initialize currentTradeSetup if it doesn't exist
            if (!window.currentTradeSetup) {
                window.currentTradeSetup = {
                    chainedTriggers: []
                };
            }

            // Add trigger to trade setup
            window.currentTradeSetup.chainedTriggers.push(triggerData);

            fetch('create-trigger', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(triggerData)
            })
                .then(response => response.json())
                .then(data => {
                    console.log('1Trigger Created: ', data);
                    line.triggerId = data.id;
                    // Update sidebar and push content
                    window.updateSidebar();

                    // Get chart container and adjust margin
                    const chartContainer = document.getElementById('chartContainer');
                    if (chartContainer) {
                        chartContainer.style.marginRight = '350px';
                        chartContainer.style.width = 'calc(100% - 350px)';
                        chartContainer.style.transition = 'all 0.3s ease';

                        // Redraw chart after transition
                        setTimeout(() => {
                            drawCandlestickChart(stockData, start, end);
                        }, 300);
                    }
                })
                .catch(error => {
                    console.log('Error creating trigger:', error);
                });
            
            draw_lines.push(line)
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
                chartContainer.style.marginRight = '350px';
                chartContainer.style.width = 'calc(100% - 350px)';
                chartContainer.style.transition = 'all 0.3s ease';
                setTimeout(() => {
                    console.log("candlestick_chart_draw")
                    drawCandlestickChart(stockData, start, end);
                }, 300);
            }
            draw_lines.push(line)
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
            draw_lines.push(line)
            break;

        case 'stop':
            console.log("STOP")
            line.type = 'stop';
            line.color = '#ff0000';
            console.log("CURRENT _ TRADE", window.currentTrade)
            console.log("CURRENT _ TRADE _ SETUP", window.currentTradeSetup)
            if (window.currentTrade && window.currentTrade.entry) {
                window.currentTrade.stop = line.price;
            }
            draw_lines.push(line)
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

window.updateRisk = function (value) {
    window.updateRisk = function (value) {
        currentRiskPercentage = parseFloat(value);
        // Force full sidebar refresh
        const updateFn = createTradeSetupSidebar();
        updateFn();
        // Update chart to reflect any changes
        drawCandlestickChart(stockData, start, end);
    };
}



// ------------------------

window.triggerHoverHandler = function (e, chartState) {
    const rect = canvas.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;

    if (window.current_triggers) {
        window.current_triggers.forEach(trigger => {
            const triggerY = chartState.height - chartState.margin -
                ((trigger.price - chartState.minPrice) / (chartState.maxPrice - chartState.minPrice)) *
                (chartState.height - 2 * chartState.margin);

            if (isMouseNearLine(mouseY, triggerY)) {
                document.querySelectorAll('.trigger-menu').forEach(el => el.remove());

                const menu = document.createElement('div');
                menu.className = 'trigger-menu';
                menu.style.position = 'absolute';
                menu.style.left = `${e.pageX - 150}px`;
                menu.style.top = `${e.pageY - 10}px`;
                menu.style.backgroundColor = '#333';
                menu.style.color = 'white';
                menu.style.padding = '10px';
                menu.style.border = '1px solid #666';
                menu.style.borderRadius = '4px';
                menu.style.display = 'block';
                menu.style.zIndex = '1000';
                menu.style.pointerEvents = 'auto';
                menu.style.minWidth = '200px';

                menu.innerHTML = `
                    <div style="margin-bottom: 8px;"><strong>Trigger Details</strong></div>
                    <div>Type: ${trigger.type}</div>
                    <div>Price: ${trigger.price.toFixed(8)}</div>
                    <div>Status: ${trigger.status}</div>
                    <div class="trigger-menu-item" onclick="editTrigger(${trigger.id})">Edit</div>
                    <div class="trigger-menu-item" onclick="deleteTrigger(${trigger.id})">Delete</div>
                    <div class="trigger-menu-item" onclick="handleTriggerAction('connect', ${trigger.id})">Connect to Trade</div>
                    <div class="trigger-menu-item" onclick="showTradeOptions(${trigger.id})">Upon Trigger...</div>
                `;

                menu.addEventListener('mouseenter', () => {
                    menu.dataset.hovering = 'true';
                });

                menu.addEventListener('mouseleave', function () {
                    menu.dataset.hovering = 'false';
                    menu.remove();
                });

                document.body.appendChild(menu);
            }
        });
    }
}

window.editTrigger = function (triggerId) {
    console.log("Edit Trigger", triggerId)
    // Get trigger data from all_triggers
    console.log("All Triggers", window.exchange.Triggers)
    const trigger = window.exchange.Triggers.find(t => t.id === triggerId);
    if (!trigger) return;

    console.log("Made it past the return")
    // Create or get sidebar
    let sidebar = document.getElementById('trigger-edit-sidebar');
    if (!sidebar) {
        sidebar = document.createElement('div');
        sidebar.id = 'trigger-edit-sidebar';
        sidebar.style.cssText = `
            position: fixed;
            right: -350px;
            top: 0;
            bottom: 0;
            width: 350px;
            background-color: #333;
            color: white;
            padding: 15px;
            border-left: 1px solid #444;
            overflow-y: auto;
            z-index: 1000;
            transition: right 0.3s ease;
        `;
    }

    // Populate sidebar content
    sidebar.innerHTML = `
        <div style="text-align: right;">
            <span onclick="closeTriggerEditor()" style="cursor: pointer; padding: 5px;">✕</span>
        </div>
        <h3>Edit Trigger</h3>
        
        <div class="edit-section">
            <div>Product: ${trigger.product_id}</div>
            
            <div class="input-group">
                <label>Type:</label>
                <select id="trigger-type" onchange="updateTriggerField(${triggerId}, 'type', this.value)">
                    <option value="price_above" ${trigger.type === 'price_above' ? 'selected' : ''}>Price Above</option>
                    <option value="price_below" ${trigger.type === 'price_below' ? 'selected' : ''}>Price Below</option>
                    <option value="closes_above" ${trigger.type === 'closes_above' ? 'selected' : ''}>Closes Above</option>
                    <option value="closes_below" ${trigger.type === 'closes_below' ? 'selected' : ''}>Closes Below</option>
                    <option value="wicks_above" ${trigger.type === 'wicks_above' ? 'selected' : ''}>Wicks Above</option>
                    <option value="wicks_below" ${trigger.type === 'wicks_below' ? 'selected' : ''}>Wicks Below</option>
                </select>
            </div>

            <div class="input-group">
                <label>Price:</label>
                <input type="number" 
                       id="trigger-price" 
                       value="${trigger.price}" 
                       step="0.00000001"
                       onchange="updateTriggerField(${triggerId}, 'price', this.value)">
            </div>

            <div class="input-group">
                <label>Timeframe:</label>
                <select id="trigger-timeframe" 
                        onchange="updateTriggerField(${triggerId}, 'timeframe', this.value)">
                    <option value="1m" ${trigger.timeframe === '1m' ? 'selected' : ''}>1m</option>
                    <option value="5m" ${trigger.timeframe === '5m' ? 'selected' : ''}>5m</option>
                    <option value="15m" ${trigger.timeframe === '15m' ? 'selected' : ''}>15m</option>
                    <option value="1h" ${trigger.timeframe === '1h' ? 'selected' : ''}>1h</option>
                </select>
            </div>

            <div class="input-group">
                <label>Candles:</label>
                <input type="number" 
                       id="trigger-candles" 
                       value="${trigger.candle_count || 1}" 
                       min="1"
                       onchange="updateTriggerField(${triggerId}, 'candles', this.value)">
            </div>

            <div class="input-group">
                <label>Status:</label>
                <select id="trigger-status" 
                        onchange="updateTriggerField(${triggerId}, 'status', this.value)">
                    <option value="active" ${trigger.status === 'active' ? 'selected' : ''}>Active</option>
                    <option value="inactive" ${trigger.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                </select>
            </div>
        </div>
    `;

    // Add CSS for the editor
    const style = document.createElement('style');
    style.textContent = `
        .edit-section {
            margin-top: 20px;
        }
        .input-group {
            margin: 15px 0;
        }
        .input-group label {
            display: block;
            margin-bottom: 5px;
        }
        .input-group input,
        .input-group select {
            width: 100%;
            padding: 5px;
            background: #444;
            border: 1px solid #666;
            color: white;
            border-radius: 3px;
        }
    `;
    document.head.appendChild(style);

    // Add to document and show
    document.body.appendChild(sidebar);
    setTimeout(() => {
        sidebar.style.right = '0';

        // Adjust ALL content, not just chart
        document.body.style.marginRight = '350px';
        document.body.style.transition = 'margin-right 0.3s ease';

        const chartContainer = document.getElementById('chartContainer');
        if (chartContainer) {
            chartContainer.style.width = 'calc(100% - 350px)';
            chartContainer.style.transition = 'width 0.3s ease';
        }

        // Redraw chart after transition
        setTimeout(() => {
            drawCandlestickChart(stockData, start, end);
        }, 300);
    }, 0);
}

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
    const updates = {};
    updates[field] = value;

    fetch('/update-trigger', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            trigger_id: triggerId,
            updates: updates
        })
    })
        .then(response => response.json())
        .then(data => {
            // Update local trigger data
            const trigger = window.all_triggers.find(t => t.id === triggerId);
            if (trigger) {
                trigger[field] = value;
            }
            // Update line on chart if necessary
            const line = draw_lines.find(l => l.triggerId === triggerId);
            if (line) {
                line[field] = value;
                drawCandlestickChart(stockData, start, end);
            }
        })
        .catch(error => console.error('Error updating trigger:', error));
}

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
    console.log("Trigger:", trigger)

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
                if (document.getElementById('trade-setup-sidebar').style.right === '-350px') {
                    toggleSidebar();
                }
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
}

window.showTradeSetupDialog = function (trigger) {
    const dialog = document.createElement('div');
    dialog.className = 'edit-trigger-form';
    dialog.style.position = 'absolute';
    dialog.style.left = '50%';
    dialog.style.top = '50%';
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
  }