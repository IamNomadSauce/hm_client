package main

import (
	"bytes"
	"fmt"
	"hm_client/api"
	"hm_client/model"
	"html/template"
	"io/ioutil"
	"log"
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
	//http.HandleFunc("/change_exchange", exchange_changeHandler)

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

/*
func exchange_changeHandler(w http.ResponseWriter, r *http.Request) {
  fmt.Println("Change Exchange")
  exchangeIndex := r.FormValue("exchange_index")
  fmt.Println("\n",exchangeIndex, "\n")
  session, _ := store.Get(r, "session-name")
  session.Values["selectedExchangeIndex"] = exchangeIndex
  session.Save(r,w)

  http.Redirect(w, r, "/finance", http.StatusSeeOther)
}
*/

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
	tmpl, err := template.ParseFiles(
		"templates/base.html",
		"templates/finance.html",
		"templates/components/navbar.html",
		"templates/components/chart.html",
	)
	if err != nil {
		fmt.Println("Error parsing template", err)
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

	for _, exchange := range exchanges {
		fmt.Println("\n----------------------------\n")
		fmt.Println("Exchange:", exchange.Name)
		fmt.Println("Watchlist:", exchange.Watchlist)
		fmt.Println("Timeframes:", exchange.Timeframes)
		fmt.Println("\n----------------------------\n")
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

	// Candles
	var candles []model.Candle

	if selectedProduct.ProductID != "" && selectedTimeframe.TF != "" {
		candles, err = api.GetCandles(strings.Replace(selectedProduct.ProductID, "-", "_", -1), selectedTimeframe.TF, selectedExchange.Name)
		if err != nil {
			log.Printf("Error fetching candles: %v", err)
		}
	}

	fmt.Println("\n------------------\nSelected Product:\n", selectedExchange.Name, selectedProduct, selectedTimeframe)
	fmt.Println("Candles:", len(candles), "\n------------------------------\n")

	data := struct {
		Exchanges         []model.Exchange
		SelectedExchange  model.Exchange
		SelectedIndex     int
		ProductIndex      int
		SelectedProduct   model.Product
		TimeframeIndex    int
		SelectedTimeframe model.Timeframe
		Candles           []model.Candle
	}{
		Exchanges:         exchanges,
		SelectedExchange:  selectedExchange,
		SelectedIndex:     selectedIndex,
		ProductIndex:      productIndex,
		SelectedProduct:   selectedProduct,
		TimeframeIndex:    timeframeIndex,
		SelectedTimeframe: selectedTimeframe,
		Candles:           candles,
	}

	// Use a buffer to render the template first
	var buf bytes.Buffer
	err = tmpl.Execute(&buf, data)
	if err != nil {
		http.Error(w, "Error executing template: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// If template execution was successful, write the result to the response
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, err = buf.WriteTo(w)
	if err != nil {
		log.Printf("Error writing response: %v", err)
		// At this point, we've already started writing the response,
		// so we can't send an HTTP error status anymore.
	}
}
