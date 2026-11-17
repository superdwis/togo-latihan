# Prompt Utuh: Membuat Template Undangan untuk Aplikasi

Dokumen ini berisi satu prompt mandiri. Salin seluruh isi di dalam blok **PROMPT SIAP PAKAI** ke AI atau tool pembuat desain. Ganti bagian dalam tanda kurung siku sesuai desain yang kamu inginkan. Tidak perlu melampirkan file JSON lain; struktur data dan aturan aplikasi sudah tercakup di prompt.

## PROMPT SIAP PAKAI

````text
Kamu adalah desainer UI/UX sekaligus frontend engineer yang membantu menyiapkan
template undangan digital untuk aplikasi undangan pernikahan berbasis Next.js,
React, CSS Modules, dan Supabase.

TUJUAN
Buat satu konsep template undangan yang orisinal, menarik, responsif, dan siap
ditinjau untuk kemudian dikonversi ke aplikasi yang sudah ada.

Nama template: [ISI NAMA TEMPLATE]
Gaya/tema: [ISI GAYA, CONTOH: garden botanical, adat Jawa kontemporer,
modern minimal, editorial klasik]
Key template yang diinginkan: [ISI KEY BARU HURUF KECIL, ATAU KEY YANG SUDAH ADA:
elegant, botanical, modern]
Preferensi warna atau suasana: [ISI PREFERENSI, ATAU TULIS "BEBAS"]
Referensi desain milik sendiri (opsional): [JELASKAN ATAU LAMPIRKAN SCREENSHOT]

KONTEKS APLIKASI
- Template hanya mengubah presentasi visual. Template bukan record undangan baru.
- Data undangan, daftar tamu, token tautan, serta RSVP yang telah disimpan harus
  tetap terhubung dan tidak boleh dibuat ulang atau hilang ketika desain diganti.
- Admin memilih template melalui field `template_key` pada acara.
- Halaman publik setiap tamu dibuka dengan token; nama tamu, status RSVP, dan
  pesan RSVP adalah data personal dari tamu yang membuka tautan tersebut.
- Template yang tersedia sekarang adalah `elegant`, `botanical`, dan `modern`.
  Jika memakai salah satu key tersebut, desain mengganti tampilan template itu.
  Jika membuat template baru, nyatakan key baru yang stabil dan jelaskan bahwa
  aplikasi perlu menambah key itu di UI admin, validasi database, dan CSS.
- Bagian halaman yang saat ini dapat digunakan: `cover`, `hero`, `quote`,
  `couple`, `events`, `gallery`, `rsvp`, `gifts`, dan `footer`.

DATA YANG TERSEDIA
Gunakan hanya data berikut. Jangan mengarang field database tambahan.

1. Pasangan:
   - `groom_name`: nama mempelai 1.
   - `bride_name`: nama mempelai 2.
   - `groom_parents`: teks orang tua mempelai 1; dapat memuat baris baru.
   - `bride_parents`: teks orang tua mempelai 2; dapat memuat baris baru.
   - `groom_instagram`: handle Instagram mempelai 1; bisa diawali @.
   - `bride_instagram`: handle Instagram mempelai 2; bisa diawali @.
   - `groom_photo`: URL foto mempelai 1.
   - `bride_photo`: URL foto mempelai 2.
   - `host_names`: nama pengundang; dapat dipakai sebagai fallback nama pasangan.
2. Acara:
   - `event_title`: judul acara.
   - `message`: pesan sambutan.
   - `event_date`: tanggal resepsi; dipakai untuk hitung mundur dan simpan tanggal.
   - `event_time`: waktu resepsi.
   - `venue`: lokasi resepsi.
   - `akad_date`: tanggal akad, opsional.
   - `akad_time`: waktu akad, opsional.
   - `akad_venue`: lokasi akad, opsional.
3. Konten:
   - `quote`: kutipan pilihan; jika kosong aplikasi dapat menampilkan kutipan bawaan.
   - `quote_source`: sumber kutipan.
   - `gallery_photos`: array URL foto.
   - `gift_accounts`: array objek rekening, setiap objek berisi `bank`, `number`,
     dan `owner`.
   - `gift_address`: teks alamat pengiriman kado.
4. Tamu:
   - `guest_name`: nama penerima undangan personal.
   - `rsvp_status`: status RSVP (`attending`, `not_attending`, `maybe`, atau kosong).
   - `guest_message`: ucapan/pesan dari tamu.

ATURAN DESAIN DAN IMPLEMENTASI
- Buat desain orisinal; jangan menyalin persis desain, aset, atau karya berhak
  cipta pihak lain. Gunakan hanya aset yang saya berikan atau aset yang memang
  boleh digunakan, dan cantumkan sumber/lisensinya.
- Semua nama, tanggal, lokasi, kutipan, rekening, dan pesan harus berasal dari
  binding data di atas. Gunakan placeholder seperti `{{groom_name}}`,
  `{{bride_name}}`, `{{event_date}}`, `{{venue}}`, `{{guest_name}}`,
  `{{gallery_photos}}`, dan `{{gift_accounts}}`; jangan menanam data demo sebagai
  teks final.
- Jangan menaruh secret, token, kredensial, data pribadi contoh, atau URL palsu
  yang terlihat seperti data sungguhan.
- Jangan mengubah skema database hanya untuk memenuhi preferensi desain.
  Jika sebuah ide membutuhkan data yang tidak tersedia, tandai sebagai opsional
  dan jelaskan; tetap sediakan desain fallback tanpa data tersebut.
- Hormati kondisi data kosong:
  - sembunyikan bagian galeri jika `gallery_photos` kosong;
  - sembunyikan bagian hadiah jika rekening dan alamat kado sama-sama kosong;
  - sembunyikan bagian akad jika `akad_date`, `akad_time`, dan `akad_venue`
    semuanya kosong;
  - jangan menampilkan placeholder rusak, URL kosong, atau label yang
    membingungkan jika data opsional tidak diisi.
- Jangan mengubah alur kerja yang sudah ada:
  - tautan peta menggunakan teks `venue`/`akad_venue`;
  - tombol Simpan Tanggal menggunakan data acara yang tersedia;
  - galeri foto dapat membuka lightbox;
  - form RSVP tetap memakai status dan menyimpan pesan tamu;
  - tombol, form, dan navigasi harus tetap berfungsi.
- Desain mobile-first dan periksa lebar layar 320 px, ponsel umum, tablet, serta
  desktop. Tidak boleh ada scroll horizontal yang tidak disengaja.
- Pastikan kontras teks memadai, fokus keyboard tampak, tombol/link punya label
  yang jelas, gambar bermakna punya alt text, dan animasi menghormati
  `prefers-reduced-motion`.
- Ikuti gaya komponen aplikasi yang sudah ada. Jangan memasukkan HTML dari tool
  lain langsung tanpa meninjau ulang keamanan, aksesibilitas, responsivitas, dan
  perilaku aplikasi.

OUTPUT YANG WAJIB DIBERIKAN
Berikan hasil dengan urutan berikut:

1. Ringkasan visual singkat, termasuk nama dan key template.
2. Spesifikasi tema dalam JSON valid, memakai bentuk berikut. Pertahankan
   `data_bindings` dan nama field persis seperti yang didefinisikan di atas;
   kamu boleh menambah detail desain di `theme`, `layout`, dan `responsive`.

{
  "spec_version": 1,
  "template": {
    "key": "[KEY TEMPLATE]",
    "name": "[NAMA TEMPLATE]",
    "category": "wedding",
    "description": "[RINGKASAN DESAIN]",
    "source": {
      "kind": "original-design",
      "assets": []
    }
  },
  "data_bindings": {
    "couple": {
      "groom_name": "invitation.groom_name",
      "bride_name": "invitation.bride_name",
      "groom_parents": "invitation.groom_parents",
      "bride_parents": "invitation.bride_parents",
      "groom_instagram": "invitation.groom_instagram",
      "bride_instagram": "invitation.bride_instagram",
      "groom_photo": "invitation.groom_photo",
      "bride_photo": "invitation.bride_photo"
    },
    "event": {
      "title": "invitation.event_title",
      "host_names": "invitation.host_names",
      "message": "invitation.message",
      "event_date": "invitation.event_date",
      "event_time": "invitation.event_time",
      "venue": "invitation.venue",
      "akad_date": "invitation.akad_date",
      "akad_time": "invitation.akad_time",
      "akad_venue": "invitation.akad_venue"
    },
    "content": {
      "quote": "invitation.quote",
      "quote_source": "invitation.quote_source",
      "gallery_photos": "invitation.gallery_photos[]",
      "gift_accounts": "invitation.gift_accounts[]",
      "gift_address": "invitation.gift_address"
    },
    "guest": {
      "name": "invitation.guest_name",
      "rsvp_status": "invitation.rsvp_status",
      "message": "invitation.guest_message"
    }
  },
  "theme": {
    "colors": {
      "paper": "#HEX",
      "surface": "#HEX",
      "text": "#HEX",
      "text_muted": "#HEX",
      "accent": "#HEX",
      "accent_soft": "#HEX",
      "border": "#HEX"
    },
    "typography": {
      "heading": "serif",
      "body": "sans-serif",
      "heading_style": "[DESKRIPSI]",
      "uppercase_tracking": "[DESKRIPSI]"
    },
    "shape": {
      "cover_frame": "[DESKRIPSI]",
      "photo_frame": "[DESKRIPSI]",
      "button": "[DESKRIPSI]",
      "card": "[DESKRIPSI]"
    },
    "atmosphere": ["[KATA KUNCI SUASANA]"]
  },
  "layout": {
    "content_width": "[NARROW/REGULAR/WIDE]",
    "section_spacing": "[DESKRIPSI]",
    "mobile_first": true,
    "navigation": "[DESKRIPSI]",
    "sections": [
      {
        "id": "cover",
        "enabled": true,
        "order": 1,
        "style": "[DESKRIPSI]",
        "bindings": ["couple.groom_name", "couple.bride_name", "event.event_date", "guest.name"]
      },
      {
        "id": "hero",
        "enabled": true,
        "order": 2,
        "style": "[DESKRIPSI]",
        "bindings": ["couple.groom_name", "couple.bride_name", "event.message", "event.event_date", "event.event_time"]
      },
      {
        "id": "quote",
        "enabled": true,
        "order": 3,
        "style": "[DESKRIPSI]",
        "bindings": ["content.quote", "content.quote_source"]
      },
      {
        "id": "couple",
        "enabled": true,
        "order": 4,
        "style": "[DESKRIPSI]",
        "bindings": ["couple.groom_name", "couple.groom_parents", "couple.groom_instagram", "couple.groom_photo", "couple.bride_name", "couple.bride_parents", "couple.bride_instagram", "couple.bride_photo"]
      },
      {
        "id": "events",
        "enabled": true,
        "order": 5,
        "style": "[DESKRIPSI]",
        "bindings": ["event.akad_date", "event.akad_time", "event.akad_venue", "event.event_date", "event.event_time", "event.venue"]
      },
      {
        "id": "gallery",
        "enabled": true,
        "order": 6,
        "style": "[DESKRIPSI]",
        "bindings": ["content.gallery_photos"]
      },
      {
        "id": "rsvp",
        "enabled": true,
        "order": 7,
        "style": "[DESKRIPSI]",
        "bindings": ["guest.name", "guest.rsvp_status", "guest.message"]
      },
      {
        "id": "gifts",
        "enabled": true,
        "order": 8,
        "style": "[DESKRIPSI]",
        "bindings": ["content.gift_accounts", "content.gift_address"]
      },
      {
        "id": "footer",
        "enabled": true,
        "order": 9,
        "style": "[DESKRIPSI]",
        "bindings": ["couple.groom_name", "couple.bride_name", "event.event_date"]
      }
    ]
  },
  "behavior": {
    "preserve_existing_rsvp": true,
    "show_gallery_only_when_nonempty": true,
    "show_gifts_only_when_nonempty": true,
    "show_akad_only_when_any_akad_field_is_filled": true,
    "event_maps_link_uses_venue_text": true,
    "gallery_images_open_lightbox": true,
    "respect_reduced_motion": true
  },
  "responsive": {
    "mobile": {
      "couple_layout": "single-column",
      "event_layout": "single-column",
      "gallery_columns": 2,
      "navigation": "horizontal-scroll"
    },
    "accessibility": {
      "minimum_body_font_px": 14,
      "visible_focus": true,
      "decorative_images_have_empty_alt": true,
      "interactive_controls_have_labels": true
    }
  }
}

3. Arahan tampilan tiap bagian, urutan, palet warna HEX, tipografi, bentuk
   foto/tombol/kartu, jarak, state hover/fokus, dan perilaku mobile.
4. Daftar file/aset yang dihasilkan. Jika menghasilkan HTML/CSS prototype,
   gunakan placeholder `{{field_name}}`, bukan data acara atau tamu sungguhan.
   Sertakan cara menjalankan/meninjau prototype dan sumber/lisensi setiap aset.
5. Catatan keterbatasan: sebutkan dengan jelas bila ada ide visual atau interaksi
   yang tidak bisa dibuat hanya dengan field dan perilaku yang tersedia.
6. Jangan menyatakan desain sudah diintegrasikan atau diuji di aplikasi. Hasil
   ini akan ditinjau dan dikonversi ke komponen Next.js secara terpisah.

Sebelum mengirim hasil, pastikan JSON valid, semua binding memakai nama field
yang tersedia, tidak ada teks/data demo yang tertanam sebagai data final, dan
semua bagian opsional memiliki fallback yang masuk akal.
````

## Cara menggunakan hasil prompt

1. Ganti nama, gaya, key template, dan preferensi desain pada bagian awal prompt.
2. Salin prompt secara utuh ke tool AI/desain yang digunakan. Lampirkan referensi visual milikmu bila ada.
3. Minta tool mengembalikan JSON valid beserta screenshot, prototype, atau file desain yang dapat ditinjau.
4. Bawa hasilnya kembali ke project agar dapat dikonversi ke template aplikasi. JSON spesifikasi sendiri tidak diimpor atau dirender langsung oleh aplikasi.
