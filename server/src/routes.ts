import express, { NextFunction, Request, Response } from "express";
import handleResetBoard from "./controllers/handleResetBoard.js";
const router = express.Router();

router.post("/gameplay", (req: Request, res: Response) => {});
router.post("/resetgame", handleResetBoard);


// Error handling
router.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(err);
  res.status(500).send({ success: false, message: err.message });
});

export default router;