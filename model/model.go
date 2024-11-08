package model

// Structs (temporary)
type Candle struct {
	Timestamp int64
	Open      float64
	High      float64
	Low       float64
	Close     float64
	Volume    float64
}

type Timeframe struct {
	ID       int64  `db:"id"`
	XchID    int64  `db:"xch_id"`
	TF       string `db:"label"`
	Endpoint string `db:"endpoint"`
	Minutes  int64  `db:"minutes"`
}

type Exchange struct {
	ID                int
	Name              string
	Timeframes        []Timeframe
	Orders            []Order
	Fills             []Fill
	Watchlist         []Product
	CandleLimit       int64
	AvailableProducts []Product
}

type Product struct {
	ID                int    `json:"id"`
	XchID             int    `json:"xch_id"`
	ProductID         string `json:"product_id"`
	BaseName          string `json:"base_name"`
	QuoteName         string `json:"quote_name"`
	Status            string `json:"status"`
	Price             string `json:"price"`
	Volume_24h        string `json:"volume_24h"`
	Base_Currency_ID  string `json:"base_currency_id"`
	Quote_Currency_ID string `json:"quote_currency_id"`
}

type Asset struct {
	Symbol           Product
	AvailableBalance Balance
	Hold             Balance
	Value            float64
}

type Balance struct {
	Value    string `json:"value"`
	Currency string `json:"currency"`
}

type Watchlist struct {
	ID      int    `db:"id"`
	Product string `db:"product"`
	XchID   int    `db:"xch_id"`
}

type Order struct {
	Timestamp      int64  `db:"time"`
	OrderID        string `db:"orderid"`   // Exchange specific order identifier
	ProductID      string `db:"productid"` // xbt_usd_15
	TradeType      string `db:"tradetype"` // Long / Short
	Side           string `db:"side"`      // buy / sell
	XchID          int    `db:"xch_id"`
	MarketCategory string `db:"marketcategory"` // (crypto / equities)_(spot / futures)
	Price          string `db:"price"`          // instrument_currency
	Size           string `db:"size"`           // How many of instrument
	Status         string `db:"status"`
}

type Fill struct {
	Timestamp      int    `db:"time"`
	EntryID        string `db:"entryid"`
	TradeID        string `db:"tradeid"`
	OrderID        string `db:"orderid"`
	TradeType      string `db:"tradetype"`
	Price          string `db:"price"`
	Size           string `db:"size"`
	Side           string `db:"side"`
	Commission     string `db:"commission"`
	ProductID      string `db:"productid"`
	XchID          int    `db:"xch_id"`
	MarketCategory string `db:"marketcategory"`
}
