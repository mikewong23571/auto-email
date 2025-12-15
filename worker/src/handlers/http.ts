import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import messages from "../routes/messages";
import type { Bindings } from "../types";
import { AppError, isAppError } from "../utils/errors";
import type { ContentfulStatusCode } from "hono/utils/http-status";

const app = new Hono<{ Bindings: Bindings }>();

// Global Error handling
app.onError((err, c) => {
  console.error("App Error:", err);
  if (isAppError(err)) {
    return c.json({ error: err.message }, err.status as ContentfulStatusCode);
  }
  return c.json({ error: "Internal Server Error" }, 500);
});

// Middleware for Auth
app.use("/api/*", async (c, next) => {
  const token = c.env.API_TOKEN;
  if (!token) {
    throw new AppError(500, "API token not configured");
  }
  const auth = bearerAuth({ token });
  return auth(c, next);
});

app.route("/api/messages", messages);

app.get("/", (c) => c.text("Cloudflare Mail Cleaner API Running"));

export const httpHandler = app;
