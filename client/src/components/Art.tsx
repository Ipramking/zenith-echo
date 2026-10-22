/** Background artwork for the pre-login screens, drawn as SVG. */

export function WaveBg() {
  return (
    <svg className="art" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="splashGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e4001f" />
          <stop offset=".55" stopColor="#a50a25" />
          <stop offset="1" stopColor="#5e1020" />
        </linearGradient>
        <pattern id="waves" width="11" height="60" patternUnits="userSpaceOnUse">
          <path d="M5.5 0C9.5 10 1.5 20 5.5 30S9.5 50 5.5 60" fill="none" stroke="rgba(0,0,0,.22)" strokeWidth="1.1" />
        </pattern>
      </defs>
      <rect width="390" height="844" fill="url(#splashGrad)" />
      <rect width="390" height="844" fill="url(#waves)" />
    </svg>
  )
}

export function SwooshBg() {
  return (
    <svg className="art" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="passGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c10000" />
          <stop offset="1" stopColor="#ec0a0a" />
        </linearGradient>
      </defs>
      <rect width="390" height="844" fill="url(#passGrad)" />
      <path d="M-20 90C130 40 210 250 140 420S-40 700 -20 844H-90V90Z" fill="rgba(0,0,0,.14)" />
      <path d="M430 30C300 160 380 340 300 520S380 760 430 844V30Z" fill="rgba(0,0,0,.16)" />
      <path d="M70 0C230 200 70 380 260 560S380 720 250 844H410V0Z" fill="rgba(255,255,255,.05)" />
      <path d="M0 640C120 560 220 700 390 600V844H0Z" fill="rgba(0,0,0,.1)" />
    </svg>
  )
}

/** Dim grey backdrop with abstract red/grey 3D shapes, like the existing welcome screen. */
export function ShapesBg() {
  return (
    <svg className="art" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="shapesBase" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#56565a" />
          <stop offset="1" stopColor="#38383b" />
        </linearGradient>
        <radialGradient id="redBall" cx=".35" cy=".3" r=".8">
          <stop offset="0" stopColor="#e5333a" />
          <stop offset="1" stopColor="#7a0a10" />
        </radialGradient>
        <radialGradient id="greyBall" cx=".35" cy=".3" r=".8">
          <stop offset="0" stopColor="#b4b4b8" />
          <stop offset="1" stopColor="#505054" />
        </radialGradient>
        <linearGradient id="greyCube" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a8a8ac" />
          <stop offset="1" stopColor="#5a5a5e" />
        </linearGradient>
        <linearGradient id="redRing" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e5333a" />
          <stop offset="1" stopColor="#8a0c13" />
        </linearGradient>
      </defs>
      <rect width="390" height="844" fill="url(#shapesBase)" />
      <rect x="22" y="548" width="92" height="92" rx="16" fill="url(#greyCube)" transform="rotate(-18 68 594)" />
      <circle cx="205" cy="610" r="84" fill="url(#redBall)" />
      <circle cx="338" cy="582" r="40" fill="url(#redBall)" />
      <circle cx="338" cy="738" r="44" fill="none" stroke="url(#redRing)" strokeWidth="26" />
      <circle cx="88" cy="742" r="54" fill="url(#greyBall)" />
      <circle cx="210" cy="760" r="34" fill="url(#redBall)" />
      <rect x="0" y="0" width="390" height="844" fill="rgba(30,30,32,.38)" />
    </svg>
  )
}
