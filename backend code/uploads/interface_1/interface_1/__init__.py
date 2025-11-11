from .add_audit_trail import AddAuditTrail
from .add_new_trade_for_fund import AddNewTradeForFund
from .calculate_future_value import CalculateFutureValue
from .calculate_liabilities import CalculateLiabilities
from .compute_nav import ComputeNav
from .create_fund import CreateFund
from .delete_fund import DeleteFund
from .execute_trade import ExecuteTrade
from .get_daily_profit_loss_by_fund import GetDailyProfitLossByFund
from .get_fund_nav_history import GetFundNavHistory
from .get_fund_trade_details import GetFundTradeDetails
from .list_funds_with_filter import ListFundsWithFilter
from .validate_approval import ValidateApproval
from .retrieve_available_funds import RetrieveAvailableFunds
from .retrieve_fund_instruments import RetrieveFundInstruments
from .retrieve_growth_rate import RetrieveGrowthRate
from .retrieve_instruments import RetrieveInstruments
from .retrieve_instruments_prices import RetrieveInstrumentsPrices
from .retrieve_nav_records import RetrieveNavRecords
from .update_fund import UpdateFund
from .update_instrument import UpdateInstrument
from .update_instrument_price import UpdateInstrumentPrice
from .update_nav_record_value import UpdateNavRecordValue
from .update_trade import UpdateTrade
from .query_users import QueryUsers
from .fetch_filtered_investors import FetchFilteredInvestors

ALL_TOOLS_INTERFACE_1 = [
    AddAuditTrail,
    AddNewTradeForFund,
    CalculateFutureValue,
    CalculateLiabilities,
    ComputeNav,
    CreateFund,
    DeleteFund,
    ExecuteTrade,
    GetDailyProfitLossByFund,
    GetFundNavHistory,
    GetFundTradeDetails,
    ListFundsWithFilter,
    ValidateApproval,
    RetrieveAvailableFunds,
    RetrieveFundInstruments,
    RetrieveGrowthRate,
    RetrieveInstruments,
    RetrieveInstrumentsPrices,
    RetrieveNavRecords,
    UpdateFund,
    UpdateInstrument,
    UpdateInstrumentPrice,
    UpdateNavRecordValue,
    UpdateTrade,
    QueryUsers,
    FetchFilteredInvestors
]
