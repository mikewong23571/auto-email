import { ChevronDown, Clock, Filter, Inbox, Search, Trash2, X } from "lucide-react";
import { useDeferredValue, useEffect, useRef, useState, useMemo } from "react";
import type { Message } from "../api/types";
import { useBatchDeleteMessages, useDeleteMessage, useMessages } from "../hooks/useMessages";
import { MessageDetail } from "./MessageDetail";

const PAGE_SIZE = 20;

// Custom hook for managing recent recipients
const useRecentRecipients = () => {
  const [recipients, setRecipients] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("recent_recipients");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const addRecipient = (email: string) => {
    if (!email || !email.includes("@")) return;
    setRecipients((prev) => {
      const newSet = new Set([email, ...prev]);
      const newList = Array.from(newSet).slice(0, 5); // Keep top 5
      localStorage.setItem("recent_recipients", JSON.stringify(newList));
      return newList;
    });
  };

  return { recipients, addRecipient };
};

// Check if email is from a system/automated source
const isSystemEmail = (email: string): boolean => {
  return (
    email.includes("bounce") ||
    email.includes("noreply") ||
    email.includes("no-reply") ||
    email.includes("mailer-daemon") ||
    email.includes("postmaster") ||
    email.endsWith("mandrillapp.com") ||
    email.endsWith("sendgrid.net") ||
    email.endsWith("amazonses.com")
  );
};

// Extract display name from email
const formatFromAddr = (email: string): string => {
  // Truncate long emails
  if (email.length > 30) {
    const [local, domain] = email.split("@");
    if (local && domain) {
      const truncatedLocal = local.length > 15 ? `${local.slice(0, 12)}...` : local;
      const truncatedDomain = domain.length > 15 ? `${domain.slice(0, 12)}...` : domain;
      return `${truncatedLocal}@${truncatedDomain}`;
    }
  }
  return email;
};

export const MessageList = () => {
  const [searchInput, setSearchInput] = useState("");
  const [toAddrInput, setToAddrInput] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Recipient Combobox State
  const [isRecipientFocused, setIsRecipientFocused] = useState(false);
  const { recipients, addRecipient } = useRecentRecipients();
  const recipientWrapperRef = useRef<HTMLDivElement>(null);

  const deferredSearch = useDeferredValue(searchInput);
  const deferredToAddr = useDeferredValue(toAddrInput);

  const offset = page * PAGE_SIZE;
  const {
    data: response,
    isLoading,
    error,
    isFetching,
  } = useMessages(deferredSearch || undefined, deferredToAddr || undefined, offset, PAGE_SIZE);
  const deleteMutation = useDeleteMessage();
  const batchDeleteMutation = useBatchDeleteMessages();

  const messages = Array.isArray(response?.data) ? response.data : [];
  const total = response?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Extract unique recipients from current messages for suggestions
  const suggestedRecipients = useMemo(() => {
    const currentFromMessages = new Set(messages.map((m) => m.to_addr).filter(Boolean));
    const history = new Set(recipients);
    // Combine history and current, prioritizing history
    return Array.from(new Set([...history, ...currentFromMessages])).slice(0, 10);
  }, [messages, recipients]);

  // Close combobox when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        recipientWrapperRef.current &&
        !recipientWrapperRef.current.contains(event.target as Node)
      ) {
        setIsRecipientFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Delete this message?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Delete ${selectedIds.size} selected messages?`)) {
      batchDeleteMutation.mutate(Array.from(selectedIds), {
        onSuccess: () => setSelectedIds(new Set()),
      });
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === messages.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(messages.map((m) => m.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleRecipientSelect = (email: string) => {
    setToAddrInput(email);
    setIsRecipientFocused(false);
    setPage(0);
  };

  const handleRecipientSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      addRecipient(toAddrInput);
      setIsRecipientFocused(false);
    }
  };

  return (
    <div className="message-list-container">
      {/* Search Bar */}
      <div className="search-bar">
        <div className="input-with-icon search-input">
          <Search className="input-icon" size={18} />
          <input
            type="text"
            placeholder="Search messages..."
            className="input-field"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPage(0);
            }}
          />
        </div>

        {/* Recipient Combobox */}
        <div className="combobox-container filter-input" ref={recipientWrapperRef}>
          <div className="input-with-icon">
            <Filter className="input-icon" size={18} />
            <input
              type="email"
              placeholder="Filter by recipient..."
              className="input-field"
              value={toAddrInput}
              onFocus={() => setIsRecipientFocused(true)}
              onChange={(e) => {
                setToAddrInput(e.target.value);
                setPage(0);
              }}
              onKeyDown={handleRecipientSubmit}
              onBlur={() => {
                if (toAddrInput?.includes("@")) {
                  addRecipient(toAddrInput);
                }
              }}
            />
            {suggestedRecipients.length > 0 && (
              <ChevronDown
                size={16}
                className="input-icon-right"
                style={{
                  position: "absolute",
                  right: "12px",
                  color: "var(--color-text-muted)",
                  pointerEvents: "none",
                }}
              />
            )}
          </div>

          {isRecipientFocused && suggestedRecipients.length > 0 && (
            <div className="combobox-dropdown">
              <div className="text-label" style={{ padding: "0 var(--space-3) var(--space-2)" }}>
                {recipients.length > 0 ? "Recent & Suggested" : "Suggested"}
              </div>
              {suggestedRecipients.map((email) => (
                <button
                  key={email}
                  type="button"
                  className="combobox-item"
                  onClick={() => handleRecipientSelect(email)}
                >
                  <Clock size={14} className="combobox-item-icon" />
                  <span className="text-truncate flex-1">{email}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Batch Action Bar - Only visible when items selected */}
      {selectedIds.size > 0 ? (
        <div className="batch-bar">
          <div className="batch-bar-left">
            <button
              type="button"
              onClick={clearSelection}
              className="btn btn-ghost-sm"
              aria-label="Clear selection"
            >
              <X size={16} />
            </button>
            <span className="batch-count">{selectedIds.size} selected</span>
          </div>
          <div className="batch-bar-right">
            <button
              type="button"
              onClick={handleBatchDelete}
              disabled={batchDeleteMutation.isPending}
              className="btn btn-danger-solid"
            >
              <Trash2 size={16} />
              {batchDeleteMutation.isPending ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      ) : (
        <div className="info-bar">
          <span className="text-meta">
            {total} messages {isFetching && "• updating..."}
          </span>
        </div>
      )}

      {/* Messages Table */}
      {error ? (
        <div className="status-error">Error: {String(error)}</div>
      ) : isLoading ? (
        <div className="status-loading">Loading...</div>
      ) : (
        <>
          <div className="table-container">
            <table className="message-table">
              <thead>
                <tr>
                  <th className="col-checkbox">
                    <input
                      type="checkbox"
                      checked={messages.length > 0 && selectedIds.size === messages.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="col-from">FROM</th>
                  <th className="col-to">TO</th>
                  <th className="col-subject">SUBJECT</th>
                  <th className="col-date">DATE</th>
                  <th className="col-actions" />
                </tr>
              </thead>
              <tbody>
                {messages.map((msg: Message) => (
                  <tr
                    key={msg.id}
                    className={`message-row ${selectedIds.has(msg.id) ? "selected" : ""}`}
                    onClick={() => setSelectedId(msg.id)}
                    onKeyDown={(e) => e.key === "Enter" && setSelectedId(msg.id)}
                  >
                    <td
                      className="col-checkbox"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(msg.id)}
                        onChange={() => toggleSelect(msg.id)}
                      />
                    </td>
                    <td className="col-from" title={msg.from_addr}>
                      <div className="from-cell">
                        <span className="from-text">{formatFromAddr(msg.from_addr)}</span>
                        {isSystemEmail(msg.from_addr) && (
                          <span className="badge badge-system">SYS</span>
                        )}
                      </div>
                    </td>
                    <td className="col-to" title={msg.to_addr}>
                      <span
                        className="text-body text-truncate"
                        style={{ maxWidth: "150px", display: "block" }}
                      >
                        {formatFromAddr(msg.to_addr)}
                      </span>
                    </td>
                    <td className="col-subject">
                      <div className="subject-cell">
                        <span className="subject-text">{msg.subject || "(No Subject)"}</span>
                        <span className="preview-text">{msg.preview || ""}</span>
                      </div>
                    </td>
                    <td className="col-date">{formatDate(msg.received_at)}</td>
                    <td
                      className="col-actions"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, msg.id)}
                        className="btn btn-row-action"
                        aria-label="Delete message"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {messages.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      <div className="empty-state-content">
                        <Inbox size={48} strokeWidth={1} className="empty-state-icon" />
                        <span>No messages found</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="btn btn-ghost"
              >
                ← Prev
              </button>
              <span className="pagination-info">
                {page + 1} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="btn btn-ghost"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {selectedId && <MessageDetail id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
};
