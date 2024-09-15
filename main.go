package main

import (
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
  "html/template"
  "encoding/json"
	"os"
	"github.com/joho/godotenv"
  "hm_client/api"
)

func main() {
	
	fmt.Println("main")

  http.HandleFunc("/", homeHandler)
  http.HandleFunc("/finance", financeHandler)

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
    http.Error(w, "Error parsing template", http.StatusInternalServerError)
  }

	err = godotenv.Load()


	url := os.Getenv("URL")

  exchangeData, err := api.GetExchanges(url)
  if err != nil {
    http.Error(w, "Error fetching exchange data:"+err.Error(), http.StatusInternalServerError)
    return
  }
  var exchanges []Exchange
  err = json.Unmarshal(exchangeData, &exchanges)
  if err != nil {
    http.Error(w, "Error parsing exchange data: "+err.Error(), http.StatusInternalServerError)
    return
  }
  fmt.Println(exchanges)

  err = tmpl.Execute(w, exchanges)
  if err != nil {
    http.Error(w, "Error executing temlate", http.StatusInternalServerError)
  }
}

type Exchange struct {
  ID          int
  Name        string
  Timeframes  []Timeframe
  Orders      []Order
  Fills       []Fill
  Watchlist   []Watchlist
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


