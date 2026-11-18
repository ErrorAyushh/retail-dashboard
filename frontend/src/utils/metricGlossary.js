export const GLOSSARY = {
  net_sales_incl_gst: {
    term: 'Net sales (incl. GST)',
    definition: 'SUM(amount_incl_gst) over all txn types',
    tooltip: 'Total billed amount including GST across all transaction types (Sale, Return, Exchange). Returns are deducted automatically.'
  },
  net_sales_ex_gst: {
    term: 'Net sales (ex-GST)',
    definition: 'SUM(sales_ex_gst) over all txn types',
    tooltip: 'Net revenue excluding GST. Represents the top-line product revenue earned across all stores.'
  },
  gross_sales: {
    term: 'Sales (gross)',
    definition: "SUM(amount_incl_gst) where txn_type = 'Sale'",
    tooltip: 'Gross billed amount on all forward sales before deducting returns.'
  },
  returns: {
    term: 'Returns',
    definition: "SUM(amount_incl_gst) where txn_type = 'Return' (negative)",
    tooltip: 'Total value of returned merchandise. Stored negative in raw data, shown as positive Returns ₹X in red.'
  },
  exchanges: {
    term: 'Exchanges',
    definition: "SUM(amount_incl_gst) where txn_type = 'Exchange'",
    tooltip: 'Replacement items issued on exchange. In Wondersoft, exchange rows are positive sales and included in net sales.'
  },
  net_units: {
    term: 'Net units',
    definition: 'SUM(units) over all rows',
    tooltip: 'Net physical quantity of footwear and accessories sold across all stores (Sale units minus Return units).'
  },
  bills: {
    term: 'Bills',
    definition: "COUNT(DISTINCT bill_key) where txn_type = 'Sale'",
    tooltip: 'Unique customer invoices with forward sales. Excludes standalone return receipts.'
  },
  aov: {
    term: 'AOV (Average Order Value)',
    definition: 'Sales (gross) / Bills',
    tooltip: 'Average invoice value: Gross forward sales divided by sale bills.'
  },
  upt: {
    term: 'UPT (Units Per Bill)',
    definition: 'SUM(units where Sale) / Bills',
    tooltip: 'Basket size: forward sale units divided by sale bills.'
  },
  discount_pct: {
    term: 'Discount %',
    definition: 'SUM(discount) / SUM(mrp_value) over Sale rows',
    tooltip: 'Share of Maximum Retail Price (MRP) given away as discounts on forward sales.'
  },
  gross_margin: {
    term: 'Gross margin ₹',
    definition: 'SUM(gross_margin) over all rows',
    tooltip: 'Net sales (ex-GST) minus cost. Footnote: Retail cost is taken from Wondersoft and may differ slightly from online margin.'
  },
  gross_margin_pct: {
    term: 'Gross margin %',
    definition: 'Gross margin ₹ / Net sales (ex-GST)',
    tooltip: 'Gross margin percentage calculated against Net Sales excluding GST. Retail cost is from Wondersoft.'
  },
  return_rate: {
    term: 'Return rate',
    definition: 'ABS(Returns) / Sales (gross); also by units',
    tooltip: 'Value of returned items divided by forward gross sales.'
  },
  asp: {
    term: 'Avg selling price (ASP)',
    definition: 'Sales (ex-GST) / Sale units',
    tooltip: 'Average realized selling price per unit sold, excluding GST.'
  }
};

export function glossary(termKey) {
  if (!termKey) return null;
  const entry = GLOSSARY[termKey];
  if (!entry) return null;
  return `${entry.definition} — ${entry.tooltip}`;
}
