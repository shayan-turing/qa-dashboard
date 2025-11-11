import json
from typing import Any, Dict
from tau_bench.envs.tool import Tool

class CalculateLiabilities(Tool):
    @staticmethod
    def invoke(data: Dict[str, Any], instrument_id: str) -> str:
        instrument_prices = data.get('instrument_prices', {})
        
        # Find the most recent instrument price record by instrument_id
        instrument_price = None
        latest_date = None
        
        for price_record in instrument_prices.values():
            if str(price_record.get('instrument_id')) == str(instrument_id):
                record_date = price_record.get('price_date')
                if record_date and (latest_date is None or record_date > latest_date):
                    latest_date = record_date
                    instrument_price = price_record
        
        if instrument_price is None:
            return json.dumps({"success": False, "message": "Instrument not found"})
        
        # Get the closing price (note: field name is 'close_price' not 'closing_price')
        closing_price = instrument_price.get('close_price', 0)
        
        # Validate closing price
        if closing_price <= 0:
            return json.dumps({"success": False, "message": "Instrument closing price must be positive"})
        
        # Calculate liabilities as 1.5% of closing price
        liabilities = round(closing_price * 0.015, 4)

        return json.dumps({"success": True, "liabilities": liabilities, "price_date": latest_date})

    @staticmethod
    def get_info() -> Dict[str, Any]:
        return {
            "type": "function",
            "function": {
                "name": "calculate_liabilities",
                "description": "Calculate liabilities as 1.5% of instrument closing price",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "instrument_id": {"type": "string", "description": "ID of the instrument"}
                    },
                    "required": ["instrument_id"]
                }
            }
        }