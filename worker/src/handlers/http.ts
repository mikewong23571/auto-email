import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import messages from "../routes/messages";
import type { Bindings } from "../types";
import { isAppError } from "../utils/errors";

const app = new Hono<{ Bindings: Bindings }>();

// Global Error handling
app.onError((err, c) => {
	console.error("App Error:", err);
	if (isAppError(err)) {
		return c.json({ error: err.message }, err.status);
	}
	return c.json({ error: "Internal Server Error" }, 500);
});

// Middleware for Auth
app.use("/api/*", (c, next) => {
	const token = c.env.API_TOKEN;
	if (!token) {
		return c.json({ error: "API token not configured" }, 500);
	}
	const auth = bearerAuth({ token });
	return auth(c, next);
});

app.route("/api/messages", messages);

app.get("/", (c) => c.text("Cloudflare Mail Cleaner API Running"));

export const httpHandler = app;
