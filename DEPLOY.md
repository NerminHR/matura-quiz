# Deployment Guide — Matura Quiz

Complete instructions for running the app locally and publishing it online.

---

## Table of contents

1. [Run locally](#1-run-locally)
2. [Deploy to Railway](#2-deploy-to-railway-recommended) ← easiest online option
3. [Deploy to Render](#3-deploy-to-render-free-alternative)
4. [Deploy to a VPS / server](#4-deploy-to-a-vps--server)
5. [Database notes](#5-database-notes)
6. [Environment variables](#6-environment-variables)

---

## 1. Run locally

**Prerequisites:** [Node.js 20+](https://nodejs.org), [Git](https://git-scm.com)

```bash
# 1. Clone the repository
git clone https://github.com/NerminHR/matura-quiz.git
cd matura-quiz

# 2. Install dependencies
cd app
npm install

# 3. Start the dev server
npm run dev
```

Open **http://localhost:3000** — the app is ready.

> The SQLite database (`app/matura.sqlite`) is included in the repo with all 400 questions pre-loaded. No extra setup needed.

### Production build (local)

```bash
cd app
npm run build
npm start
```

---

## 2. Deploy to Railway *(Recommended)*

Railway is the best option for this app because it:
- Supports **persistent file storage** (needed for the leaderboard SQLite writes)
- Has a **free tier** (500 hours/month)
- Deploys directly from GitHub with zero config

### Step-by-step

**1. Sign up**
Go to [railway.app](https://railway.app) → sign in with your GitHub account (NerminHR).

**2. New project**
Click **+ New Project** → **Deploy from GitHub repo** → select `NerminHR/matura-quiz`.

**3. Set the root directory**
Railway will detect it as a Node.js app. Go to your service **Settings** tab:
- **Root Directory** → set to `app`
- **Build Command** → `npm run build`
- **Start Command** → `npm start`

**4. Add a persistent volume** *(keeps leaderboard data across redeploys)*
- In your service, go to **Volumes** tab → **Add Volume**
- Mount path: `/app/data`
- Set environment variable `DATABASE_URL=/app/data/matura.sqlite`

  > If you skip this step the app still works, but the leaderboard resets every time you redeploy.

**5. Copy the database to the volume** *(first deploy only)*

Open a Railway shell (service → **Shell** tab) and run:
```bash
cp /app/matura.sqlite /app/data/matura.sqlite
```

**6. Deploy**
Railway auto-deploys on every push to `main`. Your public URL will be shown in the service dashboard, e.g. `https://matura-quiz-production.up.railway.app`.

---

## 3. Deploy to Render *(free alternative)*

Render's free tier spins down after 15 minutes of inactivity (cold start ~30 sec). For a school/classroom app this is usually fine.

**1. Sign up at [render.com](https://render.com)** → New → **Web Service** → connect `NerminHR/matura-quiz`.

**2. Configure**

| Field | Value |
|---|---|
| Root directory | `app` |
| Build command | `npm install && npm run build` |
| Start command | `npm start` |
| Node version | `20` |

**3. Add a persistent disk** *(optional — keeps leaderboard data)*
- Go to your service → **Disks** → **Add Disk**
- Mount path: `/opt/render/project/data`
- Add env var `DATABASE_URL=/opt/render/project/data/matura.sqlite`
- SSH into the service and run `cp /opt/render/project/src/matura.sqlite /opt/render/project/data/matura.sqlite`

**4. Deploy** — Render builds and deploys automatically. Your URL will be `https://matura-quiz.onrender.com`.

---

## 4. Deploy to a VPS / server

For full control (DigitalOcean, Hetzner, Linode, etc.):

```bash
# On the server
git clone https://github.com/NerminHR/matura-quiz.git
cd matura-quiz/app
npm install
npm run build

# Run with PM2 (keeps it alive after SSH disconnect)
npm install -g pm2
pm2 start "npm start" --name matura-quiz
pm2 save
pm2 startup
```

Then set up nginx as a reverse proxy:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable HTTPS with [Certbot](https://certbot.eff.org):
```bash
sudo certbot --nginx -d yourdomain.com
```

---

## 5. Database notes

The file `app/matura.sqlite` is included in the repository. It contains:
- **400 questions** (200 Bosanski + 200 English) — read-only content
- **`test_results` table** — written at runtime (leaderboard scores)

### Leaderboard persistence

The SQLite file is written to `process.cwd()/matura.sqlite` (i.e. the `app/` directory at runtime).

| Platform | Default behavior | Persistent? |
|---|---|---|
| Railway | File lives in the container filesystem | ❌ resets on redeploy — use a Volume (see above) |
| Render | Same | ❌ resets on redeploy — use a Disk (see above) |
| VPS | File lives on the server disk | ✅ always persistent |
| Local dev | File lives in `app/matura.sqlite` | ✅ always persistent |

To point the app at a different DB path, set the `DATABASE_URL` environment variable (see below).

### Backup the database

```bash
# Download DB from Railway shell
railway run -- cat /app/matura.sqlite > backup.sqlite

# Or from a VPS
scp user@yourserver:/path/to/matura-quiz/app/matura.sqlite ./backup.sqlite
```

---

## 6. Environment variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `./matura.sqlite` | Path to the SQLite file. Override when using a persistent volume. |
| `PORT` | `3000` | Port the server listens on. Railway/Render set this automatically. |

Set `DATABASE_URL` in the platform's environment variables panel, e.g.:
```
DATABASE_URL=/app/data/matura.sqlite
```

Then update `app/lib/db.ts` line 9 to read it:
```ts
const dbPath = process.env.DATABASE_URL ?? path.join(process.cwd(), "matura.sqlite");
```

---

## Updating the app

After making changes locally:

```bash
git add .
git commit -m "describe your changes"
git push
```

Railway and Render auto-deploy on every push to `main`. The app is live within ~2 minutes.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `better-sqlite3` fails to build | The platform needs native build tools. Railway and Render include them. Vercel does **not** support better-sqlite3. |
| Leaderboard resets after redeploy | Add a persistent volume/disk (Railway) or use a VPS. |
| App works locally but 500 errors online | Check that `app/matura.sqlite` exists in the deployed container and the path is correct. |
| Port already in use | Set `PORT=3001` environment variable. |
