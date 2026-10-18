/* Penghubung ke Google Apps Script. Dipakai halaman user dan admin. */
(() => {
  "use strict";

  /** Kirim perintah ke Apps Script. Dikirim sebagai teks biasa agar browser tidak melakukan preflight CORS. */
  async function callApi(payload) {
    const url = (window.APP_CONFIG || {}).APPS_SCRIPT_URL || "";
    if (!url || url.includes("ISI-ALAMAT-ANDA")) {
      throw new Error("Alamat Apps Script belum diisi di config.js.");
    }
    let res;
    try {
      res = await fetch(url, { method: "POST", body: JSON.stringify(payload) });
    } catch (_) {
      throw new Error("Tidak bisa terhubung ke server. Periksa internet Anda.");
    }
    let data;
    try {
      data = await res.json();
    } catch (_) {
      throw new Error("Jawaban server tidak dikenali. Pastikan deployment Apps Script diatur ke akses \"Siapa saja\".");
    }
    if (data.error) throw new Error(data.error);
    return data;
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const CHUNK = 8 * 1024 * 1024; // harus kelipatan 256 KB (aturan Google Drive)

  function putChunk(url, blob, start, end, total, onLoaded) {
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open("PUT", url);
      x.setRequestHeader("Content-Range", `bytes ${start}-${end - 1}/${total}`);
      x.upload.onprogress = (e) => e.lengthComputable && onLoaded(e.loaded);
      x.onload = () => {
        if ([200, 201, 308].includes(x.status)) resolve(x.status);
        else reject(new Error("Drive menjawab kode " + x.status));
      };
      x.onerror = () => reject(new Error("koneksi ke Google Drive gagal"));
      x.send(blob.slice(start, end));
    });
  }

  /** Kirim berkas (berapa pun ukurannya) langsung ke Google Drive per potongan 8 MB. */
  async function uploadToDrive(uploadUrl, blob, onProgress) {
    const total = blob.size;
    let start = 0;
    while (start < total) {
      const end = Math.min(start + CHUNK, total);
      let ok = false;
      let lastErr;
      for (let t = 0; t < 4 && !ok; t++) {
        try {
          await putChunk(uploadUrl, blob, start, end, total, (l) => onProgress((start + l) / total));
          ok = true;
        } catch (e) {
          lastErr = e;
          await sleep(1500 * (t + 1));
        }
      }
      if (!ok) throw new Error(`Upload terputus (${lastErr.message}). Coba kirim ulang.`);
      start = end;
      onProgress(start / total);
    }
  }

  window.Api = { call: callApi, uploadToDrive };
})();
