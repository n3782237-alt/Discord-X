# Discord X — GitHub-ready Windows desktop project

Discord X is an original community/chat application starter with a Discord-inspired layout. It is built as a Windows desktop app (Electron) with a Node.js API, PostgreSQL database, email verification, realtime chat, WebRTC call signaling, and a demo X-Coins subscription flow.

> **Project status:** functional development starter, not a production-hosted Discord replacement. You must run the backend and database separately. Email delivery requires SMTP configuration. Calls across different networks need TURN. Demo subscriptions use virtual X-Coins only; no real money is charged.

## What is included

- Windows desktop app shell (Electron)
- Registration, six-digit email verification, and login
- Password hashing with bcrypt
- JWT authentication
- PostgreSQL data models via Prisma
- Create servers and text/voice channels
- Realtime text messages with Socket.IO
- WebRTC audio/video signaling foundation
- X-Coins wallet and Premium / Premium PRO demo plans
- Purchase confirmation dialog with mandatory policy checkboxes
- 24-hour demo X-Coins refund endpoint
- Privacy/security and refund policy documents

## Folder structure

```text
Discord-X-Project/
├── docker-compose.yml
├── .gitignore
├── README.md
├── docs/
│   ├── PRIVACY-AND-SECURITY.md
│   └── REFUNDS.md
├── server/
│   ├── .env.example
│   ├── package.json
│   ├── prisma/schema.prisma
│   └── src/index.js
└── desktop/
    ├── package.json
    ├── main.js
    ├── preload.js
    └── renderer/
        ├── index.html
        ├── style.css
        └── app.js
```

## Requirements

Install:
1. **Node.js 20 LTS or newer** — https://nodejs.org/
2. **Git for Windows** — https://git-scm.com/download/win
3. **Docker Desktop** — https://www.docker.com/products/docker-desktop/
4. Windows 10/11, 64-bit

Open PowerShell in the extracted project directory.

## A. Configure and start PostgreSQL

Start Docker Desktop, wait until it says it is running, then run:

```powershell
docker compose up -d db
```

Check the database container:

```powershell
docker compose ps
```

The local database defaults are:
- database: `discordx`
- username: `discordx`
- password: `discordx_local_password`
- port: `5432`

These defaults are for local development only. Change them before any hosted deployment.

## B. Configure the API server

```powershell
cd server
Copy-Item .env.example .env
```

Open `server/.env` in Notepad or VS Code. Set a long random `JWT_SECRET` (at least 32 characters). Keep `.env` private; it is ignored by Git.

### Configure real email delivery

Fill in the SMTP settings supplied by your email provider:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-login
SMTP_PASS=your-smtp-password-or-app-password
SMTP_FROM="Discord X <no-reply@your-domain.example>"
```

Use the exact host, port, TLS mode and app-password rules from your email provider. Do not use your ordinary mailbox password if the provider requires an app password.

**Local-only fallback:** if SMTP is not configured, the six-digit verification code is printed in the API server's terminal. This is only for local testing; it is not suitable for public use.

Install dependencies and create database tables:

```powershell
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

Keep this terminal open. The API should report:

```text
Discord X API listening on http://localhost:4000
```

Test in a browser: `http://localhost:4000/api/health`

Expected response resembles:

```json
{"ok":true,"app":"Discord X"}
```

## C. Start the Windows desktop app

Open a **second** PowerShell window in the project root:

```powershell
cd desktop
npm install
npm start
```

The Discord X window should open. Register with an email address, then enter the code sent to that mailbox. If using local-only SMTP fallback, read the code in the server terminal.

Keep the API server and PostgreSQL running while using the desktop app.

## D. Build a Windows installer (.exe)

In the desktop PowerShell window:

```powershell
npm run dist
```

When the build finishes, look inside:

```text
desktop\dist\
```

The NSIS setup executable will be generated there. The installer only packages the desktop client; it does **not** bundle PostgreSQL or host the API. For another person to use the app, you must deploy the API and database to a reachable server and configure the desktop API URL to that server. Do not publish a desktop build pointing at localhost for other users.

## E. Upload the project to GitHub

1. Sign in at https://github.com/
2. Click **New repository**.
3. Name it `discord-x`.
4. Choose Public or Private.
5. Create the repository **without** adding a README, .gitignore or license (this ZIP already contains project files).
6. Extract this ZIP on your computer.
7. Open PowerShell in the extracted `Discord-X-Project` folder.
8. Run these commands, replacing the URL with your own repository URL:

```powershell
git init
git add .
git status
git commit -m "Initial Discord X project"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/discord-x.git
git push -u origin main
```

If Git asks you to sign in, complete the browser authentication. Do not upload `.env`, SMTP passwords, JWT secrets, database backups, or private user data. `.gitignore` excludes `.env` and common build folders.

### Optional: build the EXE automatically with GitHub Actions

The current project can be built locally using `npm run dist`. A GitHub Actions workflow can be added later to build the installer on every push. Do not publish an installer until the API URL, app signing, privacy disclosures and production settings are ready.

## Payments, confirmation and 24-hour refund flow

This starter uses **demo X-Coins**, not real card payments:
1. User opens Premium or Premium PRO.
2. User chooses a plan.
3. A confirmation screen displays the plan and X-Coins price.
4. The user must tick both checkboxes:
   - agreement to the Privacy and Security Policy;
   - acknowledgement that a refund of the virtual X-Coins can be requested within 24 hours.
5. The **Confirm and pay** button becomes active only after both boxes are checked.
6. The server records the purchase, deducts virtual X-Coins and returns a 24-hour deadline.
7. The Refund button sends a refund request. If within 24 hours, the demo coins are returned and the previous tier is restored.

The checkbox is an acknowledgement for this demo application; it is not a substitute for legal review, proper consent records, consumer-law compliance or a payment provider's refund system. If real money is introduced, connect a payment provider (such as Stripe, subject to its availability and rules), verify payments on the server using signed webhooks, store payment IDs securely, and implement refunds through that provider. Never claim a real-money refund has been processed when only virtual credits were restored.

## Calls: important setup notes

The app uses browser WebRTC APIs and Socket.IO signaling. This is a starter foundation, not a hardened production voice platform. The current call-room signaling is intended for small development tests. For dependable audio/video across NATs, firewalls and mobile networks, configure a TURN server and add its credentials to the WebRTC ICE configuration in `desktop/renderer/app.js`. For larger group calls, use an SFU media server (for example, a properly deployed LiveKit or mediasoup service). Use HTTPS/WSS for production; browsers restrict camera/microphone access on insecure origins except localhost.

## Troubleshooting

**`ECONNREFUSED` / cannot connect to database**
- Make sure Docker Desktop is running.
- Run `docker compose up -d db`.
- Check port 5432 is not already used.
- Confirm `DATABASE_URL` in `server/.env`.

**Prisma says tables do not exist**
- From `server`, run `npx prisma generate` and `npx prisma migrate dev --name init`.

**Verification email does not arrive**
- Check SMTP host, port, username, password and secure mode.
- Check spam/junk.
- Read server terminal output for SMTP errors.
- For local testing only, code is printed in server terminal if SMTP is blank.

**Desktop opens but shows API error**
- Start the API first and verify `http://localhost:4000/api/health`.
- Confirm desktop client API URL in `desktop/renderer/app.js` is correct.

**No remote audio/video**
- Allow microphone/camera access in Windows privacy settings.
- Test on localhost first.
- For remote networks configure TURN and HTTPS.
- Ensure firewall allows the required traffic.

**Build fails**
- Use Node.js 20+.
- Run `npm install` again inside `desktop`.
- Run `npm run dist` from `desktop`.

## Before public launch — security checklist

- Deploy API behind HTTPS and a reverse proxy.
- Use managed PostgreSQL, strong unique DB credentials and backups.
- Store secrets in deployment environment variables, never GitHub.
- Add rate limiting, brute-force protection, email resend limits and verification-attempt limits.
- Add account deletion/export and privacy retention rules.
- Add moderation, reporting, blocking and abuse response.
- Configure TURN/SFU and protect call rooms.
- Add automated tests, logging and monitoring.
- Review privacy policy, terms, refund terms and applicable laws with qualified counsel.
- Replace demo X-Coins billing with a real payment provider only after server-side payment verification and refund integration.

## License

No third-party Discord assets or branding are included. The Discord-inspired layout is an independent project. Add a license file after deciding how you want others to use your code.
