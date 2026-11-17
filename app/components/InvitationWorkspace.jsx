"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import readXlsxFile from "read-excel-file/browser";
import { getSupabaseBrowserClient } from "../../lib/supabase";
import InvitationContentEditor from "./InvitationContentEditor";

const EVENT_FIELDS =
  "id, title, host_names, event_date, event_time, venue, message, template_key, groom_name, groom_parents, groom_instagram, groom_photo, bride_name, bride_parents, bride_instagram, bride_photo, akad_date, akad_time, akad_venue, quote, quote_source, gift_address, gallery_photos, gift_accounts, created_at";
const GUEST_FIELDS =
  "id, event_id, invitation_token, name, phone, instagram, is_sent, sent_at, notes, rsvp_status, guest_message, created_at";
const GUEST_BATCH_SIZE = 200;
const demoGallery = [
  "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=900&q=80",
];
const templates = [
  {
    id: "elegant",
    name: "Undangan Elegan",
    style: "Klasik",
    description: "Nuansa ivory dan emas dengan tata letak romantis dan foto berbingkai.",
    symbol: "❦",
  },
  {
    id: "botanical",
    name: "Garden Botanical",
    style: "Botanical",
    description: "Palet sage dan hijau dengan detail alami untuk suasana hangat.",
    symbol: "❋",
  },
  {
    id: "modern",
    name: "Modern Minimal",
    style: "Modern",
    description: "Warna lavender dan tata letak bersih untuk tampilan kontemporer.",
    symbol: "◇",
  },
];

const headerAliases = {
  name: ["nama", "nama tamu", "name", "guest", "guest name", "undangan"],
  phone: ["nomor hp", "no hp", "no. hp", "telepon", "phone", "whatsapp", "wa"],
  instagram: ["ig", "instagram", "akun instagram", "instagram username"],
  notes: ["keterangan", "catatan", "notes", "note"],
};

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function parseCsv(text) {
  const input = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
    } else if (character === '"' && value === "") {
      quoted = true;
    } else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value.replace(/\r$/, ""));
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  if (quoted) throw new Error("CSV memiliki tanda kutip yang tidak berpasangan.");
  row.push(value.replace(/\r$/, ""));
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function mapImportRow(row) {
  const entries = Object.entries(row);
  const normalized = new Map(
    entries.map(([key, value]) => [normalizeHeader(key), String(value ?? "").trim()]),
  );
  const getValue = (field) => {
    const alias = headerAliases[field].find((item) => normalized.has(item));
    return alias ? normalized.get(alias) : "";
  };
  return {
    name: getValue("name"),
    phone: getValue("phone"),
    instagram: getValue("instagram"),
    notes: getValue("notes"),
  };
}

function normalizePhone(phone) {
  const cleaned = String(phone || "").replace(/[^\d+]/g, "");
  if (!cleaned) return "";
  if (cleaned.startsWith("0")) return `62${cleaned.slice(1)}`;
  if (cleaned.startsWith("+")) return cleaned.slice(1);
  return cleaned;
}

function formatDate(value) {
  if (!value) return "Tanggal menyusul";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function rsvpLabel(status) {
  if (status === "attending") return "Hadir";
  if (status === "not_attending") return "Tidak hadir";
  if (status === "maybe") return "Belum pasti";
  return "Belum menjawab";
}

function rsvpClass(status) {
  if (status === "attending") return "attending";
  if (status === "not_attending") return "not-attending";
  if (status === "maybe") return "maybe";
  return "pending";
}

function buildWhatsAppUrl(phone, text) {
  const normalized = normalizePhone(phone);
  if (!normalized) return "";
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
}

export default function InvitationWorkspace() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const fileInputRef = useRef(null);
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guestsLoading, setGuestsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [origin, setOrigin] = useState("");
  const [eventForm, setEventForm] = useState({
    title: "",
    host_names: "",
    event_date: "",
    event_time: "",
    venue: "",
    message: "",
    template_key: "elegant",
  });
  const [editingEvent, setEditingEvent] = useState(false);
  const [guestForm, setGuestForm] = useState({
    name: "",
    phone: "",
    instagram: "",
    notes: "",
  });
  const [showGuestForm, setShowGuestForm] = useState(false);

  const selectedEvent = events.find((event) => event.id === selectedEventId) || null;

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase
      .from("invitation_events")
      .select(EVENT_FIELDS)
      .order("created_at", { ascending: false })
      .then(({ data, error: loadError }) => {
        if (!active) return;
        if (loadError) {
          setError(loadError.message);
        } else {
          setEvents(data);
          setSelectedEventId((current) =>
            current && data.some((event) => event.id === current)
              ? current
              : data[0]?.id || null,
          );
        }
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (!selectedEventId) {
      setGuests([]);
      return undefined;
    }

    let active = true;
    setGuestsLoading(true);
    supabase
      .from("invitation_guests")
      .select(GUEST_FIELDS)
      .eq("event_id", selectedEventId)
      .order("name", { ascending: true })
      .then(({ data, error: loadError }) => {
        if (!active) return;
        if (loadError) {
          setError(loadError.message);
        } else {
          setGuests(data);
        }
        setGuestsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedEventId, supabase]);

  async function loadGuests(eventId) {
    const { data, error: loadError } = await supabase
      .from("invitation_guests")
      .select(GUEST_FIELDS)
      .eq("event_id", eventId)
      .order("name", { ascending: true });
    if (loadError) throw loadError;
    setGuests(data);
  }

  async function saveEvent(event) {
    event.preventDefault();
    const values = {
      title: eventForm.title.trim(),
      host_names: eventForm.host_names.trim(),
      event_date: eventForm.event_date || null,
      event_time: eventForm.event_time.trim() || null,
      venue: eventForm.venue.trim() || null,
      message: eventForm.message.trim() || null,
      template_key: eventForm.template_key,
    };
    if (!values.title || !values.host_names) {
      setError("Isi nama acara dan nama tuan rumah.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");

    if (editingEvent && selectedEvent) {
      const { data, error: saveError } = await supabase
        .from("invitation_events")
        .update(values)
        .eq("id", selectedEvent.id)
        .select(EVENT_FIELDS)
        .single();
      if (saveError) {
        setError(saveError.message);
      } else {
        setEvents((current) => current.map((item) => item.id === data.id ? data : item));
        setEditingEvent(false);
        setNotice("Detail acara berhasil diperbarui.");
      }
    } else {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      const { data, error: saveError } = userError
        ? { data: null, error: userError }
        : await supabase
            .from("invitation_events")
            .insert({ ...values, user_id: userData.user.id })
            .select(EVENT_FIELDS)
            .single();
      if (saveError) {
        setError(saveError.message);
      } else {
        setEvents((current) => [data, ...current]);
        setSelectedEventId(data.id);
        setShowCreateForm(false);
        setNotice("Acara undangan berhasil dibuat. Sekarang tambahkan daftar tamu.");
      }
    }
    setBusy(false);
  }

  async function chooseTemplate(templateKey) {
    if (showCreateForm || !selectedEvent) {
      setEventForm((current) => ({ ...current, template_key: templateKey }));
      if (!showCreateForm) {
        setEditingEvent(false);
        setShowCreateForm(true);
      }
      const templateName = templates.find((item) => item.id === templateKey)?.name;
      setNotice(
        editingEvent
          ? `Template ${templateName} dipilih. Simpan perubahan acara untuk menerapkannya.`
          : `Template ${templateName} dipilih.`,
      );
      return;
    }

    if (selectedEvent.template_key === templateKey) {
      setNotice("Template ini sudah digunakan pada undangan aktif.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    const { data, error: updateError } = await supabase
      .from("invitation_events")
      .update({ template_key: templateKey })
      .eq("id", selectedEvent.id)
      .select(EVENT_FIELDS)
      .single();

    if (updateError) {
      setError(updateError.message);
    } else {
      setEvents((current) => current.map((item) => item.id === data.id ? data : item));
      setNotice(`Template berhasil diubah ke ${templates.find((item) => item.id === templateKey)?.name}. Data undangan tetap tersimpan.`);
    }
    setBusy(false);
  }

  function beginEditEvent() {
    if (!selectedEvent) return;
    setEventForm({
      title: selectedEvent.title,
      host_names: selectedEvent.host_names,
      event_date: selectedEvent.event_date || "",
      event_time: selectedEvent.event_time || "",
      venue: selectedEvent.venue || "",
      message: selectedEvent.message || "",
      template_key: selectedEvent.template_key,
    });
    setEditingEvent(true);
    setShowCreateForm(true);
    setError("");
    setNotice("");
  }

  async function deleteEvent() {
    if (!selectedEvent || !window.confirm(`Hapus acara "${selectedEvent.title}" dan seluruh daftar tamunya?`)) return;
    setBusy(true);
    setError("");
    const { error: deleteError } = await supabase
      .from("invitation_events")
      .delete()
      .eq("id", selectedEvent.id);
    if (deleteError) {
      setError(deleteError.message);
    } else {
      const remaining = events.filter((item) => item.id !== selectedEvent.id);
      setEvents(remaining);
      setSelectedEventId(remaining[0]?.id || null);
      setNotice("Acara dan daftar tamunya sudah dihapus.");
    }
    setBusy(false);
  }

  async function addGuest(event) {
    event.preventDefault();
    if (!selectedEvent || !guestForm.name.trim()) return;
    setBusy(true);
    setError("");
    const { data: userData, error: userError } = await supabase.auth.getUser();
    const { error: insertError } = userError
      ? { error: userError }
      : await supabase.from("invitation_guests").insert({
          ...guestForm,
          name: guestForm.name.trim(),
          phone: guestForm.phone.trim() || null,
          instagram: guestForm.instagram.trim() || null,
          notes: guestForm.notes.trim() || null,
          user_id: userData.user.id,
          event_id: selectedEvent.id,
        });
    if (insertError) {
      setError(insertError.message);
    } else {
      setGuestForm({ name: "", phone: "", instagram: "", notes: "" });
      setShowGuestForm(false);
      await loadGuests(selectedEvent.id);
      setNotice("Tamu berhasil ditambahkan.");
    }
    setBusy(false);
  }

  async function importGuests(file) {
    if (!selectedEvent || !file) return;
    setBusy(true);
    setError("");
    setNotice("");
    let imported = 0;
    try {
      const isCsv = file.name.toLowerCase().endsWith(".csv");
      if (!isCsv && !file.name.toLowerCase().endsWith(".xlsx")) {
        throw new Error("Gunakan file CSV atau Excel dengan format .xlsx.");
      }
      const sourceRows = isCsv
        ? parseCsv(await file.text())
        : await readXlsxFile(file);
      const headers = sourceRows[0];
      if (!headers?.length) throw new Error("File tidak memiliki baris header.");
      const dataRows = sourceRows.slice(1).map((cells) =>
        Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])),
      );
      const rows = dataRows.map(mapImportRow).filter((row) => row.name);
      if (!rows.length) {
        throw new Error("Kolom nama belum ditemukan atau tidak ada data tamu yang valid.");
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      for (let offset = 0; offset < rows.length; offset += GUEST_BATCH_SIZE) {
        const batch = rows.slice(offset, offset + GUEST_BATCH_SIZE).map((row) => ({
          ...row,
          user_id: userData.user.id,
          event_id: selectedEvent.id,
        }));
        const { error: insertError } = await supabase
          .from("invitation_guests")
          .insert(batch);
        if (insertError) {
          throw new Error(
            `Import terhenti setelah ${imported} tamu. ${insertError.message}`,
          );
        }
        imported += batch.length;
      }
      await loadGuests(selectedEvent.id);
      setNotice(`${imported} tamu berhasil diimpor dari ${file.name}.`);
    } catch (importError) {
      let errorMessage = importError.message || "Gagal membaca file.";
      if (imported > 0) {
        try {
          await loadGuests(selectedEvent.id);
        } catch (refreshError) {
          errorMessage += ` Daftar tamu gagal dimuat ulang: ${refreshError.message}`;
        }
      }
      setError(errorMessage);
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function updateGuest(guestId, changes) {
    setError("");
    const { data, error: updateError } = await supabase
      .from("invitation_guests")
      .update(changes)
      .eq("id", guestId)
      .select(GUEST_FIELDS)
      .single();
    if (updateError) {
      setError(updateError.message);
      return null;
    }
    setGuests((current) => current.map((guest) => guest.id === guestId ? data : guest));
    return data;
  }

  async function markAsSent(guest) {
    if (guest.is_sent) return;
    const updated = await updateGuest(guest.id, {
      is_sent: true,
      sent_at: new Date().toISOString(),
    });
    if (updated) setNotice(`Undangan untuk ${guest.name} ditandai sudah dikirim.`);
  }

  async function copyInvitationLink(guest) {
    if (!origin) {
      setError("Tautan belum siap. Coba beberapa saat lagi.");
      return;
    }

    try {
      await navigator.clipboard.writeText(
        `${origin}/i/${guest.invitation_token}`,
      );
      setError("");
      setNotice(`Tautan personal untuk ${guest.name} disalin.`);
    } catch (copyError) {
      setError(`Gagal menyalin tautan: ${copyError.message}`);
    }
  }

  async function deleteGuest(guest) {
    if (!window.confirm(`Hapus undangan untuk ${guest.name}?`)) return;
    const { error: deleteError } = await supabase
      .from("invitation_guests")
      .delete()
      .eq("id", guest.id);
    if (deleteError) {
      setError(deleteError.message);
    } else {
      setGuests((current) => current.filter((item) => item.id !== guest.id));
    }
  }

  async function createTemplateDemo(templateKey) {
    setBusy(true);
    setError("");
    setNotice("");
    const { data: userData, error: userError } = await supabase.auth.getUser();
    const { data: event, error: eventError } = userError
      ? { data: null, error: userError }
      : await supabase
          .from("invitation_events")
          .insert({
            user_id: userData.user.id,
            title: "Pernikahan Raka & Alya",
            host_names: "Raka & Alya",
            groom_name: "Raka Pratama",
            groom_parents: "Putra dari Bapak Hendra Pratama & Ibu Sri Wahyuni",
            groom_photo:
              "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80",
            bride_name: "Alya Rahmadani",
            bride_parents: "Putri dari Bapak Ahmad Fauzi & Ibu Nur Aisyah",
            bride_photo:
              "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80",
            event_date: "2026-12-12",
            event_time: "11.00–14.00 WIB",
            venue: "Gedung Serbaguna Melati, Jakarta Selatan",
            akad_date: "2026-12-12",
            akad_time: "09.00 WIB",
            akad_venue: "Masjid Al-Ikhlas, Jakarta Selatan",
            message:
              "Dengan memohon rahmat dan ridha Allah SWT, kami bermaksud menyelenggarakan pernikahan putra-putri kami. Merupakan suatu kehormatan dan kebahagiaan bagi kami apabila Anda berkenan hadir.",
            gift_address: "Jl. Melati No. 21, Kebayoran Baru, Jakarta Selatan 12120",
            gallery_photos: demoGallery,
            gift_accounts: [
              { bank: "Bank BCA", number: "1234567890", owner: "Raka Pratama" },
              { bank: "Bank Mandiri", number: "9876543210", owner: "Alya Rahmadani" },
            ],
            template_key: templateKey || "elegant",
          })
          .select(EVENT_FIELDS)
          .single();

    if (eventError) {
      setError(eventError.message);
      setBusy(false);
      return;
    }
    const { error: guestError } = await supabase.from("invitation_guests").insert([
      {
        user_id: userData.user.id,
        event_id: event.id,
        name: "Sahabat Tersayang",
        phone: "6281234567890",
        instagram: "@sahabat",
        notes: "Tamu demo untuk testing",
      },
      {
        user_id: userData.user.id,
        event_id: event.id,
        name: "Keluarga Besar",
        phone: "6281234567891",
        notes: "Tamu demo kedua",
      },
    ]);

    if (guestError) {
      const { error: cleanupError } = await supabase
        .from("invitation_events")
        .delete()
        .eq("id", event.id);
      setError(
        cleanupError
          ? `${guestError.message} Acara demo juga gagal dibersihkan: ${cleanupError.message}`
          : guestError.message,
      );
    } else {
      setEvents((current) => [event, ...current]);
      setSelectedEventId(event.id);
      setShowCreateForm(false);
      setNotice("Contoh undangan siap dicoba dengan 2 tamu. Buka tautan tamu untuk melihat hasilnya.");
    }
    setBusy(false);
  }

  function downloadCsvTemplate() {
    const csv = [
      "nama,nomor hp,instagram,keterangan",
      "Andi Pratama,081234567890,@andi,Teman kuliah",
      "Siti Rahma,081234567891,@siti,Keluarga",
    ].join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "contoh-daftar-undangan.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const filteredGuests = guests.filter((guest) => {
    const matchesSearch = `${guest.name} ${guest.phone || ""} ${guest.instagram || ""}`
      .toLowerCase()
      .includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === "sent") return guest.is_sent;
    if (filter === "pending") return !guest.is_sent;
    if (filter === "responded") return Boolean(guest.rsvp_status);
    return true;
  });

  const sentCount = guests.filter((guest) => guest.is_sent).length;
  const attendingCount = guests.filter((guest) => guest.rsvp_status === "attending").length;
  const responseCount = guests.filter((guest) => guest.rsvp_status).length;
  const chosenTemplateKey = showCreateForm ? eventForm.template_key : selectedEvent?.template_key;
  return (
    <div className="invitation-workspace">
      <header className="invitation-page-heading">
        <div>
          <p className="eyebrow">MANAJEMEN TAMU & RSVP</p>
          <h1>Kelola undangan<span className="heading-period">.</span></h1>
          <p className="page-subtitle">Satu undangan personal untuk setiap tamu spesialmu.</p>
        </div>
        <button
          className="button button-primary"
          onClick={() => {
            setEventForm({
              title: "",
              host_names: "",
              event_date: "",
              event_time: "",
              venue: "",
              message: "",
              template_key: "elegant",
            });
            setEditingEvent(false);
            setShowCreateForm(true);
            setError("");
            setNotice("");
          }}
        >
          <span aria-hidden="true">＋</span> Buat acara
        </button>
      </header>

      {error && <p className="form-message error invitation-message">{error}</p>}
      {notice && <p className="form-message success invitation-message">{notice}</p>}

      <section className="template-shelf">
        <div className="template-shelf-heading">
          <div>
            <h2>Template undangan</h2>
            <p>
              {selectedEvent
                ? `Pilih desain untuk “${selectedEvent.title}”. Semua data dan tautan tamu tetap sama.`
                : "Pilih desain terlebih dahulu. Data acara bisa dilengkapi setelahnya."}
            </p>
          </div>
          <button className="text-button" onClick={downloadCsvTemplate}>Unduh contoh CSV</button>
        </div>
        <div className="template-cards">
          {templates.map((item) => (
            <article
              className={`template-card ${item.id} ${
                chosenTemplateKey === item.id ? "selected" : ""
              }`}
              key={item.id}
            >
              <span className="template-card-symbol" aria-hidden="true">{item.symbol}</span>
              <div>
                <span className="template-style">{item.style}</span>
                <h3>{item.name}</h3>
                <p>{item.description}</p>
              </div>
              <div className="template-card-actions">
                <button
                  className="button button-subtle"
                  onClick={() => chooseTemplate(item.id)}
                  disabled={busy}
                >
                  {selectedEvent && !showCreateForm && selectedEvent.template_key === item.id
                    ? "Sedang dipakai"
                    : chosenTemplateKey === item.id
                      ? "Terpilih"
                      : selectedEvent
                        ? "Gunakan template"
                        : "Pilih template"}
                </button>
                <button
                  className="text-button template-demo-button"
                  onClick={() => createTemplateDemo(item.id)}
                  disabled={busy}
                >
                  Buat contoh
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {showCreateForm && (
        <section className="invitation-form-card">
          <div className="invitation-form-heading">
            <div>
              <p className="eyebrow">{editingEvent ? "PENGATURAN ACARA" : "MULAI DARI SINI"}</p>
              <h2>{editingEvent ? "Edit detail undangan" : "Buat acara undangan"}</h2>
            </div>
            <button
              className="icon-button"
              onClick={() => {
                setShowCreateForm(false);
                setEditingEvent(false);
              }}
              aria-label="Tutup form"
            >
              ×
            </button>
          </div>
          <form className="invitation-event-form" onSubmit={saveEvent}>
            <label>
              Nama acara
              <input
                value={eventForm.title}
                onChange={(event) => setEventForm({ ...eventForm, title: event.target.value })}
                placeholder="Contoh: Pernikahan Alya & Bima"
                maxLength={120}
                required
              />
            </label>
            <label>
              Nama pengundang
              <input
                value={eventForm.host_names}
                onChange={(event) => setEventForm({ ...eventForm, host_names: event.target.value })}
                placeholder="Contoh: Alya & Bima"
                maxLength={160}
                required
              />
            </label>
            <label>
              Template undangan
              <select
                value={eventForm.template_key}
                onChange={(event) =>
                  setEventForm({ ...eventForm, template_key: event.target.value })
                }
              >
                {templates.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
            <label>
              Tanggal acara
              <input
                type="date"
                value={eventForm.event_date}
                onChange={(event) => setEventForm({ ...eventForm, event_date: event.target.value })}
              />
            </label>
            <label>
              Waktu acara
              <input
                value={eventForm.event_time}
                onChange={(event) => setEventForm({ ...eventForm, event_time: event.target.value })}
                placeholder="Contoh: 10.00 WIB"
                maxLength={40}
              />
            </label>
            <label className="event-form-wide">
              Lokasi
              <input
                value={eventForm.venue}
                onChange={(event) => setEventForm({ ...eventForm, venue: event.target.value })}
                placeholder="Nama gedung dan alamat"
                maxLength={500}
              />
            </label>
            <label className="event-form-wide">
              Pesan dari tuan rumah
              <textarea
                rows={3}
                value={eventForm.message}
                onChange={(event) => setEventForm({ ...eventForm, message: event.target.value })}
                placeholder="Pesan singkat yang tampil di undangan (opsional)"
                maxLength={5000}
              />
            </label>
            <div className="event-form-actions event-form-wide">
              <button className="button button-primary" disabled={busy}>
                {busy ? "Menyimpan..." : editingEvent ? "Simpan perubahan" : "Buat acara"}
              </button>
            </div>
          </form>
        </section>
      )}

      {loading ? (
        <div className="empty-state"><span className="spinner" /><p>Memuat acara...</p></div>
      ) : events.length ? (
        <>
          <section className="event-selector-card">
            <label htmlFor="event-selector">Acara aktif</label>
            <select
              id="event-selector"
              value={selectedEventId || ""}
              onChange={(event) => {
                setSelectedEventId(event.target.value);
                setNotice("");
                setError("");
              }}
            >
              {events.map((event) => (
                <option key={event.id} value={event.id}>{event.title}</option>
              ))}
            </select>
            {selectedEvent && (
              <>
                <div className="event-selector-meta">
                  <span>{formatDate(selectedEvent.event_date)}</span>
                  <span>•</span>
                  <span>{selectedEvent.groom_name || selectedEvent.host_names}</span>
                  <span>•</span>
                  <span>{selectedEvent.gallery_photos?.length || 0} foto</span>
                </div>
                <div className="event-selector-actions">
                  <button className="button button-subtle" onClick={beginEditEvent}>Edit acara</button>
                  <button className="button button-subtle danger-subtle" onClick={deleteEvent} disabled={busy}>Hapus acara</button>
                </div>
              </>
            )}
          </section>

          <InvitationContentEditor
            event={selectedEvent}
            supabase={supabase}
            onSaved={(updated) =>
              setEvents((current) =>
                current.map((item) => (item.id === updated.id ? updated : item)),
              )
            }
          />

          <div className="invitation-stats">
            <article><span>Total tamu</span><strong>{guests.length}</strong></article>
            <article><span>Undangan terkirim</span><strong>{sentCount}<small> / {guests.length}</small></strong></article>
            <article><span>Sudah merespons</span><strong>{responseCount}</strong></article>
            <article><span>Konfirmasi hadir</span><strong>{attendingCount}</strong></article>
          </div>

          <section className="guest-management-card">
            <div className="guest-management-heading">
              <div>
                <h2>Daftar undangan <span>{guests.length}</span></h2>
                <p>Setiap tamu mendapat tautan undangan personal dan formulir RSVP.</p>
              </div>
              <div className="guest-toolbar-actions">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="visually-hidden-file"
                  onChange={(event) => importGuests(event.currentTarget.files?.[0])}
                />
                <button
                  className="button button-subtle"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                >
                  {busy ? "Mengimpor..." : "Impor CSV / Excel"}
                </button>
                <button className="button button-primary" onClick={() => setShowGuestForm(!showGuestForm)}>
                  <span aria-hidden="true">＋</span> Tambah tamu
                </button>
              </div>
            </div>

            {showGuestForm && (
              <form className="single-guest-form" onSubmit={addGuest}>
                <input
                  placeholder="Nama tamu *"
                  aria-label="Nama tamu"
                  value={guestForm.name}
                  onChange={(event) => setGuestForm({ ...guestForm, name: event.target.value })}
                  maxLength={160}
                  required
                />
                <input
                  placeholder="Nomor HP / WhatsApp"
                  aria-label="Nomor HP"
                  value={guestForm.phone}
                  onChange={(event) => setGuestForm({ ...guestForm, phone: event.target.value })}
                  maxLength={40}
                />
                <input
                  placeholder="Instagram"
                  aria-label="Instagram"
                  value={guestForm.instagram}
                  onChange={(event) => setGuestForm({ ...guestForm, instagram: event.target.value })}
                  maxLength={100}
                />
                <input
                  placeholder="Keterangan"
                  aria-label="Keterangan"
                  value={guestForm.notes}
                  onChange={(event) => setGuestForm({ ...guestForm, notes: event.target.value })}
                  maxLength={2000}
                />
                <button className="button button-primary" disabled={busy}>Simpan tamu</button>
              </form>
            )}

            <div className="guest-list-toolbar">
              <input
                className="guest-search"
                type="search"
                placeholder="Cari nama, nomor, Instagram..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Cari tamu"
              />
              <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter daftar undangan">
                <option value="all">Semua tamu</option>
                <option value="pending">Belum dikirim</option>
                <option value="sent">Sudah dikirim</option>
                <option value="responded">Sudah RSVP</option>
              </select>
            </div>

            {guestsLoading ? (
              <div className="empty-state"><span className="spinner" /><p>Memuat daftar tamu...</p></div>
            ) : guests.length ? filteredGuests.length ? (
              <div className="guest-table-wrap">
                <table className="guest-table">
                  <thead>
                    <tr>
                      <th>Nama tamu</th>
                      <th>Kontak</th>
                      <th>Pengiriman</th>
                      <th>Konfirmasi</th>
                      <th>Keterangan / pesan tamu</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGuests.map((guest) => {
                      const invitationUrl = origin
                        ? `${origin}/i/${guest.invitation_token}`
                        : "";
                      const whatsappText = `Halo ${guest.name}, kami mengundangmu ke ${selectedEvent.title}. Lihat undangan personalmu: ${invitationUrl}`;
                      const whatsappUrl = origin
                        ? buildWhatsAppUrl(guest.phone, whatsappText)
                        : "";
                      return (
                        <tr key={guest.id}>
                          <td>
                            <strong className="guest-name">{guest.name}</strong>
                            {guest.instagram && <span className="guest-secondary">{guest.instagram}</span>}
                          </td>
                          <td>{guest.phone || <span className="table-muted">—</span>}</td>
                          <td>
                            {guest.is_sent ? (
                              <span className="sent-status"><span />Terkirim</span>
                            ) : <span className="table-muted">Belum dikirim</span>}
                            {guest.sent_at && <span className="guest-secondary">{formatDateTime(guest.sent_at)}</span>}
                          </td>
                          <td>
                            <span className={`rsvp-status ${rsvpClass(guest.rsvp_status)}`}>
                              {rsvpLabel(guest.rsvp_status)}
                            </span>
                          </td>
                          <td>
                            {guest.guest_message && <span className="guest-reply">“{guest.guest_message}”</span>}
                            {guest.notes && <span className="guest-secondary">Catatan: {guest.notes}</span>}
                            {!guest.guest_message && !guest.notes && <span className="table-muted">—</span>}
                          </td>
                          <td>
                            <div className="guest-row-actions">
                              {whatsappUrl && (
                                <a
                                  className="guest-send-link"
                                  href={whatsappUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="Kirim via WhatsApp"
                                >
                                  WA
                                </a>
                              )}
                              {!guest.is_sent && (
                                <button
                                  className="guest-icon-action"
                                  onClick={() => markAsSent(guest)}
                                  title="Tandai terkirim"
                                  aria-label={`Tandai undangan ${guest.name} terkirim`}
                                >
                                  ✓
                                </button>
                              )}
                              <button
                                className="guest-icon-action"
                                onClick={() => copyInvitationLink(guest)}
                                title="Salin tautan undangan"
                                aria-label={`Salin tautan ${guest.name}`}
                                disabled={!origin}
                              >
                                ↗
                              </button>
                              <button
                                className="guest-icon-action danger-action"
                                onClick={() => deleteGuest(guest)}
                                title="Hapus tamu"
                                aria-label={`Hapus ${guest.name}`}
                              >
                                ×
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state guest-empty">
                <h3>Tidak ada tamu yang cocok.</h3>
                <p>Coba ubah kata pencarian atau filter daftar.</p>
              </div>
            ) : (
              <div className="empty-state guest-empty">
                <div className="empty-icon">✉</div>
                <h3>Daftar tamu masih kosong.</h3>
                <p>Impor file CSV/Excel atau tambahkan tamu satu per satu untuk mulai membagikan undangan personal.</p>
              </div>
            )}
            <p className="import-format-hint">
              Kolom yang didukung: <strong>nama</strong> (wajib), nomor HP, Instagram, dan keterangan.
              File CSV atau XLSX. Undangan dikirim manual melalui WhatsApp atau tautannya.
            </p>
          </section>
        </>
      ) : (
        <section className="invitation-empty-start">
          <div className="empty-icon">✉</div>
          <h2>Siapkan undangan pertamamu.</h2>
          <p>Pilih salah satu template siap pakai atau buat acara sendiri. Kamu dapat mengimpor daftar tamu setelahnya.</p>
          <button className="button button-primary" onClick={() => setShowCreateForm(true)}>
            Buat acara undangan
          </button>
        </section>
      )}
    </div>
  );
}
