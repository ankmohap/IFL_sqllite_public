# IFL SQLite Project Instructions

This guide helps a new user set up the project and run the app locally.

## 1. What This Project Is

This is an IFL fantasy league application with:

- React + Vite frontend
- FastAPI backend
- SQLite database

The default SQLite database file is:

- `server/data/ifl.sqlite3`

## 2. Prerequisites

Make sure these are installed:

- `python3`
- `npm`
- `pip3`

You can verify:

```bash
python3 --version
npm --version
pip3 --version
```

## 3. Open The Project

Go to the project folder:

```bash
cd /Users/ankitmohapatra/Documents/IFL_Sqllite
```

## 4. Install Dependencies

Install frontend packages:

```bash
npm install
```

Install backend packages:

```bash
pip3 install -r server/requirements.txt
```

## 5. Start The Backend

Run the FastAPI server:

```bash
npm run dev:server
```

By default the backend runs on:

- [http://localhost:4000](http://localhost:4000)

If port `4000` is already in use, run:

```bash
PORT=4001 npm run dev:server
```

## 6. Start The Frontend

Open a second terminal and run:

```bash
cd /Users/ankitmohapatra/Documents/IFL_Sqllite
npm run dev:client
```

The frontend usually runs on:

- [http://localhost:5173](http://localhost:5173)

## 7. Open The App

In your browser open:

- [http://localhost:5173](http://localhost:5173)

## 8. Login Details

### Admin

- Username: `admin`
- Password: `ifl@2026`

### Sample User

- Username: `demo`
- Password: `pw`
- Team Code: `IFL2026`

## 9. Backend Health Check

To confirm the backend is running:

- [http://localhost:4000/api/health](http://localhost:4000/api/health)

If you started the backend on another port, use that port instead.

## 10. Important Files

- Backend entry: `server/app.py`
- Database config: `server/database.py`
- SQLite DB: `server/data/ifl.sqlite3`
- Frontend app: `client/src/App.jsx`

## 11. Open The Database In DBeaver

You can inspect the SQLite database directly in DBeaver.

### SQLite file path

Use this file:

- `/Users/ankitmohapatra/Documents/IFL_Sqllite/server/data/ifl.sqlite3`

### Steps in DBeaver

1. Open DBeaver.
2. Click `Database` > `New Database Connection`.
3. Search for `SQLite`.
4. Select `SQLite` and click `Next`.
5. In the `Database/File` field, choose:

   `/Users/ankitmohapatra/Documents/IFL_Sqllite/server/data/ifl.sqlite3`

6. Click `Test Connection`.
7. If DBeaver asks to download the SQLite driver, allow it.
8. Click `Finish`.

### What you can inspect

Useful tables include:

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

## 12. Common Problems

### Port already in use

Check what is using port `4000`:

```bash
lsof -i :4000
```

Stop it:

```bash
kill <PID>
```

### Frontend opens but backend calls fail

Make sure the backend terminal is still running.

### Python dependency issue

Re-run:

```bash
pip3 install -r server/requirements.txt
```

### Frontend dependency issue

Re-run:

```bash
npm install
```

## 13. Stop The App

Press `Ctrl + C` in the backend terminal and the frontend terminal.
