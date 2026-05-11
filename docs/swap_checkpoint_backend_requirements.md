# Super Swapper Backend Design

This document describes the implemented backend design for player swaps.

## Objective
Support multiple swap windows where users can replace 1 to 3 players without mutating their original squad history.

The backend must:
- let users submit, reset, and freeze swaps
- let admin approve or reject swaps
- keep all swap data in `user_swaps`
- use `swap_windows.effective_match_id` to decide when swaps affect scoring
- keep `user_players` as the original squad record

## Tables

### `swap_windows`
Purpose: configure each swap window.

Key fields:
- `id`
- `name`
- `starts_at`
- `locks_at`
- `effective_match_id`
- `max_swaps`
- `is_active`
- `created_at`

Usage:
- `starts_at` and `locks_at` control whether users can submit/reset/freeze.
- `effective_match_id` controls the first match where frozen/validated swaps affect squad and scoring.
- Multiple windows are supported by adding more rows.

### `user_swaps`
Purpose: store each swap pair selected by a user.

Key fields:
- `id`
- `user_id`
- `window_id`
- `out_player_id`
- `in_player_id`
- `created_at`
- `is_deleted`
- `is_frozen`
- `frozen_at`
- `is_validated`
- `validated_at`
- `validated_by`

Important:
- There is no required `effective_match_id` on `user_swaps`.
- Effective match comes from the joined `swap_windows` row.
- User swap actions write only to `user_swaps`.
- `user_players` is not changed by swap submit, reset, freeze, approve, or reject.

## User APIs

### `POST /api/user/swaps`
Creates or replaces the user's active swap pairs for a window.

Expected behaviour:
- validate active window
- validate 1 to 3 complete pairs
- validate out players are in current effective squad
- validate in players are not in current effective squad
- validate no duplicate out/in players
- validate resulting squad has exactly 20 players
- validate resulting squad has minimum 6 bowlers
- validate resulting squad has maximum 8 international players
- soft-delete old active rows for that user/window
- insert new rows into `user_swaps`

### `POST /api/user/swaps/list`
Returns the user's saved swaps and window status.

### `POST /api/user/swaps/reset`
Deletes or soft-deletes active rows for that user/window.

Expected behaviour:
- allowed while the window permits change
- does not touch `user_players`

### `POST /api/user/swaps/freeze`
Marks active rows as frozen.

Expected behaviour:
- at least one submitted pair must exist
- sets `is_frozen`
- sets `frozen_at`
- does not touch `user_players`

## Admin APIs

### `GET /api/admin/swaps`
Returns swap rows with user/team/player/window details for validation dashboard.

### `POST /api/admin/swaps/validate`
Approves swap rows.

Expected behaviour:
- marks rows validated
- sets validation timestamp and validator
- does not touch `user_players`

### `POST /api/admin/swaps/reject`
Rejects swap rows.

Expected behaviour:
- deletes or soft-deletes rows from active workflow
- does not touch `user_players`

## Effective Squad Algorithm
For a target match id:

1. Read original active squad from `user_players`.
2. Read user swaps where:
   - `is_deleted = 0`
   - `is_frozen = 1`
   - `is_validated = 1`
   - joined `swap_windows.effective_match_id <= target_match_id`
3. Apply windows in effective match order.
4. For each pair:
   - remove `out_player_id`
   - add `in_player_id`

This produces the effective squad for:
- total points
- last earned
- My Team
- Frozen Squads
- Admin User Points
- players-at-play reports
- swap-window validation and swap-out candidate lists

## Current Window Validation Algorithm
For a target swap window:

1. Read original active squad from `user_players`.
2. Read user swaps where:
   - `is_deleted = 0`
   - `is_frozen = 1`
   - `is_validated = 1`
   - the joined swap window is earlier than the currently selected window
3. Apply earlier windows in order to build the pre-window effective squad.
4. Validate new `out_player_id` values against that pre-window effective squad.
5. Validate new `in_player_id` values against the same pre-window effective squad after excluding currently selected swap-outs.

This ensures players added in window 1 can be swapped out in window 2 and later.

## Scoring Semantics
- For matches before a window's `effective_match_id`, old players continue to score.
- From the window's `effective_match_id` onward, swapped-in players score.
- Swapped-out players stop scoring from that effective match onward.
- This applies to runs, catches, runouts/stumpings, wickets, milestone bonuses, and Man of the Match.

Re-entry behaviour:
- If a player starts in the original squad, is swapped out in one window, and is brought back in a later window, total scoring is segmented by active periods.
- Points are counted before the first swap-out effective match.
- Points are not counted while the player is out of the squad.
- Points resume from the later swap-in effective match onward.

Display semantics:
- UI surfaces such as `My Team` and `Super Swapper` should derive displayed accumulated points from the same effective-squad match-by-match replay used for total user points.

## Validation Rules
Validate at user submit time and again before admin approval if needed:
- minimum 1 swap pair
- maximum 3 swap pairs, or lower if the window config says lower
- all pairs complete
- no duplicate out players
- no duplicate in players
- out players are in the current effective squad
- in players are outside the current effective squad
- resulting squad count is exactly 20
- resulting squad has at least 6 bowlers
- resulting squad has at most 8 international players

The "current effective squad" for validation means the squad after earlier windows are applied, not the original `user_players` squad.

## Multiple Window Support
The design is future-proof for multiple swap windows because each row points to a `window_id`.

Example:
- Window 1 effective from match 23
- Window 2 effective from match 46

For match 40, only window 1 swaps apply.
For match 50, both window 1 and window 2 swaps apply in order.

## Migration Expectations
SQLite snapshot/export scripts must include:
- `swap_windows.effective_match_id`
- `user_swaps.is_frozen`
- `user_swaps.frozen_at`
- `user_swaps.is_validated`
- `user_swaps.validated_at`
- `user_swaps.validated_by`

Legacy databases with a not-null `user_swaps.effective_match_id` must be updated to remove the requirement or provide a compatible nullable/default value.

## Non-Goals
- Do not update `user_players` when users swap.
- Do not store swap state inside the full `ifl_users` payload.
- Do not require admin to rewrite squad rows for scoring to work.
