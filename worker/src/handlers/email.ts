import PostalMime from "postal-mime";
import { getDatabase, insertMessage } from "../db/client";
import { sanitizeHtml, extractText } from "../utils/html";
import type { Message } from "../types";

import type { ForwardableEmailMessage } from "@cloudflare/workers-types";
import type { Bindings } from "../types";

export const emailHandler = async (
	message: ForwardableEmailMessage,
	env: Bindings,
	ctx: ExecutionContext,
) => {
	try {
		const raw = message.raw; // ReadableStream
		// postal-mime expects ArrayBuffer or similar?
		// It handles readable stream in some versions, or we convert.
		// Cloudflare message.raw is a stream.
		// We can read it to ArrayBuffer.

		// Simplest: consume stream to ArrayBuffer
		const chunks = [];
		const reader = raw.getReader();
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			chunks.push(value);
		}
		const blob = new Blob(chunks as BlobPart[]);
		const arrayBuffer = await blob.arrayBuffer();

		const parser = new PostalMime();
		const email = await parser.parse(arrayBuffer);

		const id = crypto.randomUUID();
		const to_addr = message.to;
		const from_addr = message.from;
		const subject = email.subject || "(No Subject)";

		let body_html = email.html || "";
		let body_text = email.text || "";

		if (!body_text && body_html) {
			body_text = extractText(body_html);
		}

		if (body_html) {
			body_html = sanitizeHtml(body_html);
		}

		const msg: Message = {
			id,
			to_addr,
			from_addr,
			subject,
			body_text,
			body_html,
			received_at: Math.floor(Date.now() / 1000),
		};

		const db = getDatabase(env);
		await insertMessage(db, msg);
	} catch (err) {
		console.error("Error processing email:", err);
		// Explicitly do not reject to avoid bouncing back to sender if possible,
		// or reject if we want to signal failure.
		// Usually for forwarders we might want to log only.
	}
};
