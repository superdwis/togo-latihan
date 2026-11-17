"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./InvitationGuestPage.module.css";

const RSVP_OPTIONS = [
  { value: "attending", label: "Hadir" },
  { value: "not_attending", label: "Tidak Hadir" },
  { value: "maybe", label: "Masih Ragu" },
];

const DEFAULT_QUOTE = {
  arabic:
    "وَمِنْ آيَاتِهِ أَنْ خَلَقَ لَكُم مِّنْ أَنفُسِكُمْ أَزْوَاجًا لِّتَسْكُنُوا إِلَيْهَا وَجَعَلَ بَيْنَكُم مَّوَدَّةً وَرَحْمَةً",
  text: "Dan di antara tanda-tanda kekuasaan-Nya ialah Dia menciptakan untukmu pasangan dari jenismu sendiri, supaya kamu merasa tenteram, dan dijadikan-Nya di antara kamu rasa kasih dan sayang.",
  source: "QS. Ar-Rum : 21",
};

const DEFAULT_MESSAGE =
  "Dengan memohon rahmat dan ridha Allah SWT, kami bermaksud menyelenggarakan pernikahan putra-putri kami. Merupakan suatu kehormatan dan kebahagiaan bagi kami apabila Anda berkenan hadir.";

function pad(value) {
  return String(value).padStart(2, "0");
}

function stringList(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string" && item.trim());
}

function objectList(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object");
}

function splitNames(value) {
  return String(value || "")
    .split(/\s*(?:&|dan)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function initialOf(name) {
  return String(name || "?").trim().charAt(0).toUpperCase() || "?";
}

function instagramProfile(value) {
  const handle = String(value || "").trim().replace(/^@/, "");
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(handle)) return null;
  return {
    handle: `@${handle}`,
    url: `https://www.instagram.com/${encodeURIComponent(handle)}/`,
  };
}

function formatLongDate(value) {
  if (!value) return "Tanggal menyusul";
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatShortDate(value) {
  if (!value) return "Tanggal menyusul";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Tanggal menyusul";
  return `${pad(date.getDate())} · ${pad(date.getMonth() + 1)} · ${date.getFullYear()}`;
}

function buildTargetDate(dateValue, timeValue) {
  if (!dateValue) return null;
  const time = String(timeValue || "").match(/(\d{1,2})[.:](\d{2})/);
  const hours = time ? pad(time[1]) : "09";
  const minutes = time ? time[2] : "00";
  const date = new Date(`${dateValue}T${hours}:${minutes}:00+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function mapsUrl(venue) {
  if (!venue) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue)}`;
}

export default function InvitationGuestPage({ token }) {
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [opened, setOpened] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [rsvpError, setRsvpError] = useState("");
  const [lightbox, setLightbox] = useState("");
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);
  const pageRef = useRef(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/invitations/public/${encodeURIComponent(token)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Undangan tidak ditemukan.");
        if (active) {
          setInvitation(result.invitation);
          setStatus(result.invitation.rsvp_status || "");
          setMessage(result.invitation.guest_message || "");
        }
      })
      .catch((requestError) => {
        if (active) setLoadError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  const openInvitation = useCallback(() => {
    setOpened(true);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  /* Kunci scroll selama cover masih tampil atau lightbox terbuka. */
  useEffect(() => {
    if (!invitation) return undefined;
    document.body.style.overflow = !opened || lightbox ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [invitation, opened, lightbox]);

  /* Scroll, swipe, dan keyboard dapat membuka undangan. */
  useEffect(() => {
    if (!invitation || opened) return undefined;

    const onWheel = (event) => {
      if (event.deltaY > 8) openInvitation();
    };
    let touchStartY = null;
    const onTouchStart = (event) => {
      touchStartY = event.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (event) => {
      if (touchStartY !== null && touchStartY - (event.touches[0]?.clientY ?? 0) > 30) {
        openInvitation();
      }
    };
    const onKeyDown = (event) => {
      if (["Enter", " ", "ArrowDown", "PageDown"].includes(event.key)) {
        openInvitation();
      }
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [invitation, opened, openInvitation]);

  /* Escape menutup pratinjau foto kapan pun lightbox terbuka. */
  useEffect(() => {
    if (!lightbox) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setLightbox("");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightbox]);

  /* Animasi muncul saat bagian undangan masuk ke layar. */
  useEffect(() => {
    if (!opened || !invitation) return undefined;
    const nodes = Array.from(pageRef.current?.querySelectorAll("[data-reveal]") || []);
    if (!("IntersectionObserver" in window)) {
      nodes.forEach((node) => node.classList.add(styles.in));
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.in);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [opened, invitation]);

  const model = useMemo(() => {
    if (!invitation) return null;

    const hosts = splitNames(invitation.host_names);
    const groomName = (invitation.groom_name || hosts[0] || invitation.event_title || "Mempelai").trim();
    const brideName = (invitation.bride_name || hosts[1] || "").trim();
    const coupleLabel = brideName ? `${groomName} & ${brideName}` : groomName;

    const gallery = stringList(invitation.gallery_photos);
    const gifts = objectList(invitation.gift_accounts).filter(
      (gift) => gift.bank || gift.number || gift.owner,
    );

    const akad = {
      date: invitation.akad_date,
      time: invitation.akad_time,
      venue: invitation.akad_venue,
    };
    const resepsi = {
      date: invitation.event_date,
      time: invitation.event_time,
      venue: invitation.venue,
    };

    const hasAkad = Boolean(akad.date || akad.time || akad.venue);
    const hasResepsi = Boolean(resepsi.date || resepsi.time || resepsi.venue);

    const events = [];
    if (hasAkad) events.push({ key: "akad", title: "Akad Nikah", ...akad });
    if (hasResepsi) events.push({ key: "resepsi", title: "Resepsi", ...resepsi });
    if (!events.length) {
      events.push({ key: "main", title: "Acara", date: null, time: "", venue: "" });
    }

    const navItems = [
      { id: "home", label: "Home" },
      { id: "mempelai", label: "Mempelai" },
      { id: "acara", label: "Acara" },
      ...(gallery.length ? [{ id: "galeri", label: "Galeri" }] : []),
      { id: "rsvp", label: "RSVP" },
      ...(gifts.length || invitation.gift_address
        ? [{ id: "hadiah", label: "Hadiah" }]
        : []),
    ];

    return {
      groomName,
      brideName,
      coupleLabel,
      gallery,
      gifts,
      events,
      navItems,
      akad,
      resepsi,
      hasAkad,
      hasResepsi,
      targetDate: buildTargetDate(invitation.event_date, invitation.event_time),
    };
  }, [invitation]);

  /* Countdown menuju hari acara. */
  useEffect(() => {
    if (!model?.targetDate) {
      setCountdown(null);
      return undefined;
    }
    const tick = () => {
      const diff = Math.max(0, model.targetDate.getTime() - Date.now());
      setCountdown({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [model?.targetDate]);

  function showToast(text) {
    setToast(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2200);
  }

  async function copyText(value, label) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      showToast(label);
    } catch {
      showToast("Gagal menyalin. Salin manual ya.");
    }
  }

  async function shareInvitation() {
    const data = {
      title: `Undangan ${model?.coupleLabel || "pernikahan"}`,
      text: "Kami mengundang Anda untuk hadir di hari istimewa kami.",
      url: window.location.href,
    };
    if (navigator.share) {
      try {
        await navigator.share(data);
      } catch {
        /* dibatalkan pengguna */
      }
      return;
    }
    copyText(window.location.href, "Tautan undangan disalin");
  }

  function saveTheDate() {
    if (!invitation?.event_date) {
      showToast("Tanggal acara belum diisi.");
      return;
    }
    const target = model?.targetDate || new Date(`${invitation.event_date}T09:00:00+07:00`);
    const start = new Date(target.getTime());
    const end = new Date(target.getTime() + 3 * 3600000);
    const stamp = (date) => date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Rapi//Undangan//ID",
      "BEGIN:VEVENT",
      `UID:${token}@undangan`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${invitation.event_title}`,
      `LOCATION:${invitation.venue || ""}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ];
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "undangan.ics";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Tanggal berhasil disimpan");
  }

  async function submitRsvp(event) {
    event.preventDefault();
    if (!status) {
      setRsvpError("Pilih konfirmasi kehadiran terlebih dahulu.");
      return;
    }

    setSaving(true);
    setRsvpError("");
    setSaved(false);
    try {
      const response = await fetch(
        `/api/invitations/public/${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, message }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Konfirmasi gagal disimpan.");
      setSaved(true);
    } catch (requestError) {
      setRsvpError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.loadingScreen}>
          <span className={styles.spinner} aria-label="Memuat undangan" />
        </div>
      </main>
    );
  }

  if (!invitation || !model) {
    return (
      <main className={styles.page}>
        <div className={styles.notFoundScreen}>
          <section className={styles.notFoundCard}>
            <div className={styles.monogram}>R.</div>
            <p className={styles.eyebrow}>Tautan Undangan</p>
            <h1>Undangan tidak ditemukan.</h1>
            <p>{loadError || "Periksa kembali tautan yang kamu terima."}</p>
          </section>
        </div>
      </main>
    );
  }

  const customQuote = Boolean(invitation.quote);
  const quoteText = invitation.quote || DEFAULT_QUOTE.text;
  const quoteSource = invitation.quote_source || DEFAULT_QUOTE.source;
  const greeting = invitation.message || DEFAULT_MESSAGE;
  const displayDate = formatShortDate(invitation.event_date);
  const monogram = `${initialOf(model.groomName)}${model.brideName ? `&${initialOf(model.brideName)}` : ""}`;
  const groomInstagram = instagramProfile(invitation.groom_instagram);
  const brideInstagram = instagramProfile(invitation.bride_instagram);
  const templateClass = ["botanical", "modern"].includes(invitation.template_key)
    ? invitation.template_key
    : "elegant";

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className={`${styles.page} ${styles[templateClass]}`} ref={pageRef}>
      {/* COVER */}
      <div
        className={`${styles.cover} ${opened ? styles.coverOpen : ""}`}
        aria-hidden={opened}
      >
        <div className={styles.coverInner}>
          <div className={styles.monogram}>{monogram}</div>
          <p className={styles.eyebrow}>The Wedding Of</p>
          <h1 className={styles.coverNames}>
            {model.groomName}
            {model.brideName && (
              <>
                <span className={styles.amp}>&amp;</span>
                {model.brideName}
              </>
            )}
          </h1>
          <p className={styles.coverDate}>{displayDate}</p>

          <div className={styles.guest}>
            <p className={styles.guestLabel}>Kepada</p>
            <p className={styles.guestName}>{invitation.guest_name}</p>
            <p className={styles.guestNote}>
              Tanpa mengurangi rasa hormat, kami mengundang Anda.
            </p>
          </div>

          <button className={`${styles.btn} ${styles.btnSolid}`} onClick={openInvitation}>
            Buka Undangan
          </button>
        </div>
        <p className={styles.coverHint}>Scroll atau klik tombol untuk membuka</p>
      </div>

      {/* NAV */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <button className={styles.brand} onClick={() => scrollTo("home")}>
            {model.groomName.split(" ")[0]} <em>&amp;</em>{" "}
            {model.brideName ? model.brideName.split(" ")[0] : ""}
          </button>
          <div className={styles.navLinks}>
            {model.navItems.map((item) => (
              <button
                key={item.id}
                className={styles.navLink}
                onClick={() => scrollTo(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* HERO */}
      <header className={styles.hero} id="home">
        <div className={styles.wrap}>
          <p className={`${styles.eyebrow} ${styles.reveal}`} data-reveal>
            We Are Getting Married
          </p>
          <h1
            className={`${styles.heroTitle} ${styles.reveal}`}
            data-reveal
            style={{ "--delay": "120ms" }}
          >
            {model.groomName}
            {model.brideName && (
              <>
                {" "}
                <span className={styles.heroAmp}>&amp;</span> {model.brideName}
              </>
            )}
          </h1>
          <div className={`${styles.orn} ${styles.reveal}`} data-reveal style={{ "--delay": "200ms" }}>
            <span />
          </div>
          <p
            className={`${styles.heroSub} ${styles.reveal}`}
            data-reveal
            style={{ "--delay": "260ms" }}
          >
            {greeting}
          </p>

          {countdown && (
            <div
              className={`${styles.countdown} ${styles.reveal}`}
              data-reveal
              style={{ "--delay": "320ms" }}
              aria-label="Hitung mundur acara"
            >
              {[
                ["Hari", countdown.days],
                ["Jam", countdown.hours],
                ["Menit", countdown.minutes],
                ["Detik", countdown.seconds],
              ].map(([label, value]) => (
                <div className={styles.countCell} key={label}>
                  <b>{pad(value)}</b>
                  <small>{label}</small>
                </div>
              ))}
            </div>
          )}

          <div
            className={`${styles.heroActions} ${styles.reveal}`}
            data-reveal
            style={{ "--delay": "380ms" }}
          >
            <button className={`${styles.btn} ${styles.btnSolid}`} onClick={() => scrollTo("acara")}>
              Lihat Acara
            </button>
            <button className={styles.btn} onClick={saveTheDate}>
              Simpan Tanggal
            </button>
          </div>
        </div>
      </header>

      {/* QUOTE */}
      <section className={styles.quote}>
        <div className={`${styles.wrap} ${styles.reveal}`} data-reveal>
          {!customQuote && <p className={styles.quoteArabic}>{DEFAULT_QUOTE.arabic}</p>}
          <blockquote className={styles.quoteText}>&ldquo;{quoteText}&rdquo;</blockquote>
          <cite className={styles.quoteSource}>{quoteSource}</cite>
        </div>
      </section>

      {/* MEMPELAI */}
      <section className={`${styles.section} ${styles.sectionAlt}`} id="mempelai">
        <div className={styles.wrap}>
          <div className={`${styles.sectionHead} ${styles.reveal}`} data-reveal>
            <p className={styles.eyebrow}>Bride &amp; Groom</p>
            <h2>Kedua Mempelai</h2>
            <p>Dua hati, satu tujuan. Dengan penuh rasa syukur kami memperkenalkan calon pengantin.</p>
          </div>

          <div
            className={`${styles.coupleGrid} ${
              model.brideName ? "" : styles.coupleGridSingle
            }`}
          >
            <article className={styles.person}>
              <div className={styles.personPhoto}>
                {invitation.groom_photo ? (
                  <img src={invitation.groom_photo} alt={model.groomName} loading="lazy" />
                ) : (
                  <span className={styles.personInitial}>{initialOf(model.groomName)}</span>
                )}
              </div>
              <h3>{model.groomName}</h3>
              <span className={styles.personRole}>The Groom</span>
              {invitation.groom_parents && (
                <p className={styles.personParents}>{invitation.groom_parents}</p>
              )}
              {groomInstagram && (
                <a
                  className={styles.personInstagram}
                  href={groomInstagram.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {groomInstagram.handle}
                </a>
              )}
            </article>

            {model.brideName && (
              <>
                <div className={styles.coupleAmp} aria-hidden="true">
                  &amp;
                </div>
                <article className={styles.person}>
                  <div className={styles.personPhoto}>
                    {invitation.bride_photo ? (
                      <img src={invitation.bride_photo} alt={model.brideName} loading="lazy" />
                    ) : (
                      <span className={styles.personInitial}>{initialOf(model.brideName)}</span>
                    )}
                  </div>
                  <h3>{model.brideName}</h3>
                  <span className={styles.personRole}>The Bride</span>
                  {invitation.bride_parents && (
                    <p className={styles.personParents}>{invitation.bride_parents}</p>
                  )}
                  {brideInstagram && (
                    <a
                      className={styles.personInstagram}
                      href={brideInstagram.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {brideInstagram.handle}
                    </a>
                  )}
                </article>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ACARA */}
      <section className={styles.section} id="acara">
        <div className={styles.wrap}>
          <div className={`${styles.sectionHead} ${styles.reveal}`} data-reveal>
            <p className={styles.eyebrow}>Save The Date</p>
            <h2>Rangkaian Acara</h2>
            <p>Dengan penuh kebahagiaan, kami mengundang Anda untuk hadir di hari istimewa kami.</p>
          </div>

          <div className={styles.eventsGrid}>
            {model.events.map((item, index) => (
              <article
                className={`${styles.eventCard} ${styles.reveal}`}
                data-reveal
                style={{ "--delay": `${index * 120}ms` }}
                key={item.key}
              >
                <div className={styles.eventIcon} aria-hidden="true">
                  {item.key === "resepsi" ? "❦" : "♡"}
                </div>
                <h3>{item.title}</h3>
                <p className={styles.eventTime}>{formatLongDate(item.date)}</p>
                {item.time && <p className={styles.eventTime}>{item.time}</p>}
                <p className={styles.eventPlace}>
                  {item.venue ? <strong>{item.venue}</strong> : "Lokasi menyusul"}
                </p>
                {item.venue && (
                  <a
                    className={styles.btn}
                    href={mapsUrl(item.venue)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Petunjuk Arah
                  </a>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* GALERI */}
      {model.gallery.length > 0 && (
        <section className={`${styles.section} ${styles.sectionAlt}`} id="galeri">
          <div className={styles.wrap}>
            <div className={`${styles.sectionHead} ${styles.reveal}`} data-reveal>
              <p className={styles.eyebrow}>Our Moments</p>
              <h2>Galeri Kenangan</h2>
              <p>Sepenggal cerita perjalanan kami, menuju satu tujuan yang sama.</p>
            </div>

            <div className={styles.galleryGrid}>
              {model.gallery.map((src, index) => (
                <button
                  className={`${styles.galleryItem} ${
                    index === 0 ? styles.galleryWide : ""
                  } ${styles.reveal}`}
                  data-reveal
                  style={{ "--delay": `${Math.min(index, 4) * 80}ms` }}
                  key={`${src}-${index}`}
                  onClick={() => setLightbox(src)}
                  aria-label={`Buka foto ${index + 1}`}
                >
                  <img src={src} alt={`Momen ${index + 1}`} loading="lazy" />
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* RSVP */}
      <section className={styles.section} id="rsvp">
        <div className={styles.wrap}>
          <div className={`${styles.sectionHead} ${styles.reveal}`} data-reveal>
            <p className={styles.eyebrow}>RSVP</p>
            <h2>Konfirmasi Kehadiran</h2>
            <p>Berikan kabar kehadiran dan ucapan terbaik Anda untuk kami.</p>
          </div>

          <form className={`${styles.formCard} ${styles.reveal}`} data-reveal onSubmit={submitRsvp}>
            <div className={styles.field}>
              <label>Nama Tamu</label>
              <div className={styles.readonlyName}>{invitation.guest_name}</div>
            </div>

            <div className={styles.field}>
              <label>Kehadiran</label>
              <div className={styles.rsvpOptions}>
                {RSVP_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`${styles.rsvpOption} ${
                      status === option.value ? styles.rsvpOptionSelected : ""
                    }`}
                  >
                    <input
                      type="radio"
                      name="rsvp"
                      value={option.value}
                      checked={status === option.value}
                      onChange={() => setStatus(option.value)}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="guest-message">Ucapan &amp; Doa</label>
              <textarea
                id="guest-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={2000}
                rows={4}
                placeholder="Tuliskan ucapan dan doa untuk mempelai..."
              />
            </div>

            {rsvpError && <p className={`${styles.formMessage} ${styles.error}`}>{rsvpError}</p>}
            {saved && (
              <p className={`${styles.formMessage} ${styles.success}`}>
                Terima kasih, konfirmasi kehadiranmu sudah tersimpan.
              </p>
            )}

            <button
              className={`${styles.btn} ${styles.btnSolid} ${styles.rsvpSubmit}`}
              disabled={saving || !status}
            >
              {saving ? "Menyimpan..." : "Kirim Konfirmasi"}
            </button>
          </form>
        </div>
      </section>

      {/* HADIAH */}
      {(model.gifts.length > 0 || invitation.gift_address) && (
        <section className={`${styles.section} ${styles.sectionAlt}`} id="hadiah">
          <div className={styles.wrap}>
            <div className={`${styles.sectionHead} ${styles.reveal}`} data-reveal>
              <p className={styles.eyebrow}>Wedding Gift</p>
              <h2>Amplop Digital</h2>
              <p>
                Kehadiran Anda adalah hadiah terindah. Namun apabila ingin memberikan tanda
                kasih, kami sediakan kanal berikut.
              </p>
            </div>

            {model.gifts.length > 0 && (
              <div className={styles.giftGrid}>
                {model.gifts.map((gift, index) => (
                  <article
                    className={`${styles.giftCard} ${styles.reveal}`}
                    data-reveal
                    style={{ "--delay": `${index * 120}ms` }}
                    key={`${gift.bank}-${gift.number}-${index}`}
                  >
                    <p className={styles.giftBank}>{gift.bank || "Rekening"}</p>
                    <p className={styles.giftNumber}>{gift.number || "—"}</p>
                    <p className={styles.giftOwner}>{gift.owner ? `a.n. ${gift.owner}` : ""}</p>
                    {gift.number && (
                      <button
                        type="button"
                        className={styles.copyButton}
                        onClick={() =>
                          copyText(String(gift.number).replace(/\s+/g, ""), "Nomor rekening disalin")
                        }
                      >
                        Salin Nomor
                      </button>
                    )}
                  </article>
                ))}
              </div>
            )}

            {invitation.gift_address && (
              <div className={`${styles.giftCard} ${styles.giftAddress} ${styles.reveal}`} data-reveal>
                <div>
                  <p className={styles.giftBank}>Kirim Kado</p>
                  <strong>{model.coupleLabel}</strong>
                  <p>{invitation.gift_address}</p>
                </div>
                <button
                  type="button"
                  className={styles.copyButton}
                  onClick={() => copyText(invitation.gift_address, "Alamat disalin")}
                >
                  Salin Alamat
                </button>
              </div>
            )}

            <p className={`${styles.giftNote} ${styles.reveal}`} data-reveal>
              Terima kasih atas perhatian dan kasih sayang Anda. Semoga kebaikan Anda dibalas
              berlipat ganda.
            </p>
          </div>
        </section>
      )}

      {/* FOOTER */}
      <footer className={styles.footer}>
        <div className={`${styles.wrap} ${styles.reveal}`} data-reveal>
          <div className={styles.monogram}>{monogram}</div>
          <p className={styles.eyebrow} style={{ color: "#d8bf9b" }}>
            Thank You
          </p>
          <h2 className={styles.footerNames}>{model.coupleLabel}</h2>
          <p className={styles.footerText}>
            Merupakan suatu kebahagiaan dan kehormatan bagi kami apabila Bapak/Ibu/Saudara
            berkenan hadir dan memberikan doa restu.
          </p>
          <p className={styles.footerSmall}>{displayDate}</p>
        </div>
      </footer>

      {/* FLOATING */}
      <div className={styles.float}>
        <button
          type="button"
          className={styles.floatButton}
          onClick={shareInvitation}
          aria-label="Bagikan undangan"
          title="Bagikan undangan"
        >
          ↗
        </button>
        <button
          type="button"
          className={styles.floatButton}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Kembali ke atas"
          title="Kembali ke atas"
        >
          ↑
        </button>
      </div>

      {/* LIGHTBOX */}
      <div
        className={`${styles.lightbox} ${lightbox ? styles.lightboxOpen : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Pratinjau foto"
        onClick={(event) => {
          if (event.target === event.currentTarget) setLightbox("");
        }}
      >
        <button
          type="button"
          className={styles.lightboxClose}
          onClick={() => setLightbox("")}
          aria-label="Tutup"
        >
          ×
        </button>
        {lightbox && <img className={styles.lightboxImg} src={lightbox} alt="Pratinjau foto" />}
      </div>

      {/* TOAST */}
      <div className={`${styles.toast} ${toast ? styles.toastShow : ""}`} role="status" aria-live="polite">
        {toast}
      </div>
    </main>
  );
}
