# Architecture rules
- Store voucher filtering is isolated in the pure Store summary helper and its second KPI strip; existing shared summaries and exports must remain unaffected.
- Voucher configuration reads and writes share the React Query key for the existing map_config entry so saved settings update mounted KPI views.
- Minimum-stock demand flags are persisted per model/color/size independently of PLAN pauses; numerical save and paste paths preserve destination flags so edits cannot silently reset them.
- PLAN grids receive the model catalogue as a pure-function argument and share its map_config query across tabs, so catalogue edits update every mounted view without changing shared inventory calculations.