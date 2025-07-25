package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"hm_client/api"
	"hm_client/model"
	"html/template"
	"io"
	"log"
	"math"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

func main() {

	fmt.Println("main")

	http.HandleFunc("/", homeHandler)
	http.HandleFunc("/finance", financeHandler)
	http.HandleFunc("/horizon", horizonAcctHandler)
	http.HandleFunc("/add-to-watchlist", addToWatchlistHandler)
	http.HandleFunc("/trade-entry", tradeEntryHandler)
	http.HandleFunc("/create-trade", newTradeBlockHandler)
	http.HandleFunc("/delete-trade-block", deleteTradeBlockHandler)
	http.HandleFunc("/cancel-order", cancelOrderHandler)
	http.HandleFunc("/create-trigger", createTriggerHandler)
	http.HandleFunc("/delete-trigger/{id}", deleteTriggerHandler)
	http.HandleFunc("/update-trigger", updateTriggerHandler)
	//http.HandleFunc("/change_exchange", exchange_changeHandler)

	http.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("static"))))
	err := http.ListenAndServe(":8080", nil)

	// -----------------------------------------------

	// -----------------------------------------------

	err = godotenv.Load()

	url := os.Getenv("URL")

	resp, err := http.Get(url)
	if err != nil {
		fmt.Println("Error retrieval of url", err)
	}

	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Fatalf("Error reading response body: %v", err)
	}
	fmt.Println("Test")

	if resp.StatusCode != http.StatusOK {
		log.Fatalf("Unexpected status code: %d", resp.StatusCode, string(body))
	}

	fmt.Println("Received Data:", string(body))
}

// renderTemplate executes the given template files and writes the output to the ResponseWriter.
func renderTemplate(w http.ResponseWriter, baseTmpl string, data interface{}, files ...string) {
	// 1. Create a new template with the base name and add the shared function map.
	var funcMap = template.FuncMap{
		"multiply": func(a, b interface{}) float64 {
			var aFloat, bFloat float64

			switch v := a.(type) {
			case int:
				aFloat = float64(v)
			case float64:
				aFloat = v
			default:
				return 0
			}

			switch v := b.(type) {
			case int:
				bFloat = float64(v)
			case float64:
				bFloat = v
			default:
				return 0
			}

			return aFloat * bFloat
		},
		"divide": func(a, b interface{}) float64 {
			var aFloat, bFloat float64

			switch v := a.(type) {
			case int:
				aFloat = float64(v)
			case float64:
				aFloat = v
			default:
				return 0
			}

			switch v := b.(type) {
			case int:
				bFloat = float64(v)
			case float64:
				bFloat = v
			default:
				return 0
			}

			if bFloat == 0 {
				return 0
			}
			return aFloat / bFloat
		},
		"largeArcFlag": largeArcFlag,
		"add":          func(a, b float64) float64 { return a + b },
		"addInt":       func(a, b int) int { return a + b },
		"sub":          func(a, b float64) float64 { return a - b },
		"subInt":       func(a, b int) int { return a - b },
		"mul":          func(a, b float64) float64 { return a * b },
		"div":          func(a, b float64) float64 { return a / b },
		"cos":          math.Cos,
		"sin":          math.Sin,
		"degToRad":     func(deg float64) float64 { return deg * math.Pi / 180 },
		"gt": func(a, b interface{}) bool {
			switch a := a.(type) {
			case int:
				switch b := b.(type) {
				case int:
					return a > b
				case float64:
					return float64(a) > b
				}
			case float64:
				switch b := b.(type) {
				case int:
					return a > float64(b)
				case float64:
					return a > b
				}
			}
			return false // Default case if types are unsupported
		},
		"ge": func(a, b int) bool { return a >= b },
		"le": func(a, b int) bool { return a <= b },
	}

	tmpl, err := template.New(baseTmpl).Funcs(funcMap).ParseFiles(files...)
	if err != nil {
		log.Printf("Error parsing template files: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	// 2. Execute the template into a buffer to catch errors before writing to the response.
	//    This prevents partial HTML pages from being sent if an error occurs during execution.
	buf := new(bytes.Buffer)
	err = tmpl.ExecuteTemplate(buf, baseTmpl, data)
	if err != nil {
		log.Printf("Error executing template %s: %v", baseTmpl, err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	// 3. Set the content type and write the buffer to the http.ResponseWriter.
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, err = buf.WriteTo(w)
	if err != nil {
		log.Printf("Error writing template to response: %v", err)
	}
}

func cancelOrderHandler(w http.ResponseWriter, r *http.Request) {
	log.Println("Cancel Order Handler")

	if r.Method != http.MethodPost {
		log.Println("Method Not Allowed")
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse request body
	var request struct {
		OrderID string `json:"order_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		log.Printf("Error decoding request body: %v", err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if request.OrderID == "" {
		log.Println("Invalid Order ID")
		http.Error(w, "Invalid order ID", http.StatusBadRequest)
		return
	}

	// Load environment variables
	err := godotenv.Load()
	if err != nil {
		log.Printf("Error loading .env file: %v", err)
	}

	// Construct URL and forward request to backend
	baseURL := os.Getenv("URL")
	url := fmt.Sprintf("%s/cancel-order", baseURL)

	jsonData, err := json.Marshal(request)
	if err != nil {
		log.Printf("Error marshaling payload: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	req, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(jsonData))
	if err != nil {
		log.Printf("Error creating request: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Error sending request: %v", err)
		http.Error(w, "Failed to cancel order", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	// Forward the backend response
	w.Header().Set("Content-Type", "application/json")
	if resp.StatusCode != http.StatusOK {
		http.Error(w, "Failed to cancel order", resp.StatusCode)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{
		"status":  "success",
		"message": "Order cancelled successfully",
	})
}

func updateTriggerHandler(w http.ResponseWriter, r *http.Request) {
	log.Println("Update Trigger Handler")

	if r.Method != http.MethodPut {
		log.Println("Method Not Allowed")
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var request struct {
		TriggerID int                    `json:"trigger_id"`
		Updates   map[string]interface{} `json:"updates"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		log.Printf("Error decoding request body: %v", err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if request.TriggerID <= 0 {
		log.Println("Invalid Trigger ID")
		http.Error(w, "Invalid trigger ID", http.StatusBadRequest)
		return
	}

	err := godotenv.Load()
	if err != nil {
		log.Printf("Error loading .env file: %v", err)
	}

	baseURL := os.Getenv("URL")
	url := fmt.Sprintf("%s/update-trigger", baseURL) // Construct proper URL

	// Forward the same structure to the backend
	payload := map[string]interface{}{
		"trigger_id": request.TriggerID,
		"updates":    request.Updates,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		log.Printf("Error marshaling payload: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	log.Printf("Trigger:\n%+v", payload)

	req, err := http.NewRequest(http.MethodPut, url, bytes.NewBuffer(jsonData))
	if err != nil {
		log.Printf("Error creating request: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Error sending request: %v", err)
		http.Error(w, "Failed to update trigger", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	// Forward the backend response
	w.Header().Set("Content-Type", "application/json")
	if resp.StatusCode != http.StatusOK {
		http.Error(w, "Failed to update trigger", resp.StatusCode)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{
		"status":  "success",
		"message": "Trigger updated successfully",
	})
}

func deleteTriggerHandler(w http.ResponseWriter, r *http.Request) {
	log.Println("Delete Trigger")

	// Get trigger ID from URL path
	parts := strings.Split(r.URL.Path, "/")
	if len(parts) < 3 {
		http.Error(w, "Invalid URL", http.StatusBadRequest)
		return
	}

	triggerId, err := strconv.Atoi(parts[len(parts)-1])
	if err != nil {
		http.Error(w, "Invalid trigger ID", http.StatusBadRequest)
		return
	}

	// Only allow DELETE method
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	err = godotenv.Load()
	if err != nil {
		log.Printf("Error loading .env file: %v", err)
	}

	url := os.Getenv("URL")

	err = api.DeleteTrigger(url, triggerId)
	if err != nil {
		log.Printf("Error deleting trigger: %v", err)
		http.Error(w, "Failed to delete trigger", http.StatusInternalServerError)
		return
	}

	// Return success response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "success",
		"message": "Trigger deleted successfully",
	})
}

func createTriggerHandler(w http.ResponseWriter, r *http.Request) {
	log.Println("Create Trigger")

	var trigger model.Trigger
	if err := json.NewDecoder(r.Body).Decode(&trigger); err != nil {
		log.Printf("Error decoding request body: %v", err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	log.Printf("Creating New Trigger: %v", trigger)

	err := godotenv.Load()
	if err != nil {
		log.Printf("Error loading .env file: %v", err)
	}

	url := os.Getenv("URL")

	err = api.CreateTrigger(url, trigger)
	if err != nil {
		log.Printf("Error creating trigger %v", err)
		http.Error(w, "Failled to create bracket order", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "success",
		"message": "New trigger created successfully",
	})
}

func newTradeBlockHandler(w http.ResponseWriter, r *http.Request) {
	log.Println("Bracket Order Handler")

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// log.Printf("Body: %+v", r.Body)

	var TradeGroup model.TradeBlock
	if err := json.NewDecoder(r.Body).Decode(&TradeGroup); err != nil {
		log.Printf("Error decoding request body: %v", err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	log.Printf("Creating bracket order: %+v", TradeGroup)

	err := godotenv.Load()
	if err != nil {
		log.Printf("Error loading .env file: %v", err)
	}

	base_url := os.Getenv("URL")
	url := base_url + "/new_trade"

	jsonData, err := json.Marshal(TradeGroup)
	if err != nil {
		log.Printf("Error marshaling request payload: %v", err)
		return
	}
	log.Printf("Sending payload: %s", string(jsonData))

	req, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(jsonData))
	if err != nil {
		log.Printf("Error creating request: %v", err)
		return
	}

	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Error sending request: %v", err)
		return
	}

	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Println("Error reading response body: %v", err)
		return
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		log.Printf("Unexpected status code: %d, response: %s", resp.StatusCode, string(body))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "success",
		"message": "Bracket order created successfully",
	})
}

func deleteTradeBlockHandler(w http.ResponseWriter, r *http.Request) {
	log.Println("Delete Trade Block Handler")

	if r.Method != http.MethodPost {
		log.Println("Method Not Allowed")
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var request struct {
		GroupID string `json:"group_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		log.Printf("Error decoding request body: %v", err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if request.GroupID == "" {
		log.Println("Invalid Group ID")
		http.Error(w, "Invalid group ID", http.StatusBadRequest)
		return
	}

	err := godotenv.Load()
	if err != nil {
		log.Printf("Error loading .env file: %v", err)
	}

	baseURL := os.Getenv("URL")
	url := fmt.Sprintf("%s/delete-trade-group", baseURL)

	jsonData, err := json.Marshal(request)
	if err != nil {
		log.Printf("Error marshaling payload: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	req, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(jsonData))
	if err != nil {
		log.Printf("Error creating request: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Error sending request: %v", err)
		http.Error(w, "Failed to delete trade block", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "application/json")
	if resp.StatusCode != http.StatusOK {
		http.Error(w, "Failed to delete trade block", resp.StatusCode)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{
		"status":  "success",
		"message": "Trade block deleted successfully",
	})
}

func addToWatchlistHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse form data
	err := r.ParseForm()
	if err != nil {
		http.Error(w, "Failed to parse form", http.StatusBadRequest)
		return
	}

	// Get values from form
	exchangeID, err := strconv.Atoi(r.FormValue("xch_id"))
	if err != nil {
		http.Error(w, "Invalid exchange ID", http.StatusBadRequest)
		return
	}
	productID := r.FormValue("product_id")

	log.Printf("Frontend handler: exchange_id=%d, product_id=%s", exchangeID, productID)

	// Call the AddToWatchlist function with correct field names
	err = api.AddToWatchlist(os.Getenv("URL"), exchangeID, productID)
	if err != nil {
		log.Printf("Error adding to watchlist: %v", err)
		http.Error(w, "Failed to add to watchlist", http.StatusInternalServerError)
		return
	}

	// Redirect back to the finance page
	http.Redirect(w, r, "/finance", http.StatusSeeOther)
}

func tradeEntryHandler(w http.ResponseWriter, r *http.Request) {

	log.Println("Trade Entry Handler")

	err := r.ParseForm()
	if err != nil {
		http.Error(w, "Failed to parse form", http.StatusBadRequest)
		return
	}

	entry := r.FormValue("entry")
	stoploss := r.FormValue("stoploss")
	pt1 := r.FormValue("pt1")
	pt2 := r.FormValue("pt2")

	log.Println("Entry:", entry, "StopLoss", stoploss, "PT1", pt1, "PT2", pt2)

	http.Redirect(w, r, "/finance", http.StatusSeeOther)
}

func homeHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Println("Home Request")
	renderTemplate(w, "base.html", nil,
		"templates/base.html",
		"templates/home.html",
		"templates/components/navbar.html",
	)
}

func largeArcFlag(angleDiff float64) string {
	if angleDiff > 180 {
		return "1"
	}
	return "0"
}

func financeHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Println("Finance Page Request")

	err := godotenv.Load()
	if err != nil {
		log.Println("Error loading .env file:", err)
		// Decide whether to return or continue based on your requirements
	}

	// -----------------------------------------------
	// -----------------------------------------------

	url := os.Getenv("URL")

	exchanges, err := api.GetExchanges(url)
	if err != nil {
		http.Error(w, "Error fetching exchange data: "+err.Error(), http.StatusInternalServerError)
		return
	}

	selectedIndex, err := strconv.Atoi(r.URL.Query().Get("selected_index"))
	if err != nil || selectedIndex < 0 || selectedIndex >= len(exchanges) {
		selectedIndex = 0
	}

	selectedExchange := exchanges[selectedIndex]

	productIndex, err := strconv.Atoi(r.URL.Query().Get("product_index"))
	if err != nil || productIndex < 0 || productIndex >= len(selectedExchange.Watchlist) {
		productIndex = 0
	}

	selectedProduct := model.Product{}

	if len(selectedExchange.Watchlist) > 0 {
		selectedProduct = selectedExchange.Watchlist[productIndex]
	}

	timeframeIndex, err := strconv.Atoi(r.URL.Query().Get("timeframe_index"))
	if err != nil || timeframeIndex < 0 || timeframeIndex >= len(selectedExchange.Timeframes) {
		timeframeIndex = 0
	}
	var selectedTimeframe model.Timeframe
	if len(selectedExchange.Timeframes) > 0 {
		selectedTimeframe = selectedExchange.Timeframes[timeframeIndex]
	}

	candleOffset, _ := strconv.Atoi(r.URL.Query().Get("candle_offset"))
	if candleOffset < 0 {
		candleOffset = 0
	}

	var allCandles []model.Candle

	if selectedProduct.ProductID != "" && selectedTimeframe.TF != "" {
		allCandles, err = api.GetCandles(strings.Replace(selectedProduct.ProductID, "-", "_", -1), selectedTimeframe.TF, selectedExchange.Name)
		if err != nil {
			log.Printf("Error fetching candles: %v", err)
		}
	}

	if candleOffset >= len(allCandles) && len(allCandles) > 0 {
		candleOffset = len(allCandles) - 1
	}

	var displayCandles []model.Candle
	if len(allCandles) > 0 {
		endIndex := len(allCandles) - candleOffset
		if endIndex > 0 {
			displayCandles = allCandles[:endIndex]
		}
	}

	var trendlines []model.Trendline
	var trendZilla []model.Trendline
	if len(displayCandles) > 0 {
		trendlines, err = makeAPITrendlines(displayCandles)
		if err != nil {
			log.Printf("Error making API trendlines: %v", err)
		}
		if len(trendlines) > 0 {
			trendZilla = buildTrendlines(trendlines, 0)
		}
	}

	fmt.Println("\n------------------\nSelected Product:\n", selectedExchange.Name, selectedProduct, selectedTimeframe)
	// fmt.Println("Candles:", len(candles), "\n------------------------------\n")

	colors := []string{
		"#3e3e3e", " #82e0aa", "#aeb6bf", "#52be80",
		"#bfc9ca", "#Fe74c3c", " #5499c7", "#34495e",
	}

	var totalValue float64

	for _, asset := range selectedExchange.Portfolio {
		totalValue += asset.Value
	}

	FilteredTrendlines := make(map[string][]model.Trendline)

	log.Println("Exchange", selectedExchange.Name)
	log.Printf("Asset: %s", selectedProduct.ProductID)

	data := struct {
		Exchanges          []model.Exchange
		SelectedExchange   model.Exchange
		SelectedIndex      int
		ProductIndex       int
		SelectedProduct    model.Product
		TimeframeIndex     int
		SelectedTimeframe  model.Timeframe
		FilteredTrendlines map[string][]model.Trendline // Trendlines for the selected product/asset
		BaseTrends         []model.Trendline
		Trendlines         []model.Trendline
		Candles            []model.Candle
		Colors             []string
		TotalValue         float64
		PortfolioData      []PortfolioItem
		CandleOffset       int
		TotalCandleCount   int
	}{
		Exchanges:          exchanges,
		SelectedExchange:   selectedExchange,
		SelectedIndex:      selectedIndex,
		ProductIndex:       productIndex,
		SelectedProduct:    selectedProduct,
		TimeframeIndex:     timeframeIndex,
		SelectedTimeframe:  selectedTimeframe,
		FilteredTrendlines: FilteredTrendlines,
		BaseTrends:         trendlines,
		Trendlines:         trendZilla,
		Candles:            displayCandles,
		Colors:             colors,
		TotalValue:         totalValue,
		PortfolioData:      preparePortfolioData(selectedExchange.Portfolio),
		CandleOffset:       candleOffset,
		TotalCandleCount:   len(allCandles),
	}

	renderTemplate(w, "base.html", data,
		"templates/base.html",
		"templates/finance.html",
		"templates/components/navbar.html",
		"templates/components/chart.html",
	)
}

// MakeTrendlines generates trendlines based on the given candles.
func makeTrendlines(candles []model.Candle) ([]model.Trendline, error) {

	// Return empty slice if no candles are provided
	if len(candles) == 0 {
		return []model.Trendline{}, nil
	}

	var trendlines []model.Trendline
	var current = model.Trendline{}
	sliced_candles := candles

	counter := 0
	// startT := time.Now()

	// Initialize start and end points from the first candle
	start := model.Point{
		Time:       candles[0].Timestamp,
		Point:      candles[0].Low,
		TrendStart: candles[0].Close,
		Inv:        candles[0].Close,
	}
	end := model.Point{
		Time:       candles[0].Timestamp,
		Point:      candles[0].High,
		TrendStart: candles[0].Close,
		Inv:        candles[0].Close,
	}
	current = model.Trendline{
		Start:     start,
		End:       end,
		Direction: "up",
		Status:    "current",
	}

	for i, candle := range sliced_candles {
		// log.Println("Processing candle time: ", candle.Timestamp)
		// Condition 1: Higher high in uptrend (continuation)
		if candle.High > current.End.Point && current.Direction == "up" {
			current.End = model.Point{
				Time:       candle.Timestamp,
				Point:      candle.High,
				Inv:        candle.Low,
				TrendStart: math.Max(candle.Close, candle.Open), // (close > open) ? close : open
			}
			counter = 0
		} else if (candle.High > current.End.Inv || (i > 0 && candle.High > candles[i-1].High)) && current.Direction == "down" { // Condition 2: Higher high in downtrend (new uptrend)
			counter++
			if counter >= 0 { // Confirm reversal after 3 higher highs
				current.Status = "done"
				trendlines = append(trendlines, current)
				current = model.Trendline{
					Start: current.End,
					End: model.Point{
						Time:       candle.Timestamp,
						Point:      candle.High,
						Inv:        candle.Low,
						TrendStart: math.Max(candle.Close, candle.Open),
					},
					Direction: "up",
					Status:    "current",
				}
				counter = 0
			}
		} else if (candle.Low < current.End.Inv || (i > 0 && candle.Low < candles[i-1].Low)) && current.Direction == "up" { // Condition 3: Lower low in uptrend (new downtrend)
			counter++
			if counter >= 0 { // Confirm reversal after 3 lower lows
				current.Status = "done"
				trendlines = append(trendlines, current)
				current = model.Trendline{
					Start: current.End,
					End: model.Point{
						Time:       candle.Timestamp,
						Point:      candle.Low,
						Inv:        candle.High,
						TrendStart: math.Min(candle.Close, candle.Open), // (close > open) ? open : close
					},
					Direction: "down",
					Status:    "current",
				}
				counter = 0
			}
		} else if candle.Low < current.End.Point && current.Direction == "down" { // Condition 4: Lower low in downtrend (continuation)
			current.End = model.Point{
				Time:       candle.Timestamp,
				Point:      candle.Low,
				Inv:        candle.High,
				TrendStart: math.Min(candle.Close, candle.Open),
			}
			counter = 0
		}
	}

	return trendlines, nil
}

func makeAPITrendlines(candles []model.Candle) ([]model.Trendline, error) {
	trendlines := []model.Trendline{}

	var current = model.Trendline{}
	sliced_candles := candles

	counter := 0

	start := model.Point{
		Time:       candles[0].Timestamp,
		Point:      candles[0].Low,
		TrendStart: candles[0].Close,
		Inv:        candles[0].Close,
	}
	end := model.Point{
		Time:       candles[0].Timestamp,
		Point:      candles[0].High,
		TrendStart: candles[0].Close,
		Inv:        candles[0].Close,
	}
	current = model.Trendline{
		Start:     start,
		End:       end,
		Direction: "up",
		Status:    "current",
	}

	for index, candle := range sliced_candles {

		if current.Direction == "up" {

			// Higher High && Lower Low
			if candle.High > current.End.Point && candle.Low < current.End.Inv {
				if candle.Close > candle.Open { // Green Candle
					current.Status = "done"
					trendlines = append(trendlines, current)

					current = model.Trendline{
						Start: current.End,
						End: model.Point{
							Time:       candle.Timestamp,
							Point:      candle.Low,
							Inv:        candle.High,
							TrendStart: math.Max(candle.Close, candle.Open), // (close > open) ? close : open
						},
						Status:    "current",
						Direction: "down",
					}
				} else { // Red Candle
					current.End = model.Point{
						Time:       candle.Timestamp,
						Point:      candle.High,
						Inv:        candle.Low,
						TrendStart: math.Max(candle.Close, candle.Open), // (close > open) ? close : open
					}
					current.Status = "done"
					trendlines = append(trendlines, current)

					current = model.Trendline{
						Start: current.End,
						End: model.Point{
							Time:       candle.Timestamp,
							Point:      candle.Low,
							Inv:        candle.High,
							TrendStart: math.Max(candle.Close, candle.Open), // (close > open) ? close : open
						},
						Direction: "down",
						Status:    "current",
					}
				}
				continue
			}

			// Higher High in uptrend  (continuation)
			if candle.High > current.End.Point {
				current.End = model.Point{
					Time:       candle.Timestamp,
					Point:      candle.High,
					Inv:        candle.Low,
					TrendStart: math.Max(candle.Close, candle.Open), // (close > open) ? close : open
				}
				current.Note = ""
				counter = 0
				continue
			}

			// Lower Low in uptrend (new trend)
			if candle.Low < current.End.Inv || (index > 0 && candle.Low < candles[index-1].Low) {

				counter++
				if counter >= 0 { // Confirm reversal after 3 lower lows
					current.Status = "done"
					trendlines = append(trendlines, current)
					current = model.Trendline{
						Start: current.End,
						End: model.Point{
							Time:       candle.Timestamp,
							Point:      candle.Low,
							Inv:        candle.High,
							TrendStart: math.Min(candle.Close, candle.Open), // (close > open) ? open : close
						},
						Direction: "down",
						Status:    "current",
					}
					counter = 0
				}
				continue

			}

		} else if current.Direction == "down" {

			// Lower Low && Higher High in downtrend
			if candle.Low < current.End.Point && candle.High > current.End.Inv {
				if candle.Close > candle.Open { // Green Candle
					current.End = model.Point{
						Time:       candle.Timestamp,
						Point:      candle.Low,
						Inv:        candle.High,
						TrendStart: math.Max(candle.Close, candle.Open), // (close > open) ? close : open
					}
					current.Status = "done"
					trendlines = append(trendlines, current)
					current = model.Trendline{
						Start: current.End,
						End: model.Point{
							Time:       candle.Timestamp,
							Point:      candle.High,
							Inv:        candle.Low,
							TrendStart: math.Max(candle.Close, candle.Open), // (close > open) ? close : open
						},
						Status:    "current",
						Direction: "up",
					}
				} else { // Red Candle
					current.End = model.Point{
						Time:       candle.Timestamp,
						Point:      candle.Low,
						Inv:        candle.High,
						TrendStart: math.Max(candle.Close, candle.Open), // (close > open) ? close : open
					}
					current.Status = "done"
					trendlines = append(trendlines, current)

					current = model.Trendline{
						Start: current.End,
						End: model.Point{
							Time:       candle.Timestamp,
							Point:      candle.High,
							Inv:        candle.Low,
							TrendStart: math.Max(candle.Close, candle.Open), // (close > open) ? close : open
						},
						Direction: "up",
						Status:    "current",
					}
				}
				continue
			}

			// Lower Low in downtrend  (continuation)
			if candle.Low < current.End.Point {
				current.End = model.Point{
					Time:       candle.Timestamp,
					Point:      candle.Low,
					Inv:        candle.High,
					TrendStart: math.Min(candle.Close, candle.Open),
				}
				counter = 0

				continue

			}

			// Higher High in downtrend  (new trend)
			if candle.High > current.End.Inv || (index > 0 && candle.High > candles[index-1].High) {
				counter++
				if counter >= 0 { // Confirm reversal after 3 higher highs
					current.Status = "done"
					trendlines = append(trendlines, current)
					current = model.Trendline{
						Start: current.End,
						End: model.Point{
							Time:       candle.Timestamp,
							Point:      candle.High,
							Inv:        candle.Low,
							TrendStart: math.Max(candle.Close, candle.Open),
						},
						Direction: "up",
						Status:    "current",
					}
					counter = 0
				}

				continue

			}

		}
		// if current.StartTime == current.EndTime {
		// 	current.StartTime = current.StartTime - 1
	}

	trendlines = append(trendlines, current)

	// After generating trendlines, create a windowed slice of trendlines
	// windowedTrends := windowArray(trendlines, 3)

	// // Iterate over the windowed trendlines to assign labels and colors
	// for i, window := range windowedTrends {
	// 	if len(window) == 3 {
	// 		a, b, c := window[0], window[1], window[2]

	// 		// Determine the label and color based on the trend
	// 		if c.End.Point < b.End.Point && c.End.Point > a.End.Point {
	// 			c.End.Label = "HL"
	// 			c.Color = "green"
	// 		} else if c.End.Point < a.End.Point && b.End.Point > a.End.Point {
	// 			c.End.Label = "LL"
	// 			c.Color = "red"
	// 		} else if c.End.Point > b.End.Point && c.End.Point > a.End.Point {
	// 			c.End.Label = "HH"
	// 			c.Color = "green"
	// 		} else if c.End.Point < a.End.Point && b.End.Point < c.End.Point {
	// 			c.End.Label = "LH"
	// 			c.Color = "red"
	// 		}
	// 		fmt.Printf("%s", c.Label)

	// 		//fmt.Printf("Trendline: %v %v\n", c.End.Time, c.Label)

	// 		// Update the trendlines with the new labels and colors
	// 		trendlines[i+2].End.Label = c.End.Label

	// 		// // Seed the labels and colors for the first window
	// 		// if i == 0 {
	// 		// 	trendlines[i].Label = "L"
	// 		// 	if a.End.Point > b.End.Point {
	// 		// 		trendlines[i].Label = "H"
	// 		// 	}
	// 		// 	trendlines[i].Color = "white"
	// 		// }
	// 	}
	// }

	fmt.Printf("|%d| TRENDLINES\n", len(trendlines))
	for _, trend := range trendlines {
		fmt.Printf("%+v %s \n", trend.End.Label, trend.Color)
	}

	return trendlines, nil
}

var totalTrends = 0

// buildTrendlines is the recursive function
func buildTrendlines(trendlines []model.Trendline, depth int) []model.Trendline {
	// Log the current depth

	// Base case: stop if too few trendlines or max depth reached
	if len(trendlines) <= 10 {
		log.Println("Build Trends Complete at depth", depth, len(trendlines))
		return trendlines
	}

	// Generate higher-level trendlines
	dx_trends, err := dxTrendlines(trendlines)
	if err != nil {
		return nil
	}

	log.Println("Trend Depth", depth, "trends_0", len(trendlines), "dx_trends", len(dx_trends))
	// Process each trendline
	for i := range dx_trends {
		// log.Printf("Trend: %d of %d @ depth %d", i, len(dx_trends), depth)
		v := &dx_trends[i] // Pointer to modify the original trend

		// Find start index where trendlines[k].Start.Time >= v.Start.Time
		startIdx := sort.Search(len(trendlines), func(k int) bool {
			return trendlines[k].Start.Time >= v.Start.Time
		})

		// Find end index where trendlines[k].Start.Time > v.End.Time
		endIdx := sort.Search(len(trendlines), func(k int) bool {
			return trendlines[k].End.Time > v.End.Time
		})

		v.TrendLines = trendlines[startIdx:endIdx]
	}

	// return trendlines, nil
	return buildTrendlines(dx_trends, depth+1)
}

func dxTrendlines(trendlines []model.Trendline) ([]model.Trendline, error) {

	windowedTrends := windowArray(trendlines, 3)
	return_trends := []model.Trendline{}

	// Iterate over the windowed trendlines to assign labels and colors
	for i, window := range windowedTrends {
		if len(window) == 3 {
			a, b, c := window[0], window[1], window[2]

			// Determine the label and color based on the trend
			if c.End.Point < b.End.Point && c.End.Point > a.End.Point {
				c.End.Label = "HL"
				c.End.Color = "cyan"
			} else if c.End.Point < a.End.Point && b.End.Point > a.End.Point {
				c.End.Label = "LL"
				c.End.Color = "red"
			} else if c.End.Point > b.End.Point && c.End.Point > a.End.Point {
				c.End.Label = "HH"
				c.End.Color = "green"
			} else if c.End.Point < a.End.Point && b.End.Point < c.End.Point {
				c.End.Label = "LH"
				c.End.Color = "yellow"
			}
			fmt.Printf("%s", c.Label)

			//fmt.Printf("Trendline: %v %v\n", c.End.Time, c.Label)

			// Update the trendlines with the new labels and colors
			trendlines[i+2].End.Label = c.End.Label

			// // Seed the labels and colors for the first window
			// if i == 0 {
			// 	trendlines[i].Label = "L"
			// 	if a.End.Point > b.End.Point {
			// 		trendlines[i].Label = "H"
			// 	}
			// 	trendlines[i].Color = "white"
			// }
		}
	}

	current := trendlines[0]
	direction := trendlines[0].Direction
	// log.Println(trendlines[0])
	// log.Println("Initial Direction", direction)
	for _, trend := range trendlines {
		end := trend.End
		if end.Label == "LL" {
			// log.Println(end.Label)
			if direction == "down" { // Continuation
				// log.Println("Continuation LL", direction, end.Point)
				current.End = end
				current.End.Color = "orange"
			} else if direction == "up" { // HH -> LL New Trend
				// log.Println("New Trend LL", end.Point)
				return_trends = append(return_trends, current)

				var temp_current model.Trendline
				temp_current.Start = current.End
				temp_current.End = end
				current = temp_current
				current.End.Color = "red"
				direction = "down"
			}
		} else if end.Label == "HH" { // HH
			// log.Println(end.Label)
			if direction == "up" { // Continuation
				// log.Println("Continuation HH", direction, end.Point)
				current.End = end
				current.End.Color = "gold"
			} else if direction == "down" { // New Trend
				// log.Println("New Trend HH", end.Point)
				return_trends = append(return_trends, current)

				var temp_current model.Trendline
				temp_current.Start = current.End
				temp_current.End = end
				current = temp_current
				current.End.Color = "green"
				direction = "up"
			}
		} else if end.Label == "HL" {

		} else if end.Label == "LH" {
		}
	}

	return_trends = append(return_trends, current)

	// log.Printf("Trendlines %+v", len(return_trends))

	return return_trends, nil
}

func windowArray(trends []model.Trendline, windowSize int) [][]model.Trendline {
	var windowedTrends [][]model.Trendline
	for i := 0; i < len(trends); i++ {
		var window []model.Trendline
		for j := i; j < i+windowSize && j < len(trends); j++ {
			window = append(window, trends[j])
		}
		if len(window) == windowSize {
			windowedTrends = append(windowedTrends, window)
		}
	}
	return windowedTrends
}

type PortfolioItem struct {
	Asset      string  `json:"asset"`
	Value      float64 `json:"value"`
	Color      string  `json:"color"`
	Percentage float64 `json:"percentage"`
	StartAngle float64
	EndAngle   float64
}

func preparePortfolioData(portfolio []model.Asset) []PortfolioItem {
	var total float64
	for _, asset := range portfolio {
		holdValue, _ := strconv.ParseFloat(asset.Hold.Value, 64)
		total += asset.Value + holdValue
	}

	colors := []string{
		"#3e3e3e", "#82e0aa", "#aeb6bf", "#52be80",
		"#bfc9ca", "#Fe74c3c", "#5499c7", "#34495e",
	}

	var items []PortfolioItem
	cumulativePercentage := 0.0
	for i, asset := range portfolio {
		holdValue, _ := strconv.ParseFloat(asset.Hold.Value, 64)
		totalAssetValue := asset.Value + holdValue
		percentage := (totalAssetValue / total) * 100

		startAngle := (cumulativePercentage / 100) * 360
		cumulativePercentage += percentage
		endAngle := (cumulativePercentage / 100) * 360

		item := PortfolioItem{
			Asset:      asset.Asset,
			Value:      totalAssetValue,
			Color:      colors[i%len(colors)],
			Percentage: percentage,
			StartAngle: startAngle,
			EndAngle:   endAngle,
		}

		items = append(items, item)
		log.Println(item.Asset, item.Percentage, item.StartAngle, item.EndAngle)
	}

	return items
}

func horizonAcctHandler(w http.ResponseWriter, r *http.Request) {
	log.Println("Horizon Account")
	err := godotenv.Load()

	acctID := os.Getenv("HORIZON_ID")
	if acctID == "" {
		log.Println("Horizon_id not set in .env file")
		http.Error(w, "Horizon Account ID is not configured", http.StatusInternalServerError)
		return
	}

	account, err := api.GetAccountDetails(acctID)
	if err != nil {
		log.Printf("Error getting account details: %v", err)
	}

	trades, err := api.GetTrades(acctID)
	if err != nil {
		log.Printf("Error getting trades: %v", err)
	}

	offers, err := api.GetOffers(acctID)
	if err != nil {
		log.Printf("Error getting offers: %v", err)
	}

	payments, err := api.GetPayments(acctID)
	if err != nil {
		log.Printf("Error getting payments: %v", err)
	}

	data := struct {
		Account  model.HorizonAccount
		Trades   model.HorizonTradeResponse
		Offers   model.HorizonOfferResponse
		Payments model.HorizonPaymentResponse
	}{
		Account:  account,
		Trades:   trades,
		Offers:   offers,
		Payments: payments,
	}

	renderTemplate(w, "base.html", data,
		"templates/base.html",
		"templates/horizon.html",
		"templates/components/navbar.html",
	)
}
