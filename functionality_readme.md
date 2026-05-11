# IFL 2026 Functional Inventory

This document describes the current user, admin, scoring, and data behaviour of the IFL app.

## 1. Authentication and Access
- Users register and login with phone number and password.
- Registration/login is allowed only when the phone number is present in the admin allowlist.
- Admin login is handled by the backend and returns a signed bearer token.
- Admin sessions expire according to backend token TTL.
- Login audit records user, device type, browser, OS, platform, language, screen size, IP, and timestamp.
- Public home also offers a Guest Demo mode. Guest Demo uses dummy read-only data and does not join the league or write to database-backed league tables.

## 2. User Navigation
User pages:
- Home
- Predictions
- Playoffs Prediction
- Today's Edge
- My Team
- Super Swapper
- Frozen Squads
- Leaderboard
- Rules
- User Manual
- Profile

The logged-in user top navigation is intentionally minimal. The main Home screen provides primary navigation cards/buttons for user journeys.

Guest Demo pages:
- Home
- Predictions
- Today's Edge
- My Team
- Super Swapper
- Playoffs
- Rules
- Profile

## 3. Predictions
- Users pick a winner for each match.
- Predictions are locked before match start.
- Prediction updates use an isolated per-user, per-match upsert.
- The app does not rewrite the full user payload when a single prediction changes.
- Admin winner selection updates `predictions.is_correct` and `predictions.points_awarded`.
- `NR` means no result; all users receive 0 prediction points for that match.
- Prediction accuracy ignores `NR` matches.

## 4. Playoffs Prediction
- Users choose four teams during the configured playoff prediction window.
- Playoffs selections are stored in `store_kv` under `ifl_playoffs_predictions`.
- Users can reset and repick while the window remains open.
- Admin can view and export all playoff predictions.

## 5. Original Squad Lifecycle
- Initial squad submission must contain exactly 20 players.
- The initial squad must include at least 6 bowlers.
- The initial squad can include at most 8 international players.
- Admin can validate/freeze/unfreeze/reset users from the user management screen.
- The original squad is stored in `user_players`.

## 6. Super Swapper
Super Swapper is the user swap workflow.

User rules:
- A swap window must be active.
- A user can submit minimum 1 and maximum 3 swap pairs in a window.
- Swap out players come from the user's current effective squad.
- Swap in players come from the master player pool and exclude players already in the effective squad.
- Player pool supports search, team filter, role filter, Indian/International filter, and point-based sort.
- Resulting squad after swaps must still have exactly 20 players.
- Resulting squad must have minimum 6 bowlers.
- Resulting squad must have maximum 8 international players.
- Submit saves the selected swap pairs.
- Freeze locks the saved swap pairs for that user/window.
- Reset deletes/soft-deletes the saved swap request so the user can choose again while allowed.

Important data rule:
- User swaps write only to `user_swaps`.
- Swaps do not modify `user_players`.

## 7. Swap Validation
Admin Swap Validation allows admins to review user swaps.

Admin actions:
- Approve validates the submitted/frozen swap.
- Reject removes the swap request from the active workflow.
- Export creates a PDF report of swap validations.

The screen displays users by team name, not phone number.

## 8. Effective Squad Logic
The effective squad is calculated from:
- original squad in `user_players`
- frozen/validated rows in `user_swaps`
- `swap_windows.effective_match_id`

For any match:
- Start with the original squad.
- Apply every frozen/validated swap whose window `effective_match_id <= match_id`.
- Swapped-out players stop contributing from that effective match onward.
- Swapped-in players start contributing from that effective match onward.

This logic is used by:
- total points
- leaderboard `LAST_EARNED`
- My Team current squad
- My Team match-wise player points
- Frozen Squads
- players-at-play report generation
- admin user points screen

## 9. Points Engine
Player points:

| Component | Points |
|---|---:|
| Run | 1 |
| Catch | 5 |
| Runout/Stumping | 10 |
| Wicket | 20 |
| 3 wickets bonus | 25 |
| 4 wickets bonus | 50 |
| 5 wickets bonus | 100 |
| 50 runs bonus | 25 |
| 75 runs bonus | 50 |
| 100 runs bonus | 100 |
| Man of the Match | 50 |

Prediction points:
- Correct winner: 50
- Wrong winner: 0
- No result: 0

Leaderboard total:
- effective-squad player points
- man-of-the-match points for effective players
- prediction points

## 10. My Team
My Team shows:
- current effective squad
- role-wise player grouping with flip cards
- calculated player archetype avatars and labels
- dummy/popularity-style stars based on ownership
- accumulated player points on the flipped card
- match-wise player points
- prediction contribution
- swapped player frozen points for players swapped out

After a swap window's effective match id is reached, new players appear in current squad and old swapped-out players move into the frozen-points section.

Player card behaviour:
- Desktop users can hover a player card to flip it.
- Mobile/touch users can tap a player card to flip it.
- On touch devices, the card auto-flips back after 3 seconds.

Player archetypes are calculated from available app data:
- `Run Machine`: batter with high accumulated runs.
- `Wicket Hunter`: bowler with high wicket count.
- `Clutch Finisher`: player with strong recent points.
- `Balance Broker`: all-rounder with meaningful total points.
- `Powerplay Striker`: bowler with strong total points.
- `Safe Pick`: high-owned, stable points player.
- `Dark Horse`: low-owned player with useful total points.
- `Impact Spark`: low/mid-owned player with recent points spike.
- `Mystery Maker`: low-owned bowler/spinner type.
- `Chaos Pick`: all-rounder fallback when no stronger archetype applies.

## 11. Frozen Squads
- Shows user squads using latest effective squad logic.
- This prevents old swapped-out players from appearing as active after the relevant effective match.

## 12. Today's Edge and Galgotias Insight Box
Today's Edge highlights daily league context:
- match leverage
- leaderboard gaps
- what can change today
- players involved in today's matches

Galgotias Insight Box is deterministic and button-driven. It intentionally avoids open-ended AI calls and returns calculated insights from app data.

Today's Edge uses the same navy/gold cinematic design as Home and includes brighter image-backed background, gold section headings, and glass cards.

## 13. Leaderboard
Leaderboard shows:
- rank
- team
- last earned points
- total points
- prediction points
- rank movement since previous snapshot
- significant rank gaps
- What Can Change Today section

Logged-in Home includes:
- current leader highlighter with rotating horizontal disc/pedestal
- leader team logo above the pedestal
- centered leader team name below the disc
- auto-scrolling leaderboard preview when enough ranks exist

Leaderboard export includes:
- rank
- team
- last earned
- total points
- last prediction
- prediction points
- biggest movers
- maximum difference between adjacent ranks

## 14. Admin Scoring
Admin can:
- enter player stats manually
- import JSON or CSV score dumps
- set winner or no result
- set Man of the Match
- save/clear match scoring
- recalculate points

Scoring recalculation also updates prediction correctness and prediction points for the relevant match/user rows.

## 15. Admin User Points
Admin User Points shows:
- user dropdown by team name
- match-wise accumulated points
- player-wise contribution
- prediction-wise contribution

This is useful for auditing why a user's total changed.

## 16. Generated Reports and Cards
Generated outputs live under `docs/`.

Supported generated content:
- prediction ratio cards
- players-at-play cards
- playoff prediction extract report
- swap insights report
- unique swap calls report
- user story cards

Players-at-play cards use latest effective squads and include users who have no player from the teams playing that match.

## 17. Home Experience
- Login/home can show a one-time intro video on refresh/open.
- After the video ends, it returns to `main_page.jpg`.
- The static image remains the main fitted home background.
- Logged-in Home uses the navy/gold cinematic design, leader spotlight, quick navigation buttons, control-room widgets, auto-scrolling leaderboard preview, and bottom action cards.
- Guest Home mirrors the user experience with dummy data and a demo leader spotlight.

## 17A. Visual System
- User and admin screens use a common navy/gold glass style.
- Primary buttons use gold/yellow.
- Secondary buttons and form fields use translucent dark navy.
- Team names and team badges retain team identity colors where needed.
- Non-team widget accents are normalized to gold/yellow to avoid purple/orange/pink drift.
- Admin screens are styled consistently with user screens while remaining token-protected.

## 17B. Guest Experience
Guest Demo provides a safe simulation:
- No account creation.
- No prediction, swap, or user writes.
- Demo leaderboard uses generic team names only.
- Demo Today's Edge mirrors the real page structure with dummy climb paths, active player exposure, leverage snapshot, What Can Change Today, and Galgotias Insight Box buttons.
- Demo My Team has 11 player cards, cartoon archetype avatars, archetype labels, popularity stars, flip-card points, swapped frozen points, and previous match points.

## 18. Data Model
Current main tables:
- `users`
- `players`
- `matches`
- `user_players`
- `user_swaps`
- `swap_windows`
- `predictions`
- `match_player_stats`
- `match_meta`
- `activity_feed`
- `user_login_audit`
- `store_kv`
- `leaderboard_snapshots`

Compatibility store keys:
- `ifl_users`
- `ifl_master_players`
- `ifl_master_matches`
- `ifl_match_stats`
- `ifl_swap_windows`
- `ifl_playoffs_predictions`
- `ifl_allowed_phones`
- `ifl_global_team_code`

## 19. Deployment
- App is Dockerized with a multi-stage Dockerfile.
- Azure App Service deployment assets are in `deploy/azure/`.
- SQLite is the default database for local and sample deployment flows in this repo.
- SQLite snapshot scripts are maintained for backup and portability.
