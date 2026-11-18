"""
Metrics Module for Kadam Dashboard
Centralized single-source-of-truth definition for every retail business metric.
"""
from dataclasses import dataclass
from typing import Optional, Dict, Any

@dataclass(frozen=True)
class MetricDefinition:
    key: str
    label: str
    definition: str
    tooltip: str
    unit: str  # 'currency', 'percent', 'number', 'ratio'
    invert_badge: bool = False  # If True, increase is bad (e.g. Return Rate, Discount %)
    footnote: Optional[str] = None

METRIC_REGISTRY: Dict[str, MetricDefinition] = {
    "net_sales_incl_gst": MetricDefinition(
        key="net_sales_incl_gst",
        label="Net Sales (incl. GST)",
        definition="SUM(amount_incl_gst) over all transaction types (Sale, Return, Exchange)",
        tooltip="Total billed amount including GST across all transaction types. Returns are deducted automatically.",
        unit="currency"
    ),
    "net_sales_ex_gst": MetricDefinition(
        key="net_sales_ex_gst",
        label="Net Sales (ex-GST)",
        definition="SUM(sales_ex_gst) over all transaction types (Sale, Return, Exchange)",
        tooltip="Net revenue excluding GST. Represents the top-line product revenue earned.",
        unit="currency"
    ),
    "gross_sales": MetricDefinition(
        key="gross_sales",
        label="Gross Sales",
        definition="SUM(amount_incl_gst) WHERE txn_type = 'Sale'",
        tooltip="Gross billed amount on all forward sales before deducting returns.",
        unit="currency"
    ),
    "returns": MetricDefinition(
        key="returns",
        label="Returns",
        definition="SUM(amount_incl_gst) WHERE txn_type = 'Return' (stored negative, displayed positive)",
        tooltip="Total value of returned merchandise. Stored as negative in raw data, shown as positive in red.",
        unit="currency",
        invert_badge=True
    ),
    "exchanges": MetricDefinition(
        key="exchanges",
        label="Exchanges",
        definition="SUM(amount_incl_gst) WHERE txn_type = 'Exchange'",
        tooltip="Replacement items issued on exchange. In Wondersoft, exchange rows are positive sales.",
        unit="currency"
    ),
    "net_units": MetricDefinition(
        key="net_units",
        label="Net Units",
        definition="SUM(units) over all rows (forward sales minus return units)",
        tooltip="Net physical quantity of items sold across stores.",
        unit="number"
    ),
    "bills": MetricDefinition(
        key="bills",
        label="Bills",
        definition="COUNT(DISTINCT bill_key) WHERE txn_type = 'Sale'",
        tooltip="Count of unique forward sale invoices. Return/credit bills are excluded.",
        unit="number"
    ),
    "aov": MetricDefinition(
        key="aov",
        label="AOV (Average Order Value)",
        definition="Sales (gross) / Bills",
        tooltip="Average invoice value: Gross Sales divided by Sale Bills.",
        unit="currency"
    ),
    "upt": MetricDefinition(
        key="upt",
        label="UPT (Units Per Bill)",
        definition="SUM(units WHERE txn_type = 'Sale') / Bills",
        tooltip="Units per transaction: forward sale units divided by sale bills.",
        unit="ratio"
    ),
    "discount_pct": MetricDefinition(
        key="discount_pct",
        label="Discount %",
        definition="SUM(discount) / SUM(mrp_value) over Sale rows",
        tooltip="Share of Maximum Retail Price (MRP) given away as discount on forward sales.",
        unit="percent",
        invert_badge=True
    ),
    "gross_margin": MetricDefinition(
        key="gross_margin",
        label="Gross Margin ₹",
        definition="SUM(gross_margin) over all rows",
        tooltip="Total gross margin rupees: Net Sales (ex-GST) minus Cost.",
        unit="currency",
        footnote="Retail cost is taken from Wondersoft and may differ slightly from online margin."
    ),
    "gross_margin_pct": MetricDefinition(
        key="gross_margin_pct",
        label="Gross Margin %",
        definition="Gross Margin ₹ / Net Sales (ex-GST)",
        tooltip="Gross margin percentage calculated against Net Sales excluding GST.",
        unit="percent",
        footnote="Retail cost is taken from Wondersoft and may differ slightly from online margin."
    ),
    "return_rate": MetricDefinition(
        key="return_rate",
        label="Return Rate",
        definition="ABS(Returns) / Gross Sales",
        tooltip="Value of returned merchandise divided by Gross Sales.",
        unit="percent",
        invert_badge=True
    ),
    "return_rate_units": MetricDefinition(
        key="return_rate_units",
        label="Return Rate (Units)",
        definition="ABS(SUM(units WHERE txn_type = 'Return')) / SUM(units WHERE txn_type = 'Sale')",
        tooltip="Quantity of returned units divided by forward sale units.",
        unit="percent",
        invert_badge=True
    ),
    "asp": MetricDefinition(
        key="asp",
        label="ASP (Avg Selling Price)",
        definition="Sales (ex-GST) / Sale units",
        tooltip="Average selling price per unit sold, excluding GST.",
        unit="currency"
    )
}

def get_sql_metric_aggregates() -> str:
    """
    Standard SQL aggregation expressions to compute base metric components
    in a single query scan.
    """
    return """
        -- Billed & Sales totals
        COALESCE(SUM(amount_incl_gst), 0) AS net_sales_incl_gst,
        COALESCE(SUM(sales_ex_gst), 0) AS net_sales_ex_gst,
        COALESCE(SUM(CASE WHEN txn_type = 'Sale' THEN amount_incl_gst ELSE 0 END), 0) AS gross_sales,
        COALESCE(SUM(CASE WHEN txn_type = 'Return' THEN amount_incl_gst ELSE 0 END), 0) AS returns_raw,
        COALESCE(SUM(CASE WHEN txn_type = 'Exchange' THEN amount_incl_gst ELSE 0 END), 0) AS exchanges,
        
        -- Units
        COALESCE(SUM(units), 0) AS net_units,
        COALESCE(SUM(CASE WHEN txn_type = 'Sale' THEN units ELSE 0 END), 0) AS sale_units,
        COALESCE(SUM(CASE WHEN txn_type = 'Return' THEN units ELSE 0 END), 0) AS return_units_raw,
        
        -- Bills
        COUNT(DISTINCT CASE WHEN txn_type = 'Sale' THEN bill_key END) AS bills,
        
        -- Discounts & MRP
        COALESCE(SUM(CASE WHEN txn_type = 'Sale' THEN discount ELSE 0 END), 0) AS sale_discount,
        COALESCE(SUM(CASE WHEN txn_type = 'Sale' THEN mrp_value ELSE 0 END), 0) AS sale_mrp_value,
        COALESCE(SUM(CASE WHEN txn_type = 'Sale' THEN product_discount ELSE 0 END), 0) AS product_discount,
        COALESCE(SUM(CASE WHEN txn_type = 'Sale' THEN bill_discount ELSE 0 END), 0) AS bill_discount,
        COALESCE(SUM(CASE WHEN txn_type = 'Sale' THEN other_discount ELSE 0 END), 0) AS other_discount,

        -- Cost & Margin
        COALESCE(SUM(cost), 0) AS total_cost,
        COALESCE(SUM(gross_margin), 0) AS gross_margin
    """

def compute_derived_metrics(row: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculates derived ratios and formatted metrics from raw aggregate components.
    Guarantees no division by zero.
    """
    net_sales_incl_gst = float(row.get("net_sales_incl_gst") or 0.0)
    net_sales_ex_gst = float(row.get("net_sales_ex_gst") or 0.0)
    gross_sales = float(row.get("gross_sales") or 0.0)
    returns_raw = float(row.get("returns_raw") or 0.0)
    returns = abs(returns_raw)
    exchanges = float(row.get("exchanges") or 0.0)
    
    net_units = float(row.get("net_units") or 0.0)
    sale_units = float(row.get("sale_units") or 0.0)
    return_units_raw = float(row.get("return_units_raw") or 0.0)
    return_units = abs(return_units_raw)
    
    bills = int(row.get("bills") or 0)
    
    sale_discount = float(row.get("sale_discount") or 0.0)
    sale_mrp_value = float(row.get("sale_mrp_value") or 0.0)
    
    total_cost = float(row.get("total_cost") or 0.0)
    gross_margin = float(row.get("gross_margin") or 0.0)
    
    # Ratios
    aov = (gross_sales / bills) if bills > 0 else 0.0
    upt = (sale_units / bills) if bills > 0 else 0.0
    discount_pct = ((sale_discount / sale_mrp_value) * 100.0) if sale_mrp_value > 0 else 0.0
    gross_margin_pct = ((gross_margin / net_sales_ex_gst) * 100.0) if net_sales_ex_gst != 0 else 0.0
    return_rate = ((returns / gross_sales) * 100.0) if gross_sales > 0 else 0.0
    return_rate_units = ((return_units / sale_units) * 100.0) if sale_units > 0 else 0.0
    asp = (net_sales_ex_gst / sale_units) if sale_units > 0 else 0.0

    return {
        "net_sales_incl_gst": round(net_sales_incl_gst, 2),
        "net_sales_ex_gst": round(net_sales_ex_gst, 2),
        "gross_sales": round(gross_sales, 2),
        "returns": round(returns, 2),
        "returns_raw": round(returns_raw, 2),
        "exchanges": round(exchanges, 2),
        "net_units": int(net_units),
        "sale_units": int(sale_units),
        "return_units": int(return_units),
        "bills": bills,
        "aov": round(aov, 2),
        "upt": round(upt, 2),
        "discount_pct": round(discount_pct, 1),
        "sale_discount": round(sale_discount, 2),
        "sale_mrp_value": round(sale_mrp_value, 2),
        "total_cost": round(total_cost, 2),
        "gross_margin": round(gross_margin, 2),
        "gross_margin_pct": round(gross_margin_pct, 1),
        "return_rate": round(return_rate, 1),
        "return_rate_units": round(return_rate_units, 1),
        "asp": round(asp, 2),
        "product_discount": round(float(row.get("product_discount") or 0.0), 2),
        "bill_discount": round(float(row.get("bill_discount") or 0.0), 2),
        "other_discount": round(float(row.get("other_discount") or 0.0), 2),
    }
