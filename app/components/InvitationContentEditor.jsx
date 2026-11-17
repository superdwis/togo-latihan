"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const EMPTY_GIFT = { bank: "", number: "", owner: "" };
const EDITOR_SECTIONS = [
  { id: "cover", label: "Sampul", icon: "▣" },
  { id: "couple", label: "Mempelai", icon: "♡" },
  { id: "events", label: "Acara", icon: "◷" },
  { id: "message", label: "Kutipan & pesan", icon: "≋" },
  { id: "gallery", label: "Galeri", icon: "▧" },
  { id: "gifts", label: "Hadiah", icon: "◇" },
];

function trimOrNull(value) {
  const trimmed = String(value || "").trim();
  return trimmed || null;
}

function toForm(event) {
  return {
    groom_name: event.groom_name || "",
    groom_parents: event.groom_parents || "",
    groom_instagram: event.groom_instagram || "",
    groom_photo: event.groom_photo || "",
    bride_name: event.bride_name || "",
    bride_parents: event.bride_parents || "",
    bride_instagram: event.bride_instagram || "",
    bride_photo: event.bride_photo || "",
    akad_date: event.akad_date || "",
    akad_time: event.akad_time || "",
    akad_venue: event.akad_venue || "",
    event_date: event.event_date || "",
    event_time: event.event_time || "",
    venue: event.venue || "",
    quote: event.quote || "",
    quote_source: event.quote_source || "",
    message: event.message || "",
    gift_address: event.gift_address || "",
    gallery_photos: Array.isArray(event.gallery_photos)
      ? event.gallery_photos.filter((item) => typeof item === "string")
      : [],
    gift_accounts:
      Array.isArray(event.gift_accounts) && event.gift_accounts.length
        ? event.gift_accounts.map((gift) => ({
            bank: gift?.bank || "",
            number: gift?.number || "",
            owner: gift?.owner || "",
          }))
        : [{ ...EMPTY_GIFT }],
  };
}

function PropertyField({ label, value, onChange, multiline = false, ...props }) {
  const Control = multiline ? "textarea" : "input";
  return (
    <label className="inv-canvas-property">
      <span>{label}</span>
      <Control
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...(multiline ? { rows: 3 } : {})}
        {...props}
      />
    </label>
  );
}

function InlineCanvasField({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className = "",
  multiline = false,
  maxLength,
  type = "text",
}) {
  const Control = multiline ? "textarea" : "input";
  const content = value || "";
  const sizeStyle = multiline || type === "date"
    ? undefined
    : { width: `${Math.max(content.length, placeholder.length, 5)}ch` };

  return (
    <Control
      className={`inv-canvas-inline-field ${className}`}
      value={content}
      placeholder={placeholder}
      type={multiline ? undefined : type}
      aria-label={ariaLabel}
      title="Klik lalu ketik untuk mengubah teks"
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => onChange(event.target.value)}
      maxLength={maxLength}
      rows={multiline ? 3 : undefined}
      style={sizeStyle}
    />
  );
}

export default function InvitationContentEditor({ event, supabase, onSaved }) {
  const [form, setForm] = useState(() => toForm(event));
  const [open, setOpen] = useState(false);
  const [selectedSection, setSelectedSection] = useState("cover");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [dirty, setDirty] = useState(false);
  const galleryInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const activePhotoTarget = useRef("");

  useEffect(() => {
    setForm(toForm(event));
    setError("");
    setNotice("");
    setDirty(false);
    setSelectedSection("cover");
  }, [event.id]);

  const galleryCount = form.gallery_photos.length;
  const filledGifts = useMemo(
    () => form.gift_accounts.filter((gift) => gift.bank || gift.number || gift.owner).length,
    [form.gift_accounts],
  );

  function updateField(field, value) {
    setDirty(true);
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateGift(index, field, value) {
    setDirty(true);
    setForm((current) => ({
      ...current,
      gift_accounts: current.gift_accounts.map((gift, giftIndex) =>
        giftIndex === index ? { ...gift, [field]: value } : gift,
      ),
    }));
  }

  function addGift() {
    setDirty(true);
    setForm((current) => ({
      ...current,
      gift_accounts: [...current.gift_accounts, { ...EMPTY_GIFT }],
    }));
  }

  function removeGift(index) {
    setDirty(true);
    setForm((current) => ({
      ...current,
      gift_accounts: current.gift_accounts.filter((_, giftIndex) => giftIndex !== index),
    }));
  }

  function addPhotoUrl() {
    const url = photoUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url) && !url.startsWith("data:image/")) {
      setError("URL foto harus dimulai dengan http:// atau https://.");
      return;
    }
    setError("");
    updateField("gallery_photos", [...form.gallery_photos, url]);
    setPhotoUrl("");
  }

  function removePhoto(index) {
    updateField(
      "gallery_photos",
      form.gallery_photos.filter((_, photoIndex) => photoIndex !== index),
    );
  }

  async function uploadFile(file, target) {
    if (!file) return "";
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) {
      throw new Error("Sesi login berakhir. Silakan masuk kembali.");
    }

    const body = new FormData();
    body.append("eventId", event.id);
    body.append("file", file);
    const response = await fetch("/api/invitations/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      body,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Gagal mengunggah foto.");

    if (target === "gallery_photos") {
      setDirty(true);
      setForm((current) => ({
        ...current,
        gallery_photos: [...current.gallery_photos, result.url],
      }));
    } else {
      updateField(target, result.url);
    }
    return result.url;
  }

  async function handleSingleUpload(file, target) {
    if (!file) return;
    setUploading(target);
    setError("");
    setNotice("");
    try {
      await uploadFile(file, target);
      setNotice("Foto berhasil diunggah. Simpan perubahan untuk menerapkannya.");
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setUploading("");
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  async function handleGalleryUpload(files) {
    const list = Array.from(files || []).slice(0, 10);
    if (!list.length) return;
    setUploading("gallery_photos");
    setError("");
    setNotice("");
    let uploaded = 0;
    try {
      for (const file of list) {
        await uploadFile(file, "gallery_photos");
        uploaded += 1;
      }
      setNotice(`${uploaded} foto ditambahkan. Simpan perubahan untuk menerapkannya.`);
    } catch (uploadError) {
      setError(
        uploaded
          ? `${uploaded} foto berhasil diunggah. ${uploadError.message}`
          : uploadError.message,
      );
    } finally {
      setUploading("");
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  }

  async function saveContent() {
    setSaving(true);
    setError("");
    setNotice("");

    const values = {
      groom_name: trimOrNull(form.groom_name),
      groom_parents: trimOrNull(form.groom_parents),
      groom_instagram: trimOrNull(form.groom_instagram),
      groom_photo: trimOrNull(form.groom_photo),
      bride_name: trimOrNull(form.bride_name),
      bride_parents: trimOrNull(form.bride_parents),
      bride_instagram: trimOrNull(form.bride_instagram),
      bride_photo: trimOrNull(form.bride_photo),
      akad_date: form.akad_date || null,
      akad_time: trimOrNull(form.akad_time),
      akad_venue: trimOrNull(form.akad_venue),
      event_date: form.event_date || null,
      event_time: trimOrNull(form.event_time),
      venue: trimOrNull(form.venue),
      quote: trimOrNull(form.quote),
      quote_source: trimOrNull(form.quote_source),
      message: trimOrNull(form.message),
      gift_address: trimOrNull(form.gift_address),
      gallery_photos: form.gallery_photos.filter(Boolean),
      gift_accounts: form.gift_accounts.filter(
        (gift) => gift.bank.trim() || gift.number.trim() || gift.owner.trim(),
      ),
    };

    try {
      const { data, error: saveError } = await supabase
        .from("invitation_events")
        .update(values)
        .eq("id", event.id)
        .select("*")
        .single();

      if (saveError) {
        setError(saveError.message);
      } else {
        setDirty(false);
        setNotice("Perubahan tersimpan. Undangan tamu sudah diperbarui.");
        onSaved(data);
      }
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Tidak dapat menyimpan perubahan undangan.",
      );
    } finally {
      setSaving(false);
    }
  }

  function selectSection(section) {
    setSelectedSection(section);
    if (section === "groom_photo" || section === "bride_photo") {
      activePhotoTarget.current = section;
    }
  }

  function selectPhoto(field) {
    activePhotoTarget.current = field;
    setSelectedSection(field);
  }

  function renderCanvasSection(id, label, content, className = "") {
    const selected =
      selectedSection === id || (id === "couple" && selectedSection.endsWith("_photo"));
    return (
      <div
        role="group"
        tabIndex={0}
        className={`inv-canvas-block ${selected ? "selected" : ""} ${className}`}
        onClick={() => selectSection(id)}
        onKeyDown={(keyEvent) => {
          if (keyEvent.target === keyEvent.currentTarget && ["Enter", " "].includes(keyEvent.key)) {
            keyEvent.preventDefault();
            selectSection(id);
          }
        }}
        aria-label={`Pilih bagian ${label} untuk diedit`}
      >
        {content}
        {selected && <span className="inv-canvas-selection-label">{label}</span>}
      </div>
    );
  }

  function renderPhotoInspector(label, field) {
    const value = form[field];
    return (
      <div className="inv-canvas-photo-property">
        <span className="inv-canvas-property-label">{label}</span>
        <div className="inv-canvas-photo-preview">
          {value ? <img src={value} alt={`Pratinjau ${label}`} /> : <span>Foto belum dipilih</span>}
        </div>
        <PropertyField
          label="URL foto"
          value={value}
          onChange={(next) => updateField(field, next)}
          placeholder="Tempel URL foto..."
        />
        <div className="inv-canvas-property-actions">
          <button
            type="button"
            className="button button-subtle"
            onClick={() => {
              activePhotoTarget.current = field;
              photoInputRef.current?.click();
            }}
            disabled={Boolean(uploading)}
          >
            {uploading === field ? "Mengunggah..." : "Ganti foto"}
          </button>
          {value && (
            <button type="button" className="text-button inv-editor-remove" onClick={() => updateField(field, "")}>
              Hapus
            </button>
          )}
        </div>
      </div>
    );
  }

  function renderInspector() {
    if (selectedSection === "cover") {
      return (
        <>
          <p className="inv-canvas-inspector-description">
            Pilih teks pada sampul untuk mengubah data pasangan atau tanggal.
          </p>
          <PropertyField label="Nama mempelai 1" value={form.groom_name} onChange={(value) => updateField("groom_name", value)} placeholder="Nama mempelai 1" maxLength={160} />
          <PropertyField label="Nama mempelai 2" value={form.bride_name} onChange={(value) => updateField("bride_name", value)} placeholder="Nama mempelai 2" maxLength={160} />
          <PropertyField label="Tanggal resepsi" type="date" value={form.event_date} onChange={(value) => updateField("event_date", value)} />
        </>
      );
    }

    if (selectedSection === "couple") {
      return (
        <>
          <p className="inv-canvas-inspector-description">
            Atur nama, informasi keluarga, akun sosial, dan foto mempelai.
          </p>
          <PropertyField label="Nama mempelai 1" value={form.groom_name} onChange={(value) => updateField("groom_name", value)} maxLength={160} />
          <PropertyField label="Orang tua mempelai 1" value={form.groom_parents} onChange={(value) => updateField("groom_parents", value)} multiline maxLength={300} />
          <PropertyField label="Instagram mempelai 1" value={form.groom_instagram} onChange={(value) => updateField("groom_instagram", value)} placeholder="@username" maxLength={31} />
          {renderPhotoInspector("Foto mempelai 1", "groom_photo")}
          <PropertyField label="Nama mempelai 2" value={form.bride_name} onChange={(value) => updateField("bride_name", value)} maxLength={160} />
          <PropertyField label="Orang tua mempelai 2" value={form.bride_parents} onChange={(value) => updateField("bride_parents", value)} multiline maxLength={300} />
          <PropertyField label="Instagram mempelai 2" value={form.bride_instagram} onChange={(value) => updateField("bride_instagram", value)} placeholder="@username" maxLength={31} />
          {renderPhotoInspector("Foto mempelai 2", "bride_photo")}
        </>
      );
    }

    if (selectedSection === "events") {
      return (
        <>
          <p className="inv-canvas-inspector-description">
            Bagian acara muncul mengikuti data yang diisi. Tanggal resepsi juga dipakai untuk hitung mundur.
          </p>
          <h4 className="inv-canvas-inspector-subtitle">Akad nikah</h4>
          <PropertyField label="Tanggal akad" type="date" value={form.akad_date} onChange={(value) => updateField("akad_date", value)} />
          <PropertyField label="Waktu akad" value={form.akad_time} onChange={(value) => updateField("akad_time", value)} placeholder="Contoh: 09.00 WIB" maxLength={40} />
          <PropertyField label="Lokasi akad" value={form.akad_venue} onChange={(value) => updateField("akad_venue", value)} multiline maxLength={500} />
          <h4 className="inv-canvas-inspector-subtitle">Resepsi</h4>
          <PropertyField label="Tanggal resepsi" type="date" value={form.event_date} onChange={(value) => updateField("event_date", value)} />
          <PropertyField label="Waktu resepsi" value={form.event_time} onChange={(value) => updateField("event_time", value)} placeholder="Contoh: 11.00–14.00 WIB" maxLength={40} />
          <PropertyField label="Lokasi resepsi" value={form.venue} onChange={(value) => updateField("venue", value)} multiline maxLength={500} />
        </>
      );
    }

    if (selectedSection === "message") {
      return (
        <>
          <p className="inv-canvas-inspector-description">
            Sesuaikan kalimat sambutan dan kutipan yang tampil pada undangan.
          </p>
          <PropertyField label="Pesan sambutan" value={form.message} onChange={(value) => updateField("message", value)} multiline maxLength={5000} placeholder="Tulis pesan untuk para tamu..." />
          <PropertyField label="Kutipan" value={form.quote} onChange={(value) => updateField("quote", value)} multiline maxLength={1000} placeholder="Kosongkan untuk kutipan bawaan." />
          <PropertyField label="Sumber kutipan" value={form.quote_source} onChange={(value) => updateField("quote_source", value)} maxLength={160} placeholder="Contoh: QS. Ar-Rum : 21" />
        </>
      );
    }

    if (selectedSection === "gallery") {
      return (
        <>
          <p className="inv-canvas-inspector-description">
            Unggah foto atau tempel URL. Klik foto di panel ini untuk menghapusnya.
          </p>
          <div className="inv-canvas-gallery-properties">
            {form.gallery_photos.map((photo, index) => (
              <button
                type="button"
                key={`${photo}-${index}`}
                className="inv-canvas-gallery-property"
                onClick={() => removePhoto(index)}
                aria-label={`Hapus foto galeri ${index + 1}`}
                title="Klik untuk menghapus foto"
              >
                <img src={photo} alt={`Foto galeri ${index + 1}`} />
                <span>×</span>
              </button>
            ))}
            <label className="inv-canvas-gallery-add">
              {uploading === "gallery_photos" ? "Mengunggah..." : "＋ Tambah foto"}
              <input
                ref={galleryInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
                onChange={(inputEvent) => handleGalleryUpload(inputEvent.target.files)}
                disabled={Boolean(uploading)}
              />
            </label>
          </div>
          <div className="inv-canvas-add-url">
            <PropertyField label="URL foto" value={photoUrl} onChange={setPhotoUrl} placeholder="https://..." />
            <button type="button" className="button button-subtle" onClick={addPhotoUrl}>Tambah URL</button>
          </div>
        </>
      );
    }

    if (selectedSection === "gifts") {
      return (
        <>
          <p className="inv-canvas-inspector-description">
            Bagian hadiah otomatis disembunyikan bila rekening dan alamat kado kosong.
          </p>
          {form.gift_accounts.map((gift, index) => (
            <div className="inv-canvas-gift-property" key={`gift-${index}`}>
              <div className="inv-canvas-gift-heading">
                <strong>Rekening {index + 1}</strong>
                <button type="button" className="text-button inv-editor-remove" onClick={() => removeGift(index)}>Hapus</button>
              </div>
              <PropertyField label="Bank / e-wallet" value={gift.bank} onChange={(value) => updateGift(index, "bank", value)} maxLength={60} />
              <PropertyField label="Nomor rekening" value={gift.number} onChange={(value) => updateGift(index, "number", value)} maxLength={60} />
              <PropertyField label="Atas nama" value={gift.owner} onChange={(value) => updateGift(index, "owner", value)} maxLength={120} />
            </div>
          ))}
          <button type="button" className="button button-subtle" onClick={addGift}>＋ Tambah rekening</button>
          <PropertyField label="Alamat kirim kado" value={form.gift_address} onChange={(value) => updateField("gift_address", value)} multiline maxLength={500} />
        </>
      );
    }

    if (selectedSection === "groom_photo" || selectedSection === "bride_photo") {
      return renderPhotoInspector(
        selectedSection === "groom_photo" ? "Foto mempelai 1" : "Foto mempelai 2",
        selectedSection,
      );
    }

    return <p className="inv-canvas-inspector-description">Pilih bagian undangan untuk mengedit.</p>;
  }

  const templateClass = ["botanical", "modern"].includes(event.template_key)
    ? event.template_key
    : "elegant";
  const activeToolbarSection = selectedSection.endsWith("_photo") ? "couple" : selectedSection;

  return (
    <section className="inv-editor">
      <div className="inv-editor-head">
        <div>
          <p className="eyebrow">EDITOR VISUAL</p>
          <h2>Desain undanganmu</h2>
          <p className="inv-editor-lead">
            Klik bagian teks, foto, acara, atau galeri pada kanvas untuk mengubah isinya. Semua perubahan tetap untuk <strong>{event.title}</strong>.
          </p>
        </div>
        <button
          type="button"
          className={open ? "button button-subtle" : "button button-primary"}
          onClick={() => {
            setOpen((current) => !current);
            setError("");
            setNotice("");
          }}
        >
          {open ? "Tutup editor visual" : "Edit desain undangan"}
        </button>
      </div>

      {!open && (
        <div className="inv-editor-summary">
          <span>
            <strong>{form.groom_name || "Mempelai 1"}</strong> &amp;{" "}
            <strong>{form.bride_name || "Mempelai 2"}</strong>
          </span>
          <span>·</span>
          <span>{form.event_date || "Tanggal belum diisi"}</span>
          <span>·</span>
          <span>{galleryCount} foto</span>
          <span>·</span>
          <span>{filledGifts} rekening</span>
        </div>
      )}

      {open && (
        <div className="inv-canvas-editor">
          <nav className="inv-canvas-toolbar" aria-label="Bagian undangan">
            {EDITOR_SECTIONS.map((section) => (
              <button
                type="button"
                key={section.id}
                className={activeToolbarSection === section.id ? "active" : ""}
                onClick={() => selectSection(section.id)}
              >
                <span aria-hidden="true">{section.icon}</span>
                {section.label}
              </button>
            ))}
          </nav>

          {error && <p className="form-message error inv-editor-message">{error}</p>}
          {notice && <p className="form-message success inv-editor-message">{notice}</p>}

          <div className="inv-canvas-workspace">
            <div className="inv-canvas-stage">
              <div className="inv-canvas-stage-heading">
                <span>PRATINJAU UNDANGAN</span>
                <span>Klik nama atau teks untuk mengedit langsung</span>
              </div>
              <div className={`inv-canvas-page ${templateClass}`}>
                {renderCanvasSection(
                  "cover",
                  "Sampul",
                  <div className="inv-canvas-cover">
                    <span className="inv-canvas-monogram">
                      {(form.groom_name || "M").trim().charAt(0)}
                      {form.bride_name ? `&${form.bride_name.trim().charAt(0)}` : ""}
                    </span>
                    <span className="inv-canvas-eyebrow">THE WEDDING OF</span>
                    <span className="inv-canvas-couple-name">
                      <InlineCanvasField
                        value={form.groom_name}
                        onChange={(value) => updateField("groom_name", value)}
                        placeholder="Nama Mempelai 1"
                        ariaLabel="Edit nama mempelai 1 langsung di sampul"
                        className="inv-canvas-inline-name"
                        maxLength={160}
                      />
                      <i>&amp;</i>
                      <InlineCanvasField
                        value={form.bride_name}
                        onChange={(value) => updateField("bride_name", value)}
                        placeholder="Nama Mempelai 2"
                        ariaLabel="Edit nama mempelai 2 langsung di sampul"
                        className="inv-canvas-inline-name"
                        maxLength={160}
                      />
                    </span>
                    <InlineCanvasField
                      value={form.event_date}
                      onChange={(value) => updateField("event_date", value)}
                      type="date"
                      ariaLabel="Edit tanggal resepsi langsung di sampul"
                      className="inv-canvas-date"
                    />
                    <span className="inv-canvas-guest">
                      <small>KEPADA</small>
                      <strong>Nama Tamu</strong>
                    </span>
                    <span className="inv-canvas-open-button">Buka Undangan</span>
                  </div>,
                  "cover-preview",
                )}

                {renderCanvasSection(
                  "message",
                  "Sambutan & kutipan",
                  <div className="inv-canvas-intro">
                    <span className="inv-canvas-eyebrow">WE ARE GETTING MARRIED</span>
                    <span className="inv-canvas-hero-names">
                      <InlineCanvasField
                        value={form.groom_name}
                        onChange={(value) => updateField("groom_name", value)}
                        placeholder="Mempelai 1"
                        ariaLabel="Edit nama mempelai 1 langsung di judul"
                        className="inv-canvas-inline-name"
                        maxLength={160}
                      />
                      <i>&amp;</i>
                      <InlineCanvasField
                        value={form.bride_name}
                        onChange={(value) => updateField("bride_name", value)}
                        placeholder="Mempelai 2"
                        ariaLabel="Edit nama mempelai 2 langsung di judul"
                        className="inv-canvas-inline-name"
                        maxLength={160}
                      />
                    </span>
                    <span className="inv-canvas-message">
                      <InlineCanvasField
                        value={form.message}
                        onChange={(value) => updateField("message", value)}
                        placeholder="Klik untuk menulis pesan sambutan..."
                        ariaLabel="Edit pesan sambutan langsung di kanvas"
                        className="inv-canvas-inline-paragraph"
                        multiline
                        maxLength={5000}
                      />
                    </span>
                    <span className="inv-canvas-countdown">HARI　 JAM　 MENIT　 DETIK</span>
                  </div>,
                  "intro-preview",
                )}

                {renderCanvasSection(
                  "message",
                  "Kutipan",
                  <div className="inv-canvas-quote">
                    <InlineCanvasField
                      value={form.quote}
                      onChange={(value) => updateField("quote", value)}
                      placeholder="Klik untuk menulis kutipan..."
                      ariaLabel="Edit kutipan langsung di kanvas"
                      className="inv-canvas-inline-quote"
                      multiline
                      maxLength={1000}
                    />
                    <InlineCanvasField
                      value={form.quote_source}
                      onChange={(value) => updateField("quote_source", value)}
                      placeholder="Sumber kutipan"
                      ariaLabel="Edit sumber kutipan langsung di kanvas"
                      className="inv-canvas-inline-source"
                      maxLength={160}
                    />
                  </div>,
                  "quote-preview",
                )}

                {renderCanvasSection(
                  "couple",
                  "Mempelai",
                  <div className="inv-canvas-couple-section">
                    <span className="inv-canvas-eyebrow">BRIDE &amp; GROOM</span>
                    <strong>Kedua Mempelai</strong>
                    <div className="inv-canvas-couple-grid">
                      <div className="inv-canvas-person">
                        <button
                          type="button"
                          className="inv-canvas-person-photo-button"
                          aria-label="Ganti foto mempelai 1"
                          onClick={(clickEvent) => { clickEvent.stopPropagation(); selectPhoto("groom_photo"); }}
                        >
                          <span className="inv-canvas-person-photo">
                            {form.groom_photo ? <img src={form.groom_photo} alt="" /> : (form.groom_name || "M").trim().charAt(0)}
                          </span>
                        </button>
                        <InlineCanvasField
                          value={form.groom_name}
                          onChange={(value) => updateField("groom_name", value)}
                          placeholder="Nama Mempelai 1"
                          ariaLabel="Edit nama mempelai 1 langsung di profil"
                          className="inv-canvas-inline-name"
                          maxLength={160}
                        />
                        <InlineCanvasField
                          value={form.groom_parents}
                          onChange={(value) => updateField("groom_parents", value)}
                          placeholder="Nama orang tua"
                          ariaLabel="Edit nama orang tua mempelai 1 langsung di profil"
                          className="inv-canvas-inline-small"
                          multiline
                          maxLength={300}
                        />
                        <InlineCanvasField
                          value={form.groom_instagram}
                          onChange={(value) => updateField("groom_instagram", value)}
                          placeholder="@instagram"
                          ariaLabel="Edit Instagram mempelai 1 langsung di profil"
                          className="inv-canvas-inline-small"
                          maxLength={31}
                        />
                      </div>
                      <i>&amp;</i>
                      <div className="inv-canvas-person">
                        <button
                          type="button"
                          className="inv-canvas-person-photo-button"
                          aria-label="Ganti foto mempelai 2"
                          onClick={(clickEvent) => { clickEvent.stopPropagation(); selectPhoto("bride_photo"); }}
                        >
                          <span className="inv-canvas-person-photo">
                            {form.bride_photo ? <img src={form.bride_photo} alt="" /> : (form.bride_name || "M").trim().charAt(0)}
                          </span>
                        </button>
                        <InlineCanvasField
                          value={form.bride_name}
                          onChange={(value) => updateField("bride_name", value)}
                          placeholder="Nama Mempelai 2"
                          ariaLabel="Edit nama mempelai 2 langsung di profil"
                          className="inv-canvas-inline-name"
                          maxLength={160}
                        />
                        <InlineCanvasField
                          value={form.bride_parents}
                          onChange={(value) => updateField("bride_parents", value)}
                          placeholder="Nama orang tua"
                          ariaLabel="Edit nama orang tua mempelai 2 langsung di profil"
                          className="inv-canvas-inline-small"
                          multiline
                          maxLength={300}
                        />
                        <InlineCanvasField
                          value={form.bride_instagram}
                          onChange={(value) => updateField("bride_instagram", value)}
                          placeholder="@instagram"
                          ariaLabel="Edit Instagram mempelai 2 langsung di profil"
                          className="inv-canvas-inline-small"
                          maxLength={31}
                        />
                      </div>
                    </div>
                  </div>,
                  "couple-preview",
                )}

                {renderCanvasSection(
                  "events",
                  "Rangkaian acara",
                  <div className="inv-canvas-events">
                    <span className="inv-canvas-eyebrow">SAVE THE DATE</span>
                    <strong>Rangkaian Acara</strong>
                    <div className="inv-canvas-event-grid">
                      {(form.akad_date || form.akad_time || form.akad_venue) && (
                        <article>
                          <small>AKAD NIKAH</small>
                          <InlineCanvasField
                            value={form.akad_date}
                            onChange={(value) => updateField("akad_date", value)}
                            type="date"
                            ariaLabel="Edit tanggal akad langsung di kanvas"
                            className="inv-canvas-inline-event-value"
                          />
                          <InlineCanvasField
                            value={form.akad_time}
                            onChange={(value) => updateField("akad_time", value)}
                            placeholder="Waktu akad"
                            ariaLabel="Edit waktu akad langsung di kanvas"
                            className="inv-canvas-inline-event-value"
                            maxLength={40}
                          />
                          <InlineCanvasField
                            value={form.akad_venue}
                            onChange={(value) => updateField("akad_venue", value)}
                            placeholder="Lokasi akad"
                            ariaLabel="Edit lokasi akad langsung di kanvas"
                            className="inv-canvas-inline-event-value"
                            multiline
                            maxLength={500}
                          />
                        </article>
                      )}
                      <article>
                        <small>RESEPSI</small>
                        <InlineCanvasField
                          value={form.event_date}
                          onChange={(value) => updateField("event_date", value)}
                          type="date"
                          ariaLabel="Edit tanggal resepsi langsung di kanvas"
                          className="inv-canvas-inline-event-value"
                        />
                        <InlineCanvasField
                          value={form.event_time}
                          onChange={(value) => updateField("event_time", value)}
                          placeholder="Waktu resepsi"
                          ariaLabel="Edit waktu resepsi langsung di kanvas"
                          className="inv-canvas-inline-event-value"
                          maxLength={40}
                        />
                        <InlineCanvasField
                          value={form.venue}
                          onChange={(value) => updateField("venue", value)}
                          placeholder="Lokasi resepsi"
                          ariaLabel="Edit lokasi resepsi langsung di kanvas"
                          className="inv-canvas-inline-event-value"
                          multiline
                          maxLength={500}
                        />
                      </article>
                    </div>
                  </div>,
                  "events-preview",
                )}

                {renderCanvasSection(
                  "gallery",
                  "Galeri",
                  <div className="inv-canvas-gallery">
                    <span className="inv-canvas-eyebrow">OUR MOMENTS</span>
                    <strong>Galeri Kenangan</strong>
                    {form.gallery_photos.length ? (
                      <div className="inv-canvas-gallery-grid">
                        {form.gallery_photos.slice(0, 4).map((photo, index) => (
                          <img key={`${photo}-${index}`} src={photo} alt="" />
                        ))}
                      </div>
                    ) : (
                      <span className="inv-canvas-empty-gallery">Foto galeri akan tampil di sini</span>
                    )}
                  </div>,
                  "gallery-preview",
                )}

                {renderCanvasSection(
                  "gifts",
                  "Hadiah",
                  <div className="inv-canvas-gifts">
                    <span className="inv-canvas-eyebrow">TANDA KASIH</span>
                    <strong>Amplop Digital</strong>
                    {filledGifts || form.gift_address ? (
                      <span>{filledGifts ? `${filledGifts} rekening` : ""}{filledGifts && form.gift_address ? " · " : ""}{form.gift_address || ""}</span>
                    ) : (
                      <span>Bagian hadiah disembunyikan jika tidak diisi</span>
                    )}
                  </div>,
                  "gifts-preview",
                )}

                <div className="inv-canvas-preview-footer">
                  {form.groom_name || "Mempelai 1"} &amp; {form.bride_name || "Mempelai 2"} · Pratinjau RSVP tamu
                </div>
              </div>
            </div>

            <aside className="inv-canvas-inspector">
              <div className="inv-canvas-inspector-header">
                <span>PROPERTI</span>
                <h3>{EDITOR_SECTIONS.find((section) => section.id === selectedSection)?.label || (selectedSection === "groom_photo" ? "Foto mempelai 1" : "Foto mempelai 2")}</h3>
                <p>Perubahan langsung terlihat pada kanvas.</p>
              </div>
              <div className="inv-canvas-inspector-body">{renderInspector()}</div>
              <div className="inv-canvas-save">
                {dirty && <span className="inv-canvas-unsaved">Perubahan belum disimpan</span>}
                <button
                  type="button"
                  className="button button-primary"
                  onClick={saveContent}
                  disabled={saving || Boolean(uploading) || !dirty}
                >
                  {saving ? "Menyimpan..." : "Simpan perubahan"}
                </button>
                <button
                  type="button"
                  className="button button-subtle"
                  onClick={() => {
                    setForm(toForm(event));
                    setDirty(false);
                    setError("");
                    setNotice("");
                  }}
                  disabled={saving || Boolean(uploading) || !dirty}
                >
                  Batalkan perubahan
                </button>
              </div>
            </aside>
          </div>

          <input
            ref={photoInputRef}
            className="inv-canvas-hidden-input"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
            onChange={(inputEvent) =>
              handleSingleUpload(inputEvent.target.files?.[0], activePhotoTarget.current)
            }
          />
        </div>
      )}
    </section>
  );
}
