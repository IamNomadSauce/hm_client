package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"hm_client/api"
	"hm_client/model"
	"html/template"
	"io/ioutil"
	"log"
	"math"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

func main() {

	fmt.Println("main")

	http.HandleFunc("/", homeHandler)
	http.HandleFunc("/finance", financeHandler)
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

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		log.Fatalf("Error reading response body: %v", err)
	}
	fmt.Println("Test")

	if resp.StatusCode != http.StatusOK {
		log.Fatalf("Unexpected status code: %d", resp.StatusCode, string(body))
	}

	fmt.Println("Received Data:", string(body))
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

	body, err := ioutil.ReadAll(resp.Body)
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
	tmpl, err := template.ParseFiles(
		"templates/base.html",
		"templates/home.html",
		"templates/components/navbar.html",
	)
	if err != nil {
		http.Error(w, "Error parsing template", http.StatusInternalServerError)
	}

	err = tmpl.Execute(w, nil)
	if err != nil {
		http.Error(w, "Error executing temlate", http.StatusInternalServerError)
		fmt.Println("Error executing template", err)
	}

}

func financeHandler(w http.ResponseWriter, r *http.Request) {
	fmt.Println("Finance Page Request")

	// Create template with functions and specify the base template name
	tmpl := template.New("base.html").Funcs(template.FuncMap{
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
	})

	// Parse all template files
	tmpl, err := tmpl.ParseFiles(
		"templates/base.html",
		"templates/finance.html",
		"templates/components/navbar.html",
		"templates/components/chart.html",
	)
	if err != nil {
		log.Printf("Error parsing template: %v", err)
		http.Error(w, "Error parsing template", http.StatusInternalServerError)
		return
	}

	err = godotenv.Load()
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

	// for _, exchange := range exchanges {
	// 	// 	fmt.Println("\n----------------------------")
	// 	// 	fmt.Println("Exchange:", exchange.Name)
	// 	// 	fmt.Println("Watchlist:", exchange.Watchlist)
	// 	// 	fmt.Println("Timeframes:", exchange.Timeframes)
	// 	// 	fmt.Println("AvailableProducts:", len(exchange.AvailableProducts))
	// 	// 	fmt.Println("Fills", len(exchange.Fills))
	// 	// 	fmt.Println("\n----------------------------")
	// 	// log.Printf("Trendlines for %+v", exchange.Trendlines)
	// }

	selectedIndex, err := strconv.Atoi(r.URL.Query().Get("selected_index"))
	if err != nil || selectedIndex < 0 || selectedIndex >= len(exchanges) {
		selectedIndex = 0
	}

	selectedExchange := exchanges[selectedIndex]

	// for _, fill := range selectedExchange.Fills {
	// 	log.Println(fill)

	// }

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

	// Candles
	var candles []model.Candle

	if selectedProduct.ProductID != "" && selectedTimeframe.TF != "" {
		candles, err = api.GetCandles(strings.Replace(selectedProduct.ProductID, "-", "_", -1), selectedTimeframe.TF, selectedExchange.Name)
		if err != nil {
			log.Printf("Error fetching candles: %v", err)
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
	log.Println("Trendlines:")
	// for key, trendlines := range selectedExchange.Trendlines {

	// 	log.Println("\n---------------------------------------")
	// 	key_split := strings.Split(key, "_")

	// 	asset := key_split[0]
	// 	timeframe := key_split[1]
	// 	exchange := key_split[2]

	// 	log.Println("Key", key, "Asset: ", selectedProduct.ProductID, "Exchange:", selectedExchange.Name)
	// 	if asset == selectedProduct.ProductID && exchange == selectedExchange.Name {
	// 		log.Println(key, "Key Accepted:", "\n-------------------")
	// 		FilteredTrendlines[timeframe] = append(FilteredTrendlines[timeframe], trendlines...)

	// 	} else {
	// 		log.Printf("%s Not Filtered", key)
	// 	}
	// }
	// log.Printf("Filtered Trendlines: %d", len(FilteredTrendlines))
	// for k, _ := range FilteredTrendlines {
	// 	log.Println("Filtered key", k)
	// }

	trendlines, err := makeTrendlines(candles)

	data := struct {
		Exchanges          []model.Exchange
		SelectedExchange   model.Exchange
		SelectedIndex      int
		ProductIndex       int
		SelectedProduct    model.Product
		TimeframeIndex     int
		SelectedTimeframe  model.Timeframe
		FilteredTrendlines map[string][]model.Trendline // Trendlines for the selected product/asset
		Trendlines         []model.Trendline
		Candles            []model.Candle
		Colors             []string
		TotalValue         float64
		PortfolioData      []PortfolioItem
	}{
		Exchanges:          exchanges,
		SelectedExchange:   selectedExchange,
		SelectedIndex:      selectedIndex,
		ProductIndex:       productIndex,
		SelectedProduct:    selectedProduct,
		TimeframeIndex:     timeframeIndex,
		SelectedTimeframe:  selectedTimeframe,
		FilteredTrendlines: FilteredTrendlines,
		Trendlines:         trendlines,
		Candles:            candles,
		Colors:             colors,
		TotalValue:         totalValue,
		PortfolioData:      preparePortfolioData(selectedExchange.Portfolio),
	}

	// Use a buffer to render the template first
	var buf bytes.Buffer
	err = tmpl.ExecuteTemplate(&buf, "base.html", data)
	if err != nil {
		log.Printf("Error executing template: %v", err)
		http.Error(w, "Error executing template: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// If template execution was successful, write the result to the response
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, err = buf.WriteTo(w)
	if err != nil {
		log.Printf("Error writing response: %v", err)
	}
}

// MakeTrendlines generates trendlines based on the given candles.
func makeTrendlines(candles []model.Candle) ([]model.Trendline, error) {
	var trendlines []model.Trendline

	// Return empty slice if no candles are provided
	if len(candles) == 0 {
		return trendlines, fmt.Errorf("No candles given to makeTrendlines")
	}

	// for i, j := 0, len(candles)-1; i < j; i, j = i+1, j-1 {
	// 	candles[i], candles[j] = candles[j], candles[i]
	// }

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
	current := model.Trendline{
		Start:     start,
		End:       end,
		Direction: "up",
		Status:    "current",
	}

	for i, candle := range candles {
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

	// stopT := time.Since(startT)
	// log.Printf("Trendlines Time: %.3f seconds\n", stopT.Seconds())
	// log.Println("Trendlines:", trendlines)

	return trendlines, nil
}

type PortfolioItem struct {
	Asset      string  `json:"asset"`
	Value      float64 `json:"value"`
	Color      string  `json:"color"`
	Percentage float64 `json:"percentage"`
}

func preparePortfolioData(portfolio []model.Asset) []PortfolioItem {
	var total float64

	// Calculate total including hold values
	for _, asset := range portfolio {
		holdValue, _ := strconv.ParseFloat(asset.Hold.Value, 64)
		total += asset.Value + holdValue
	}

	colors := []string{
		"#3e3e3e", " #82e0aa", "#aeb6bf", "#52be80",
		"#bfc9ca", "#Fe74c3c", " #5499c7", "#34495e",
	}

	var items []PortfolioItem
	for i, asset := range portfolio {
		holdValue, _ := strconv.ParseFloat(asset.Hold.Value, 64)
		totalAssetValue := asset.Value + holdValue
		percentage := (totalAssetValue / total) * 100

		item := PortfolioItem{
			Asset:      asset.Asset,
			Value:      totalAssetValue,
			Color:      colors[i%len(colors)],
			Percentage: percentage,
		}

		items = append(items, item)
		log.Println(item.Asset, item.Percentage)
	}

	return items
}
