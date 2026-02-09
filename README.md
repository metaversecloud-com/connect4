# Connect 4

## Introduction / Summary

Connect 4 is a completely on-canvas game where two players take turns dropping pieces in an attempt to connect 4 in a row.

## Built With

### Client

![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)

### Server

![Node.js](https://img.shields.io/badge/node.js-%2343853D.svg?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/express-%23000000.svg?style=for-the-badge&logo=express&logoColor=white)

## Key Features

### Canvas elements & interactions

- Key Asset Reset Button: When clicked this asset will reset the board so that a new game can begin. If a game is in progress, only the current players or an admin can click Reset.
- Player Selectors: A user can become a player by clicking on one of the game pieces on either side of the board.
- Drop Pieces: The players can take turns clicking on the arrows above the column where they want to drop their piece.

### Admin features

- Reset Button: Clicking on the Reset Button as an admin will remove all assets and rebuild the board completely. This is especially helpful if an interactive asset has accidentally been deleted.

### Data objects

- Key Asset: the data object attached to the Reset Button key asset can stores all of the game play information including current players, player turn status, and game status.
- World: the data object attached to the world will store the key asset id of each dropped scene indexed by `dropSceneId`. This allows world builders the option of dropping just the key asset and clicking Reset for the first time to build the board OR dropping the entire board as a prebuilt scene removing the need to click Reset to build the board for the first time.

## Implementation Requirements

### Required Assets with Unique Names

The app dynamically generates assets with the following unique names:

| Unique Name | Description |
|-------------|-------------|
| `board` | The board background image |
| `gameText` | Game status message |
| `player1Text` | Player 1 name display |
| `player2Text` | Player 2 name display |
| `player1` | Player 1 selection button |
| `player2` | Player 2 selection button |
| `selector` | Column drop arrows (7 total, all share this name) |
| `claimedSpace` | Game pieces placed on board |
| `crown` | Victory crown for winner |

## Developers

### Getting Started

- Clone this repository
- Run `npm i` in root folder

### Add your .env environmental variables

```json
APP_URL
INSTANCE_DOMAIN=api.topia.io
INSTANCE_PROTOCOL=https
INTERACTIVE_KEY=xxxxxxxxxxxxx
INTERACTIVE_SECRET=xxxxxxxxxxxxxx
S3_BUCKET=https://mybucket.s3.amazonaws.com/
```

### Where to find INTERACTIVE_KEY and INTERACTIVE_SECRET

[Topia Dev Account Dashboard](https://dev.topia.io/t/dashboard/integrations)

[Topia Production Account Dashboard](https://topia.io/t/dashboard/integrations)

### Helpful links

- [SDK Developer docs](https://metaversecloud-com.github.io/mc-sdk-js/index.html)
- [View it in action!](topia.io/connect4-prod)
<!-- - [Notion One Pager](https://www.notion.so/topiaio/) -->
