package api

import (
	"encoding/json"
	"fmt"
	"hm_client/model"
	"io"
	"net/http"
)

const horizonBaseURL = "https://horizon.stellar.org"

func GetAccountDetails(accountID string) (model.HorizonAccount, error) {
	var account model.HorizonAccount

	url := fmt.Sprintf("%s/accounts/%s", horizonBaseURL, accountID)

	resp, err := http.Get(url)
	if err != nil {
		return account, fmt.Errorf("error fetching account details: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return account, fmt.Errorf("horizon API returned non-200 status for account details: %d %s", resp.StatusCode, string(body))
	}

	if err := json.NewDecoder(resp.Body).Decode(&account); err != nil {
		return account, fmt.Errorf("error decoding account details JSON: %w", err)
	}

	return account, nil
}

func GetTrades(accountID string) (model.HorizonTradeResponse, error) {
	var tradeResponse model.HorizonTradeResponse
	url := fmt.Sprintf("%s/accounts/%s/trades?limit=20&order=desc", horizonBaseURL, accountID)

	resp, err := http.Get(url)
	if err != nil {
		return tradeResponse, fmt.Errorf("error fetching tradeResponse details: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return tradeResponse, fmt.Errorf("horizon API returned non-200 status for trades details: %d %s", resp.StatusCode, string(body))
	}

	if err := json.NewDecoder(resp.Body).Decode(&tradeResponse); err != nil {
		return tradeResponse, fmt.Errorf("error decoding trades details JSON: %w", err)
	}

	return tradeResponse, nil
}

func GetOffers(accountID string) (model.HorizonOfferResponse, error) {
	var offerResponse model.HorizonOfferResponse
	url := fmt.Sprintf("%s/accounts/%s/offers?limit=20&order=desc", horizonBaseURL, accountID)

	resp, err := http.Get(url)
	if err != nil {
		return offerResponse, fmt.Errorf("error fetching offer details: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return offerResponse, fmt.Errorf("horizon API returned non-200 status for trades details: %d %s", resp.StatusCode, string(body))
	}

	if err := json.NewDecoder(resp.Body).Decode(&offerResponse); err != nil {
		return offerResponse, fmt.Errorf("error decoding offer details JSON: %w", err)
	}

	return offerResponse, nil
}

func GetPayments(accountID string) (model.HorizonPaymentResponse, error) {
	var paymentResponse model.HorizonPaymentResponse
	url := fmt.Sprintf("%s/accounts/%s/payments?limit=20&order=desc", horizonBaseURL, accountID)

	resp, err := http.Get(url)
	if err != nil {
		return paymentResponse, fmt.Errorf("error fetching payment details: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return paymentResponse, fmt.Errorf("horizon API returned non-200 status for trades details: %d %s", resp.StatusCode, string(body))
	}

	if err := json.NewDecoder(resp.Body).Decode(&paymentResponse); err != nil {
		return paymentResponse, fmt.Errorf("error decoding payment details JSON: %w", err)
	}

	return paymentResponse, nil
}
