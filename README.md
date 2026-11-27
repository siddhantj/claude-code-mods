# Claude Code mods

Mods I've made for Claude Code. Each one lives in its own folder and installs on its own.

| Mod | What it does | Where it shows |
| --- | --- | --- |
| [`thor-thanos`](thor-thanos/) | A 10-second pixel-art loop of Thor (Stormbreaker) fighting Thanos (Infinity Gauntlet), drawn dimmed along the bottom of the window, behind the chat. Off until you run `/thor-thanos`; run it again to stop. | Terminal, fullscreen layout |
| [`firefly-meadow`](firefly-meadow/) | A dusky meadow behind the app with a matching dusk color theme. Fireflies multiply as the context window fills: 12 when empty, 87 when full. | Desktop app |
| [`winter-night`](winter-night/) | A winter night with a matching color theme. Snow falls harder as the context window fills, and turns into a storm as auto-compaction nears. The status line says how far you are from auto-compact. | Desktop app (still backdrop) and terminal (falling snow, fullscreen layout) |

`firefly-meadow` and `winter-night` both set the color theme, so turn on one of them at a time.

## Install

### Straight from GitHub

At the prompt of a Claude Code terminal session, one line per mod:

```
/plugin install thor-thanos --marketplace siddhantj/claude-code-mods
/plugin install firefly-meadow --marketplace siddhantj/claude-code-mods
/plugin install winter-night --marketplace siddhantj/claude-code-mods
```

Answer `y` to add the marketplace, then pick a scope (the user scope loads the mod in every session). The mod is active as soon as it says `Installed`.

From a shell instead:

```
claude plugin install thor-thanos --marketplace siddhantj/claude-code-mods
```

In the desktop app, where `/plugin` does not run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `siddhantj/claude-code-mods`, then **Add plugin**.

### From a downloaded copy

1. Download this repository (`git clone https://github.com/siddhantj/claude-code-mods`, or **Code → Download ZIP** and unzip it).
2. Install a mod from that folder, giving its path as the marketplace:

   ```
   claude plugin install thor-thanos --marketplace /path/to/claude-code-mods --scope user
   ```

   On Windows the path looks like `C:/Users/you/claude-code-mods`.
3. Start a new Claude Code session. Sessions that were already open pick the mod up after a restart.

The install reads from the folder you downloaded, so keep the folder where it is.

To try a mod once without installing it:

```
claude --plugin-dir /path/to/claude-code-mods/thor-thanos
```

### Turn one off or remove it

```
claude plugin disable winter-night
claude plugin uninstall winter-night
```

## Where mods live on a machine

- **While being written:** `~/.claude/dev-mods/<session-id>/<mod-name>/` (on Windows, `C:\Users\<you>\.claude\dev-mods\...`). A mod there loads only in the session that wrote it, which is why a new mod's command is missing from other sessions.
- **Kept and shared:** this repository. Each mod's folder here is the copy to edit and install from.
- **Installed:** `claude plugin list` shows every installed mod, its scope and the folder it reads from.

## What is in a mod folder

```
<mod>/
  .claude-plugin/plugin.json   name, version, description
  hooks/hooks.json             names the hooks module
  hooks/register.tsx           the mod's code
  hooks/*.test.tsx             its tests
  types/index.d.ts             the values it keeps (only where it keeps any)
```

Check a mod after changing it:

```
claude plugin validate <mod folder>
claude plugin test <mod folder>
```

## Notes

- The terminal mods draw behind the chat only in the fullscreen layout, and only in blank cells. They are not drawn with reduced motion on.
- `thor-thanos` is fan art. Thor and Thanos are Marvel characters; this project is not affiliated with or endorsed by Marvel.
