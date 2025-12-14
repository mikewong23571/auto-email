import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import messages from "../routes/messages";
import type { Bindings } from "../types";

const app = new Hono<{ Bindings: Bindings }>();

// Global Error handling
app.onError((err, c) => {
	console.error("App Error:", err);
	return c.json({ error: err.message }, 500);
});

// Middleware for Auth
app.use("/api/*", (c, next) => {
	const token = c.env.API_TOKEN;
	const auth = bearerAuth({ token });
	return auth(c, next);
});

app.route("/api/messages", messages);

app.get("/", (c) => c.text("Cloudflare Mail Cleaner API Running"));

export const httpHandler = app;
