# Rapi — Todo dengan Next.js dan Supabase

Aplikasi todo sederhana dengan daftar akun dan login menggunakan email/password atau Google, serta fitur tambah, lihat, edit, tandai selesai, dan hapus todo. Todo mendukung satu lampiran foto, video, atau audio hingga 20 MB. Menu **Undangan** menyediakan pengelolaan acara, impor tamu CSV/Excel, tautan undangan personal, serta RSVP. Data todo dan undangan dilindungi Row Level Security. Media todo baru disimpan di Google Drive; foto undangan disimpan di bucket publik Supabase Storage agar dapat ditampilkan pada tautan undangan.

## Menjalankan aplikasi

1. Buat project di [Supabase](https://supabase.com/dashboard).
2. Salin `.env.example` menjadi `.env.local`.
3. Isi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` dari **Project Settings → API** di dashboard. Publishable key boleh digunakan pada aplikasi browser; jangan pernah menaruh secret key Supabase (`sb_secret_...`) di variabel `NEXT_PUBLIC_*` atau kode browser.
4. Di Supabase **SQL Editor**, jalankan isi `supabase/schema.sql`. Jalankan ulang jika database sudah menggunakan skema todo sebelumnya agar kolom `media_provider` tersedia. Attachment lama tetap berada di bucket Supabase yang sudah ada; aplikasi masih bisa membacanya. Jangan hapus bucket lama sebelum attachment tersebut dimigrasikan atau dilepas.
5. Untuk lampiran media todo, siapkan Apps Script untuk Google Drive. Integrasi ini tidak digunakan untuk upload foto undangan:

   - Buat project di [Google Apps Script](https://script.google.com/) dan salin `google-apps-script/Code.gs`.
   - Pada **Project Settings → Script Properties**, tambahkan `API_KEY` dengan secret acak yang panjang. Jangan taruh secret ini di kode Apps Script atau variabel `NEXT_PUBLIC_*`.
   - Deploy sebagai **Web app**, pilih **Execute as: Me** dan **Who has access: Anyone**. Apps Script memeriksa `API_KEY` pada setiap request, sedangkan aplikasi memvalidasi sesi Supabase sebelum meneruskan upload atau hapus.
   - Salin URL deployment `/exec` ke `GOOGLE_APPS_SCRIPT_URL`. Buat secret yang sama untuk `GOOGLE_APPS_SCRIPT_API_KEY` pada `.env.local` Next.js. Apps Script membuat folder media di Google Drive otomatis.

6. Salin `.env.example` menjadi `.env.local` dan isi URL Supabase, publishable key, URL Apps Script, serta API key rahasia. Jangan bagikan `.env.local`.
7. Tambahkan `OPENROUTER_API` ke `.env.local` menggunakan API key dari OpenRouter. Variabel ini hanya digunakan di server dan tidak boleh diawali `NEXT_PUBLIC_`.
8. Jalankan aplikasi:

   ```bash
   npm install
   npm run dev
   ```

9. Buka alamat yang tampil di terminal, lalu daftar menggunakan email dan password. Jika konfirmasi email diaktifkan, konfirmasi email sebelum login.

## Undangan online

Jalankan ulang `supabase/schema.sql` setelah deployment atau pembaruan schema agar tabel undangan, kolom konten baru (`groom_name`, `gallery_photos`, `gift_accounts`, dan lainnya), policy RLS, serta fungsi publik untuk halaman undangan dan RSVP tersedia. Jika database masih memakai skema undangan lama, halaman admin dan undangan publik akan gagal memuat kolom baru sampai skrip ini dijalankan.

Prompt mandiri untuk membuat konsep template di tool lain dan membawa hasilnya kembali untuk dikonversi tersedia di [PROMPT_TEMPLATE_UNDANGAN.md](./PROMPT_TEMPLATE_UNDANGAN.md). Prompt tersebut sudah memuat konteks aplikasi, field data, aturan desain, dan struktur JSON spesifikasi; JSON yang dihasilkan bukan file template yang dapat diimpor langsung.

Menu **Undangan** menampilkan acara dan daftar tamu akun yang sedang login. Buat acara sendiri atau klik **Buat contoh undangan** untuk membuat acara demo lengkap dengan dua tamu contoh. Setelah acara dipilih, buka **Editor visual**. Nama mempelai, tanggal, pesan, kutipan, data acara, dan teks profil bisa diklik lalu diketik langsung pada posisinya di kanvas; perubahan nama otomatis ikut diperbarui pada semua tampilannya. Foto, galeri, dan detail rekening dapat diatur lewat panel samping. Perubahan terlihat langsung di pratinjau; tekan **Simpan perubahan** untuk menerapkannya pada tautan tamu. Data yang belum disimpan dapat dibatalkan.

Pilih salah satu dari tiga desain: **Undangan Elegan**, **Garden Botanical**, atau **Modern Minimal**. Template dapat dipilih saat membuat acara atau diterapkan ke acara aktif kapan saja. Mengganti template hanya mengubah tampilan halaman publik; semua isian acara, foto, daftar tamu, dan tautan personal tetap tersimpan.

- **Mempelai** — nama, nama orang tua, Instagram, serta foto mempelai 1 dan 2 (unggah file atau tempel URL).
- **Acara** — tanggal, waktu, dan lokasi akad nikah serta resepsi. Tanggal resepsi dipakai untuk hitung mundur di halaman publik.
- **Kutipan & pesan** — kutipan pembuka, sumber kutipan, dan pesan sambutan.
- **Galeri foto** — unggah hingga 10 foto sekaligus (maks. 10 MB per foto) atau tambahkan lewat URL.
- **Amplop digital** — beberapa rekening bank/e-wallet dan alamat pengiriman kado.

Foto yang diunggah melalui endpoint `/api/invitations/upload` disimpan ke bucket publik `invitation-media` di Supabase Storage. Bucket dan policy upload dibuat saat `supabase/schema.sql` dijalankan; upload dibatasi ke folder milik pengguna yang sedang login. Foto juga bisa dimasukkan lewat URL tanpa unggah. Perubahan yang disimpan langsung tampil pada tautan undangan tamu. Tautan foto lama yang sudah tersimpan tetap digunakan, sehingga foto lama di Google Drive tidak otomatis dipindahkan.

Impor file `.csv` atau Excel `.xlsx` (sheet pertama). Kolom `nama` wajib; `nomor hp`, `instagram`, dan `keterangan` bersifat opsional. Alias seperti `name`, `guest name`, `phone`, `whatsapp`, `ig`, `notes`, dan `catatan` juga dikenali. File contoh tersedia melalui tombol **Unduh contoh CSV**. Tamu dapat ditambahkan satu per satu, dicari, dan difilter menurut status pengiriman atau RSVP.

Setiap tamu memiliki URL unik berbentuk `/i/<token>`. Halaman publik menampilkan cover pembuka, hitung mundur, kutipan, profil mempelai, rangkaian acara, galeri dengan lightbox, form RSVP, dan amplop digital. Salin tautan tamu atau buka WhatsApp dengan pesan yang sudah diisi. Pengiriman WhatsApp tetap dilakukan manual; setelah benar-benar mengirim, tekan tombol centang **Tandai undangan terkirim** agar waktu pengiriman tercatat. RSVP yang dikirim dari halaman undangan publik akan langsung tersimpan ke database dan ditampilkan di dashboard. Tautan token memberikan akses ke undangan serta izin mengirim RSVP, jadi bagikan hanya kepada tamu terkait.

## Chat AI dan memory

Menu **Chat AI** menyediakan riwayat percakapan pribadi dan menggunakan model OpenRouter `z-ai/glm-5.3-flash`. Pesan dan memory dikirim ke OpenRouter untuk menghasilkan jawaban, lalu riwayat disimpan di Supabase setelah OpenRouter berhasil menjawab. Key OpenRouter digunakan di server dan tidak dikirim ke browser. Tambahkan `OPENROUTER_API` di `.env.local`, lalu restart server setelah mengubah konfigurasi.

Jalankan ulang `supabase/schema.sql` untuk membuat tabel chat dan memory beserta Row Level Security. Setiap akun memiliki percakapan dan memory sendiri. Pada menu **Memory**, simpan instruksi **Persona & gaya jawaban** atau **Product knowledge**; hingga 40 memory terbaru akun tersebut akan disertakan (dengan batas konteks) pada permintaan baru. Memory yang dihapus tidak mengubah pesan lama yang sudah tersimpan.

## Mengaktifkan login Google

1. Di Google Cloud Console, buat OAuth client dengan tipe **Web application**.
2. Salin callback URL yang ditampilkan Supabase di **Authentication → Providers → Google**, lalu tambahkan sebagai **Authorized redirect URI** pada OAuth client Google. Callback umumnya berbentuk `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Aktifkan provider **Google** di dashboard Supabase dan masukkan OAuth client ID serta client secret dari Google.
4. Di **Authentication → URL Configuration** Supabase, masukkan URL aplikasi pada **Redirect URLs**, misalnya `http://localhost:3000/**` untuk development dan URL domain aplikasi untuk deployment. Atur **Site URL** ke domain utama aplikasi.
5. Tombol **Lanjutkan dengan Google** akan memulai OAuth dan kembali ke URL aplikasi yang sedang dibuka. Kredensial Google disimpan di Supabase, bukan di `.env.local`.

## Menambahkan sample data

Setelah mendaftar di aplikasi, edit email placeholder `ganti-email-anda@example.com` di `supabase/seed.sql` menjadi email akunmu, lalu jalankan file tersebut lewat **SQL Editor** Supabase. Tiga todo contoh akan dibuat untuk akun itu.

## Struktur tabel

Tabel `public.todos` menyimpan `user_id`, `title`, `description`, `is_completed`, `due_date`, ID file Drive, tipe dan nama media, provider media, serta timestamp. Upload lampiran todo diteruskan melalui API Next.js yang memvalidasi access token Supabase; Apps Script menyimpan file di folder per pengguna, dan API key hanya tersimpan di server. File diberi izin “anyone with link” agar preview dapat ditampilkan langsung di browser. Menghapus atau mengganti lampiran akan mengirim file sebelumnya ke Trash Drive. Attachment lama dari Supabase tidak otomatis dipindahkan. Format yang diterima: JPEG, PNG, GIF, WebP, AVIF, MP4, WebM, MOV, MP3, M4A, WAV, dan OGG. Foto undangan disimpan terpisah di bucket `invitation-media` pada Supabase Storage.

Chatbot menyimpan riwayat di `public.chat_conversations` dan `public.chat_messages`, serta konteks yang dapat dikelola di `public.chatbot_memories`. Policy RLS membatasi data berdasarkan `auth.uid()`. Endpoint chat membatasi konteks ke 12 pesan terakhir dan mengirim memory milik pengguna yang sedang login ke OpenRouter.
