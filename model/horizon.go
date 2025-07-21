package model

import "time"

type HorizonAccount struct {
	ID         string         `json:"id"`
	AccountID  string         `json:"accountid"`
	Sequence   string         `json:"sequence"`
	Balances   []TokenBalance `json:"balances"`
	Thresholds struct {
		LowThreshold   int `json:"low_threshold"`
		MedThreshold   int `json:"med_threshold"`
		HightThreshold int `json:"high_threshold"`
	} `json:"thresholds"`
	Flags struct {
		AuthRequired  bool `json:"auth_required"`
		AuthRevocable bool `json:"auth_revocable"`
		AuthImmutable bool `json:"auth_immutable"`
	} `json:"flags"`
}

type TokenBalance struct {
	Balance                           string `json:"balance"`
	Limit                             string `json:"limit"`
	AssetType                         string `json:"asset_type"`
	AssetCode                         string `json:"asset_code,omitempty"`
	AssetIssuer                       string `json:"asset_issuer,omitempty"`
	BuyingLiabilities                 string `json:"buying_liabilities,omitempty"`
	SellingLiabilities                string `json:"selling_liabilities,omitempty"`
	SponsoringID                      string `json:"sponsoring_id,omitempty"`
	IsAuthorized                      bool   `json:"is_authorized"`
	IsAuthorizedToMainTainLiabilities bool   `json:"is_authorized_to_maintain_liabilities"`
}

type HorizonTradeResponse struct {
	Embedded struct {
		Records []HorizonTrade `json:"records"`
	} `json:"_embedded"`
}

type HorizonTrade struct {
	ID                 string    `json:"id"`
	PadingToken        string    `json:"pading_token"`
	LedgerCloseTime    time.Time `json:"ledger_close_time"`
	OfferID            string    `json:"offer_id"`
	BaseAccount        string    `json:"base_account"`
	BaseAmount         string    `json:"base_ammount"`
	BaseAssetType      string    `json:"base_asset_type"`
	BaseAssetCode      string    `json:"base_asset_code,omitempty"`
	BaseAssetIssuer    string    `json:"base_asset_issuer,omitempty"`
	CounterAccount     string    `json:"counter_account"`
	CounterAmount      string    `json:"counter_amount,"`
	CounterAssetType   string    `json:"counter_asset_type"`
	CounterAssetCode   string    `json:"counter_asset_code,omitempty"`
	CounterAssetIssuer string    `json:"counter_asset_issuer,omitempty"`
	BaseIsSeller       bool      `json:"base_is_seller"`
}

type HorizonOfferResponse struct {
	Embedded struct {
		Records []Offer `json:"records"`
	} `json:"_embedded"`
}

type Offer struct {
	ID                 string       `json:"id"`
	PagingToken        string       `json:"paging_token"`
	Seller             string       `json:"seller"`
	Selling            HorizonAsset `json:"selling"`
	Buying             HorizonAsset `json:"buying"`
	Amount             string       `json:"amount"`
	PriceR             Price        `json:"price_r"`
	Price              string       `json:"price"`
	LastModifiedLedger int          `json:"last_modified_ledger"`
	LastModifiedTime   time.Time    `json:"last_modified_time"`
}

type HorizonPaymentResponse struct {
	Embedded struct {
		Records []Payment `json:"records"`
	} `json:"_embedded"`
}

type Payment struct {
	ID          string    `json:"id"`
	PagingToken string    `json:"paging_token"`
	Type        string    `json:"type"`
	From        string    `json:"from"`
	To          string    `json:"to"`
	AssetType   string    `json:"asset_type"`
	AssetCode   string    `json:"asset_code"`
	AssetIssuer string    `json:"asset_issuer"`
	Amount      string    `json:"amount"`
	CreatedAt   time.Time `json:"created_at"`
}

type HorizonAsset struct {
	AssetType   string `json:"asset_type"`
	AssetCode   string `json:"asset_code"`
	AssetIssuer string `json:"asset_issuer"`
}

type Price struct {
	N int `json:"n"`
	D int `json:"D"`
}
