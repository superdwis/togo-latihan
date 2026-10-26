# Rapi — Todo dengan Next.js dan Supabase

Aplikasi todo sederhana dengan daftar akun dan login email/password, serta fitur tambah, lihat, edit, tandai selesai, dan hapus todo. Todo mendukung satu lampiran foto, video, atau audio hingga 20 MB. Data dan media dilindungi Row Level Security dan hanya dapat diakses oleh pemiliknya.

## Menjalankan aplikasi

1. Buat project di [Supabase](https://supabase.com/dashboard).
2. Salin `.env.example` menjadi `.env.local`.
3. Isi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` dari **Project Settings → API** di dashboard. Publishable key boleh digunakan pada aplikasi browser; jangan pernah menaruh `service_role` key di variabel `NEXT_PUBLIC_*`.
4. Di Supabase **SQL Editor**, jalankan isi `supabase/schema.sql`. Script membuat tabel/policy todo serta private Storage bucket `todo-media`; jalankan ulang script ini bila project sudah memakai skema todo sebelumnya untuk menambahkan kolom media dan policy bucket.
5. Jalankan aplikasi:

   ```bash
   npm install
   npm run dev
   ```

6. Buka alamat yang tampil di terminal, lalu daftar menggunakan email dan password. Jika konfirmasi email diaktifkan, konfirmasi email sebelum login.

## Menambahkan sample data

Setelah mendaftar di aplikasi, edit email placeholder `ganti-email-anda@example.com` di `supabase/seed.sql` menjadi email akunmu, lalu jalankan file tersebut lewat **SQL Editor** Supabase. Tiga todo contoh akan dibuat untuk akun itu.

## Struktur tabel

Tabel `public.todos` menyimpan `user_id`, `title`, `description`, `is_completed`, `due_date`, lokasi dan tipe media, serta timestamp. Media berada pada bucket private `todo-media` dengan struktur path `user_id/todo_id/nama-file`; signed URL berlaku selama 24 jam. Policy Storage membatasi baca, upload, dan hapus ke folder milik user yang sedang login. Format yang diterima: JPEG, PNG, GIF, WebP, AVIF, MP4, WebM, MOV, MP3, M4A, WAV, dan OGG.
