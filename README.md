# Arsip Upload (GitHub Pages + Google Spreadsheet)

- Halaman web (user dan admin): dihosting gratis di **GitHub Pages**.
- Database: **Google Spreadsheet** (bisa diunduh sebagai Excel .xlsx).
- Penyimpanan berkas: **Google Drive** milik Anda. Video dikirim langsung dari browser ke Drive,
  tanpa batas ukuran dari website.
- Foto: digabung jadi satu **PDF** di browser user, lalu PDF itu yang masuk ke admin.

Isi folder:

    index.html        halaman user (upload foto dan video)
    admin.html        halaman admin (login, kelola data)
    style.css, script.js, admin.js, api.js, config.js
    backend/Code.gs   kode untuk Google Apps Script (dipasang di akun Google, langkah 2)

---

## Langkah 1: Buat Spreadsheet

1. Buka https://sheets.google.com, buat spreadsheet baru (nama bebas, misalnya "Database Upload").

## Langkah 2: Pasang backend

1. Di spreadsheet tadi: menu **Ekstensi > Apps Script**.
2. Hapus isi file `Code.gs` yang ada, lalu tempel seluruh isi `backend/Code.gs` dari folder ini.
3. Di bagian atas, ganti `ADMIN_PASSWORD` dengan password Anda. Opsional: ubah `ADMIN_USER`,
   dan isi `KODE_UPLOAD` kalau hanya orang yang tahu kode yang boleh upload.
4. Klik ikon simpan. Di bar atas pilih fungsi **setup**, lalu klik **Jalankan**.
5. Google meminta izin. Pilih akun Anda. Jika muncul "Google belum memverifikasi aplikasi ini",
   klik **Lanjutan > Buka ... (tidak aman)**, lalu **Izinkan**. Ini aman karena skripnya milik Anda sendiri.
   Setelah itu terbentuk folder **"Arsip Upload"** di Google Drive Anda.

## Langkah 3: Terbitkan backend sebagai Web App

1. Klik **Deploy > Deployment baru**, klik ikon roda gigi, pilih **Aplikasi web**.
2. Isi: Jalankan sebagai **Saya**, Yang memiliki akses **Siapa saja**.
3. Klik **Deploy**, lalu salin **URL aplikasi web** (berakhiran `/exec`).

## Langkah 4: Isi config.js

Buka `config.js`, ganti `ISI-ALAMAT-ANDA` dengan URL tadi, sehingga menjadi seperti:

    APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfy.../exec",

Jika Anda mengisi `KODE_UPLOAD` di Code.gs, ubah juga `PAKAI_KODE: true`.

## Langkah 5: Unggah ke GitHub

1. Buat repository baru di https://github.com/new (misalnya `arsip-upload`, publik).
2. Klik **uploading an existing file**, tarik semua file (index.html, admin.html, style.css, script.js,
   admin.js, api.js, config.js, README.md, folder backend), lalu **Commit changes**.
3. Buka **Settings > Pages**. Pada "Build and deployment" pilih **Deploy from a branch**,
   branch **main**, folder **/ (root)**, lalu **Save**.
4. Tunggu 1-2 menit. Alamatnya: `https://NAMAANDA.github.io/arsip-upload/`
   - Halaman user: alamat di atas (index.html)
   - Halaman admin: alamat di atas diikuti `admin.html`

## Memakai

- **User:** isi nama, pilih foto atau video, tekan Kirim.
- **Admin:** masuk di `admin.html`. Tombol **Lihat** dan **Unduh** membuka berkas di Google Drive,
  jadi masuklah ke akun Google pemilik Drive (atau bagikan folder "Arsip Upload" ke akun admin lain).
  Tombol **Unduh Excel** mengunduh seluruh data sebagai .xlsx.

## Menambah kelas

Pilihan kelas bawaan hanya "X PSPT". Untuk menambah, isi `KELAS` di `config.js`:

    KELAS: ["X PSPT", "XI PSPT", "XII PSPT"],

Tambahkan baris itu di dalam `window.APP_CONFIG = { ... }`, lalu simpan dan commit di GitHub.

## Kalau Code.gs diubah

Simpan, lalu **Deploy > Kelola deployment > ikon pensil > Versi: Versi baru > Deploy**.
URL-nya tetap sama.

## Hal penting

- Password admin hanya ada di Apps Script Anda, bukan di GitHub. Jangan menulis password asli di
  file yang Anda unggah ke GitHub.
- URL Web App tampak di repo (memang harus begitu). Agar orang asing tidak memenuhi Drive Anda,
  isi `KODE_UPLOAD` dan bagikan kodenya hanya ke orang yang boleh upload.
- "Tanpa batas" berlaku untuk website ini. Ruang Drive tetap terbatas (akun gratis 15 GB).
- Foto dibatasi 50 per kiriman supaya HP user tidak kehabisan memori saat membuat PDF.

## Jika upload video gagal

Pesan "koneksi ke Google Drive gagal" biasanya berarti Drive menolak pengiriman langsung dari browser
(CORS). Periksa: (1) deployment memakai akses "Siapa saja", (2) Anda sudah menjalankan `setup` dan
memberi izin, (3) Code.gs terbaru sudah dideploy sebagai Versi baru. Jika masih gagal, kirimkan pesan
errornya (tekan F12, tab Console) agar bisa dilacak.
