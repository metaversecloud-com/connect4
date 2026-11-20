import express, { NextFunction, Request, Response } from "express";
import bodyParser from "body-parser";
import router from "./routes.js";
import cors from "cors";
import "dotenv/config";

function checkEnvVariables() {
  const requiredEnvVariables = ["APP_URL", "S3_BUCKET", "INTERACTIVE_KEY", "INTERACTIVE_SECRET"];
  const missingVariables = requiredEnvVariables.filter((variable) => !process.env[variable]);

  if (missingVariables.length > 0) {
    throw new Error(`Missing required environment variables in the .env file: ${missingVariables.join(", ")}`);
  }
}
checkEnvVariables();

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
// A malformed JSON body gets a clean 400 instead of Express' default error page (stack trace, file paths).
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err?.type === "entity.parse.failed") return res.status(400).json({ success: false, error: "Invalid JSON" });
  next(err);
});
app.use("/api", router);

// Prevent crashes from unhandled promise rejections (e.g., API timeouts after response sent).
// @rtsdk/topia registers its own handler that calls process.exit(1) when it's imported: remove it first.
process.removeAllListeners("unhandledRejection");
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  // ERR_HTTP_HEADERS_SENT is non-fatal — response was already sent, just log it
  if ((error as any).code === "ERR_HTTP_HEADERS_SENT") {
    console.error("Caught ERR_HTTP_HEADERS_SENT (response already sent):", error.message);
    return;
  }
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
