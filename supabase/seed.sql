-- Ganti email ini dengan email akun yang sudah terdaftar di Supabase Auth.
do $$
declare
  sample_user_id uuid;
begin
  select id
    into sample_user_id
    from auth.users
    where email = 'ganti-email-anda@example.com';

  if sample_user_id is null then
    raise exception 'Akun belum ditemukan. Daftar melalui aplikasi, lalu ganti email di seed.sql.';
  end if;

  insert into public.todos (user_id, title, description, is_completed, due_date)
  select sample_user_id, sample.title, sample.description, sample.is_completed, sample.due_date
    from (values
      ('Rencanakan minggu ini', 'Pilih tiga prioritas utama untuk minggu ini.', false, current_date + 1),
      ('Rapikan meja kerja', 'Sisihkan 10 menit untuk merapikan ruang kerja.', false, current_date + 2),
      ('Baca 10 halaman', 'Lanjutkan membaca buku yang sedang berjalan.', true, null)
    ) as sample(title, description, is_completed, due_date)
    where not exists (
      select 1
        from public.todos existing
        where existing.user_id = sample_user_id
          and existing.title = sample.title
    );
end;
$$;
