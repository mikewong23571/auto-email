export interface Message {
  id: string;
  to_addr: string;
  from_addr: string;
  subject: string;
  body_text?: string;
  body_html?: string;
  received_at: number;
  has_html?: boolean;
  preview?: string;
}

export interface MessageListResponse {
  data: Message[];
  total: number;
  limit: number;
  offset: number;
}

export interface MessageDetailResponse {
  data: Message;
}
