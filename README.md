# Rapi — Todo dengan Next.js dan Supabase

Aplikasi todo sederhana dengan daftar akun dan login menggunakan email/password atau Google, serta fitur tambah, lihat, edit, tandai selesai, dan hapus todo. Todo mendukung satu lampiran foto, video, atau audio hingga 20 MB. Data todo dilindungi Row Level Security. Media baru disimpan di Google Drive dan dibagikan dengan izin **siapa pun yang memiliki link**; hindari mengunggah media rahasia.

## Menjalankan aplikasi

1. Buat project di [Supabase](https://supabase.com/dashboard).
2. Salin `.env.example` menjadi `.env.local`.
3. Isi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` dari **Project Settings → API** di dashboard. Publishable key boleh digunakan pada aplikasi browser; jangan pernah menaruh `service_role` key di variabel `NEXT_PUBLIC_*`.
4. Di Supabase **SQL Editor**, jalankan isi `supabase/schema.sql`. Jalankan ulang jika database sudah menggunakan skema todo sebelumnya agar kolom `media_provider` tersedia. Attachment lama tetap berada di bucket Supabase yang sudah ada; aplikasi masih bisa membacanya. Jangan hapus bucket lama sebelum attachment tersebut dimigrasikan atau dilepas.
5. Siapkan Apps Script untuk Google Drive:

   - Buat project di [Google Apps Script](https://script.google.com/) dan salin `google-apps-script/Code.gs`.
   - Pada **Project Settings → Script Properties**, tambahkan `API_KEY` dengan secret acak yang panjang. Jangan taruh secret ini di kode Apps Script atau variabel `NEXT_PUBLIC_*`.
   - Deploy sebagai **Web app**, pilih **Execute as: Me** dan **Who has access: Anyone**. Apps Script memeriksa `API_KEY` pada setiap request, sedangkan aplikasi memvalidasi sesi Supabase sebelum meneruskan upload atau hapus.
   - Salin URL deployment `/exec` ke `GOOGLE_APPS_SCRIPT_URL`. Buat secret yang sama untuk `GOOGLE_APPS_SCRIPT_API_KEY` pada `.env.local` Next.js. Apps Script membuat folder media di Google Drive otomatis.

6. Salin `.env.example` menjadi `.env.local` dan isi empat variabel: URL Supabase, publishable key, URL Apps Script, dan API key rahasia. Jangan bagikan `.env.local`.
7. Jalankan aplikasi:

   ```bash
   npm install
   npm run dev
   ```

8. Buka alamat yang tampil di terminal, lalu daftar menggunakan email dan password. Jika konfirmasi email diaktifkan, konfirmasi email sebelum login.

## Mengaktifkan login Google

1. Di Google Cloud Console, buat OAuth client dengan tipe **Web application**.
2. Salin callback URL yang ditampilkan Supabase di **Authentication → Providers → Google**, lalu tambahkan sebagai **Authorized redirect URI** pada OAuth client Google. Callback umumnya berbentuk `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Aktifkan provider **Google** di dashboard Supabase dan masukkan OAuth client ID serta client secret dari Google.
4. Di **Authentication → URL Configuration** Supabase, masukkan URL aplikasi pada **Redirect URLs**, misalnya `http://localhost:3000/**` untuk development dan URL domain aplikasi untuk deployment. Atur **Site URL** ke domain utama aplikasi.
5. Tombol **Lanjutkan dengan Google** akan memulai OAuth dan kembali ke URL aplikasi yang sedang dibuka. Kredensial Google disimpan di Supabase, bukan di `.env.local`.

## Menambahkan sample data

Setelah mendaftar di aplikasi, edit email placeholder `ganti-email-anda@example.com` di `supabase/seed.sql` menjadi email akunmu, lalu jalankan file tersebut lewat **SQL Editor** Supabase. Tiga todo contoh akan dibuat untuk akun itu.

## Struktur tabel

Tabel `public.todos` menyimpan `user_id`, `title`, `description`, `is_completed`, `due_date`, ID file Drive, tipe dan nama media, provider media, serta timestamp. Upload baru diteruskan melalui API Next.js yang memvalidasi access token Supabase; Apps Script menyimpan file di folder per pengguna, dan API key hanya tersimpan di server. File diberi izin “anyone with link” agar preview dapat ditampilkan langsung di browser. Menghapus atau mengganti lampiran akan mengirim file sebelumnya ke Trash Drive. Attachment lama dari Supabase tidak otomatis dipindahkan. Format yang diterima: JPEG, PNG, GIF, WebP, AVIF, MP4, WebM, MOV, MP3, M4A, WAV, dan OGG.
