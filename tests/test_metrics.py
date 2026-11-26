"""
Tests KPI calculations and metrics math on a fixed sample dataset fixture.
"""
import pytest

def calculate_kpis(bills_data):
    """
    Standard KPI calculation formula:
    - Net Sales = Gross Sales - Discounts - Returns
    - AOV = Net Sales / Bill Count
    - UPT = Net Units / Bill Count
    - Discount % = Total Discounts / Gross Sales
    - Gross Margin % = (Net Sales - Total COGS) / Net Sales
    """
    total_gross = sum(b["gross_sales"] for b in bills_data)
    total_discount = sum(b["discount"] for b in bills_data)
    total_returns = sum(b["returns"] for b in bills_data)
    total_net = total_gross - total_discount - total_returns
    total_units = sum(b["units"] for b in bills_data)
    total_bills = len(bills_data)
    total_cogs = sum(b.get("cogs", 0) for b in bills_data)

    aov = total_net / total_bills if total_bills > 0 else 0.0
    upt = total_units / total_bills if total_bills > 0 else 0.0
    discount_pct = (total_discount / total_gross * 100) if total_gross > 0 else 0.0
    margin_pct = ((total_net - total_cogs) / total_net * 100) if total_net > 0 else 0.0

    return {
        "net_sales": total_net,
        "aov": round(aov, 2),
        "upt": round(upt, 2),
        "discount_pct": round(discount_pct, 2),
        "margin_pct": round(margin_pct, 2)
    }

def test_kpi_sample_math():
    sample = [
        {"bill_no": "B1", "gross_sales": 3000.0, "discount": 300.0, "returns": 0.0, "units": 2, "cogs": 1200.0},
        {"bill_no": "B2", "gross_sales": 5000.0, "discount": 1000.0, "returns": 0.0, "units": 3, "cogs": 1800.0},
        {"bill_no": "B3", "gross_sales": 2000.0, "discount": 200.0, "returns": 500.0, "units": 1, "cogs": 600.0},
    ]
    # Total Gross = 10000, Total Disc = 1500, Returns = 500 => Net = 8000
    # Total Units = 6, Total Bills = 3
    # AOV = 8000 / 3 = 2666.67
    # UPT = 6 / 3 = 2.0
    # Disc % = 1500 / 10000 = 15.0%
    # Margin % = (8000 - 3600) / 8000 = 4400 / 8000 = 55.0%
    metrics = calculate_kpis(sample)
    assert metrics["net_sales"] == 8000.0
    assert metrics["aov"] == 2666.67
    assert metrics["upt"] == 2.0
    assert metrics["discount_pct"] == 15.0
    assert metrics["margin_pct"] == 55.0

def test_kpi_zero_division():
    empty_sample = []
    metrics = calculate_kpis(empty_sample)
    assert metrics["net_sales"] == 0.0
    assert metrics["aov"] == 0.0
    assert metrics["upt"] == 0.0
    assert metrics["discount_pct"] == 0.0
