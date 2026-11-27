// Whether the fight is playing. Kept for the session.
export type IsOn = boolean

declare module 'claude-code' {
  interface PluginState {
    'thor-thanos': { isOn: IsOn }
  }
}
