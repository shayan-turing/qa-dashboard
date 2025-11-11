import json
from typing import Any, Dict
from tau_bench.envs.tool import Tool

class CreateFund(Tool):
    @staticmethod
    def invoke(data: Dict[str, Any], fund_name: str, fund_type: str,
               initial_size: float, manager_id: str, 
               compliance_officer_review: bool, fund_manager_approval: bool) -> str:

        def generate_id(table: Dict[str, Any]) -> int:
            if not table:
                return 1
            return max(int(k) for k in table.keys()) + 1
        
        if not compliance_officer_review:
            return json.dumps({"error": "Compliance Officer review required. Process halted."})
        
        if not fund_manager_approval:
            return json.dumps({"error": "Fund Manager approval required. Process halted."})
        
        funds = data.get("funds", {})
        users = data.get("users", {})
        
        # Validate manager exists
        if str(manager_id) not in users:
            return json.dumps({"error": f"Manager {manager_id} not found"})
        
        # Validate fund type
        valid_types = ["mutual_funds", "exchange_traded_funds", "pension_funds", "private_equity_funds",
                      "hedge_funds", "sovereign_wealth_funds", "money_market_funds", 
                      "real_estate_investment_trusts", "infrastructure_funds", "multi_asset_funds"]
        if fund_type not in valid_types:
            return json.dumps({"error": f"Invalid fund type. Must be one of {valid_types}"})
        
        fund_id = generate_id(funds)
        timestamp = "2025-10-01T00:00:00"
        
        new_fund = {
            "fund_id": str(fund_id),
            "name": fund_name,
            "fund_type": fund_type,
            "manager_id": int(manager_id),
            "size": initial_size,
            "status": "open", # status can be open, closed, or suspended
            "created_at": timestamp,
            "updated_at": timestamp
        }
        
        funds[str(fund_id)] = new_fund
        return json.dumps({"fund_id": str(fund_id)})

    @staticmethod
    def get_info() -> Dict[str, Any]:
        return {
            "type": "function",
            "function": {
                "name": "create_fund",
                "description": "Create a new fund after approvals",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "fund_name": {"type": "string", "description": "Name of the fund"},
                        "fund_type": {"type": "string", "description": "Type of fund. Must be one of: 'mutual_funds', 'exchange_traded_funds', 'pension_funds', 'private_equity_funds', 'hedge_funds', 'sovereign_wealth_funds', 'money_market_funds', 'real_estate_investment_trusts', 'infrastructure_funds', 'multi_asset_funds'"},
                        "initial_size": {"type": "number", "description": "Initial size of the fund"},
                        "manager_id": {"type": "string", "description": "ID of the fund manager"},
                        "compliance_officer_review": {"type": "boolean", "description": "Compliance Officer review flag (True/False)"},
                        "fund_manager_approval": {"type": "boolean", "description": "Fund Manager approval flag (True/False)"}
                    },
                    "required": ["fund_name", "fund_type", "initial_size", "manager_id", 
                            "compliance_officer_review", "fund_manager_approval"]
                }
            }
        }
