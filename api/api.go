package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"hm_client/model"
	"io/ioutil"
	"log"
	"net/http"
	"net/url"
	"os"

	"github.com/joho/godotenv"
)

func GetExchanges(url string) ([]model.Exchange, error) {
	fmt.Println("\n------------------------------------\n API:GetExchanges \n------------------------------------\n ")
	url = url + "/exchanges"
	resp, err := http.Get(url)
	if err != nil {
		return nil, fmt.Errorf("Error retrieving URL: %v", err)
	}

	defer resp.Body.Close()

	raw_exchanges, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("Error reading response: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Status Code: %d, raw_exchanges: %s", resp.StatusCode, string(raw_exchanges))
	}

	var exchanges []model.Exchange
	err = json.Unmarshal(raw_exchanges, &exchanges)
	if err != nil {
		fmt.Errorf("Error unmarshalling Exchanges %v", err)
		return nil, err
	}

	for exchange := range exchanges {
		fmt.Println("\n----------------------------\n")
		fmt.Println(exchanges[exchange].Name)
		// fmt.Println(exchanges[exchange].Watchlist)
		// fmt.Println(exchanges[exchange].Timeframes)
		// fmt.Println("Available Products", exchanges[exchange].AvailableProducts)
		portfolio := exchanges[exchange].Portfolio
		for _, asset := range portfolio {
			fmt.Println(asset.Asset)
			fmt.Println(asset.Value)
		}
		fmt.Println("\n----------------------------\n")
	}
	// fmt.Println("Exchanges", exchanges)

	return exchanges, nil
}

func CreateTrigger(baseURL string, trigger model.Trigger) error {
	log.Printf("API:CreateTrigger\n%+v", trigger)
	url := baseURL + "/create-trigger"

	jsonData, err := json.Marshal(trigger)
	if err != nil {
		return fmt.Errorf("Error marshaling request payload: %v", err)
	}
	log.Printf("Sending payload: %s", string(jsonData))

	req, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("Error creating request: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("Error sending request: %v", err)
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("Error reading response body: %v", err)
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("Unexpected status Code: %d, response: %s", resp.StatusCode, string(body))
	}

	return nil
}

func DeleteTrigger(baseURL string, triggerID int) error {
	log.Printf("API:DeleteTrigger ID: %d", triggerID)
	url := baseURL + "/delete-trigger"

	// Create the request payload
	payload := struct {
		TriggerID int `json:"trigger"`
	}{
		TriggerID: triggerID,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("error marshaling request payload: %v", err)
	}
	log.Printf("Sending payload: %s", string(jsonData))

	req, err := http.NewRequest(http.MethodDelete, url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("error creating request: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("error sending request: %v", err)
	}
	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("error reading response body: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status code: %d, response: %s", resp.StatusCode, string(body))
	}

	return nil
}

func CreateTradeGroup(baseURL string, order model.TradeBlock) error {
	log.Printf("API:CreateTradeGroup\n%+v", order)
	url := baseURL + "/new_trade_group"

	jsonData, err := json.Marshal(order)
	if err != nil {
		return fmt.Errorf("Error marshaling request payload: %v", err)
	}
	log.Printf("Sending payload: %s", string(jsonData))

	req, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("Error creating request: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("Error sending request: %v", err)
	}

	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("Error reading response body: %v", err)
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("Unexpected status code: %d, response: %s", resp.StatusCode, string(body))
	}

	return nil
}

func AddToWatchlist(baseURL string, exchangeID int, productID string) error {
	log.Printf("API:AddToWatchlist\n%s\n%s", exchangeID, productID)
	url := baseURL + "/add-to-watchlist"

	// Create the request payload
	payload := struct {
		ExchangeID int    `json:"xch_id"`
		ProductID  string `json:"product_id"`
	}{
		ExchangeID: exchangeID,
		ProductID:  productID,
	}

	// Marshal the payload to JSON
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("error marshaling request payload: %v", err)
	}
	log.Printf("Sending payload: %s", string(jsonData))

	// Create a new PUT request
	req, err := http.NewRequest(http.MethodPut, url, bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("error creating request: %v", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")

	// Create HTTP client and send request
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("error sending request: %v", err)
	}
	defer resp.Body.Close()

	// Read response body
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("error reading response body: %v", err)
	}

	// Check response status
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("unexpected status code: %d, response: %s", resp.StatusCode, string(body))
	}

	return nil
}

func GetCandles(product, timeframe, exchange string) ([]model.Candle, error) {
	// fmt.Println("Get Candles", product, timeframe, exchange)
	err := godotenv.Load()
	if err != nil {
		log.Println("Error loading .env file:", err)
		// Decide whether to return or continue based on your requirements
	}

	baseurl := os.Getenv("URL")

	u, err := url.Parse(baseurl)
	if err != nil {
		return nil, fmt.Errorf("Error parsing base url request: %v", err)
	}

	u.Path = "/candles"
	q := u.Query()
	q.Set("product", product)
	q.Set("timeframe", timeframe)
	q.Set("exchange", exchange)
	u.RawQuery = q.Encode()

	// fmt.Println("Request URL:", u.String())
	resp, err := http.Get(u.String())
	if err != nil {
		return nil, fmt.Errorf("Error retrieving URL: %v", err)
	}

	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("Error reading response: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Status Code: %d, Body: %s", resp.StatusCode, string(body))
	}

	var candles []model.Candle
	err = json.Unmarshal(body, &candles)

	if err != nil {
		return nil, fmt.Errorf("Error unmarshalling JSON: %v", err)
	}

	// fmt.Println("\n-------------------------------------\n", candles)

	reverseCandles(candles)

	return candles, nil
}

func reverseCandles(candles []model.Candle) {
	for i, j := 0, len(candles)-1; i < j; i, j = i+1, j-1 {
		candles[i], candles[j] = candles[j], candles[i]
	}
}
