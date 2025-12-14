import { Hono } from "hono";
import { z } from "zod";
import {
	getDatabase,
	getMessages,
	getLatestMessages,
	getMessage,
	deleteMessage,
} from "../db/client";
import type { Bindings } from "../types";

const messages = new Hono<{ Bindings: Bindings }>();

messages.get("/", async (c) => {
	const to = c.req.query("to");
	const q = c.req.query("q"); // search query
	const limit = Number.parseInt(c.req.query("limit") || "20");
	const offset = Number.parseInt(c.req.query("offset") || "0");

	const db = getDatabase(c.env);
	const results = await getMessages(db, limit, offset, to, q);

	return c.json({ data: results });
});

messages.get("/latest", async (c) => {
	const to = c.req.query("to");
	const n = Number.parseInt(c.req.query("n") || "5");

	if (!to) return c.json({ error: "Missing to address" }, 400);

	const db = getDatabase(c.env);
	const results = await getLatestMessages(db, n, to);
	return c.json({ data: results });
});

messages.get("/:id", async (c) => {
	const id = c.req.param("id");
	const db = getDatabase(c.env);
	const msg = await getMessage(db, id);
	if (!msg) return c.json({ error: "Not found" }, 404);
	return c.json({ data: msg });
});

messages.delete("/:id", async (c) => {
	const id = c.req.param("id");
	const db = getDatabase(c.env);
	await deleteMessage(db, id);
	return c.json({ success: true });
});

export default messages;
