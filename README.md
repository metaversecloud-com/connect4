# Bulletin Board

## Introduction / Summary

Connect 4 is a completely on-canvas game where two players take turns dropping pieces in an attempt to connect 4 in a row.

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

## Developers:

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
