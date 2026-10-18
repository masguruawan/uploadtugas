/* Halaman admin: login, lalu kelola data yang tersimpan di Google Spreadsheet. */
(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const el = {
    loginView: $("#loginView"), appView: $("#appView"), loginForm: $("#loginForm"), loginMsg: $("#loginMsg"), loginBtn: $("#loginBtn"),
    rows: $("#rows"), cards: $("#cards"), chips: $("#chips"), statusFilter: $("#statusFilter"), search: $("#search"),
    noteDlg: $("#noteDlg"), noteText: $("#noteText"), noteFor: $("#noteFor"), toast: $("#toast"),
  };

  const TOKEN_KEY = "arsip_admin_token";
  let token = "";
  try { token = sessionStorage.getItem(TOKEN_KEY) || ""; } catch (_) {}

  let records = [];
  let kind = "Semua";
  let status = "";
  let query = "";
  let noteId = null;

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtSize = (kb) => {
    kb = Number(kb) || 0;
    if (kb < 1024) return kb.toFixed(0) + " KB";
    if (kb < 1024 * 1024) return (kb / 1024).toFixed(1) + " MB";
    return (kb / 1024 / 1024).toFixed(2) + " GB";
  };
  const viewUrl = (id) => `https://drive.google.com/file/d/${encodeURIComponent(id)}/view`;
  const downloadUrl = (id) => `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;

  let timer;
  const toast = (m) => {
    el.toast.textContent = m;
    el.toast.classList.add("show");
    clearTimeout(timer);
    timer = setTimeout(() => el.toast.classList.remove("show"), 3500);
  };

  /* ---------- API (dengan token) ---------- */
  async function api(payload) {
    try {
      return await Api.call({ ...payload, token });
    } catch (err) {
      if (/Sesi habis/.test(err.message)) showLogin();
      throw err;
    }
  }

  function showLogin() {
    token = "";
    try { sessionStorage.removeItem(TOKEN_KEY); } catch (_) {}
    el.appView.hidden = true;
    el.loginView.hidden = false;
    $("#user").focus();
  }
  function showApp() {
    el.loginView.hidden = true;
    el.appView.hidden = false;
  }

  el.loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    el.loginMsg.textContent = "";
    el.loginBtn.disabled = true;
    try {
      const r = await Api.call({ action: "login", user: $("#user").value, pass: $("#pass").value });
      token = r.token;
      try { sessionStorage.setItem(TOKEN_KEY, token); } catch (_) {}
      $("#pass").value = "";
      await load();
    } catch (err) {
      el.loginMsg.textContent = err.message;
      el.loginMsg.className = "msg err";
    } finally {
      el.loginBtn.disabled = false;
    }
  });

  $("#btnLogout").addEventListener("click", async () => {
    try { await api({ action: "logout" }); } catch (_) {}
    records = [];
    showLogin();
  });

  /* ---------- Data ---------- */
  async function load() {
    const r = await api({ action: "list" });
    records = r.records;
    $("#lnkSheet").href = `https://docs.google.com/spreadsheets/d/${r.sheetId}/edit`;
    $("#lnkXlsx").href = `https://docs.google.com/spreadsheets/d/${r.sheetId}/export?format=xlsx`;
    showApp();
    render();
  }

  $("#btnRefresh").addEventListener("click", () => load().then(() => toast("Data dimuat ulang.")).catch((e) => toast(e.message)));

  function visible() {
    const q = query.toLowerCase();
    return records.filter(
      (r) =>
        (kind === "Semua" || r.jenis === kind) &&
        (!status || r.status === status) &&
        (!q || [r.pengirim, r.namaFile, r.keterangan, r.catatanAdmin].some((v) => String(v).toLowerCase().includes(q)))
    );
  }

  function render() {
    const n = (f) => records.filter(f).length;
    const cards = [
      ["Total kiriman", records.length],
      ["Foto (PDF)", n((r) => r.jenis === "Foto")],
      ["Video", n((r) => r.jenis === "Video")],
      ["Status Baru", n((r) => r.status === "Baru")],
    ];
    el.cards.innerHTML = cards.map(([l, v]) => `<div class="card"><span class="card-n">${v}</span><span class="card-l">${l}</span></div>`).join("");

    const list = visible();
    if (!list.length) {
      el.rows.innerHTML = `<tr><td colspan="7" class="empty">${records.length ? "Tidak ada data yang cocok dengan filter." : "Belum ada kiriman dari user."}</td></tr>`;
      return;
    }
    el.rows.innerHTML = list
      .map((r) => {
        const isFoto = r.jenis === "Foto";
        return `<tr data-id="${esc(r.id)}">
          <td class="nowrap">${esc(r.tanggal)}</td>
          <td><div class="fname">${esc(r.pengirim)}</div></td>
          <td><span class="tag t-${esc(r.jenis)}">${isFoto ? "Foto (PDF)" : "Video"}</span></td>
          <td>
            <div class="fname">${esc(r.namaFile)}</div>
            ${isFoto && r.jumlahFoto ? `<div class="fnote">${esc(r.jumlahFoto)} foto dalam PDF ini</div>` : ""}
            ${r.keterangan ? `<div class="fnote">Keterangan: ${esc(r.keterangan)}</div>` : ""}
            ${r.catatanAdmin ? `<div class="fnote admin-note">Catatan: ${esc(r.catatanAdmin)}</div>` : ""}
          </td>
          <td class="num">${fmtSize(r.ukuranKB)}</td>
          <td>
            <select class="st st-${esc(r.status)}" data-act="status" aria-label="Status ${esc(r.namaFile)}">
              ${["Baru", "Diproses", "Selesai"].map((s) => `<option${s === r.status ? " selected" : ""}>${s}</option>`).join("")}
            </select>
          </td>
          <td class="c-act">
            <a class="act" href="${viewUrl(r.fileId)}" target="_blank" rel="noopener">Lihat</a>
            <a class="act" href="${downloadUrl(r.fileId)}" target="_blank" rel="noopener">Unduh</a>
            <button class="act" data-act="note">Catatan</button>
            <button class="act del" data-act="delete">Hapus</button>
          </td>
        </tr>`;
      })
      .join("");
  }

  /* ---------- Filter ---------- */
  el.chips.addEventListener("click", (e) => {
    const c = e.target.closest("[data-filter]");
    if (!c) return;
    kind = c.dataset.filter;
    el.chips.querySelectorAll(".chip").forEach((x) => x.classList.toggle("is-on", x === c));
    render();
  });
  el.statusFilter.addEventListener("change", () => { status = el.statusFilter.value; render(); });
  el.search.addEventListener("input", () => { query = el.search.value.trim(); render(); });

  /* ---------- Aksi ---------- */
  const find = (id) => records.find((r) => r.id === id);

  el.rows.addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-act]");
    if (!b) return;
    const r = find(b.closest("tr").dataset.id);
    if (!r) return;
    try {
      if (b.dataset.act === "note") {
        noteId = r.id;
        el.noteFor.textContent = `${r.pengirim}: ${r.namaFile}`;
        el.noteText.value = r.catatanAdmin || "";
        el.noteDlg.showModal();
        el.noteText.focus();
      }
      if (b.dataset.act === "delete") {
        if (!confirm(`Hapus "${r.namaFile}" dari ${r.pengirim}?\nBerkas dipindah ke tempat sampah Drive dan barisnya dihapus dari Spreadsheet.`)) return;
        await api({ action: "delete", id: r.id });
        records = records.filter((x) => x.id !== r.id);
        render();
        toast("Data dihapus.");
      }
    } catch (err) { toast(err.message); }
  });

  el.rows.addEventListener("change", async (e) => {
    const s = e.target.closest("select[data-act='status']");
    if (!s) return;
    const r = find(s.closest("tr").dataset.id);
    const old = r.status;
    s.disabled = true;
    try {
      const upd = await api({ action: "update", id: r.id, status: s.value });
      Object.assign(r, upd.record);
      toast(`Status diubah menjadi ${r.status}.`);
    } catch (err) {
      s.value = old;
      toast(err.message);
    } finally {
      render();
    }
  });

  /* ---------- Catatan ---------- */
  $("#noteCancel").addEventListener("click", () => el.noteDlg.close());
  $("#noteForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const upd = await api({ action: "update", id: noteId, catatanAdmin: el.noteText.value });
      Object.assign(find(noteId), upd.record);
      el.noteDlg.close();
      render();
      toast("Catatan disimpan.");
    } catch (err) { toast(err.message); }
  });

  /* ---------- Mulai ---------- */
  if (token) load().catch(() => showLogin());
  else showLogin();
})();
