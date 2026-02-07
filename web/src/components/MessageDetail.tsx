import { AtSign, Clock, Mail, User, X } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { useMessage } from "../hooks/useMessages";

interface Props {
  id: string;
  onClose: () => void;
}

export const MessageDetail = ({ id, onClose }: Props) => {
  const { data: response, isLoading, error } = useMessage(id);
  const message = response?.data;

  const [viewMode, setViewMode] = useState<"clean" | "html">("clean");

  const hasHtml = Boolean(message?.body_html);

  const cleanBlocks = useMemo(() => {
    const rawText = (message?.body_text_clean || message?.body_text)?.trim() || "";
    const normalized = rawText
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\u00a0/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .trim();

    if (!normalized)
      return [] as Array<
        { key: string; type: "p"; lines: string[] } | { key: string; type: "ul"; items: string[] }
      >;

    const paragraphs = normalized.split(/\n{2,}/g).filter(Boolean);
    return paragraphs.map((paragraph) => {
      const lines = paragraph
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const isList = lines.length > 1 && lines.every((l) => /^[-*]\s+/.test(l));
      if (isList) {
        const items = lines.map((l) => l.replace(/^[-*]\s+/, ""));
        return { key: paragraph, type: "ul" as const, items };
      }
      return { key: paragraph, type: "p" as const, lines };
    });
  }, [message?.body_text, message?.body_text_clean]);

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
    if (viewMode === "html" && message.body_html) {
      return (
        <div
          className="message-body"
          data-view="html"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Sanitized in backend
          dangerouslySetInnerHTML={{ __html: message.body_html }}
        />
      );
    }

    if (cleanBlocks.length === 0) {
      return (
        <pre className="message-body message-body--text">
          {message.body_text_clean || message.body_text}
        </pre>
      );
    }

    return (
      <div className="message-body">
        {cleanBlocks.map((block) => {
          if (block.type === "ul") {
            return (
              <ul key={block.key}>
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            );
          }
          return (
            <p key={block.key}>
              {block.lines.map((line, lineIdx) => (
                <Fragment key={line}>
                  {lineIdx > 0 ? <br /> : null}
                  {line}
                </Fragment>
              ))}
            </p>
          );
        })}
      </div>
    );
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
          <div className="modal-header-right">
            <fieldset className="view-toggle" aria-label="Message view">
              <button
                type="button"
                onClick={() => setViewMode("clean")}
                className={`view-toggle-btn ${viewMode === "clean" ? "active" : ""}`}
                aria-pressed={viewMode === "clean"}
              >
                Clean
              </button>
              <button
                type="button"
                onClick={() => setViewMode("html")}
                disabled={!hasHtml}
                className={`view-toggle-btn ${viewMode === "html" ? "active" : ""}`}
                aria-pressed={viewMode === "html"}
              >
                HTML
              </button>
            </fieldset>

            <button type="button" onClick={onClose} className="btn btn-close" aria-label="Close">
              <X size={20} />
            </button>
          </div>
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
