export const SCALES = [1, 1.2, 1.4, 1.6, 1.8, 2]

export const DEFAULT_SETTINGS = {
  profile: null,
  theme: 'dark',
  scale: 0,
  largeTargets: false,
  tremorGuard: false,
  voice: true,
  captions: true,
  haptics: true,
}

export const PROFILES = [
  {
    id: 'vision',
    title: 'I am blind or have low vision',
    description: 'Echo talks you through every step.',
    settings: { scale: 1, voice: true, captions: true, haptics: true },
  },
  {
    id: 'vision-hearing',
    title: 'I have low vision and find speech hard to hear',
    description: 'Extra-large text, captions and vibration cues.',
    settings: { scale: 3, largeTargets: true, voice: false, captions: true, haptics: true },
  },
  {
    id: 'motor',
    title: 'I have tremors or find tapping difficult',
    description: 'Bigger buttons, steadier taps and voice control.',
    settings: { scale: 1, largeTargets: true, tremorGuard: true, voice: true, captions: true, haptics: true },
  },
  {
    id: 'standard',
    title: 'Continue with standard settings',
    description: 'You can change this anytime.',
    settings: {},
  },
]