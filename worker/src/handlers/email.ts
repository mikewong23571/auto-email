import PostalMime from "postal-mime";
import { getDatabase, insertMessage } from "../db/client";
import { sanitizeHtml, extractText } from "../utils/html";
import { AppError } from "../utils/errors";
import type { Message } from "../types";

import type { ForwardableEmailMessage } from "@cloudflare/workers-types";
import type { Bindings } from "../types";

export const emailHandler = async (
	message: ForwardableEmailMessage,
	env: Bindings,
	ctx: ExecutionContext,
) => {
	try {
		const arrayBuffer = await readStreamToArrayBuffer(
			message.raw as ReadableStream<Uint8Array>,
		);

		const parser = new PostalMime({
			// Guard against deeply nested MIME parts / oversized headers
			maxNestingDepth: 5,
			maxHeadersSize: 256 * 1024,
		});
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

		if (!body_text && !body_html) {
			throw new AppError(422, "No email body after parsing");
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
		// Signal failure so the platform can surface the error; ensures bad
		// messages don't get silently acknowledged.
		throw err;
	}
};

// Maximum accepted raw email size: 10MB
const MAX_EMAIL_BYTES = 10 * 1024 * 1024;

const readStreamToArrayBuffer = async (stream: ReadableStream) => {
	const reader = stream.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		if (!value) continue;
		total += value.byteLength;
		if (total > MAX_EMAIL_BYTES) {
			throw new AppError(413, "Email exceeds 10MB limit");
		}
		chunks.push(value);
	}

	const buffer = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		buffer.set(chunk, offset);
		offset += chunk.byteLength;
	}

	return buffer.buffer;
};
