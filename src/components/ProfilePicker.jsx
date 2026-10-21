import { PROFILES } from '../a11y/profiles'
import { useAccessibility } from '../a11y/context'
import useFocusOnMount from '../a11y/useFocusOnMount'

export default function ProfilePicker() {
  const { chooseProfile } = useAccessibility()
  const headingRef = useFocusOnMount()

  return (
    <main className="screen">
      <h1 className="screen-title" ref={headingRef} tabIndex={-1}>
        How can Echo help you?
      </h1>
      <p className="screen-lead">Choose what fits you best. You can change it later.</p>
      <ul className="choice-list">
        {PROFILES.map((profile) => (
          <li key={profile.id}>
            <button className="choice" onClick={() => chooseProfile(profile.id)}>
              <span className="choice-title">{profile.title}</span>
              <span className="choice-description">{profile.description}</span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}