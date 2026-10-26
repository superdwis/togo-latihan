"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase";

const filters = [
  { id: "all", label: "Semua" },
  { id: "active", label: "Belum selesai" },
  { id: "completed", label: "Selesai" },
];

const MEDIA_BUCKET = "todo-media";
const MAX_MEDIA_SIZE = 20 * 1024 * 1024;
const ALLOWED_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/ogg",
  "audio/webm",
];
const TODO_COLUMNS =
  "id, title, description, is_completed, due_date, created_at, media_path, media_type, media_name";

function formatDate(date) {
  if (!date) return "";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function readableError(error) {
  if (!error) return "Terjadi kesalahan. Coba lagi.";
  if (error.message?.includes("Invalid login credentials")) {
    return "Email atau password salah.";
  }
  if (error.message?.includes("User already registered")) {
    return "Email ini sudah terdaftar. Silakan masuk.";
  }
  if (error.message?.includes("Email not confirmed")) {
    return "Konfirmasi email kamu terlebih dahulu sebelum masuk.";
  }
  return error.message || "Terjadi kesalahan. Coba lagi.";
}

function validateMedia(file) {
  if (!file) return "";
  if (!ALLOWED_MEDIA_TYPES.includes(file.type)) {
    return "Format media tidak didukung. Pilih foto, video, atau audio yang umum.";
  }
  if (file.size > MAX_MEDIA_SIZE) {
    return "Ukuran media maksimal 20 MB.";
  }
  return "";
}

function mediaExtension(file) {
  const extensionByType = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/avif": "avif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
  };
  return extensionByType[file.type] || "webm";
}

export default function HomePage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [authError, setAuthError] = useState("");
  const [todos, setTodos] = useState([]);
  const [todosLoading, setTodosLoading] = useState(false);
  const [todoError, setTodoError] = useState("");
  const [filter, setFilter] = useState("all");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [mediaFile, setMediaFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editMediaFile, setEditMediaFile] = useState(null);
  const [removeEditMedia, setRemoveEditMedia] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return undefined;
    }

    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) setAuthError(readableError(error));
      setSession(data.session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthMessage("");
      setAuthError("");
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !session?.user) {
      setTodos([]);
      return;
    }

    let mounted = true;
    setTodosLoading(true);
    setTodoError("");
    supabase
      .from("todos")
      .select(TODO_COLUMNS)
      .order("created_at", { ascending: false })
      .then(async ({ data, error }) => {
        if (!mounted) return;
        if (error) {
          setTodoError(readableError(error));
        } else {
          try {
            const mediaErrors = [];
            const todosWithMedia = await Promise.all(
              data.map(async (todo) => {
                if (!todo.media_path) return todo;
                const { data: signedData, error: signedError } = await supabase.storage
                  .from(MEDIA_BUCKET)
                  .createSignedUrl(todo.media_path, 60 * 60 * 24);
                if (signedError) {
                  mediaErrors.push(readableError(signedError));
                  return todo;
                }
                return { ...todo, media_url: signedData.signedUrl };
              }),
            );
            if (mounted) {
              setTodos(todosWithMedia);
              if (mediaErrors.length) {
                setTodoError(`Sebagian media tidak dapat dibuka: ${mediaErrors.join("; ")}`);
              }
            }
          } catch (mediaError) {
            if (mounted) setTodoError(readableError(mediaError));
          }
        }
        if (mounted) setTodosLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [session, supabase]);

  async function handleAuth(event) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError("");
    setAuthMessage("");

    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (result.error) {
      setAuthError(readableError(result.error));
    } else if (mode === "signup" && !result.data.session) {
      setAuthMessage("Akun dibuat. Cek email kamu untuk konfirmasi, lalu masuk.");
      setMode("login");
      setPassword("");
    }
    setAuthBusy(false);
  }

  async function uploadTodoMedia(todo, file) {
    const path = `${session.user.id}/${todo.id}/${crypto.randomUUID()}.${mediaExtension(file)}`;
    const { error: uploadError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      throw new Error(`Gagal mengunggah media: ${readableError(uploadError)}`);
    }

    const { data, error } = await supabase
      .from("todos")
      .update({
        media_path: path,
        media_type: file.type,
        media_name: file.name,
      })
      .eq("id", todo.id)
      .select(TODO_COLUMNS)
      .single();

    if (error) {
      const { error: cleanupError } = await supabase.storage
        .from(MEDIA_BUCKET)
        .remove([path]);
      const cleanupMessage = cleanupError
        ? ` File upload sementara juga gagal dibersihkan: ${readableError(cleanupError)}`
        : "";
      throw new Error(`${readableError(error)}${cleanupMessage}`);
    }

    const { data: signedData, error: signedError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .createSignedUrl(path, 60 * 60 * 24);

    return {
      todo: { ...data, media_url: signedData?.signedUrl },
      mediaError: signedError
        ? `Media tersimpan, tetapi preview gagal dibuka: ${readableError(signedError)}`
        : "",
    };
  }

  async function addTodo(event) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    const mediaValidationError = validateMedia(mediaFile);
    if (mediaValidationError) {
      setTodoError(mediaValidationError);
      return;
    }
    setSaving(true);
    setTodoError("");

    const { data, error } = await supabase
      .from("todos")
      .insert({
        title: cleanTitle,
        description: description.trim() || null,
        due_date: dueDate || null,
        user_id: session.user.id,
      })
      .select(TODO_COLUMNS)
      .single();

    if (error) {
      setTodoError(readableError(error));
    } else {
      let createdTodo = data;
      let mediaError = "";
      try {
        if (mediaFile) {
          const uploadResult = await uploadTodoMedia(data, mediaFile);
          createdTodo = uploadResult.todo;
          mediaError = uploadResult.mediaError;
        }
        setTodos((current) => [createdTodo, ...current]);
        setTitle("");
        setDescription("");
        setDueDate("");
        setMediaFile(null);
        if (mediaError) setTodoError(mediaError);
      } catch (uploadError) {
        const { error: rollbackError } = await supabase
          .from("todos")
          .delete()
          .eq("id", data.id);
        setTodoError(
          `${readableError(uploadError)}${
            rollbackError
              ? ` Todo kosong tidak berhasil dibersihkan: ${readableError(rollbackError)}`
              : ""
          }`,
        );
      }
    }
    setSaving(false);
  }

  function beginEdit(todo) {
    setEditingId(todo.id);
    setEditTitle(todo.title);
    setEditDescription(todo.description || "");
    setEditDueDate(todo.due_date || "");
    setEditMediaFile(null);
    setRemoveEditMedia(false);
  }

  async function saveEdit(event) {
    event.preventDefault();
    const cleanTitle = editTitle.trim();
    if (!cleanTitle || !editingId) return;
    const mediaValidationError = validateMedia(editMediaFile);
    if (mediaValidationError) {
      setTodoError(mediaValidationError);
      return;
    }
    setSaving(true);
    setTodoError("");

    const previousTodo = todos.find((todo) => todo.id === editingId);
    let uploadedPath = null;
    try {
      if (editMediaFile) {
        const path = `${session.user.id}/${editingId}/${crypto.randomUUID()}.${mediaExtension(editMediaFile)}`;
        const { error: uploadError } = await supabase.storage
          .from(MEDIA_BUCKET)
          .upload(path, editMediaFile, {
            contentType: editMediaFile.type,
            upsert: false,
          });
        if (uploadError) {
          throw new Error(`Gagal mengunggah media: ${readableError(uploadError)}`);
        }
        uploadedPath = path;
      }

      const changes = {
        title: cleanTitle,
        description: editDescription.trim() || null,
        due_date: editDueDate || null,
      };
      if (editMediaFile) {
        changes.media_path = uploadedPath;
        changes.media_type = editMediaFile.type;
        changes.media_name = editMediaFile.name;
      } else if (removeEditMedia) {
        changes.media_path = null;
        changes.media_type = null;
        changes.media_name = null;
      }

      const { data, error } = await supabase
        .from("todos")
        .update(changes)
        .eq("id", editingId)
        .select(TODO_COLUMNS)
        .single();
      if (error) throw error;

      let updatedTodo = {
        ...data,
        media_url: data.media_path ? previousTodo?.media_url : undefined,
      };
      if (editMediaFile) {
        const { data: signedData, error: signedError } = await supabase.storage
          .from(MEDIA_BUCKET)
          .createSignedUrl(uploadedPath, 60 * 60 * 24);
        updatedTodo = { ...data, media_url: signedData?.signedUrl };
        if (signedError) {
          setTodoError(`Media tersimpan, tetapi preview gagal dibuka: ${readableError(signedError)}`);
        }
      }
      setTodos((current) =>
        current.map((todo) => (todo.id === editingId ? updatedTodo : todo)),
      );
      setEditingId(null);
      setEditMediaFile(null);
      if ((editMediaFile || removeEditMedia) && previousTodo?.media_path) {
        const { error: removeError } = await supabase.storage
          .from(MEDIA_BUCKET)
          .remove([previousTodo.media_path]);
        if (removeError) {
          setTodoError(`Todo tersimpan, tetapi media lama gagal dihapus: ${readableError(removeError)}`);
        }
      }
    } catch (editError) {
      let cleanupMessage = "";
      if (uploadedPath) {
        const { error: cleanupError } = await supabase.storage
          .from(MEDIA_BUCKET)
          .remove([uploadedPath]);
        if (cleanupError) {
          cleanupMessage = ` Media baru juga gagal dibersihkan: ${readableError(cleanupError)}`;
        }
      }
      setTodoError(`${readableError(editError)}${cleanupMessage}`);
    }
    setSaving(false);
  }

  async function toggleTodo(todo) {
    setTodoError("");
    const { data, error } = await supabase
      .from("todos")
      .update({ is_completed: !todo.is_completed })
      .eq("id", todo.id)
      .select(TODO_COLUMNS)
      .single();

    if (error) {
      setTodoError(readableError(error));
    } else {
      setTodos((current) =>
        current.map((item) =>
          item.id === todo.id ? { ...data, media_url: item.media_url } : item,
        ),
      );
    }
  }

  async function deleteTodo(id) {
    if (!window.confirm("Hapus todo ini?")) return;
    setTodoError("");
    const todo = todos.find((item) => item.id === id);
    const { error } = await supabase.from("todos").delete().eq("id", id);
    if (error) {
      setTodoError(readableError(error));
    } else {
      setTodos((current) => current.filter((todo) => todo.id !== id));
      if (todo?.media_path) {
        const { error: removeError } = await supabase.storage
          .from(MEDIA_BUCKET)
          .remove([todo.media_path]);
        if (removeError) {
          setTodoError(`Todo terhapus, tetapi media gagal dihapus: ${readableError(removeError)}`);
        }
      }
    }
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) setTodoError(readableError(error));
  }

  const visibleTodos = todos.filter((todo) => {
    if (filter === "active") return !todo.is_completed;
    if (filter === "completed") return todo.is_completed;
    return true;
  });
  const completedCount = todos.filter((todo) => todo.is_completed).length;
  const progress =
    todos.length > 0 ? Math.round((completedCount / todos.length) * 100) : 0;

  if (!supabase) {
    return (
      <main className="setup-screen">
        <section className="setup-card">
          <div className="brand-mark">r.</div>
          <p className="eyebrow">SEDIKIT LAGI SIAP</p>
          <h1>Hubungkan project Supabase kamu</h1>
          <p>
            Buat file <code>.env.local</code> berdasarkan <code>.env.example</code>,
            lalu isi URL project dan publishable key dari dashboard Supabase.
          </p>
          <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">
            Buka Supabase Dashboard <span aria-hidden="true">↗</span>
          </a>
        </section>
      </main>
    );
  }

  if (authLoading) {
    return (
      <main className="loading-screen">
        <div className="brand-mark">r.</div>
        <span className="spinner" aria-label="Memuat" />
      </main>
    );
  }

  if (!session) {
    return (
      <main className="auth-screen">
        <div className="auth-decoration decoration-one" />
        <div className="auth-decoration decoration-two" />
        <section className="auth-card">
          <a className="brand" href="/" aria-label="Rapi beranda">
            <span className="brand-mark">r.</span>
            <span>rapi</span>
          </a>
          <p className="eyebrow">RUANG KECIL UNTUK HAL BESAR</p>
          <h1>{mode === "login" ? "Senang melihatmu lagi." : "Mulai dengan rapi."}</h1>
          <p className="auth-intro">
            {mode === "login"
              ? "Masuk dan lanjutkan hal-hal yang ingin kamu selesaikan."
              : "Buat akun gratis dan mulai atur tugasmu hari ini."}
          </p>

          <div className="auth-tabs" role="tablist" aria-label="Autentikasi">
            <button
              className={mode === "login" ? "auth-tab active" : "auth-tab"}
              onClick={() => {
                setMode("login");
                setAuthError("");
                setAuthMessage("");
              }}
              role="tab"
              aria-selected={mode === "login"}
            >
              Masuk
            </button>
            <button
              className={mode === "signup" ? "auth-tab active" : "auth-tab"}
              onClick={() => {
                setMode("signup");
                setAuthError("");
                setAuthMessage("");
              }}
              role="tab"
              aria-selected={mode === "signup"}
            >
              Daftar
            </button>
          </div>

          <form className="auth-form" onSubmit={handleAuth}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="nama@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder="Minimal 6 karakter"
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            {authError && <p className="form-message error">{authError}</p>}
            {authMessage && <p className="form-message success">{authMessage}</p>}
            <button className="button button-primary auth-submit" disabled={authBusy}>
              {authBusy
                ? "Tunggu sebentar..."
                : mode === "login"
                  ? "Masuk ke akun"
                  : "Buat akun"}
              {!authBusy && <span aria-hidden="true">→</span>}
            </button>
          </form>
          <p className="auth-footnote">
            {mode === "login" ? "Belum punya akun?" : "Sudah punya akun?"}{" "}
            <button
              className="text-button"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
            >
              {mode === "login" ? "Daftar sekarang" : "Masuk"}
            </button>
          </p>
        </section>
        <p className="auth-caption">Fokus pada satu hal. Lalu hal berikutnya.</p>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand sidebar-brand" href="/" aria-label="Rapi beranda">
          <span className="brand-mark">r.</span>
          <span>rapi</span>
        </a>
        <div className="sidebar-label">WORKSPACE</div>
        <div className="sidebar-link selected">
          <span className="nav-icon">▦</span>
          <span>Daftar tugas</span>
          <span className="nav-count">{todos.length}</span>
        </div>
        <div className="sidebar-bottom">
          <div className="user-avatar">{session.user.email?.[0]?.toUpperCase()}</div>
          <div className="user-info">
            <span className="user-name">Akun saya</span>
            <span className="user-email">{session.user.email}</span>
          </div>
          <button className="icon-button logout-button" onClick={logout} title="Keluar" aria-label="Keluar">
            ↗
          </button>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <span className="breadcrumb">Workspace <span>/</span> Daftar tugas</span>
          <span className="today-label">
            {new Intl.DateTimeFormat("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "long",
            }).format(new Date())}
          </span>
        </header>

        <div className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">RUANG KERJAMU</p>
              <h1>Daftar tugas<span className="heading-period">.</span></h1>
              <p className="page-subtitle">Satu per satu, semua bisa selesai.</p>
            </div>
            <div className="progress-card">
              <div className="progress-ring" style={{ "--progress": `${progress}%` }}>
                <span>{progress}<small>%</small></span>
              </div>
              <div>
                <strong>{completedCount} dari {todos.length}</strong>
                <span>tugas selesai</span>
              </div>
            </div>
          </div>

          <section className="composer-card">
            <div className="composer-heading">
              <span className="add-symbol">+</span>
              <div>
                <h2>Tambahkan tugas</h2>
                <p>Apa yang ingin kamu selesaikan?</p>
              </div>
            </div>
            <form className="todo-form" onSubmit={addTodo}>
              <input
                className="title-input"
                aria-label="Judul tugas"
                placeholder="Contoh: Selesaikan proposal project"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={160}
                required
              />
              <textarea
                aria-label="Deskripsi tugas"
                placeholder="Tambahkan catatan kecil (opsional)"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={2000}
                rows={2}
              />
              <div className="media-form-row">
                <label className="media-picker">
                  <span aria-hidden="true">＋</span>
                  <span>{mediaFile ? "Ganti media" : "Lampirkan foto / media"}</span>
                  <input
                    type="file"
                    accept={ALLOWED_MEDIA_TYPES.join(",")}
                    onChange={(event) => {
                      setMediaFile(event.currentTarget.files?.[0] || null);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                {mediaFile && (
                  <span className="selected-media">
                    {mediaFile.name}
                    <button type="button" onClick={() => setMediaFile(null)} aria-label="Hapus pilihan media">×</button>
                  </span>
                )}
                <span className="media-hint">Maks. 20 MB</span>
              </div>
              <div className="form-footer">
                <label className="date-input">
                  <span aria-hidden="true">▦</span>
                  <span>Tenggat</span>
                  <input
                    type="date"
                    aria-label="Tanggal tenggat"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                  />
                </label>
                <button className="button button-primary add-button" disabled={saving || !title.trim()}>
                  {saving ? "Menyimpan..." : "Tambah tugas"}
                  {!saving && <span aria-hidden="true">↗</span>}
                </button>
              </div>
            </form>
          </section>

          <div className="list-toolbar">
            <div>
              <h2>Tugasmu <span>{todos.length}</span></h2>
              <p>Jaga ritmemu, kamu sudah melakukan yang terbaik.</p>
            </div>
            <div className="filter-tabs" role="tablist" aria-label="Filter tugas">
              {filters.map((item) => (
                <button
                  key={item.id}
                  className={filter === item.id ? "filter-tab active" : "filter-tab"}
                  onClick={() => setFilter(item.id)}
                  role="tab"
                  aria-selected={filter === item.id}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {todoError && <p className="form-message error todo-error">{todoError}</p>}
          {todosLoading ? (
            <div className="empty-state"><span className="spinner" /><p>Memuat tugasmu...</p></div>
          ) : visibleTodos.length ? (
            <div className="todo-list">
              {visibleTodos.map((todo) => (
                <article className={`todo-card${todo.is_completed ? " is-completed" : ""}`} key={todo.id}>
                  {editingId === todo.id ? (
                    <form className="edit-form" onSubmit={saveEdit}>
                      <input
                        className="title-input"
                        aria-label="Judul tugas"
                        value={editTitle}
                        onChange={(event) => setEditTitle(event.target.value)}
                        maxLength={160}
                        required
                        autoFocus
                      />
                      <textarea
                        aria-label="Deskripsi tugas"
                        placeholder="Deskripsi (opsional)"
                        value={editDescription}
                        onChange={(event) => setEditDescription(event.target.value)}
                        maxLength={2000}
                        rows={2}
                      />
                      <div className="media-form-row">
                        <label className="media-picker">
                          <span aria-hidden="true">＋</span>
                          <span>{editMediaFile ? "Ganti media" : "Pilih media baru"}</span>
                          <input
                            type="file"
                            accept={ALLOWED_MEDIA_TYPES.join(",")}
                            onChange={(event) => {
                              setEditMediaFile(event.currentTarget.files?.[0] || null);
                              event.currentTarget.value = "";
                              setRemoveEditMedia(false);
                            }}
                          />
                        </label>
                        {todo.media_path && !removeEditMedia && (
                          <span className="selected-media">
                            Lampiran: {todo.media_name || "Media tersimpan"}
                          </span>
                        )}
                        {todo.media_path && !removeEditMedia && !editMediaFile && (
                          <button
                            type="button"
                            className="remove-media-button"
                            onClick={() => setRemoveEditMedia(true)}
                          >
                            Hapus lampiran saat disimpan
                          </button>
                        )}
                        {todo.media_path && removeEditMedia && (
                          <button
                            type="button"
                            className="remove-media-button"
                            onClick={() => setRemoveEditMedia(false)}
                          >
                            Batal hapus lampiran
                          </button>
                        )}
                        {editMediaFile && <span className="selected-media">{editMediaFile.name}</span>}
                        <span className="media-hint">Maks. 20 MB</span>
                      </div>
                      <div className="form-footer">
                        <label className="date-input">
                          <span aria-hidden="true">▦</span>
                          <span>Tenggat</span>
                          <input
                            type="date"
                            aria-label="Tanggal tenggat"
                            value={editDueDate}
                            onChange={(event) => setEditDueDate(event.target.value)}
                          />
                        </label>
                        <div className="edit-actions">
                          <button
                            type="button"
                            className="button button-subtle"
                            onClick={() => {
                              setEditingId(null);
                              setEditMediaFile(null);
                              setRemoveEditMedia(false);
                            }}
                          >
                            Batal
                          </button>
                          <button className="button button-primary" disabled={saving}>
                            {saving ? "Menyimpan..." : "Simpan"}
                          </button>
                        </div>
                      </div>
                    </form>
                  ) : (
                    <>
                      <button
                        className={`todo-check${todo.is_completed ? " checked" : ""}`}
                        onClick={() => toggleTodo(todo)}
                        aria-label={todo.is_completed ? "Tandai belum selesai" : "Tandai selesai"}
                      >
                        {todo.is_completed && <span aria-hidden="true">✓</span>}
                      </button>
                      <div className="todo-copy">
                        <h3>{todo.title}</h3>
                        {todo.description && <p>{todo.description}</p>}
                        {todo.due_date && (
                          <span className="todo-due"><span aria-hidden="true">▦</span> {formatDate(todo.due_date)}</span>
                        )}
                        {todo.media_url && (
                          <div className="todo-media">
                            {todo.media_type?.startsWith("image/") && (
                              <img src={todo.media_url} alt={todo.media_name || "Lampiran todo"} />
                            )}
                            {todo.media_type?.startsWith("video/") && (
                              <video src={todo.media_url} controls preload="metadata">
                                Browser tidak mendukung pemutar video.
                              </video>
                            )}
                            {todo.media_type?.startsWith("audio/") && (
                              <audio src={todo.media_url} controls preload="metadata">
                                Browser tidak mendukung pemutar audio.
                              </audio>
                            )}
                            <a href={todo.media_url} target="_blank" rel="noreferrer">
                              Buka {todo.media_name || "lampiran"}
                            </a>
                          </div>
                        )}
                      </div>
                      <div className="todo-actions">
                        <button className="icon-button" onClick={() => beginEdit(todo)} aria-label="Edit tugas" title="Edit">✎</button>
                        <button className="icon-button delete-button" onClick={() => deleteTodo(todo.id)} aria-label="Hapus tugas" title="Hapus">×</button>
                      </div>
                    </>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">{filter === "completed" ? "✓" : "✳"}</div>
              <h3>{filter === "all" ? "Ruangmu masih kosong." : "Belum ada tugas di sini."}</h3>
              <p>
                {filter === "all"
                  ? "Tuliskan satu hal kecil yang ingin kamu selesaikan hari ini."
                  : "Tugas yang cocok dengan filter ini akan muncul di sini."}
              </p>
            </div>
          )}
          <footer className="page-footer">Dibuat untuk membantumu tetap fokus <span>✳</span></footer>
        </div>
      </section>
    </main>
  );
}
