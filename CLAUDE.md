# Interior Bazzar Admin Panel

## Backend contract — read before any data change

The backend's full data model is in [BACKEND_SCHEMA.md](BACKEND_SCHEMA.md) (every model, field, type,
relation and allowed value). It is generated from the backend, so it is the truth — the backend has
**only** these models and fields. It is imported below, so it is always in your context:

@BACKEND_SCHEMA.md

Before building a feature that shows, sends or stores data:

1. **Find the data in BACKEND_SCHEMA.md first.** Grep it for the concept (e.g. `grep -i "phone" BACKEND_SCHEMA.md`).
   Reuse the existing model/field even if the name is imperfect (`lable`, `imageSQUrl` are real names — don't "fix" them).
2. **Never invent a model, field, or enum value.** Don't send a new key in a request body, don't type a
   response field that isn't backed by the schema, don't add a new status string. Values that can be
   *computed* from existing fields (counts, totals, full names, "is expired") must be computed on the frontend, not stored.
3. **A new API endpoint is fine; a new field/model is not.** A new endpoint must read/write existing fields only.
4. **Genuinely missing data?** Stop and don't fake it. Append one entry to `BACKEND_REQUESTS.md`
   (model, field name, type, why, which screen needs it) and build the UI so it hides that part until the field exists.
   Say so in your final message / PR description.
5. `json` fields are not a free-for-all — adding new keys inside one is a schema change too; list it in `BACKEND_REQUESTS.md`.
6. Never edit BACKEND_SCHEMA.md by hand; it is regenerated with `python manage.py export_schema` in the backend.

