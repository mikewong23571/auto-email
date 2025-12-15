import { AtSign, Clock, Mail, User, X } from "lucide-react";
import { useMessage } from "../hooks/useMessages";

interface Props {
  id: string;
  onClose: () => void;
}

export const MessageDetail = ({ id, onClose }: Props) => {
  const { data: response, isLoading, error } = useMessage(id);
  const message = response?.data;

  if (isLoading) return <div className="status-loading">Loading...</div>;
  if (error) return <div className="status-error">Error loading message</div>;
  if (!message) return null;

  const formatDateTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const renderBody = () => {
    if (message.body_html) {
      return (
        <div
          className="message-body"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Sanitized in backend
          dangerouslySetInnerHTML={{ __html: message.body_html }}
        />
      );
    }
    return <pre className="message-body message-body--text">{message.body_text}</pre>;
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-header-left">
            <Mail size={20} className="modal-header-icon" />
            <h2 className="modal-title">{message.subject || "(No Subject)"}</h2>
          </div>
          <button type="button" onClick={onClose} className="btn btn-close" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="modal-meta">
          <div className="modal-meta-grid">
            <div className="meta-item">
              <User size={14} className="meta-icon" />
              <span className="modal-meta-label">From</span>
              <span className="modal-meta-value">{message.from_addr}</span>
            </div>
            <div className="meta-item">
              <AtSign size={14} className="meta-icon" />
              <span className="modal-meta-label">To</span>
              <span className="modal-meta-value">{message.to_addr}</span>
            </div>
            <div className="meta-item">
              <Clock size={14} className="meta-icon" />
              <span className="modal-meta-label">Received</span>
              <span className="modal-meta-value">{formatDateTime(message.received_at)}</span>
            </div>
          </div>
        </div>
        <div className="modal-body">{renderBody()}</div>
      </div>
    </div>
  );
};
