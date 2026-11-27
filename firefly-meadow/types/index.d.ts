// Whether the theme is showing. Kept for the session.
export type IsOn = boolean

declare module 'claude-code' {
  interface PluginState {
    'firefly-meadow': { isOn: IsOn }
  }
}
