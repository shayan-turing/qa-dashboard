import json
from typing import Any, Dict
from tau_bench.envs.tool import Tool

class ComputeNav(Tool):
    @staticmethod
    def invoke(data: Dict[str, Any], fund_id: str, calculation_date: str) -> str:
        
        def generate_id(table: Dict[str, Any]) -> int:
            if not table:
                return 1
            return max(int(k) for k in table.keys()) + 1
        
        funds = data.get("funds", {})
        nav_records = data.get("nav_records", {})
        trades = data.get("trades", {})
        instrument_prices = data.get("instrument_prices", {})
        
        # Validate fund exists
        if str(fund_id) not in funds:
            return json.dumps({"success": False, "message": "Fund not found", "halt": True})
        
        fund = funds[str(fund_id)]
        
        # Calculate NAV based on fund size and recent trades
        base_nav = float(fund.get("size", 1000000))  # Use fund size as base
        
        # Adjust based on recent trades for this fund
        trade_adjustments = 0
        for trade in trades.values():
            if trade.get("fund_id") == fund_id and trade.get("status") == "executed":
                trade_value = float(trade.get("quantity", 0)) * float(trade.get("price", 0))
                if trade.get("side") == "buy":
                    trade_adjustments += trade_value
                else:
                    trade_adjustments -= trade_value
        
        # Simple NAV calculation: base + 5% growth + trade adjustments
        nav_value = round(base_nav * 1.05 + trade_adjustments, 4)
        
        # Create or update NAV record
        nav_id = generate_id(nav_records)
        timestamp = "2025-10-01T00:00:00"
        
        new_nav_record = {
            "nav_id": str(nav_id),
            "fund_id": str(fund_id),
            "nav_date": calculation_date,
            "nav_value": nav_value,
            "updated_at": timestamp
        }
        
        nav_records[str(nav_id)] = new_nav_record
        
        return json.dumps({"new_nav_record": new_nav_record, "success": True, "message": "NAV updated"})

    @staticmethod
    def get_info() -> Dict[str, Any]:
        return {
            "type": "function",
            "function": {
                "name": "compute_nav",
                "description": "Calculate and update the Net Asset Value 'NAV' for a fund",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "fund_id": {"type": "string", "description": "ID of the fund"},
                        "calculation_date": {"type": "string", "description": "Date for NAV calculation"}
                    },
                    "required": ["fund_id", "calculation_date"]
                }
            }
        }
