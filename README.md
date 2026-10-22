# Zenith Echo

**Hands-free, voice-first banking for people who are blind or have low vision, and for customers who find reading difficult.**

Built for **Zenith Bank Zecathon 6.0**, track *Inclusive Digital Banking for Diverse Accessibility Needs*.

- **Live app:** https://zenith-echo.onrender.com
- **API:** https://zenith-echo-api.onrender.com/api/health

Zenith Echo is a hackathon prototype. All accounts, balances, names and payments are demo data. It is not connected to real banking systems and is not affiliated with Zenith Bank.

---

## The problem

Millions of Nigerians live with visual, hearing or motor disabilities, and many more are not comfortable reading English text. Mainstream banking apps depend on small text, dense screens and precise taps. Screen readers often fail on payment pop-ups and one-time-code dialogs. As a result, many people hand their phone and PIN to someone else to bank for them, which exposes them to fraud and takes away their privacy.

## What Zenith Echo does

Echo is an assistant that lives inside the banking app. The customer talks to it in plain English, Nigerian Pidgin or basic Yoruba, and it carries out everyday banking on the app's real screens, step by step, until the customer approves with their own PIN.

| Feature | What it means for the customer |
|---|---|
| **"Hey Ziva", always listening** | Say "Hey Ziva" at any time while the app is open, from the very first screen. The Echo button in the bottom bar does the same with one tap. |
| **Real screens, filled by voice** | "Hey Ziva, I want to send money" opens the actual Transfer screen. Each detail appears in its field as it is spoken: account number, bank, verified account name, amount. The same works for airtime, data and electricity. |
| **Guarded checklist** | Echo never assumes a detail. It asks for each one in order, checks it, reads it back, and summarises everything before asking for confirmation. |
| **Corrections at any point** | "Go back", "repeat", "cancel", "change the account number", "no, the bank is GTBank". |
| **Smart interruption** | Echo stops talking the moment the customer taps, presses a key, says "stop", or gives a new command. |
| **Languages** | Understands English, Nigerian Pidgin and the main Yoruba banking phrases. It replies in English or Pidgin to match the speaker. |
| **Privacy by default** | Whisper mode is on from the start. Without headphones, Echo never says amounts, balances, full account numbers or surnames out loud ("the number ending in 6805"). With headphones connected, it reads full details. |
| **TalkBack-style touch** | One tap reads an item aloud, a double tap activates it, and a swipe left or right moves to the previous or next item. |
| **Short, spoken setup** | Three steps, all answerable by voice: anything else that would help, can you hear me, and create a PIN. Every other choice has a safe default and lives in Settings. |
| **Accessibility extras** | Hard of hearing (captions, vibration, screen flash), tremors (steady taps, hold to confirm), simple words. These can be combined. |

## Security

Voice can open screens and fill in forms, but **voice can never approve a payment**.

- Every payment is approved with the customer's **4-digit PIN**, typed on the keypad. Echo warns the customer if they start saying their PIN out loud, and voice commands can never press PIN keys.
- The PIN is **hashed with scrypt** on the server and compared in constant time. Three wrong attempts lock it for five minutes. Obvious PINs such as 1111 and 1234 are refused.
- Each approval is a **single-use ticket**: tied to one payment, valid for two minutes, and impossible to reuse.
- Payments above the **voice limit (₦50,000)** always require the PIN, even when fingerprint is enabled.
- Fingerprint and face approval use **WebAuthn**: the server verifies the device's cryptographic signature, so a fake approval is rejected.
- Account numbers are checked against the **CBN NUBAN check-digit algorithm** for the chosen bank before any name lookup.
- The ElevenLabs API key exists only on the server. Voice endpoints are rate-limited to protect usage credits.

---

## Architecture

```
┌──────────────────────────────┐        HTTPS         ┌────────────────────────────────┐
│  client  (React + TypeScript)│ ───────────────────▶ │  server  (Node.js + Express)   │
│                              │                       │                                │
│  Screens: Home, Transfer,    │  /api/assistant       │  Assistant: intent detection,  │
│  Airtime, Data, Bills,       │  /api/voice/speak     │  guarded checklist, Pidgin and │
│  Settings, Setup             │  /api/security/*      │  Yoruba understanding, private │
│  Echo: wake word, speech,    │                       │  speech                        │
│  touch-and-read, voice fill  │                       │  Banking: NUBAN, name lookup,  │
└──────────────────────────────┘                       │  transfers, bills              │
                                                       │  Security: PIN, WebAuthn,      │
                                                       │  approval tickets              │
                                                       │  Voice: ElevenLabs TTS and STT │
                                                       └───────────────┬────────────────┘
                                                                       │
                                                                       ▼
                                                              ElevenLabs API
```

### How a voice payment works

1. The browser hears "Hey Ziva, I want to send money" and sends the text to `/api/assistant`.
2. The server detects the intent and language, starts a checklist session, and replies with the next question plus the details collected so far.
3. The app opens the real Transfer screen and fills each field as the details arrive.
4. When everything is confirmed, the app opens its own **Authorize Transaction** screen. The customer types their PIN, and the payment completes and appears in their history.

Every reply carries three versions of what Echo says: `text` for captions, `speech` for headphones, and `privateSpeech` for the loudspeaker. The app chooses one based on the privacy mode and whether headphones are detected.

---

## Project structure

```
zenith-echo-template
├── client/                 Banking app (React 19, TypeScript, Vite)
│   └── src/
│       ├── screens/        Setup, Home, Transfer, Airtime/Data, Bills, Settings, Payment flow
│       ├── components/     Keypad, tab bar, Echo UI, form fields
│       ├── voice/          Echo: listening, speech, touch-and-read, voice fill, API client
│       ├── state/          Settings, navigation, accounts, payment flow
│       └── lib/            Demo data, formatting, PIN hashing, receipts
└── server/                 Echo API (Node.js 22+, Express 5)
    ├── src/
    │   ├── assistant/      Intents, conversation flows, engine, language and privacy layer
    │   ├── banking/        Banks, NUBAN check, parsers, directory and name lookup
    │   ├── services/       Ledger, transfers, bills, voice, security
    │   └── routes/         HTTP endpoints
    └── scripts/            Automated checks: smoke, voice, assistant, security
```

## Running it locally

**Requirements:** Node.js 22 or newer, and an ElevenLabs API key.

### 1. Server
```bash
cd server
npm install
cp .env.example .env        # on Windows: copy .env.example .env
```
Put your ElevenLabs key in `server/.env`, then start the server:
```bash
npm start                   # http://localhost:4000
```

### 2. App
```bash
cd client
npm install
cp .env.example .env        # VITE_API_URL=http://localhost:4000
npm run dev                 # http://localhost:5173
```
Open the app in **Chrome**. The microphone and speech features need `localhost` or `https`.

### Environment variables

**server/.env**

| Variable | Purpose | Example |
|---|---|---|
| `PORT` | Server port | `4000` |
| `CLIENT_ORIGIN` | Allowed app addresses, comma-separated | `http://localhost:5173` |
| `ELEVENLABS_API_KEY` | ElevenLabs key. **Secret: never commit it.** | `sk_…` |
| `ELEVENLABS_VOICE_ID` | Echo's voice | `EXAVITQu4vr4xnSDxMaL` |
| `ELEVENLABS_TTS_MODEL` | Text-to-speech model | `eleven_multilingual_v2` |
| `ELEVENLABS_STT_MODEL` | Speech-to-text model | `scribe_v2` |
| `VOICE_LIMIT` | Above this amount, only the PIN can approve | `50000` |

**client/.env**

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Address of the Echo API |

### Automated checks
With the server running, from the `server` folder:
```bash
npm run smoke       # accounts, transfers, airtime, data, electricity
npm run voice       # ElevenLabs speech in and out
npm run assistant   # full spoken conversations, including Pidgin and Yoruba
npm run security    # PIN, lockout, replay, forged fingerprint, voice limit
```
The security check deliberately locks the PIN at the end. Restart the server after running it.

## API overview

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Service status |
| `POST` | `/api/assistant` | Send what the customer said; returns the next question, the checklist and the filled fields |
| `POST` | `/api/assistant/voice` | Same, from recorded audio (ElevenLabs Scribe) |
| `POST` | `/api/assistant/execute` | Complete a payment with a single-use approval ticket |
| `POST` | `/api/voice/speak` | Text to speech (ElevenLabs), cached |
| `POST` | `/api/voice/transcribe` | Speech to text (ElevenLabs Scribe) |
| `GET` | `/api/security/status` | PIN and fingerprint status, lockout, voice limit |
| `POST` | `/api/security/pin`, `/api/security/pin/verify` | Create a PIN, approve with a PIN |
| `POST` | `/api/security/biometric/*` | Register and verify fingerprint or face (WebAuthn) |
| `GET` | `/api/account`, `/api/banks`, `/api/bills/*` | Account, banks, networks, data plans, electricity companies |

## Demo script

1. Open https://zenith-echo.onrender.com in **Chrome on Android** and tap anywhere to start. Allow the microphone.
2. Say **"none of these"**, then **"yes"**, then type a PIN such as **2580** twice.
3. Say **"Hey Ziva, I want to send money"**. The Transfer screen opens.
4. Say **"2 0 8 2 1 4 6 8 0 5"**, then **"Zenith bank"**. The account name appears.
5. Say **"five thousand naira"**, then **"skip"**, then **"yes"**. Type the PIN to approve.
6. Try **"Hey Ziva, abeg I wan buy data"**, **"my number"**, **"number two"** to hear Pidgin.

**Demo accounts:** 2082146805 (Zenith), 1148082005 (GTBank), 7619025532 (Access). Saved contacts: "My Mechanic", "Auntie Bukky". Any account or meter number starting with `000` simulates a failed lookup.

## Known limits

- **Always listening means while the app is open on screen.** Browsers do not allow websites to use the microphone in the background or with the screen off. Background listening needs a native app.
- Wake-word listening uses the browser's speech recognition. It works best in **Chrome on Android**, works partly in Safari, and does not work in Firefox.
- Headphone detection depends on the browser exposing device names. If it cannot tell, Echo stays private.
- Demo data lives in memory on the server and in the browser. Restarting the server resets the server-side demo account.
- Yoruba is understood for the main banking commands. Full Yoruba replies need review by a native speaker before release.

## Roadmap

- Native Android app for true background "Hey Ziva" and integration with the phone's own TalkBack.
- Full Yoruba, Hausa and Igbo replies, reviewed by native speakers.
- Nigerian-accented Echo voice.
- Connection to Zenith Bank's real transfer, name-enquiry and bill-payment services.
- Haptic balance: feel your balance as vibration patterns.

---

## AI usage

We used AI tools during this build and want to be clear about how.

- **Frontend:** the banking app's interface (screens, layout, setup flow, Settings page and components) was generated with AI and then reviewed, adjusted and integrated by the team.
- **Backend and integration:** the developer designed the system, decided the features, security rules and conversation behaviour, and directed, assembled, tested and deployed every part. 
- **Auditing:** AI was used to review the Website and its structure alone. The Github repo was not sent to the ai for audit.
- **Research:** AI was used to research accessibility practice (TalkBack, WCAG 2.2), and the CBN NUBAN check-digit rule.
- **Readme:** Ai  was use to get a template for the Readme based on what it knows from the auditand was edited and finalized by the Dev.
- **The AI Used:** Claude and Chatgpt. Claude to assist with the frontend and Chatgpt for website feedback, review and research.

All product decisions, testing on devices and the final submission are the team's own.

## Team

| Name | Role |
|---|---|
| Daniel Toluwani Olorunda | Product Manager |
| Lemeh Godwin Chisom | Researcher |
| Anjorin Olamide | Front-end Engineer |
| Inioluwa Aroyewun | Full-Stack and Integration Engineer |
