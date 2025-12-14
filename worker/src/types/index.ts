import type { z } from "zod";
import type { MessageSchema } from "../schemas/messages";
import type { D1Database } from "@cloudflare/workers-types";

export type Message = z.infer<typeof MessageSchema>;

export type Bindings = {
	DB: D1Database;
	API_TOKEN: string;
};
