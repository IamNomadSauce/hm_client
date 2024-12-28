package model

import "time"

type Alert struct {
	ID        int     `json:"id"`
	ProductID string  `json:"product_id"`
	Type      string  `json:"type"`
	Price     float64 `json:"price"`
	Status    string  `json:"status"`
	XchID     int     `json:"xch_id"`
	CreatedAt string  `json:"created_at"`
	UpdatedAt string  `json:"updated_at"`
}

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
	Alerts            []Alert
	Name              string
	Timeframes        []Timeframe
	Orders            []Order
	Fills             []Fill
	Watchlist         []Product
	CandleLimit       int64
	AvailableProducts []Product
	Portfolio         []Asset
	Trades            []Trade
}

type Product struct {
	ID                int    `json:"id"`
	XchID             int    `json:"xch_id"`
	ProductID         string `json:"product_id"`
	BaseName          string `json:"base_name"`
	QuoteName         string `json:"quote_name"`
	Status            string `json:"status"`
	Price             string `json:"price"`
	Volume_24h        string `json:"volume_24"`
	Base_Currency_ID  string `json:"base_currency_id"`
	Quote_Currency_ID string `json:"quote_currency_id"`
}

type Asset struct {
	ID               int     `json:"id"`
	Balance          float64 `json:"balance"`
	Asset            string  `json:"asset"`
	AvailableBalance Balance `json:"available_balance"`
	Hold             Balance `json:"hold_balance`
	Value            float64 `json:"value`
	XchID            int     `json:"xch_id"`
}

type Balance struct {
	Value    string `json:"value"`
	Currency string `json:"currency"`
}

type Watchlist struct {
	ID      int     `db:"id"`
	Product Product `db:"product"`
	XchID   int     `db:"xch_id"`
}

type Order struct {
	Timestamp      string  `db:"time"`
	OrderID        string  `db:"orderid"`   // Exchange specific order identifier
	ProductID      string  `db:"productid"` // xbt_usd_15
	TradeType      string  `db:"tradetype"` // Long / Short
	Side           string  `db:"side"`      // buy / sell
	XchID          int     `db:"xch_id"`
	MarketCategory string  `db:"marketcategory"` // (crypto / equities)_(spot / futures)
	Price          float64 `db:"price"`          // instrument_currency
	Size           float64 `db:"size"`           // How many of instrument
	Status         string  `db:"status"`
}

type Fill struct {
	EntryID        string  `db:"entry_id" json:"entryid"`
	TradeID        string  `db:"trade_id" json:"tradeid"`
	OrderID        string  `db:"order_id" json:"orderid"`
	Timestamp      string  `db:"time" json:"time"`
	TradeType      string  `db:"trade_type" json:"tradetype"`
	Price          float64 `db:"price" json:"price,omitempty"`
	Size           float64 `db:"size" json:"size,string,omitempty"`
	Side           string  `db:"side" json:"side"`
	Commission     float64 `db:"commission" json:"commission,string,omitempty"`
	ProductID      string  `db:"product_id" json:"product_id"`
	XchID          int     `db:"xch_id" json:"xch_id"`
	MarketCategory string  `db:"market_category" json:"marketcategory"`
}

type Trade struct {
	ID           int       `json:"id"`
	GroupID      string    `json:"group_id"`
	ProductID    string    `json:"product_id"`
	Side         string    `json:"side"`
	StopPrice    float64   `json:"stop_price"`
	EntryPrice   float64   `json:"entry_price"`
	PTPrice      float64   `json:"pt_price"`
	Size         float64   `json:"size"`
	StopOrderID  string    `json:"stop_order_id"`
	EntryOrderID string    `json:"entry_order_id"`
	PTOrderID    string    `json:"pt_order_id"`
	StopStatus   string    `json:"stop_status"`
	EntryStatus  string    `json:"entry_status"`
	PTStatus     string    `json:"pt_status"`
	PTAmount     int       `json:"pt_amount"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	XchID        int       `json:"xch_id"`
}

type TradeBlock struct {
	ProductID     string    `json:"product_id"`
	GroupID       string    `json:"group_id"`
	Side          string    `json:"side"`
	Size          float64   `json:"size"`
	EntryPrice    float64   `json:"entry_price"`
	StopPrice     float64   `json:"stop_price"`
	ProfitTargets []float64 `json:"profit_targets"`
	RiskReward    float64   `json:"risk_reward"`
	XchID         int       `json:"xch_id"`
}
