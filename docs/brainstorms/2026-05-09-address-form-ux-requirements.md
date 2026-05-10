---
date: 2026-05-09
topic: address-form-ux
---

# Address Form UX Improvement

## Summary

Improve the address entry form in both the onboarding and membership application flows by reordering fields to German address convention, adding Photon-powered type-ahead autocomplete on the street field, making State optional, and replacing the Country free-text input with a searchable ISO country combobox.

---

## Problem Frame

The current address form presents five plain text fields stacked vertically (Street → City → State → Zip → Country) with no placeholders, no guidance on format, and no assistance for entry. For a Berlin-based membership organisation whose members predominantly use German address conventions, this layout creates real confusion:

- The field order doesn't match how Germans write or think about addresses (street + house number, then PLZ and city together, not city before PLZ)
- "Street" gives no hint whether to include the house number on the same line
- Country is a free-text field, producing inconsistent data ("Germany", "Deutschland", "DE", "de") that is hard to normalise later
- State is required, but for Berlin members it duplicates the city — Berlin is both city and Bundesland
- There are no placeholders or examples to orient the user

The form exists in two places with the same structure: the new-user onboarding step and the membership application address step.

---

## Key Flows

- F1. **Autocomplete-assisted address entry**
  - **Trigger:** User begins typing in the Street field
  - **Steps:** User types a partial street name and house number → after a short debounce, Photon API is queried with the typed string → a dropdown of matching address suggestions appears below the field → user selects a suggestion → PLZ, City, State, and Country fields are populated automatically → user reviews and edits individual fields if needed → user submits the form
  - **Outcome:** All address fields are populated; user only had to type a partial street string
  - **Covered by:** R3, R4, R5

- F2. **Manual address entry (no autocomplete)**
  - **Trigger:** User fills in fields without selecting an autocomplete suggestion
  - **Steps:** User types into each field individually → selects Country from the combobox → submits the form
  - **Outcome:** All required fields are filled; form submits normally
  - **Covered by:** R1, R2, R6

---

## Requirements

**Field layout and order**

- R1. Fields are presented in German address convention order: Street → PLZ + City (inline, same row) → Bundesland/State → Country
- R2. PLZ and City share a single form row, with PLZ narrow (approximately one quarter width) and City filling the remaining width
- R3. The Street field displays a placeholder that shows the expected German format (street name and house number on one line, e.g., `Hauptstraße 42`)
- R4. The PLZ field displays a placeholder showing a German postal code (e.g., `10115`); the City field displays a placeholder city name (e.g., `Berlin`)
- R5. State/Bundesland is optional — the field is present but not required for form submission
- R6. The State field is labelled "Bundesland / State" to clarify it covers both German and international usage

**Country combobox**

- R7. The Country field is replaced by a searchable combobox backed by a full ISO country list
- R8. The combobox allows the user to search/filter countries by typing a name
- R9. The Country combobox pre-selects Germany as the default value on first load (when no country is already saved)
- R10. When autocomplete fills the Country field (R13), it overrides the default with the country returned by Photon

**Street autocomplete**

- R11. The Street field queries the Photon geocoding API as the user types, with a debounce to limit request frequency
- R12. Photon is queried without a country filter — suggestions are not restricted to Germany
- R13. Selecting a Photon suggestion auto-populates PLZ, City, State, and Country from the suggestion data; the Street field shows the full street + house number string
- R14. Autocomplete is additive — users may ignore suggestions and type all fields manually without any loss of function
- R15. If Photon is unavailable or returns no results, the form falls back gracefully to manual entry with no error shown to the user

**Scope of change**

- R16. Both address step components are updated: the onboarding step and the membership application step
- R17. No database schema changes — the underlying field names (`street`, `zip`, `city`, `state`, `country`) are unchanged

---

## Acceptance Examples

- AE1. **Covers R11, R13.** Given a user on the address step, when they type "Hauptstr" into the Street field and wait for the debounce, a dropdown of address suggestions appears; selecting "Hauptstraße 42, 10115 Berlin, Berlin, Germany" populates Street with "Hauptstraße 42", PLZ with "10115", City with "Berlin", State with "Berlin", and Country with "Germany".

- AE2. **Covers R14, R15.** Given a user who ignores autocomplete suggestions and types each field manually, when they fill Street, PLZ, City, and Country (leaving State blank) and submit, the form submits successfully.

- AE3. **Covers R8, R9, R10.** Given a new user with no saved country, the Country combobox opens pre-selected to "Germany". After the user selects an autocomplete suggestion for an Austrian address, the Country field updates to "Austria".

- AE4. **Covers R5.** Given a user who fills Street, PLZ, City, and Country but leaves State blank, the form is valid and submits without error.

---

## Success Criteria

- Users complete the address step without confusing field order or format — observable by fewer support questions about address entry and fewer malformed address records (e.g., "DE", "Deutschland", "germany" variants in the Country column)
- Country field data is normalised — all records use consistent country names from the ISO list
- The form works correctly in both the onboarding and membership application flows

---

## Scope Boundaries

- Self-hosting Photon — out of scope; the public endpoint is sufficient for this volume
- Removing the State field from the database schema — out of scope; State is made optional in the UI only
- Address validation on submit (verifying the address exists via geocoding) — out of scope
- Any paid geocoding service (Google Places, HERE, Mapbox) — out of scope
- Locale switching or internationalisation of the form labels — out of scope

---

## Key Decisions

- **Photon over other free geocoders**: No API key required, good German address coverage, open-source, tested and confirmed working without a country filter.
- **Combobox over short curated list for Country**: Ensures all valid countries are available and data is normalised without maintaining a hand-curated list.
- **Photon not filtered by country**: Tested without `countrycode=DE` and works correctly; filtering would unnecessarily restrict international members.
- **Germany as Country default**: The membership is primarily Berlin-based; pre-selecting Germany reduces friction for the majority without preventing others from changing it.
- **State made optional, not removed**: Keeps the data model stable while eliminating the friction of requiring a field that most Berlin members would fill redundantly.

---

## Dependencies / Assumptions

- Photon's public endpoint (`photon.komoot.io`) is used without authentication; no API key or account needed
- An ISO country library is added as a dependency to populate the Country combobox
- The `shadcn/ui` combobox pattern (Command + Popover) is the basis for both the Country combobox and the Street autocomplete suggestion dropdown, consistent with the existing component library
