# Admin AI Scoring Functional Design

This document describes the implemented admin scoring draft flow that combines a static Cricbuzz match-id map, Cricbuzz RapidAPI scorecards, Azure OpenAI draft generation, and manual admin review before import.

## Objective
Support fast admin score import for completed fixtures without relying on fragile scorecard HTML scraping.

The flow must:
- resolve the Cricbuzz `matchId` from a static local map
- fetch structured scorecard JSON from Cricbuzz RapidAPI
- generate an import-ready draft JSON through Azure OpenAI
- reconcile draft names against the current IFL fixture player pool
- let admin preview, edit, apply, clear, and recalculate as before

## Inputs

### Fixture selection
The admin selects the match from the `Admin > Points Scoring` screen.

Required fixture fields:
- match id
- team A abbreviation
- team B abbreviation
- match date

### Static match-id map
Source file:
- `server/data/cricbuzz_match_ids_2026.json`

Each row contains:
- `matchId`
- `date`
- `team1`
- `team2`

Lookup rules:
- date must match the fixture date after formatting
- team comparison is abbreviation-based
- team order should be tolerated when matching

## Data Sources

### Primary source
Cricbuzz RapidAPI scorecard JSON:
- endpoint pattern: `https://cricbuzz-cricket.p.rapidapi.com/mcenter/v1/{matchId}/scard`

Expected source fields used by downstream parsing:
- `scorecard`
- `status`
- `ismatchcomplete`
- innings `batsman`
- innings `bowler`
- dismissal text in `outdec`

### Model source packaging
The backend sends the fetched scorecard JSON to Azure OpenAI as the primary scoring source.

The prompt should describe:
- fixture name
- fixture date
- fixture venue when available
- the structured scorecard source
- the required output schema

## Draft Output Schema
The AI draft must target this structure:

```json
{
  "winner": "TEAM_ABBR",
  "motm": "Player Name",
  "players": [
    {
      "name": "Player Name",
      "runs": 0,
      "catches": 0,
      "runouts": 0,
      "wickets": 0
    }
  ]
}
```

## Backend Flow

### `POST /api/admin/scoring/draft-json`
Expected behaviour:

1. Validate admin token.
2. Load the selected fixture.
3. Resolve Cricbuzz `matchId` from the local static map.
4. Fetch scorecard JSON from Cricbuzz RapidAPI.
5. Send the structured scorecard to Azure OpenAI.
6. Parse the returned JSON draft.
7. Reconcile player names and `motm` against the current IFL fixture player pool.
8. Return:
   - `draftText`
   - `draft`
   - `sources`
   - `model`
   - `searchMode`
   - `resolvedMatchId`

### Failure modes
The endpoint should fail clearly when:
- fixture cannot be found
- static match-id cannot be resolved
- RapidAPI credentials are missing
- RapidAPI scorecard fetch fails
- Azure OpenAI credentials are missing
- AI response cannot be parsed into JSON

## Name Reconciliation
After the AI draft is parsed, the backend should try to align player names to the selected fixture player pool.

Expected reconciliation behaviour:
- normalize common aliases such as `Mohd`, `Mohammad`, `Muhammad`, and `Mohammed`
- tolerate minor token differences such as middle-name variance
- use fuzzy matching when exact normalized matching fails
- rewrite:
  - `players[].name`
  - `motm`

Examples of names that should be recovered when a matching fixture player exists:
- `Mohammed Shami`
- `Digvesh Singh Rathi`
- `George Linde`

## Admin Review Flow
The AI draft is an assisted step, not a final write.

Admin must still be able to:
- inspect the draft JSON
- manually edit the draft
- run `Preview`
- run `Apply Import`
- run `Clear Match`
- run `Save & Recalculate`

## UI Behaviour

### Scoring screen
The admin screen should communicate that:
- match selection is the only required input
- the backend resolves the Cricbuzz match id automatically
- the backend fetches scorecard JSON automatically
- the returned draft is editable before import

### Draft metadata
The scoring modal should show:
- model name
- search mode
- resolved Cricbuzz match id
- source list

## Acceptance Criteria
- Admin can generate a scoring draft by selecting a match only.
- Backend resolves the Cricbuzz match id from the static map without another lookup API call.
- Backend fetches the scorecard JSON from RapidAPI.
- AI draft uses the scorecard JSON, not empty HTML snippets.
- Draft player names are reconciled against the selected fixture pool before preview.
- Admin can still manually correct the draft before import.
- Existing preview/apply/recalculate flow continues to work.
