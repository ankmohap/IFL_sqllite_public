# Super Swapper Frontend Design

This document describes the implemented frontend experience for user and admin player swaps.

## User Screen
Screen name: **Super Swapper**

The screen has three sections:
- current effective squad for swap out
- swap box showing selected swap out and swap in cards
- player pool for swap in

## Swap Quantity
- User can select minimum 1 swap.
- User can select maximum 3 swaps, unless the active window config sets a lower limit.
- It is not mandatory to use all 3 swaps.

## Swap Out
Swap out list:
- comes from the user's current effective squad
- shows accumulated player points for the player's active period in the user's squad
- excludes players already selected for swap out

User selects the players they want to remove from their squad from the effective match onward.

Detailed behaviour:
- In window 1, swap out points align with the same effective-squad accumulation shown in `My Team`.
- In window 2 or later, the swap out list must reflect the latest squad after all prior frozen and validated windows are applied.
- If a player was swapped in during an earlier window, their displayed points must start from that player's entry match onward, not from full-season totals.
- If a player was in the original squad, then swapped out, and later brought back in another window, the displayed points must reflect only the currently active scoring periods.

## Swap In
Swap in list:
- comes from the full player pool
- excludes players already in the current effective squad
- excludes players already selected for swap in
- shows accumulated player points

Available controls:
- search by player name
- filter by team
- filter by role
- filter by Indian/International
- sort by player points

## Swap Box
The swap box displays selected players in paired cards:
- swap out player
- swap in player

With 3 swaps, the mobile layout must allow scrolling so the third pair is reachable.

## Validation Summary
After selection, show a clear summary:
- selected swap count
- resulting squad size
- bowler count
- international player count

Valid final squad:
- exactly 20 players
- minimum 6 bowlers
- maximum 8 international players

## User Buttons

### Submit Swaps
Saves the current selected swap pairs.

Behaviour:
- writes to `user_swaps`
- does not update `user_players`
- keeps the screen focused on the submitted players
- can be changed/reset while the window allows

### Freeze Swaps
Locks the saved swap pairs.

Behaviour:
- marks rows frozen
- users should see the frozen selections
- frozen swaps become eligible for admin validation and effective squad calculation

### Reset Saved Swaps
Clears the saved swap rows.

Behaviour:
- deletes or soft-deletes rows in `user_swaps`
- does not update `user_players`
- lets the user pick again if the window is still open

## Window Behaviour
The frontend should show:
- active window name
- start time
- lock time
- effective match id
- current status

If no window is configured or open, show a clear message instead of an empty picker.

Baseline rules by window:
- Editable windows use prior windows only to determine the current effective squad.
- Read-only or frozen views may show the post-window squad, but the editable swap action must always validate against the squad that exists immediately before the selected window takes effect.

## User Messaging
Use wording that makes the scoring rule obvious:
- `Swapped-out players keep points earned before the window effective match.`
- `Swapped-in players start scoring from the window effective match.`
- `Submitting saves your swap. Freezing locks it for validation.`

## Admin Screen
Screen name: **Swap Validation**

Admin sees:
- team name/user name
- window
- swap out player
- swap in player
- freeze state
- validation state
- timestamps

Admin actions:
- Approve
- Reject
- Export PDF

Rejected swaps are removed from the active swap table view. Approved swaps become validated and can be used by effective squad/scoring logic.

## Related Screens

### My Team
Must show:
- latest effective squad
- player points for the effective squad only
- swapped player frozen points for players removed by active swaps

The point display logic used in `My Team` is the source of truth for swap-window point chips shown beside swap-out players.

### Frozen Squads
Must show latest effective squads, not stale original squads.

### Leaderboard
`LAST_EARNED` must use effective squad logic for the last scored match.

### Players At Play
Generated cards must use latest effective squads and include users with no players from the teams involved in the match.

## Acceptance Criteria
- User can submit 1, 2, or 3 swaps.
- Swap out players come only from current effective squad.
- Swap in players exclude current effective squad.
- Window 2 and later show the latest 20-player squad after prior windows are applied.
- Players swapped in during earlier windows show only post-entry accumulated points in the swap-out pool.
- Submit/freeze/reset write only to `user_swaps`.
- Admin sees users by team name, not phone number.
- Admin can approve/reject and export swap validations.
- My Team, Frozen Squads, Leaderboard, and generated reports respect effective squad logic.
