export interface Message {
	id: string;
	to_addr: string;
	from_addr: string;
	subject: string;
	body_text?: string;
	body_html?: string;
	received_at: number;
	has_html?: boolean; // Derived or partial
	preview?: string;
}

export interface MessageListResponse {
	data: Message[];
}

export interface MessageDetailResponse {
	data: Message;
}
