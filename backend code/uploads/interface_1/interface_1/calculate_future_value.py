import json
from typing import Any, Dict
from tau_bench.envs.tool import Tool

class CalculateFutureValue(Tool):
    @staticmethod
    def invoke(data: Dict[str, Any], closing_price_or_nav: float, growth_rate: float, 
               number_of_years: int) -> str:
        
        # Validate inputs
        if closing_price_or_nav <= 0:
            return json.dumps({"success": False, "message": "Closing price or NAV must be positive", "halt": True})
        
        if number_of_years < 0:
            return json.dumps({"success": False, "message": "Number of years must be non-negative", "halt": True})
        
        # Calculate future value using formula: FV = PV * (1 + r)^n
        future_value = round(closing_price_or_nav * ((1 + growth_rate) ** number_of_years), 4)
        
        return json.dumps({"future_value": future_value})

    @staticmethod
    def get_info() -> Dict[str, Any]:
        return {
            "type": "function",
            "function": {
                "name": "calculate_future_value",
                "description": "Calculate future value using compound interest formula",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "closing_price_or_nav": {"type": "number", "description": "Closing price of fund or instrument or NAV"},
                        "growth_rate": {"type": "number", "description": "Growth rate 'r'"},
                        "number_of_years": {"type": "integer", "description": "Number of years 'n'"}
                    },
                    "required": ["closing_price_or_nav", "growth_rate", "number_of_years"]
                }
            }
        }
