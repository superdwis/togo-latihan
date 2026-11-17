"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase";

async function requestJson(supabase, path, options = {}) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error("Sesi login tidak valid. Silakan login kembali.");
  }

  const response = await fetch(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("Respons server tidak valid.");
  }
  if (!response.ok) throw new Error(result.error || "Permintaan gagal.");
  return result;
}

function formatTime(value) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function ChatWorkspace({ userInitial }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [memories, setMemories] = useState([]);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [workspace, setWorkspace] = useState("chat");
  const [memoryKind, setMemoryKind] = useState("persona");
  const [memoryContent, setMemoryContent] = useState("");
  const [editingMemoryId, setEditingMemoryId] = useState(null);
  const [memoryBusy, setMemoryBusy] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    let active = true;
    setConversationsLoading(true);
    setMemoriesLoading(true);
    setError("");

    Promise.all([
      requestJson(supabase, "/api/chat/conversations"),
      requestJson(supabase, "/api/chat/memories"),
    ])
      .then(([conversationResult, memoryResult]) => {
        if (!active) return;
        setConversations(conversationResult.conversations);
        setMemories(memoryResult.memories);
        setSelectedId((current) =>
          current && conversationResult.conversations.some((item) => item.id === current)
            ? current
            : conversationResult.conversations[0]?.id || null,
        );
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) {
          setConversationsLoading(false);
          setMemoriesLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      setMessagesLoading(false);
      return undefined;
    }

    let active = true;
    setMessages([]);
    setMessagesLoading(true);
    requestJson(supabase, `/api/chat/conversations/${selectedId}/messages`)
      .then((result) => {
        if (active) setMessages(result.messages);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setMessagesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedId, supabase]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  async function createConversation() {
    const result = await requestJson(supabase, "/api/chat/conversations", {
      method: "POST",
    });
    setConversations((current) => [result.conversation, ...current]);
    setSelectedId(result.conversation.id);
    setMessages([]);
    setWorkspace("chat");
    setError("");
    return result.conversation;
  }

  async function sendMessage(event) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setError("");
    setDraft("");

    try {
      let conversationId = selectedId;
      if (!conversationId) {
        const conversation = await createConversation();
        conversationId = conversation.id;
      }

      const result = await requestJson(
        supabase,
        `/api/chat/conversations/${conversationId}/messages`,
        { method: "POST", body: { content } },
      );
      setMessages((current) => [...current, ...result.messages]);
      setConversations((current) => {
        const conversation = current.find((item) => item.id === conversationId);
        if (!conversation) return current;
        const updated = {
          ...conversation,
          title: conversation.title === "Percakapan baru"
            ? content.slice(0, 60)
            : conversation.title,
          updated_at: new Date().toISOString(),
        };
        return [updated, ...current.filter((item) => item.id !== conversationId)];
      });
    } catch (requestError) {
      setDraft(content);
      setError(requestError.message);
    } finally {
      setSending(false);
    }
  }

  async function removeConversation(conversationId) {
    if (!window.confirm("Hapus percakapan dan seluruh riwayat pesannya?")) return;
    setError("");
    try {
      await requestJson(supabase, `/api/chat/conversations/${conversationId}`, {
        method: "DELETE",
      });
      const remaining = conversations.filter((item) => item.id !== conversationId);
      setConversations(remaining);
      if (selectedId === conversationId) {
        setSelectedId(remaining[0]?.id || null);
      }
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function refreshMemories() {
    const result = await requestJson(supabase, "/api/chat/memories");
    setMemories(result.memories);
  }

  async function saveMemory(event) {
    event.preventDefault();
    const content = memoryContent.trim();
    if (!content || memoryBusy) return;
    setMemoryBusy(true);
    setError("");
    try {
      if (editingMemoryId) {
        await requestJson(supabase, `/api/chat/memories/${editingMemoryId}`, {
          method: "PATCH",
          body: { kind: memoryKind, content },
        });
      } else {
        await requestJson(supabase, "/api/chat/memories", {
          method: "POST",
          body: { kind: memoryKind, content },
        });
      }
      setMemoryContent("");
      setEditingMemoryId(null);
      await refreshMemories();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setMemoryBusy(false);
    }
  }

  function editMemory(memory) {
    setEditingMemoryId(memory.id);
    setMemoryKind(memory.kind);
    setMemoryContent(memory.content);
  }

  async function removeMemory(memoryId) {
    if (!window.confirm("Hapus memory ini dari chatbot?")) return;
    setError("");
    try {
      await requestJson(supabase, `/api/chat/memories/${memoryId}`, {
        method: "DELETE",
      });
      setMemories((current) => current.filter((item) => item.id !== memoryId));
      if (editingMemoryId === memoryId) {
        setEditingMemoryId(null);
        setMemoryContent("");
      }
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <div className="chat-workspace">
      <header className="chat-page-heading">
        <div>
          <p className="eyebrow">ASISTEN PRIBADIMU</p>
          <h1>Teman berpikir<span className="heading-period">.</span></h1>
          <p className="page-subtitle">
            Chat AI yang memahami persona dan produkmu.
          </p>
        </div>
        <button
          className="button button-subtle memory-open-button"
          onClick={() => {
            setWorkspace(workspace === "memories" ? "chat" : "memories");
            setError("");
          }}
        >
          <span aria-hidden="true">✳</span>
          {workspace === "memories" ? "Kembali ke chat" : `Memory (${memories.length})`}
        </button>
      </header>

      {error && <p className="form-message error chat-error">{error}</p>}

      {workspace === "memories" ? (
        <section className="memory-workspace">
          <div className="memory-intro">
            <div className="add-symbol">✳</div>
            <div>
              <h2>Atur pengetahuan chatbot</h2>
              <p>
                Memory ini ditambahkan sebagai konteks pada setiap percakapanmu.
                Kelola persona dan informasi produk yang ingin diingat AI.
              </p>
            </div>
          </div>

          <form className="memory-form" onSubmit={saveMemory}>
            <div className="memory-form-heading">
              <h3>{editingMemoryId ? "Edit memory" : "Tambah memory baru"}</h3>
              <span>{memoryContent.length}/8000</span>
            </div>
            <label htmlFor="memory-kind">Jenis memory</label>
            <select
              id="memory-kind"
              value={memoryKind}
              onChange={(event) => setMemoryKind(event.target.value)}
            >
              <option value="persona">Persona & gaya jawaban</option>
              <option value="product">Product knowledge</option>
            </select>
            <label htmlFor="memory-content">
              {memoryKind === "persona" ? "Instruksi persona" : "Informasi produk"}
            </label>
            <textarea
              id="memory-content"
              rows={5}
              maxLength={8000}
              placeholder={
                memoryKind === "persona"
                  ? "Contoh: Jawab dengan ramah, ringkas, dan selalu gunakan bahasa Indonesia."
                  : "Contoh: Produk kami bernama ..., ditujukan untuk ..., memiliki fitur ..."
              }
              value={memoryContent}
              onChange={(event) => setMemoryContent(event.target.value)}
              required
            />
            <div className="memory-form-actions">
              {editingMemoryId && (
                <button
                  type="button"
                  className="button button-subtle"
                  onClick={() => {
                    setEditingMemoryId(null);
                    setMemoryContent("");
                  }}
                >
                  Batal
                </button>
              )}
              <button
                className="button button-primary"
                disabled={memoryBusy || !memoryContent.trim()}
              >
                {memoryBusy ? "Menyimpan..." : editingMemoryId ? "Simpan perubahan" : "Simpan memory"}
              </button>
            </div>
          </form>

          <div className="memory-list-heading">
            <h2>Memory tersimpan</h2>
            <span>{memories.length}</span>
          </div>
          {memoriesLoading ? (
            <div className="empty-state"><span className="spinner" /><p>Memuat memory...</p></div>
          ) : memories.length ? (
            <div className="memory-list">
              {memories.map((memory) => (
                <article className="memory-card" key={memory.id}>
                  <div className="memory-card-copy">
                    <span className={`memory-badge ${memory.kind}`}>
                      {memory.kind === "persona" ? "PERSONA" : "PRODUCT KNOWLEDGE"}
                    </span>
                    <p>{memory.content}</p>
                  </div>
                  <div className="memory-card-actions">
                    <button className="icon-button" onClick={() => editMemory(memory)} aria-label="Edit memory" title="Edit">✎</button>
                    <button className="icon-button delete-button" onClick={() => removeMemory(memory.id)} aria-label="Hapus memory" title="Hapus">×</button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state memory-empty">
              <div className="empty-icon">✳</div>
              <h3>Belum ada memory.</h3>
              <p>Tambahkan persona atau pengetahuan produk agar jawaban AI lebih sesuai kebutuhanmu.</p>
            </div>
          )}
        </section>
      ) : (
        <section className="chat-layout">
          <aside className="conversation-sidebar">
            <button
              className="button button-primary new-chat-button"
              onClick={() => {
                createConversation().catch((requestError) => setError(requestError.message));
              }}
              disabled={conversationsLoading || sending}
            >
              <span aria-hidden="true">＋</span> Percakapan baru
            </button>
            <div className="conversation-list-heading">RIWAYAT CHAT</div>
            {conversationsLoading ? (
              <div className="conversation-loading"><span className="spinner" /></div>
            ) : conversations.length ? (
              <div className="conversation-list">
                {conversations.map((conversation) => (
                  <div
                    className={`conversation-item${selectedId === conversation.id ? " selected" : ""}`}
                    key={conversation.id}
                  >
                    <button
                      className="conversation-select"
                      onClick={() => {
                        setSelectedId(conversation.id);
                        setWorkspace("chat");
                        setError("");
                      }}
                      disabled={sending}
                    >
                      <span className="conversation-icon">◷</span>
                      <span>{conversation.title}</span>
                    </button>
                    <button
                      className="conversation-delete"
                      onClick={() => removeConversation(conversation.id)}
                      title="Hapus percakapan"
                      aria-label={`Hapus ${conversation.title}`}
                      disabled={sending}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-conversations">Riwayat percakapanmu akan muncul di sini.</p>
            )}
            <div className="memory-hint-card">
              <span aria-hidden="true">✳</span>
              <p>
                Chatbot dapat memakai persona dan pengetahuan produk yang kamu
                simpan.
              </p>
              <button onClick={() => setWorkspace("memories")}>
                Atur memory <span aria-hidden="true">→</span>
              </button>
            </div>
          </aside>

          <div className="chat-panel">
            <div className="chat-panel-heading">
              <div className="chat-avatar">✳</div>
              <div>
                <h2>Asisten AI</h2>
                <p>GLM 5.3 Flash <span /> Siap membantu</p>
              </div>
            </div>
            <div className="chat-messages">
              {messagesLoading ? (
                <div className="chat-loading"><span className="spinner" /><p>Memuat percakapan...</p></div>
              ) : messages.length ? (
                messages.map((message) => (
                  <article
                    className={`chat-message ${message.role}`}
                    key={message.id}
                  >
                    {message.role === "assistant" && <div className="message-avatar">✳</div>}
                    <div className="message-body">
                      <div className="message-meta">
                        <strong>{message.role === "user" ? "Kamu" : "Asisten AI"}</strong>
                        <time dateTime={message.created_at}>{formatTime(message.created_at)}</time>
                      </div>
                      <p>{message.content}</p>
                    </div>
                    {message.role === "user" && (
                      <div className="message-avatar user-message-avatar">{userInitial}</div>
                    )}
                  </article>
                ))
              ) : (
                <div className="chat-welcome">
                  <div className="welcome-sparkle">✳</div>
                  <p className="eyebrow">RUANG UNTUK IDE-IDE KAMU</p>
                  <h3>Apa yang sedang kamu pikirkan?</h3>
                  <p>
                    Tanyakan apa saja. Chatbot akan menggunakan memory persona
                    dan product knowledge milikmu sebagai konteks.
                  </p>
                  <div className="prompt-suggestions">
                    {[
                      "Bantu saya menyusun prioritas hari ini",
                      "Apa informasi produk yang sudah kamu ketahui?",
                    ].map((suggestion) => (
                      <button key={suggestion} onClick={() => setDraft(suggestion)}>
                        {suggestion} <span aria-hidden="true">↗</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {sending && (
                <div className="chat-message assistant">
                  <div className="message-avatar">✳</div>
                  <div className="typing-indicator" aria-label="AI sedang menjawab">
                    <span /><span /><span />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            <form className="chat-composer" onSubmit={sendMessage}>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="Tulis pesan... (Enter untuk kirim)"
                rows={2}
                maxLength={6000}
                disabled={sending}
                aria-label="Pesan untuk asisten AI"
              />
              <div className="chat-composer-footer">
                <span>Shift + Enter untuk baris baru · maks. 6.000 karakter</span>
                <button
                  className="button button-primary send-button"
                  disabled={sending || !draft.trim()}
                  aria-label="Kirim pesan"
                >
                  {sending ? "Berpikir..." : "Kirim"}
                  {!sending && <span aria-hidden="true">↑</span>}
                </button>
              </div>
            </form>
            <p className="chat-disclaimer">
              Pesan dan memory dikirim ke OpenRouter. AI dapat membuat kesalahan; jangan masukkan rahasia.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
