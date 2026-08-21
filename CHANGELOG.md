# Changelog


## Season 1 — Patch 8 | Exp. Only

### Notes
- The server has been renamed to **Green Town**.
- The server is now themed around camping and nature.

### Features
- Added sofas in 10 different colors
- Added armchairs in 10 different colors
- Added home lamps in 10 different colors
- Added berry bushes for all four seasons
- Added regular lush bushes for three seasons
- Added multi-line messages using Shift + Enter
- Added text formatting support:
  - *Italic text*
  - **Bold text**
  - Inline code
  - Links
- Added a context menu for formatting selected text
- The chat type menu can now be opened by right-clicking the chat tag
- Added `/msgcolor` to change the color of [say] messages
- Completely redesigned the command suggestion system
  - Command suggestions now display command categories
  - Added support for subcommands
- Added pupil position customization to the character preview
- Added held item preview in the character editor modal
- Added the ability to recolor regular developer tags
- Supporter tag layering options now only appear when both a supporter tag and regular tag are being used
- Added a completely redesigned toy selection window
- Added square pony portraits for character previews

### Improvements
- Completely redesigned the chat log and message input
- Completely redesigned the character editor's **Options** tab
- Reorganized editor settings for improved navigation
- Updated the Animator with the full set of available in-game animations
- Redesigned and translated the information hints at the beginning of the **Body** and **Options** tabs
- Improved the friends list for easier navigation and overall usability
- Updated the toy window to match the visual style of the game interface
- Improved toy rendering and preview functionality
- Unavailable toys now remain visible in the selection grid as inactive numbered buttons

### Fixes
- Fixed an issue where player tags could disappear if the player did not have the Creator role
- Tags are now displayed correctly to other players in the game world

---

## Season 1 — Patch 7 | Exp. Only

### Notes
- Completely overhauled the building system and home editor.

### Features
- Added new building tools:
  - Rope tool — moves objects
  - Pickaxe tool — clones objects
- Added multi-dragging support for the Rope and Pickaxe tools when holding Shift
- Updated the Hammer tool:
  - Hold Ctrl and drag to move objects
  - Hold Shift and drag to clone objects
- Updated the Saw tool:
  - Drag in a straight line to place walls in a row
  - Use the mouse wheel to switch between available wall materials
  - Added wooden and stone walls
  - Press Space to switch between low and high walls
- Updated the Broom tool:
  - Objects are now highlighted with a red outline when hovered
  - Added a puff animation when removing objects
- Updated the Shovel tool:
  - Floors can now be placed across multiple tiles horizontally and vertically
  - Added a tile placement preview showing width and height
- Added a new registration page
- Added the ability to register using Telegram

### Improvements
- Added individual outlines and improved interactions for most building tools
- Improved the overall building experience for creating and customizing player homes
- Updated player chat bubbles:
  - Supports multiple chat bubbles
  - Chat bubbles now receive a brown tint when hovered
- Completely improved and redesigned the changelog parser and changelog display

---

## Season 1 — Patch 6 | Exp. Only

### Features
- Added Emerald Supporter — Level 4:
  - Added an exclusive supporter chat
  - Can zoom the camera out to view almost the entire map
  - Can open up to three player profiles at the same time
  - Player profiles can be moved around the screen
  - Player profile width can be adjusted
- Updated Gold Supporter — Level 3:
  - Can open and move one player profile around the screen
- Updated Bronze Supporter — Level 2:
  - Added access to preview all effects in the character editor
- Added friend pinning:
  - Pinned friends are moved to a separate pinned section
- Added sorting options to the friends list
- Added the ability to view a friend's last online time
- Added personal notes for friends
- Added a test version of the in-game character editor:
  - Can be opened by clicking the pencil button in the character list
  - Can also be opened through "Edit Character" in the settings dropdown
- Updated the AFK system:
  - Players are marked as AFK after being inactive for some time
  - Continued inactivity causes the character to fall asleep
  - Players are eventually disconnected after prolonged inactivity

### Improvements
- Completely redesigned the character list:
  - Added character portraits
  - Improved navigation
  - Added search functionality
  - Added sorting options
  - Added social network indicators for individual characters
- Completely updated the in-game music player:
  - Music is now displayed correctly
  - Added track seeking
  - Added pause functionality
  - Added previous and next track controls
  - Added a small audio visualizer next to the track title
  - The player can now be collapsed and expanded
  - The player automatically hides when the music volume is set to zero
- Improved various systems and fixed multiple issues from previous patches

### Fixes
- Fixed double-clicking when changing eye direction for different facial expressions
- Fixed switching between normal and scared eye expressions using the "-" key on the numpad
- Fixed multiple minor issues and bugs

### Removed
- Removed the Discord button

## Season 1 — Patch 5 | Exp. Stable

### Fixes
- Fixed multiple issues from Patch 4
- Fixed a critical issue with changelog display

### Features
- Added the ability to change chat type by holding the chat tag or clicking it (LMB)
- Added typing indicator
- Added support for up to three chat bubbles
- Added VK button
- Added UI toggle in the game world (F6 key)

### Improvements
- Replaced advertisement button images with SVG icons
- Completely redesigned and updated the character list

### Removed
- Removed Discord Pony button

---

*More updates coming soon...*

---

## Season 1 — Patch 4 | Unstable

### Notes
- This update has not been tested and may be unstable.

### Changes
- Added the **Imported Character** window
- Added the **Character Deletion** window
- Added the **Changelog** popup window
- Changelog improvements:
  - Opens when hovering over the "Changelog" label
  - Automatically opens after a server update
  - Automatically opens after a server restart (test builds)
- Account system changes:
  - Split `/account` into `/accountdate`, `/accountid`, and `/playtime`
  - Added `/age` (displays date of birth)
- Added `/collections` (`/col`) — shows toys, gifts, eggs, clovers, candies
- Added `/achievements` (`/achs`)
  - Displays contextual player messages based on account age and playtime
- Updated command system:
  - Commands are now organized into categories (`/help` or `/?`)
- Fixed issues:
  - Fixed `scale` in character editor
  - Fixed `background` issues in editor

---

## Season 1 — Patch 3 | Stable

### Changes
- Updated project name to **"The 🍏 Server"** across components
- Added character scale customization
- Added emoji button to character name input
- Updated `/toys` command:
  - Shows collected toys or a message if none are collected
- Added `/collect` (admin):
  - Modify gifts, candies, toys
- Added milestone tracking for collected gifts
- Added utility functions:
  - `formatISODate` (YYYY-MM-DD)
  - `alignColumns` (text alignment)

---

## Season 1 — Patch 2 | Stable

### Changes
- Updated account info:
  - Added creation date
  - Added total playtime
- Updated stats UI:
  - Moved to top center
  - Added pony coordinates display
- Fixed various bugs

---

## Season 1 — Patch 1 | Stable

### Changes
- Initial server release
- Updated server logo
- Added account info page
- Updated loading screen