# Drafts preserved from unfinished security work

These `.sql.disabled` files are preserved for review, not executable migrations.
Do not copy them into the migration queue or run them on production yet.

- `20261027210000_rpc_notification_security.sql.disabled`: RPC/trigger hardening candidate; extension discovery and trigger behavior still need integration tests.
- `20261027220000_report_access_storage.sql.disabled`: access/storage candidate; requires frontend changes for public views, upload paths, image-link RPC, and duplicate search. Applying it to the current frontend would break existing flows.

The current check command does not exercise these drafts. Passing checks does not authorize treating them as validated migrations. Historical data and existing production policies have not been changed by moving these files.
