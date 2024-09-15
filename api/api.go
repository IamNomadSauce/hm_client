package api

import (
  "net/http"
  "io/ioutil"
  "fmt"
)

func GetExchanges(url string) ([]byte, error) {
  url = url + "/exchanges"
  resp, err := http.Get(url)
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

  return body, nil
  
}
