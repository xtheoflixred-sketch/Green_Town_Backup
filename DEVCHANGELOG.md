# Dev Changelog

## Season 1 — Patch 9 | Exp. Only

### Notes
- This is the biggest patch with changes so far.
- A full announcement and detailed breakdown will be shared later.

---

## Season 1 — Patch 8 | Exp. Only

### Roles
- Added the `Builder` role
- Added the `NPC` role

### Tools
- Significantly redesigned and simplified the map editor
- Removed multiple unused debugging functions and options from the map editor

### Admin
- Added a new `Chat-Log` tab to the admin panel
- The Chat-Log allows administrators to view the complete in-game chat history from all players

---

## Season 1 — Patch 7 | Exp. Only

### Tools
- Ported multiple home building tools to the moderator map editor
- Updated the map editor with additional building functionality

### Maps
- Added `ItemTrigger` to `CustomMap`
- Allows held items to be placed directly inside the trigger area
- Added NPC testing to `TestMap`
- NPCs can now appear and walk around the map

### UI
- Added role-based quick access buttons in the top-right account menu
- Depending on the assigned role, players can access:
	- Admin Panel
	- Map Preview
	- Other development and moderation pages

---

## Season 1 — Patch 6 | Exp. Only

### Commands
- Updated the moderator `/tp` command
- Added `/tp here <name>`:
	- Teleports the selected player to you
- Added `/tp to <name>`:
	- Teleports you to the selected player
- Updated `/tp <x> <y>`:
	- Added support for decimal coordinates such as `5.2` and `6.9`
- Added `/tp here all`:
	- Teleports all players to your location

### Fixes
- Fixed an issue where teleporting to a player in another location was not possible
- Fixed an issue preventing players in other locations from being teleported to your location

### Tools
- Completely redesigned the map preview page at `/tools/map`

---

## Season 1 — Patch 5 | Exp. Stable

### Tools
- Fully redesigned the Tools homepage
- Added a new icon preview tab in `tools/ui` (some icons may be missing)

#### Updated Icons
- Discord
- Patreon
- VK

#### Icons added
- CircleUser
- HandWave
- Megaphone
- Note
- Pencil
- Redo
- Slash
- Thumbtack
- Undo
- UserCheck
- UserMinus
- UsersSlash

---

## Season 1 — Patch 4 | Experimental

### Changes
- Updated `/time` (moderators): can freeze time at a specific value (e.g., `/time 12:54 stop`)
- Updated `/tp`: teleport to players, teleport players to you, added system messages
- Added moderator commands: `/speed`, `/locations`, `/players`, `/maps`
- `/time`: infinite day/night support
- `/collect`: can clear granted items
- Added `/setplaytime` and `/setcreated` (custom account creation date)
- Updated Help page: commands grouped by categories depending on role (Player, Mod, Admin, Dev, Owner)

---

## Season 1 — Patch 3 | Internal

### Changes
- Implemented Build Box component
- Updated icon to `faHammer`
- Added tests for `/collect`, gift milestones, seasonal leaderboard messages
- Updated `start server.bat` and `start server sprites.bat`

---

## Season 1 — Patch 2 | Internal

### Changes
- Added early Build Box component
- Updated Credits and README
- Added developer test visuals