
[] Trendlines
    - [] Show M2L/M2H
    - [] Step through trendline levels
    - [] Dynamic l2h/l2g updates
        - [] Need to add a range block between l2g/l2h and the trend start of the trendline that gained/lost the level
        - [] add to stack Stack -> update stack of trendlines with trendstate
            - trend (thoughts):
                - m2l = previous low + lh (swing) + new low
                - m2h = previous high + hl (swing) + new high
                - made of subtrends
                    - first trend = trend start
                        - Occurs after m2l is gained
                    - last trend = trend stop
                        - Occurs after m2g is lost
                - (trend states): direction (up/down) - 
                - (level states): Gained - Lost - Tested
                - If l2h/l2g = gained/lost -> tested?
                - f(m2l/m2h) = ((m2l & gained & tested (confirmed = bounce off m2l)) || (m2h & lost & tested (confirmed = reject m2h)))->target stack of untested levels from most recent all the way to trend start
[] add asset from available products on exchange
[x] fix pan and zoom to be more like tradingview's chart
[x] add risk:reward ratio for the trade bracket tool and make the vertical boundrie resizeable
[x] make lines from line tool persist between reloads
[X] replace old trade setup sidebar -> make sleek/slim top bar that shows trade struction and conditional execution
  - [X] fix adding third pt
  - [x] adding triggers to the trade setup
  	- [x] line tool
  	- [x] trigger tool
[x] Fix trigger creation edit/delete issue
[x] Fix issue with trigger being added 
[x] fix alpaca candle retrieval issues
