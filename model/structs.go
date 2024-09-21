package model


type Candle struct {
  Timestamp   int64
  Open   float64
  High   float64
  Low    float64
  Close  float64
  Volume float64
}

type Exchange struct {
  ID          int
  Name        string
  Timeframes  []Timeframe
  Orders      []Order
  Fills       []Fill
  Watchlist   []Watchlist
}

// Structs (temporary)
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
