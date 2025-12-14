import { z } from "zod";

export const MessageSchema = z.object({
	id: z.string(),
	to_addr: z.string().email(),
	from_addr: z.string().email(),
	subject: z.string().optional(),
	body_text: z.string().optional(),
	body_html: z.string().optional(),
	received_at: z.number(),
});
