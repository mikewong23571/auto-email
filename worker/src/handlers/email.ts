import PostalMime from "postal-mime";
import { getDatabase, insertMessage } from "../db/client";
import { sanitizeHtml, extractText } from "../utils/html";
import { AppError } from "../utils/errors";
import type { Message } from "../types";

import type { Bindings } from "../types";

const FORWARD_EMAIL_ADDRESS = "styleofwong@gmail.com";

// Maximum accepted raw email size for local processing: 10MB
const MAX_EMAIL_BYTES = 10 * 1024 * 1024;

export const emailHandler = async (
  message: ForwardableEmailMessage,
  env: Bindings,
  ctx: ExecutionContext,
) => {
  try {
    const emailSize = message.rawSize;

    if (emailSize > MAX_EMAIL_BYTES) {
      // Email too large for local processing, just forward it
      console.log(
        `Email from ${message.from} (${emailSize} bytes) exceeds ${MAX_EMAIL_BYTES} byte limit, forwarding only`,
      );
      await message.forward(FORWARD_EMAIL_ADDRESS);
      return;
    }

    // Process locally (size within limit)
    const parser = new PostalMime({
      maxNestingDepth: 5,
      maxHeadersSize: 256 * 1024,
    });
    const email = await parser.parse(message.raw as ReadableStream<Uint8Array>);

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
    console.log(`Email from ${message.from} processed and stored locally`);
  } catch (err) {
    console.error("Error processing email:", err);
    throw err;
  }
};
