package main

import (
	"fmt"
  "bytes"
	"io/ioutil"
	"log"
	"net/http"
  "html/template"
  "encoding/json"
	"os"
	"github.com/joho/godotenv"
  "hm_client/api"
  "strconv"
  "hm_client/model"
)

func main() {
	
	fmt.Println("main")

  http.HandleFunc("/", homeHandler)
  http.HandleFunc("/finance", financeHandler)
  //http.HandleFunc("/change_exchange", exchange_changeHandler)

  err := http.ListenAndServe(":8080", nil)

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

    url := os.Getenv("URL")

    exchangeData, err := api.GetExchanges(url)
    if err != nil {
        http.Error(w, "Error fetching exchange data: "+err.Error(), http.StatusInternalServerError)
        return
    }

    var exchanges []Exchange
    err = json.Unmarshal(exchangeData, &exchanges)
    if err != nil {
        http.Error(w, "Error parsing exchange data: "+err.Error(), http.StatusInternalServerError)
        return
    }
    fmt.Println(exchanges)

    selectedIndex, err := strconv.Atoi(r.URL.Query().Get("selected_index"))
    if err != nil || selectedIndex < 0 || selectedIndex >= len(exchanges) {
        selectedIndex = 0
    }

    selectedExchange := exchanges[selectedIndex]

    productIndex, err := strconv.Atoi(r.URL.Query().Get("product_index"))
    if err != nil || productIndex < 0 || productIndex >= len(selectedExchange.Watchlist) {
        productIndex = 0
    }

    selectedProduct := selectedExchange.Watchlist[productIndex]

    timeframeIndex, err := strconv.Atoi(r.URL.Query().Get("timeframe_index"))
    if err != nil || timeframeIndex < 0 || timeframeIndex >= len(selectedExchange.Timeframes) {
      timeframeIndex = 0
    }
    var selectedTimeframe Timeframe
    if len(selectedExchange.Timeframes) > 0 {
      selectedTimeframe = selectedExchange.Timeframes[timeframeIndex]
    }


    // Candles
    var candles []model.Candle

    if selectedProduct.Product != "" && selectedTimeframe.TF != "" {
      candles, err = api.GetCandles(selectedProduct.Product, selectedTimeframe.TF, selectedExchange.Name)
      if err != nil {
        log.Printf("Error fetching candles: %v", err)
      }
    }

    fmt.Println("\n------------------\nSelected Product:\n", productIndex, selectedProduct, selectedTimeframe)
    fmt.Println("\n------------------------------\nCandles:", len(candles))

    data := struct {
        Exchanges           []Exchange
        SelectedExchange    Exchange
        SelectedIndex       int
        ProductIndex        int
        SelectedProduct     Watchlist
        TimeframeIndex      int
        SelectedTimeframe   Timeframe
    }{
        Exchanges:          exchanges,
        SelectedExchange:   selectedExchange,
        SelectedIndex:      selectedIndex,
        ProductIndex:       productIndex,
        SelectedProduct:    selectedProduct,
        TimeframeIndex:     timeframeIndex, 
        SelectedTimeframe:  selectedTimeframe,   
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




// Structs (temporary)
type Exchange struct {
  ID          int
  Name        string
  Timeframes  []Timeframe
  Orders      []Order
  Fills       []Fill
  Watchlist   []Watchlist
}
type Asset struct {
  ID        int 
  Name      string
  XchID     int
  TF        Timeframe
  //Candles   []Candle

}
type Watchlist struct {
ID                  int     `db:"id"`
Product             string  `db:"product"`
XchID               int     `db:"xch_id"`
}
 
 type Order struct {
 Timestamp           int64  `db:"time"`
 OrderID             string `db:"orderid"`  // Exchange specific order identifier
 ProductID           string `db:"productid"` // xbt_usd_15
 TradeType           string `db:"tradetype"` // Long / Short
 Side                string `db:"side"` // buy / sell
 XchID               int    `db:"xch_id"`
 MarketCategory      string `db:"marketcategory"` // (crypto / equities)_(spot / futures)
 Price               string `db:"price"` // instrument_currency
 Size                string `db:"size"` // How many of instrument
 }

type Timeframe struct {
ID                  int     `db:"id"`
XchID               int     `db:"xch_id"`
TF                  string  `db:"label"`
Endpoint            string  `db:"endpoint"`
Minutes             int     `db:"minutes"`
}

type Fill struct {
Timestamp       int     `db:"time"`
EntryID         string  `db:"entryid"`
TradeID         string  `db:"tradeid"`
OrderID         string  `db:"orderid"`
TradeType       string  `db:"tradetype"`
Price           string  `db:"price"`
Size            string  `db:"size"`
Side            string  `db:"side"`
Commission      string  `db:"commission"`
ProductID       string  `db:"productid"`
XchID           int     `db:"xch_id"`
MarketCategory  string  `db:"marketcategory"`
}


