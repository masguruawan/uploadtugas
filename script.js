/* Halaman user: foto digabung jadi PDF di browser, video dikirim langsung ke Google Drive. */
(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const cfg = window.APP_CONFIG || {};
  const keyOf = (f) => `${f.name}|${f.size}|${f.lastModified}`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtSize = (b) => {
    if (b < 1024 * 1024) return (b / 1024).toFixed(0) + " KB";
    if (b < 1024 ** 3) return (b / 1024 / 1024).toFixed(1) + " MB";
    return (b / 1024 ** 3).toFixed(2) + " GB";
  };
  const isImage = (f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(f.name);
  const isVideo = (f) => f.type.startsWith("video/") || /\.(mp4|mov|webm|mkv|avi|m4v|3gp|mpe?g|wmv|flv|ogv)$/i.test(f.name);
  const slug = (s) => s.normalize("NFKD").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_").slice(0, 40) || "tanpa_nama";
  const today = () => new Date().toLocaleDateString("sv-SE");
  const MAX_FOTO = 50;

  if (cfg.PAKAI_KODE) document.querySelectorAll("[data-kode]").forEach((e) => (e.hidden = false));

  let busy = false;
  window.addEventListener("beforeunload", (e) => {
    if (busy) { e.preventDefault(); e.returnValue = ""; }
  });

  function say(el, text, type) {
    el.textContent = text;
    el.className = "msg" + (type ? " " + type : "");
  }

  function wireDrop(zone, input, add) {
    input.addEventListener("change", () => { add(input.files); input.value = ""; });
    zone.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); }
    });
    ["dragenter", "dragover"].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add("is-over"); }));
    ["dragleave", "drop"].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove("is-over"); }));
    zone.addEventListener("drop", (e) => add(e.dataTransfer.files));
  }

  /** Satu rangkaian kirim: minta sesi, kirim ke Drive, lalu catat. */
  async function kirim({ blob, fileName, mimeType, jenis, pengirim, keterangan, kode, jumlahFoto, onProgress }) {
    let sesi;
    try {
      sesi = await Api.call({ action: "init", jenis, pengirim, keterangan, kode, fileName, mimeType, size: blob.size, origin: location.origin });
    } catch (e) { throw e; }
    try {
      await Api.uploadToDrive(sesi.uploadUrl, blob, onProgress);
    } catch (e) {
      throw new Error(e.message + " Jika terus gagal, hubungi admin (pengaturan CORS Drive).");
    }
    await Api.call({ action: "finish", id: sesi.id, jenis, pengirim, keterangan, fileName, jumlahFoto });
  }

  /* ================= FOTO -> PDF ================= */
  async function toJpeg(file) {
    let bmp;
    try {
      bmp = await createImageBitmap(file); // sudah mengikuti orientasi EXIF dari kamera HP
    } catch (_) {
      throw new Error(`Foto "${file.name}" tidak bisa dibaca. Gunakan JPG, PNG, atau WebP.`);
    }
    const scale = Math.min(1, 2600 / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    if (bmp.close) bmp.close();
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
    if (!blob) throw new Error(`Foto "${file.name}" terlalu besar untuk diproses di perangkat ini.`);
    return { bytes: await blob.arrayBuffer(), width: w, height: h };
  }

  async function fotoJadiPdf(files, onStep) {
    if (!window.PDFLib) throw new Error("Pustaka PDF belum termuat. Periksa internet lalu muat ulang halaman.");
    const pdf = await PDFLib.PDFDocument.create();
    for (let i = 0; i < files.length; i++) {
      onStep(i + 1, files.length);
      const j = await toJpeg(files[i]);
      const [pw, ph] = j.width > j.height ? [842, 595] : [595, 842]; // A4 lanskap / potret
      const m = 24;
      const s = Math.min((pw - m * 2) / j.width, (ph - m * 2) / j.height);
      const w = j.width * s;
      const h = j.height * s;
      const page = pdf.addPage([pw, ph]);
      page.drawImage(await pdf.embedJpg(j.bytes), { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
    }
    return new Blob([await pdf.save()], { type: "application/pdf" });
  }

  const foto = {
    form: $("#fotoForm"), input: $("#fotoInput"), drop: $("#fotoDrop"), thumbs: $("#fotoThumbs"),
    count: $("#fotoCount"), bar: $("#fotoBar"), msg: $("#fotoMsg"), btn: $("#fotoBtn"),
    files: [], urls: new Map(),
  };

  function renderFoto() {
    foto.thumbs.innerHTML = foto.files
      .map((f, i) => {
        const k = keyOf(f);
        if (!foto.urls.has(k)) foto.urls.set(k, URL.createObjectURL(f));
        return `<li><img src="${foto.urls.get(k)}" alt="${esc(f.name)}"><button type="button" data-i="${i}" aria-label="Buang ${esc(f.name)}">&times;</button></li>`;
      })
      .join("");
    foto.count.textContent = foto.files.length ? `${foto.files.length} foto dipilih. Semuanya akan digabung menjadi satu PDF.` : "";
  }

  function addFoto(list) {
    const have = new Set(foto.files.map(keyOf));
    let skipped = 0;
    let over = 0;
    for (const f of list) {
      if (!isImage(f)) { skipped++; continue; }
      if (have.has(keyOf(f))) continue;
      if (foto.files.length >= MAX_FOTO) { over++; continue; }
      foto.files.push(f); have.add(keyOf(f));
    }
    const notes = [];
    if (skipped) notes.push(`${skipped} berkas dilewati karena bukan gambar.`);
    if (over) notes.push(`${over} foto dilewati, maksimal ${MAX_FOTO} foto sekali kirim.`);
    say(foto.msg, notes.join(" "), notes.length ? "err" : "");
    renderFoto();
  }

  wireDrop(foto.drop, foto.input, addFoto);
  foto.thumbs.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-i]");
    if (!b) return;
    const [removed] = foto.files.splice(Number(b.dataset.i), 1);
    const k = keyOf(removed);
    URL.revokeObjectURL(foto.urls.get(k));
    foto.urls.delete(k);
    renderFoto();
  });

  foto.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;
    const nama = $("#fotoNama").value.trim();
    if (!nama) { say(foto.msg, "Isi nama pengirim dulu.", "err"); $("#fotoNama").focus(); return; }
    if (!foto.files.length) { say(foto.msg, "Pilih minimal satu foto.", "err"); return; }

    busy = true; foto.btn.disabled = true; foto.bar.hidden = false; foto.bar.value = 0;
    try {
      const pdf = await fotoJadiPdf(foto.files, (i, n) => say(foto.msg, `Menyiapkan PDF… foto ${i} dari ${n}`));
      await kirim({
        blob: pdf, fileName: `Foto_${slug(nama)}_${today()}_${Date.now().toString(36).slice(-4)}.pdf`,
        mimeType: "application/pdf", jenis: "Foto", pengirim: nama,
        keterangan: $("#fotoKet").value.trim(), kode: $("#fotoKode").value, jumlahFoto: foto.files.length,
        onProgress: (p) => { foto.bar.value = p; say(foto.msg, p >= 1 ? "Menyelesaikan…" : `Mengirim PDF… ${Math.round(p * 100)}%`); },
      });
      say(foto.msg, `Berhasil. ${foto.files.length} foto sudah dikirim ke admin sebagai PDF.`, "ok");
      foto.urls.forEach((u) => URL.revokeObjectURL(u));
      foto.urls.clear();
      foto.files = [];
      $("#fotoKet").value = "";
      renderFoto();
    } catch (err) {
      say(foto.msg, err.message, "err");
    } finally {
      busy = false; foto.btn.disabled = false; foto.bar.hidden = true;
    }
  });

  /* ================= VIDEO ================= */
  const video = {
    form: $("#videoForm"), input: $("#videoInput"), drop: $("#videoDrop"), list: $("#videoFiles"),
    bar: $("#videoBar"), msg: $("#videoMsg"), btn: $("#videoBtn"), files: [],
  };

  function renderVideo() {
    video.list.innerHTML = video.files
      .map((f, i) => `<li><span class="fn">${esc(f.name)}</span><span class="fs">${fmtSize(f.size)}</span><button type="button" data-i="${i}" aria-label="Buang ${esc(f.name)}">&times;</button></li>`)
      .join("");
  }

  function addVideo(list) {
    const have = new Set(video.files.map(keyOf));
    let skipped = 0;
    for (const f of list) {
      if (!isVideo(f)) { skipped++; continue; }
      if (!have.has(keyOf(f))) { video.files.push(f); have.add(keyOf(f)); }
    }
    say(video.msg, skipped ? `${skipped} berkas dilewati karena bukan video.` : "", skipped ? "err" : "");
    renderVideo();
  }

  wireDrop(video.drop, video.input, addVideo);
  video.list.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-i]");
    if (!b) return;
    video.files.splice(Number(b.dataset.i), 1);
    renderVideo();
  });

  video.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;
    const nama = $("#videoNama").value.trim();
    if (!nama) { say(video.msg, "Isi nama pengirim dulu.", "err"); $("#videoNama").focus(); return; }
    if (!video.files.length) { say(video.msg, "Pilih minimal satu video.", "err"); return; }

    busy = true; video.btn.disabled = true; video.bar.hidden = false;
    const total = video.files.length;
    let done = 0;
    try {
      while (video.files.length) { // satu per satu; yang gagal tetap tinggal di daftar
        const f = video.files[0];
        video.bar.value = 0;
        await kirim({
          blob: f, fileName: f.name, mimeType: f.type, jenis: "Video", pengirim: nama,
          keterangan: $("#videoKet").value.trim(), kode: $("#videoKode").value,
          onProgress: (p) => { video.bar.value = p; say(video.msg, `Mengirim video ${done + 1} dari ${total}: ${f.name} (${Math.round(p * 100)}%)`); },
        });
        video.files.shift();
        done++;
        renderVideo();
      }
      say(video.msg, `Berhasil. ${done} video sudah dikirim ke admin.`, "ok");
      $("#videoKet").value = "";
    } catch (err) {
      say(video.msg, `${done ? done + " video terkirim. " : ""}${err.message} Video yang gagal masih ada di daftar, tekan Kirim video untuk mencoba lagi.`, "err");
    } finally {
      busy = false; video.btn.disabled = false; video.bar.hidden = true;
    }
  });
})();
