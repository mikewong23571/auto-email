import { Hono } from "hono";
import { z } from "zod";
import {
	getDatabase,
	getMessages,
	getLatestMessages,
	getMessage,
	deleteMessage,
	deleteMessages,
} from "../db/client";
import type { Bindings } from "../types";
import { AppError } from "../utils/errors";

const messages = new Hono<{ Bindings: Bindings }>();

const listQuerySchema = z
	.object({
		to: z.string().email().optional(),
		q: z
			.preprocess(
				(val) => {
					const str = typeof val === "string" ? val.trim() : "";
					return str.length > 0 ? str : undefined;
				},
				z.string(),
			)
			.optional(),
		limit: z
			.preprocess(
				(val) => Number.parseInt(String(val ?? "20"), 10),
				z.number().int().positive().max(100),
			)
			.default(20),
		offset: z
			.preprocess(
				(val) => Number.parseInt(String(val ?? "0"), 10),
				z.number().int().min(0),
			)
			.default(0),
	})
	.refine((data) => data.q || data.to, {
		message: "to is required when q is empty",
		path: ["to"],
	});

const latestQuerySchema = z.object({
	to: z.string().email(),
	n: z
		.preprocess(
			(val) => Number.parseInt(String(val ?? "5"), 10),
			z.number().int().positive().max(20),
		)
		.default(5),
});

const batchDeleteSchema = z.object({
	ids: z.array(z.string().min(1)).min(1).max(100),
});

messages.get("/", async (c) => {
	const parsed = listQuerySchema.safeParse({
		to: c.req.query("to"),
		q: c.req.query("q"),
		limit: c.req.query("limit"),
		offset: c.req.query("offset"),
	});

	if (!parsed.success) {
		throw new AppError(400, parsed.error.issues[0].message);
	}

	const { to, q, limit, offset } = parsed.data;

	const db = getDatabase(c.env);
	const results = await getMessages(db, limit, offset, to, q);

	return c.json({ data: results });
});

messages.get("/latest", async (c) => {
	const parsed = latestQuerySchema.safeParse({
		to: c.req.query("to"),
		n: c.req.query("n"),
	});

	if (!parsed.success) {
		throw new AppError(400, parsed.error.issues[0].message);
	}

	const { to, n } = parsed.data;

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

messages.post("/batch-delete", async (c) => {
	const body = await c.req.json();
	const parsed = batchDeleteSchema.safeParse(body);

	if (!parsed.success) {
		throw new AppError(400, parsed.error.issues[0].message);
	}

	const db = getDatabase(c.env);
	const { ids } = parsed.data;
	const { changes } = await deleteMessages(db, ids);

	return c.json({ deleted: changes ?? 0 });
});

export default messages;
