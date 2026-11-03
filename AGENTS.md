# Architecture rules
- Store voucher filtering is isolated in the pure Store summary helper and its second KPI strip; existing shared summaries and exports must remain unaffected.
- Voucher configuration reads and writes share the React Query key for the existing map_config entry so saved settings update mounted KPI views.