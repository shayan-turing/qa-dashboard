import json
from typing import Any, Dict, List
from tau_bench.envs.tool import Tool

class AddNewTradeForFund(Tool):
    @staticmethod
    def invoke(data: Dict[str, Any], fund_id: str, instrument_id: str,
               quantity: float, price: float, side: str, status: str = "pending",
               validate_positions: bool = True) -> str:
        """
        Add a new trade for investment execution with comprehensive validation.
        
        CORRECTED Investment Structure (based on actual DB schema):
        Investors → Portfolios → Portfolio Holdings (fund shares) → Funds → Trades (instruments)
        
        Key relationships:
        - Investors have portfolios
        - Portfolio holdings contain fund shares (not individual instruments)
        - Funds execute trades in instruments
        - Each trade affects the fund's NAV, which affects all investors proportionally
        
        Args:
            data: Main data dictionary
            fund_id: ID of the fund making the trade
            instrument_id: ID of the instrument to trade
            quantity: Trade quantity (must be positive)
            price: Trade price per unit (must be positive)
            side: 'buy' (purchase) or 'sell' (dispose)
            status: Trade status (defaults to 'pending')
            validate_positions: Whether to validate fund capacity and investor impacts
        """
        
        def generate_id(table: Dict[str, Any]) -> int:
            if not table:
                return 1
            return max(int(k) for k in table.keys()) + 1
        
        def get_fund_investors_via_holdings(fund_id: str) -> List[Dict[str, Any]]:
            """Get all investors who have portfolio holdings in this fund"""
            portfolio_holdings = data.get("portfolio_holdings", {})
            portfolios = data.get("portfolios", {})
            investors = data.get("investors", {})
            fund_investors = []
            
            for holding in portfolio_holdings.values():
                if str(holding.get("fund_id")) == str(fund_id):
                    portfolio_id = holding.get("portfolio_id")
                    # Find the portfolio owner (investor)
                    for portfolio in portfolios.values():
                        if str(portfolio.get("portfolio_id")) == str(portfolio_id):
                            investor_id = portfolio.get("investor_id")
                            if str(investor_id) in investors:
                                investor_info = investors[str(investor_id)].copy()
                                investor_info["portfolio_id"] = portfolio_id
                                investor_info["holding_quantity"] = holding.get("quantity", 0)  # Fund shares
                                investor_info["cost_basis"] = holding.get("cost_basis", 0)
                                fund_investors.append(investor_info)
                            break
            
            return fund_investors
        
        def get_fund_current_nav(fund_id: str) -> float:
            """Get the most recent NAV for the fund"""
            nav_records = data.get("nav_records", {})
            latest_nav = 0.0
            latest_date = None
            
            for nav_record in nav_records.values():
                if str(nav_record.get("fund_id")) == str(fund_id):
                    nav_date = nav_record.get("nav_date")
                    if latest_date is None or nav_date > latest_date:
                        latest_date = nav_date
                        latest_nav = nav_record.get("nav_value", 0.0)
            
            return latest_nav
        
        def get_fund_cash_balance(fund_id: str) -> float:
            """Get available cash balance for a fund"""
            # In real implementation, this would come from fund's cash position
            # For now, estimate from fund size minus current positions
            fund_record = data.get("funds", {}).get(str(fund_id), {})
            fund_size = fund_record.get("size", 0.0)
            
            # Rough estimate: assume some percentage is cash
            # In practice, you'd track actual cash positions
            return fund_size * 0.1  # Assume 10% cash buffer
        
        def get_fund_instrument_position(fund_id: str, instrument_id: str) -> float:
            """Get current position quantity for a fund's instrument from executed trades"""
            trades = data.get("trades", {})
            net_position = 0.0
            
            for trade in trades.values():
                if (str(trade.get("fund_id")) == str(fund_id) and 
                    str(trade.get("instrument_id")) == str(instrument_id) and
                    trade.get("status") == "executed"):
                    
                    quantity = trade.get("quantity", 0.0)
                    if trade.get("side") == "buy":
                        net_position += quantity
                    elif trade.get("side") == "sell":
                        net_position -= quantity
            
            return net_position
        
        def check_investor_impact_warnings(fund_investors: List[Dict], trade_value: float, fund_nav: float) -> List[str]:
            """Check if trade creates warnings for any investors"""
            warnings = []
            
            if fund_nav <= 0:
                warnings.append("Fund NAV is zero or negative - cannot assess investor impact")
                return warnings
            
            trade_impact_percentage = abs(trade_value) / fund_nav
            
            for investor in fund_investors:
                # Check investor status
                if investor.get("status") == "offboarded":
                    warnings.append(f"Investor {investor.get('investor_id')} is offboarded but still has holdings")
                
                # Check accreditation for large trades
                if (investor.get("accreditation_status") == "non_accredited" and 
                    trade_impact_percentage > 0.05):  # 5% threshold
                    warnings.append(f"Large trade may require disclosure to non-accredited investor {investor.get('investor_id')}")
                
                # Check if investor has pending subscriptions/redemptions
                subscriptions = data.get("subscriptions", {})
                redemptions = data.get("redemptions", {})
                
                pending_sub = any(
                    sub.get("investor_id") == investor.get("investor_id") and 
                    sub.get("fund_id") == fund_id and 
                    sub.get("status") == "pending"
                    for sub in subscriptions.values()
                )
                
                pending_red = any(
                    red.get("status") == "pending" and
                    subscriptions.get(str(red.get("subscription_id", "")), {}).get("investor_id") == investor.get("investor_id")
                    for red in redemptions.values()
                )
                
                if pending_sub or pending_red:
                    warnings.append(f"Investor {investor.get('investor_id')} has pending transactions that may be affected")
            
            return warnings
        
        # Validate inputs
        if quantity <= 0:
            raise ValueError("Quantity must be positive")
        
        if price <= 0:
            raise ValueError("Price must be positive")
        
        funds = data.get("funds", {})
        instruments = data.get("instruments", {})
        trades = data.get("trades", {})
        
        # Validate fund exists and is open
        if str(fund_id) not in funds:
            raise ValueError(f"Fund {fund_id} not found")
        
        fund_record = funds[str(fund_id)]
        if fund_record.get("status") != "open":
            raise ValueError(f"Fund {fund_id} is not open for trading (status: {fund_record.get('status')})")
        
        # Validate instrument exists and is active
        if str(instrument_id) not in instruments:
            raise ValueError(f"Instrument {instrument_id} not found")
        
        instrument_record = instruments[str(instrument_id)]
        if instrument_record.get("status") != "active":
            raise ValueError(f"Instrument {instrument_id} is not active (status: {instrument_record.get('status')})")
        
        # Validate side and status
        valid_sides = ["buy", "sell"]
        if side not in valid_sides:
            raise ValueError(f"Invalid side '{side}'. Must be one of {valid_sides}")
        
        valid_statuses = ["approved", "executed", "pending", "failed"]
        if status not in valid_statuses:
            raise ValueError(f"Invalid status '{status}'. Must be one of {valid_statuses}")
        
        # Get fund's investors through portfolio holdings
        fund_investors = get_fund_investors_via_holdings(fund_id)
        if not fund_investors:
            raise ValueError(f"No investors found with holdings in fund {fund_id}. Cannot execute trades for fund without investors.")
        
        trade_value = quantity * price
        warnings = []
        
        # Enhanced validation including investor impact
        if validate_positions:
            current_position = get_fund_instrument_position(fund_id, instrument_id)
            fund_nav = get_fund_current_nav(fund_id)
            
            if side == "buy":
                # Check cash availability
                cash_balance = get_fund_cash_balance(fund_id)
                if trade_value > cash_balance:
                    raise ValueError(
                        f"Insufficient fund cash for purchase. "
                        f"Required: ${trade_value:,.2f}, Available: ${cash_balance:,.2f}"
                    )
                
                # Check if this trade significantly changes fund composition
                if fund_nav > 0 and trade_value > fund_nav * 0.1:  # More than 10% of fund
                    warnings.append(
                        f"Large purchase ({trade_value/fund_nav:.1%} of fund NAV) may require investor notification"
                    )
            
            elif side == "sell":
                if quantity > current_position:
                    if current_position > 0:
                        short_quantity = quantity - current_position
                        warnings.append(
                            f"Partial short sale: selling {short_quantity} shares beyond "
                            f"current position of {current_position}"
                        )
                    else:
                        warnings.append(f"Pure short sale of {quantity} shares")
                        # You might want to check if short selling is allowed
                
                # Check if this significantly reduces a major holding
                if current_position > 0 and quantity >= current_position * 0.5:
                    percentage_sold = (quantity / current_position) * 100
                    warnings.append(
                        f"Selling {percentage_sold:.1f}% of {instrument_record.get('ticker', instrument_id)} "
                        f"position may trigger portfolio rebalancing"
                    )
            
            # Check investor-specific impact warnings
            investor_warnings = check_investor_impact_warnings(fund_investors, trade_value, fund_nav)
            warnings.extend(investor_warnings)
        
        # Generate trade
        trade_id = generate_id(trades)
        timestamp = "2025-10-01T00:00:00"  # In real system, use current timestamp
        
        new_trade = {
            "trade_id": str(trade_id),
            "fund_id": str(fund_id),
            "instrument_id": int(instrument_id), 
            "trade_date": timestamp,
            "quantity": quantity,
            "price": price,
            "side": side,
            "status": status,
            "created_at": timestamp
        }
        
        trades[str(trade_id)] = new_trade
        
        result = {
            "trade_id": trade_id,
            "status": "created",
            "trade_value": trade_value,
            "affected_investors": len(fund_investors),
            "fund_status": fund_record.get("status"),
            "instrument_ticker": instrument_record.get("ticker", "N/A"),
            "message": f"Trade created: {side.upper()} {quantity} shares of {instrument_record.get('ticker', instrument_id)} at ${price:.2f}",
        }
        
        if warnings:
            result["warnings"] = warnings
        
        return json.dumps(result)

    @staticmethod
    def get_info() -> Dict[str, Any]:
        return {
            "type": "function",
            "function": {
                "name": "add_new_trade_for_fund",
                "description": "Add a new trade for fund-level investment execution. Validates fund is open, instrument is active, sufficient cash for buys, and assesses impact on all fund investors through their portfolio holdings.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "fund_id": {"type": "string", "description": "ID of the fund making the trade (must be open status)"},
                        "instrument_id": {"type": "string", "description": "ID of the instrument to trade (must be active)"},
                        "quantity": {"type": "number", "description": "Trade quantity (must be positive)"},
                        "price": {"type": "number", "description": "Trade price per unit (must be positive)"},
                        "side": {
                            "type": "string", 
                            "description": "Trade side: 'buy' (purchase) or 'sell' (dispose/short)",
                            "enum": ["buy", "sell"]
                        },
                        "status": {
                            "type": "string", 
                            "description": "Trade status (defaults to 'pending')",
                            "enum": ["approved", "executed", "pending", "failed"]
                        },
                        "validate_positions": {
                            "type": "boolean",
                            "description": "Whether to validate fund positions, cash, and investor impacts (default: true)"
                        }
                    },
                    "required": ["fund_id", "instrument_id", "quantity", "price", "side"]
                }
            }
        }