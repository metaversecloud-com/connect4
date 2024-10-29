import express, { NextFunction, Request, Response } from "express";
import auth from "./middleware/auth.js";
import { handleDropPiece, handlePlayerSelection, handleResetBoard } from "./controllers/index.js";
import { getVersion } from "./utils/getVersion.js";

const router = express.Router();
const SERVER_START_DATE = new Date();

router.post("/select-player/:player", auth, handlePlayerSelection);
router.post("/click/:column", auth, handleDropPiece);
router.post("/reset", auth, handleResetBoard);

router.get("/system/health", (req, res) => {
  return res.json({
    appVersion: getVersion(),
    status: "OK",
    serverStartDate: SERVER_START_DATE,
    envs: {
      COMMIT_HASH: process.env.COMMIT_HASH,
      NODE_ENV: process.env.NODE_ENV,
      INSTANCE_DOMAIN: process.env.INSTANCE_DOMAIN,
      INTERACTIVE_KEY: process.env.INTERACTIVE_KEY,
      S3_BUCKET: process.env.S3_BUCKET,
      GOOGLESHEETS_CLIENT_EMAIL: process.env.CLIENT_EMAIL ? "SET" : "UNSET",
      GOOGLESHEETS_SHEET_ID: process.env.SHEET_ID ? "SET" : "UNSET",
      GOOGLESHEETS_PRIVATE_KEY: process.env.PRIVATE_KEY ? "SET" : "UNSET",
      GOOGLESHEETS_SHEET_RANGE: process.env.GOOGLESHEETS_SHEET_RANGE ? "SET" : "UNSET",
    },
  });
});

// Error handling
router.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(err);
  res.status(500).send({ success: false, message: err.message });
});

export default router;
