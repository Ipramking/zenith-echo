# Zenith Echo

A front-end prototype that recreates the look and flow of a Nigerian mobile banking app, with accessibility built in: first-run setup, a voice assistant ("Echo"), touch-and-read, and a full Settings page. React + TypeScript + Vite.

Screens, settings and history are demo data stored in your browser (`localStorage`). Echo's conversations, voice (ElevenLabs), payment checks and PIN approval run on the Echo API in `../server`; set its address in `.env` as `VITE_API_URL`. Not affiliated with Zenith Bank. The Z mark is drawn for this project, not taken from the bank's logo files.

## Run it

Double-click `start.bat`, or:

```
npm install
npm run dev
```

On a desktop it shows inside a phone frame; on a phone it fills the screen. Speech and the microphone need a secure context, which `localhost` is. Over plain `http://192.168...` voice input and PIN hashing fall back or switch off (see Notes).

## First launch

One question per screen, very large buttons, a spoken and written step counter ("Step 3 of 9"), a Back button, and Skip everywhere except the PIN.

1. **Welcome**: one giant "Tap anywhere to start". That tap is what lets the browser play Echo's voice.
2. **How do you want to use Echo?** **Voice** or **Touch and read** (applied immediately, so Touch and read already works on the next screens).
3. **Main profile**: Blind or low vision, or Standard.
4. **Anything else that would help?** Optional extras, multi-select: **Hard of hearing**, **Tremors or difficulty tapping**, **Simple words**.
5. **Can you hear me?** A sample line, Yes / Louder / slower / I'd rather read captions, and a speech speed choice.
6. **Microphone**: explains why first, then asks, then a "say hello" test showing what was heard.
7. **Privacy mode**: Normal, Whisper or Headphones.
8. **Text and display**: live preview, A− / A+ and Dark / Light. Skipped for the blind or low vision profile.
9. **Secure your account**: fingerprint or face, then a 4-digit PIN entered twice. Cannot be skipped. "Your voice can never approve a payment on its own."
10. **Practice**: hold-to-confirm (tremors), tap-once / double-tap (Touch and read), or "say check my balance" (Voice).
11. **You're ready**: "Say help anytime."

The profile, extras and interaction mode are combined into one set of defaults (switches only ever turn on, the text size only grows). After setup, launching the app shows the login screen and asks for your PIN. "Forgot Passcode?" offers to restart setup (this demo has no reset code).

## Home

- **Echo orb**: a big round button (112 px; never under 96 px). Tap to talk. It pulses while listening, and Echo's last reply appears under it.
- **"Hey Ziva"**: Echo listens for the wake phrase while the app is open (on/off in Settings). Say "Hey Ziva, check my balance", or just "Hey Ziva" and then the command.
- Total balance, swipeable account cards (Savings, Current, Fixed Deposit), quick links, recent transactions, favourites, side menu.

## Every reply (message model)

Echo's replies are `{ text, speech, privateSpeech }`:

- `text` is **always shown as a caption**.
- With **headphones on** (detected, or Privacy mode = Headphones) Echo plays `speech`, the full detail.
- In **Whisper** mode it plays `speech` at low volume.
- Otherwise (**Normal**, no headphones) it plays `privateSpeech`, which keeps balances, names and amounts on the screen.

Payment narration ("Confirm transaction…", "Payment successful…") follows the same rules. Silent balance by vibration plays no speech at all.

## Touch and read

For people who want to explore by touch without a separate screen reader: **a single tap speaks what is under your finger, a double tap activates it.**

- Controls announce their name and state ("Reduce motion, switch, off"), and plain text is read aloud.
- Two taps on the same item within 1.2 s count as a double tap. The first three single taps add "Double tap to activate".
- Keyboard and screen-reader activations are never intercepted, so keyboards keep working.
- Don't combine it with TalkBack or VoiceOver; they would both speak. Touch and read reads whatever you tap aloud, regardless of Privacy mode, because you asked for it.
- Hands-free listening ("Hey Ziva", auto-listen) is switched off in this mode, and "steady taps" is not used (activating already takes a deliberate second tap).

## PIN pad

Each key is labelled with its digit as a word ("Five"). Progress is announced as "digit 2 of 4 entered", never the digit itself, both spoken and in a polite live region.

## Accessibility rules the whole app follows

- Every button, input and status has an `aria-label` or visible text.
- Every status message is in an `aria-live="polite"` region.
- Every new screen, sheet and dialog moves focus to its title.
- Settings is one page with headings; every toggle is a full-width row that spells out **On** or **Off**.

## Settings

| Section | Controls |
|---|---|
| My profile | Current profile, How I use Echo (Voice / Touch and read), the three extras as switches, Change profile (main profile + extras + interaction, re-applies defaults) |
| Display | Text size (6 steps), light/dark, large buttons, reduce motion |
| Voice and sound | Spoken guidance, voice choice, speech speed, sound cues, listen automatically, **"Hey Ziva" listening**, language (English; Pidgin, Yoruba, Hausa, Igbo "coming soon") |
| Hearing | Captions, caption size, vibration cues, flash the screen for alerts |
| Touch and movement | Steady taps, press-and-hold to confirm, hold time (0.5 / 1 / 1.5 s), cancel countdown (3 / 5 / 10 s), longer time limits, Practice area |
| Privacy | Hide balances, **Privacy mode (Normal / Whisper / Headphones)**, silent balance by vibration |
| Security | Fingerprint or face, change PIN, voice payment limit (10k / 20k / 50k), daily limit |
| Saved contacts | Voice nicknames like "My Mechanic": add, rename, delete |
| Help | Replay the tutorial, voice commands, reset all settings, reset demo data, about, lock, sign out |

### Settings keys

Stored as JSON under `zenith-echo:settings:v1`. Keys from the first spec are marked ★, from the second spec ◆; the rest were needed by the controls listed.

| Key | Values | Controls |
|---|---|---|
| `profile` ★ | `blind` `standard` (older `lowVisionHoh`, `tremor` are upgraded on load) | Main profile |
| `extras` ◆ | array of `hardOfHearing` `tremor` `simpleWords` | Extras |
| `interaction` ◆ | `voice` `touchRead` | How I use Echo |
| `privacy` ◆ | `normal` `whisper` `headphones` | Privacy mode (replaces `privacyMode` and `headphonesOnly`, upgraded on load) |
| `wakeWord` ◆ | boolean | "Hey Ziva" listening |
| `theme` ★ | `light` `dark` | Display |
| `scale` ★ | `0.9` `1` `1.15` `1.3` `1.5` `1.75` | Text size |
| `largeTargets` ★ | boolean | Large buttons |
| `tremorGuard` ★ | boolean | Steady taps and the cancel countdown |
| `voice` ★ | boolean | Spoken guidance |
| `captions` ★ | boolean | Captions |
| `haptics` ★ | boolean | Vibration cues |
| `speechRate` ★ | `slow` `normal` `fast` | Speech speed (0.8 / 1 / 1.25) |
| `autoListen` ★ | boolean | Listen automatically after Echo speaks |
| `holdMs` ★ | `500` `1000` `1500` | Hold time |
| `countdownSeconds` ★ | `3` `5` `10` | Cancel countdown |
| `voiceLimit` ★ | `10000` `20000` `50000` | Voice payment limit |
| `onboarded` ★ | boolean | First-run setup finished |
| `holdToConfirm`, `reduceMotion`, `soundCues`, `voiceName`, `language`, `captionSize`, `flashAlerts`, `longerTimeouts`, `silentBalance`, `biometrics`, `dailyLimit` | see Settings | the matching controls |
| `pinHash`, `pinSalt` | strings | The PIN: salted SHA-256, never plain text |

Defaults: **Blind or low vision** = voice, auto-listen, vibration, sound cues, large buttons, 150% text, dark. **Voice** = spoken guidance, auto-listen, "Hey Ziva". **Touch and read** = spoken guidance. **Hard of hearing** = captions (large), vibration, screen flashes, sound cues, slower speech. **Tremors** = steady taps, hold-to-confirm, large buttons, longer limits, vibration, 115% text. **Simple words** = Echo uses short, plain sentences.

## Echo commands

- "Check my balance", "Read my last transaction"
- "Send 5000 naira to Auntie Bukky": opens a transfer to that saved contact with the amount filled in
- "Open transfer / airtime / data / electricity / cable / bills / history / messages / settings", "Go home", "Go back"
- "Bigger text", "Smaller text", "Dark mode", "Light mode", "Lock the app", "Stop", "Help"

**Voice can never approve a payment.** It can open a screen and fill a form; the payment still needs an on-screen confirm and your fingerprint or PIN. Payments started by voice above your voice limit always need the PIN, never the fingerprint. Saying "confirm" is refused.

Tremor guard adds press-and-hold to confirm, a countdown with a big Cancel button before a payment is sent, and steady taps.

## Notes and limits

- **Voice input and "Hey Ziva"** use the browser's speech recognition (Chrome and Edge; Safari partly; Firefox not at all). Without it, "Talk to Echo" still works by typing. Chrome may send the audio to its speech service. Continuous listening only starts if the microphone is already allowed, and uses battery.
- **Headphone detection** is best effort: browsers only show device names once the microphone is allowed. If it can't tell, Echo treats you as not wearing them (set Privacy mode to Headphones to say you are).
- **Vibration** works on Android Chrome, not on iPhones or most desktops.
- **Biometrics are simulated.** Nothing is read from a device sensor.
- **PIN storage** is a salted SHA-256 when the page is on https or localhost; on plain http it falls back to a weaker non-cryptographic hash. Fine for a demo, not for a real bank.
- **Languages:** Echo understands English, Pidgin and the main Yoruba commands, and replies in English or Pidgin.
- Auto-lock after 2 minutes of inactivity (6 with "Longer time limits"), never in the middle of a payment.

## What else is in it

Login with a shuffled keypad, swipeable accounts (Savings, Current, Fixed Deposit), quick links and a side menu, transfer (own account / Zenith / other banks, bank search, beneficiaries, fee + VAT), airtime and data, electricity (prepaid token and kWh, postpaid), cable TV, internet, education, insurance, receipts you can share as text or download as a PNG, and a history list with filters. Every payment goes: form, confirm, fingerprint or PIN, processing, success, receipt.

## Dev shortcuts

In `npm run dev`, open e.g. `http://localhost:5173/#transfer` to jump straight to a screen (`#home`, `#account`, `#airtime`, `#bills`, `#more`, `#passcode`, `#welcome`, `#onboarding`). These are disabled in production builds.
