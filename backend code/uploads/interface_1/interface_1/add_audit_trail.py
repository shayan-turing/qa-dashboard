import json
from typing import Any, Dict, Optional
from tau_bench.envs.tool import Tool

class AddAuditTrail(Tool):
    @staticmethod
    def invoke(data: Dict[str, Any], reference_id: str, reference_type: str,
               action: str, field_name: Optional[str] = None,
               old_value: Optional[str] = None, new_value: Optional[str] = None) -> str:
        
        def generate_id(table: Dict[str, Any]) -> int:
            if not table:
                return 1
            return max(int(k) for k in table.keys()) + 1
        
        audit_trails = data.get("audit_trails", {})        
        
        # Validate reference_type
        valid_reference_types = [
            "user", "fund", "investor", "subscription", "commitment", "redemption",
            "trade", "portfolio", "holding", "instrument", "invoice", "payment",
            "document", "report", "nav", "notification"
        ]
        if reference_type not in valid_reference_types:
            raise ValueError(f"Invalid reference_type. Must be one of {valid_reference_types}")
        
        # Validate action
        valid_actions = ["create", "update", "delete", "approve", "cancel", "process"]
        if action not in valid_actions:
            raise ValueError(f"Invalid action. Must be one of {valid_actions}")
        
        # Business rule validation
        if action in ["create", "delete"] and field_name is not None:
            raise ValueError(f"field_name should be null for {action} actions")
        
        if action == "create" and old_value is not None:
            raise ValueError("old_value should be null for create actions")
        
        if action == "delete" and new_value is not None:
            raise ValueError("new_value should be null for delete actions")
        
        # Validate that the referenced entity exists based on reference_type
        reference_tables = {
            "user": "users",
            "fund": "funds",
            "investor": "investors",
            "subscription": "subscriptions",
            "commitment": "commitments",
            "redemption": "redemptions",
            "trade": "trades",
            "portfolio": "portfolios",
            "holding": "portfolio_holdings",
            "instrument": "instruments",
            "invoice": "invoices",
            "payment": "payments",
            "document": "documents",
            "report": "reports",
            "nav": "nav_records",
            "notification": "notifications"
        }
        
        reference_table = reference_tables.get(reference_type)
        if reference_table and reference_table in data:
            if str(reference_id) not in data[reference_table]:
                raise ValueError(f"{reference_type.title()} {reference_id} not found")
        
        audit_trail_id = generate_id(audit_trails)
        timestamp = "2025-10-01T00:00:00"
        
        new_audit_trail = {
            "audit_trail_id": str(audit_trail_id),
            "reference_id": reference_id,
            "reference_type": reference_type,
            "action": action,
            "field_name": field_name,
            "old_value": old_value,
            "new_value": new_value,
            "created_at": timestamp
        }
        
        audit_trails[str(audit_trail_id)] = new_audit_trail
        return json.dumps(new_audit_trail)

    @staticmethod
    def get_info() -> Dict[str, Any]:
        return {
            "type": "function",
            "function": {
                "name": "add_audit_trail",
                "description": "Add an audit trail record to track changes made to database records",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "reference_id": {"type": "string", "description": "ID of the record that was changed"},
                        "reference_type": {"type": "string", "description": "Type of record being audited (user, fund, investor, subscription, commitment, redemption, trade, portfolio, holding, instrument, invoice, payment, document, report, nav, notification)"},
                        "action": {"type": "string", "description": "Action performed (create, update, delete, approve, cancel, process)"},
                        "field_name": {"type": "string", "description": "Name of the field that was changed (null for create/delete actions)"},
                        "old_value": {"type": "string", "description": "Previous value of the field (null for create actions)"},
                        "new_value": {"type": "string", "description": "New value of the field (null for delete actions)"}
                    },
                    "required": ["reference_id", "reference_type", "action"]
                }
            }
        }