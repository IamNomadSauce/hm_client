package api

import (
  "net/http"
  "net/url"
  "encoding/json"
  "hm_client/model"
  "io/ioutil"
  "fmt"
  "os"
  "github.com/joho/godotenv"
  "log"
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

  fmt.Println("Exchanges", exchanges)

  return exchanges, nil
}

func GetCandles(product, timeframe, exchange string) ([]model.Candle, error) {
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

    fmt.Println("Request URL:", u.String())
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

    reverseCandles(candles)

    return candles, nil
}

func reverseCandles(candles []model.Candle) {
    for i, j := 0, len(candles)-1; i < j; i, j = i+1, j-1 {
        candles[i], candles[j] = candles[j], candles[i]
    }
}




