/* ==============================================
   app.js — TTS Antrian & Pengumuman
   Web Speech API | Bahasa Indonesia
============================================== */

'use strict';

// ─── STATE ───────────────────────────────────────────────────────────────────
const state = {
    queue: [],          // { id, name, keperluan, time, called }
    history: [],        // { text, time }
    nextId: 1,
    lastCalled: null,   // teks terakhir yang dipanggil
    isSpeaking: false,
};

// ─── SETTINGS ────────────────────────────────────────────────────────────────
let settings = {
    voiceURI: '',
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    prefix: 'Kendaraan dengan nomor polisi',
    suffix: 'harap segera menuju area timbangan. Terima kasih.',
};

// ─── TEMPLATES PENGUMUMAN ────────────────────────────────────────────────────
const TEMPLATES = [
    {
        icon: '🕐',
        label: 'Jam Operasional',
        text: 'Perhatian. Jam operasional hari ini dimulai pukul tujuh pagi hingga pukul empat sore. Terima kasih.',
    },
    {
        icon: '⚠️',
        label: 'Istirahat',
        text: 'Perhatian kepada seluruh kendaraan. Operasional ditunda sementara karena waktu istirahat. Mohon menunggu hingga pukul satu siang. Terima kasih.',
    },
    {
        icon: '🛑',
        label: 'Operasional Ditutup',
        text: 'Perhatian. Operasional hari ini telah ditutup. Kendaraan yang belum terlayani mohon kembali besok. Terima kasih atas perhatiannya.',
    },
    {
        icon: '📋',
        label: 'Siapkan Dokumen',
        text: 'Perhatian kepada seluruh kendaraan. Harap menyiapkan dokumen pengiriman dan surat jalan sebelum memasuki area timbangan. Terima kasih.',
    },
    {
        icon: '🚧',
        label: 'Area Berbahaya',
        text: 'Perhatian. Harap berhati-hati di area timbangan. Dilarang keluar dari kendaraan kecuali di tempat yang telah ditentukan. Terima kasih.',
    },
    {
        icon: '📢',
        label: 'Antri Tertib',
        text: 'Perhatian kepada seluruh pengemudi. Mohon antri dengan tertib dan mengikuti arahan petugas. Terima kasih atas kerjasamanya.',
    },
    {
        icon: '🔔',
        label: 'Pengumuman Umum',
        text: 'Perhatian. Ada pengumuman penting dari pihak manajemen. Mohon seluruh kendaraan untuk standby dan menunggu instruksi lebih lanjut.',
    },
    {
        icon: '🅿️',
        label: 'Parkir Penuh',
        text: 'Perhatian. Area parkir saat ini penuh. Kendaraan yang baru datang mohon menunggu di luar area hingga ada tempat yang tersedia. Terima kasih.',
    },
];

// ─── INIT ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    renderTemplates();
    updateQueueUI();
    setSystemInfo();

    // Event dari browser jika voices sudah siap (Chrome, Edge)
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = () => loadVoices();
    }

    // Polling awal: coba 60x setiap 250ms (total 15 detik)
    loadVoicesWithRetry(60);

    // Firefox fix: voices sering baru tersedia setelah user gesture pertama.
    // Pasang listener sekali saja di seluruh halaman.
    document.addEventListener('click', unlockTTSOnce, { once: true });
    document.addEventListener('keydown', unlockTTSOnce, { once: true });

    // Enter key shortcuts
    document.getElementById('input-plat').addEventListener('keydown', e => {
        if (e.key === 'Enter') addToQueue();
    });
    document.getElementById('input-keperluan').addEventListener('keydown', e => {
        if (e.key === 'Enter') addToQueue();
    });
    document.getElementById('input-quick').addEventListener('keydown', e => {
        if (e.key === 'Enter') quickCall();
    });
    document.getElementById('input-announce').addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.ctrlKey) announceCustom();
    });
});

/**
 * Dipanggil sekali saat interaksi pertama user.
 * Mengirim utterance kosong untuk "membuka kunci" TTS di Firefox,
 * lalu langsung retry load voices.
 */
function unlockTTSOnce() {
    try {
        const unlock = new SpeechSynthesisUtterance('');
        unlock.volume = 0;
        speechSynthesis.speak(unlock);
        speechSynthesis.cancel();
    } catch (_) { }
    // Tunggu sebentar lalu muat ulang voices
    setTimeout(() => loadVoicesWithRetry(20), 300);
}

// ─── TAB SWITCHING ───────────────────────────────────────────────────────────
function switchTab(tab) {
    const panels = ['queue', 'announce', 'settings'];
    panels.forEach(p => {
        document.getElementById(`panel-${p}`).classList.toggle('hidden', p !== tab);
        const btn = document.getElementById(`tab-${p}-btn`);
        btn.classList.toggle('active', p === tab);
        btn.setAttribute('aria-selected', p === tab);
    });
}

// ─── VOICE LOADING ───────────────────────────────────────────────────────────

/**
 * Coba muat voices. Jika belum tersedia, ulangi setiap 250ms.
 * @param {number} retriesLeft - sisa percobaan
 */
function loadVoicesWithRetry(retriesLeft) {
    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
        loadVoices(voices);
        return;
    }
    if (retriesLeft <= 0) {
        // Tampilkan tombol aktivasi manual sebagai fallback terakhir
        showActivateButton();
        return;
    }
    setTimeout(() => loadVoicesWithRetry(retriesLeft - 1), 250);
}

/** Tampilkan tombol "Aktifkan Suara" jika semua retry gagal */
function showActivateButton() {
    const select = document.getElementById('setting-voice');
    select.innerHTML = '<option value="">Suara belum dimuat — klik tombol di bawah</option>';
    document.getElementById('info-voices').textContent = 'Belum aktif';

    // Tampilkan banner aktivasi
    const banner = document.getElementById('activate-banner');
    if (banner) banner.style.display = 'flex';
}

/** Dipanggil oleh tombol Aktifkan Suara */
function activateTTS() {
    const banner = document.getElementById('activate-banner');
    if (banner) banner.style.display = 'none';
    showToast('🔄 Mengaktifkan mesin suara...', 'info');
    try {
        const u = new SpeechSynthesisUtterance('');
        u.volume = 0;
        speechSynthesis.speak(u);
        speechSynthesis.cancel();
    } catch (_) { }
    setTimeout(() => {
        loadVoicesWithRetry(40);
        // Jika masih gagal setelah 10 detik, tampilkan pesan error
        setTimeout(() => {
            const voices = speechSynthesis.getVoices();
            if (voices.length === 0) {
                document.getElementById('setting-voice').innerHTML =
                    '<option value="">Suara tidak tersedia di browser ini</option>';
                document.getElementById('info-voices').textContent = 'Tidak tersedia';
                showToast('❌ Suara tidak ditemukan. Lihat instruksi di bawah.', 'error');
                const noVoiceMsg = document.getElementById('no-voice-msg');
                if (noVoiceMsg) noVoiceMsg.style.display = 'block';
            }
        }, 11000);
    }, 300);
}

function loadVoices(voices) {
    if (!voices) voices = speechSynthesis.getVoices();
    if (voices.length === 0) return; // dipanggil terlalu awal

    const select = document.getElementById('setting-voice');
    select.innerHTML = '';

    // Prioritaskan suara Indonesia
    const idVoices = voices.filter(v => v.lang.startsWith('id'));
    const otherVoices = voices.filter(v => !v.lang.startsWith('id'));

    if (idVoices.length > 0) {
        const group = document.createElement('optgroup');
        group.label = '🇮🇩 Bahasa Indonesia';
        idVoices.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.voiceURI;
            opt.textContent = `${v.name} (${v.lang})`;
            if (v.voiceURI === settings.voiceURI) opt.selected = true;
            group.appendChild(opt);
        });
        select.appendChild(group);
    }

    if (otherVoices.length > 0) {
        const group = document.createElement('optgroup');
        group.label = '🌐 Bahasa Lain';
        otherVoices.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.voiceURI;
            opt.textContent = `${v.name} (${v.lang})`;
            if (v.voiceURI === settings.voiceURI) opt.selected = true;
            group.appendChild(opt);
        });
        select.appendChild(group);
    }

    // Auto-pilih suara Indonesia jika belum dipilih
    if (!settings.voiceURI && idVoices.length > 0) {
        settings.voiceURI = idVoices[0].voiceURI;
        select.value = settings.voiceURI;
    } else if (settings.voiceURI) {
        select.value = settings.voiceURI;
    }

    document.getElementById('info-voices').textContent =
        `${voices.length} suara (${idVoices.length} Indonesia)`;
}

// ─── TTS ENGINE ──────────────────────────────────────────────────────────────
function speak(text, onDone) {
    if (!('speechSynthesis' in window)) {
        showToast('❌ Browser tidak mendukung Text-to-Speech!', 'error');
        return;
    }

    // Hentikan yg sedang berjalan
    speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);

    // Terapkan settings
    const voices = speechSynthesis.getVoices();
    const voice = voices.find(v => v.voiceURI === settings.voiceURI);
    if (voice) utter.voice = voice;

    utter.rate = settings.rate;
    utter.pitch = settings.pitch;
    utter.volume = settings.volume;
    utter.lang = voice ? voice.lang : 'id-ID';

    utter.onstart = () => {
        state.isSpeaking = true;
        setSpeakingStatus(true);
    };

    utter.onend = () => {
        state.isSpeaking = false;
        setSpeakingStatus(false);
        if (typeof onDone === 'function') onDone();
    };

    utter.onerror = (e) => {
        state.isSpeaking = false;
        setSpeakingStatus(false);
        console.error('TTS Error:', e);
    };

    speechSynthesis.speak(utter);
}

function setSpeakingStatus(active) {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    dot.className = 'status-dot' + (active ? ' speaking' : '');
    text.textContent = active ? 'Memanggil...' : 'Siap';
}

// ─── QUEUE MANAGEMENT ────────────────────────────────────────────────────────
function addToQueue() {
    const platInput = document.getElementById('input-plat');
    const kerluanInput = document.getElementById('input-keperluan');

    const name = platInput.value.trim().toUpperCase();
    const keperluan = kerluanInput.value.trim();

    if (!name) {
        showToast('⚠️ Masukkan nomor polisi atau nama kendaraan!', 'error');
        platInput.focus();
        return;
    }

    const item = {
        id: state.nextId++,
        name,
        keperluan,
        time: formatTime(new Date()),
        called: false,
    };

    state.queue.push(item);
    platInput.value = '';
    kerluanInput.value = '';
    platInput.focus();

    updateQueueUI();
    showToast(`✅ "${name}" ditambahkan ke antrian`, 'success');
}

function callNext() {
    const uncalled = state.queue.filter(q => !q.called);
    if (uncalled.length === 0) {
        showToast('ℹ️ Tidak ada antrian tersisa', 'info');
        return;
    }

    const item = uncalled[0];
    callItem(item);
}

function callItem(item) {
    item.called = true;
    state.lastCalled = buildCallText(item.name);

    // Tampilkan di header current call
    const box = document.getElementById('current-call-box');
    box.style.display = 'block';
    document.getElementById('current-call-name').textContent = item.name;

    speak(state.lastCalled);
    updateQueueUI();
    showToast(`🔊 Memanggil: ${item.name}`, 'info');
}

function buildCallText(name) {
    const prefix = settings.prefix || '';
    const suffix = settings.suffix || '';
    return `${prefix} ${name}. ${suffix}`.replace(/\s+/g, ' ').trim();
}

function repeatCall() {
    if (!state.lastCalled) {
        showToast('ℹ️ Belum ada panggilan sebelumnya', 'info');
        return;
    }
    speak(state.lastCalled);
    showToast('🔂 Mengulang panggilan...', 'info');
}

function quickCall() {
    const input = document.getElementById('input-quick');
    const name = input.value.trim().toUpperCase();
    if (!name) {
        showToast('⚠️ Masukkan nomor atau nama kendaraan!', 'error');
        input.focus();
        return;
    }

    state.lastCalled = buildCallText(name);
    speak(state.lastCalled);

    // Update current call box
    const box = document.getElementById('current-call-box');
    box.style.display = 'block';
    document.getElementById('current-call-name').textContent = name;

    showToast(`🔊 Memanggil: ${name}`, 'info');
    input.value = '';
    input.focus();
}

function removeQueueItem(id) {
    state.queue = state.queue.filter(q => q.id !== id);
    updateQueueUI();
    showToast('🗑️ Antrian dihapus', 'info');
}

function callQueueItem(id) {
    const item = state.queue.find(q => q.id === id);
    if (item) callItem(item);
}

function clearQueue() {
    if (state.queue.length === 0) return;
    state.queue = [];
    state.lastCalled = null;
    document.getElementById('current-call-box').style.display = 'none';
    updateQueueUI();
    showToast('🗑️ Semua antrian dihapus', 'info');
}

// ─── QUEUE UI RENDER ─────────────────────────────────────────────────────────
function updateQueueUI() {
    const list = document.getElementById('queue-list');
    const empty = document.getElementById('queue-empty');
    const counter = document.getElementById('queue-count');
    const btnNext = document.getElementById('btn-call-next');
    const btnRpt = document.getElementById('btn-repeat');

    const uncalled = state.queue.filter(q => !q.called);
    counter.textContent = `${uncalled.length} antrian`;
    btnNext.disabled = uncalled.length === 0;
    btnRpt.disabled = !state.lastCalled;

    if (state.queue.length === 0) {
        list.innerHTML = '';
        list.appendChild(empty);
        empty.style.display = 'flex';
        return;
    }

    empty.style.display = 'none';

    let html = '';
    state.queue.forEach((item, idx) => {
        html += `
      <div class="queue-item ${item.called ? 'called' : ''}" id="qi-${item.id}">
        <div class="queue-num">${idx + 1}</div>
        <div class="queue-info">
          <div class="queue-name">${escHtml(item.name)}</div>
          ${item.keperluan ? `<div class="queue-keperluan">📌 ${escHtml(item.keperluan)}</div>` : ''}
        </div>
        <div class="queue-time">${item.time}</div>
        <div class="queue-item-actions">
          ${!item.called
                ? `<button class="btn-icon" onclick="callQueueItem(${item.id})" title="Panggil">📢</button>`
                : `<span style="font-size:0.8rem;color:var(--success)">✓ Dipanggil</span>`
            }
          <button class="btn-icon remove" onclick="removeQueueItem(${item.id})" title="Hapus">✕</button>
        </div>
      </div>`;
    });

    list.innerHTML = html;
    list.appendChild(empty);
}

// ─── PENGUMUMAN ───────────────────────────────────────────────────────────────
function renderTemplates() {
    const grid = document.getElementById('template-grid');
    grid.innerHTML = TEMPLATES.map((t, i) => `
    <button class="template-btn" onclick="announceTemplate(${i})">
      <span class="template-icon">${t.icon}</span>
      <span class="template-label">${t.label}</span>
      <span class="template-preview">${t.text.substring(0, 60)}...</span>
    </button>
  `).join('');
}

function announceTemplate(idx) {
    const t = TEMPLATES[idx];
    speak(t.text);
    addHistory(t.text);
    showToast(`📢 Mengumumkan: ${t.label}`, 'info');
}

function announceCustom() {
    const input = document.getElementById('input-announce');
    const text = input.value.trim();
    if (!text) {
        showToast('⚠️ Ketik teks pengumuman terlebih dahulu!', 'error');
        input.focus();
        return;
    }
    speak(text);
    addHistory(text);
    showToast('📢 Pengumuman diputar', 'info');
}

function clearAnnounce() {
    document.getElementById('input-announce').value = '';
    document.getElementById('input-announce').focus();
}

function addHistory(text) {
    state.history.unshift({ text, time: formatTime(new Date()) });
    if (state.history.length > 20) state.history.pop();
    renderHistory();
}

function renderHistory() {
    const list = document.getElementById('history-list');
    if (state.history.length === 0) {
        list.innerHTML = `<div class="queue-empty"><span class="queue-empty-icon">📜</span><p>Belum ada riwayat pengumuman.</p></div>`;
        return;
    }
    list.innerHTML = state.history.map(h => `
    <div class="history-item">
      <span class="history-icon">📣</span>
      <div>
        <div class="history-text">${escHtml(h.text)}</div>
        <div class="history-time">${h.time}</div>
      </div>
      <button class="btn-icon" onclick="speak('${escAttr(h.text)}')" title="Ulang">🔊</button>
    </div>
  `).join('');
}

function clearHistory() {
    state.history = [];
    renderHistory();
    showToast('🗑️ Riwayat dihapus', 'info');
}

// ─── SETTINGS ────────────────────────────────────────────────────────────────
function saveSettings() {
    settings.voiceURI = document.getElementById('setting-voice').value;
    settings.rate = parseFloat(document.getElementById('setting-rate').value);
    settings.pitch = parseFloat(document.getElementById('setting-pitch').value);
    settings.volume = parseFloat(document.getElementById('setting-volume').value);
    settings.prefix = document.getElementById('setting-prefix').value;
    settings.suffix = document.getElementById('setting-suffix').value;

    localStorage.setItem('tts_settings', JSON.stringify(settings));
    showToast('💾 Pengaturan disimpan!', 'success');
}

function loadSettings() {
    const saved = localStorage.getItem('tts_settings');
    if (saved) {
        try {
            settings = { ...settings, ...JSON.parse(saved) };
        } catch { }
    }

    document.getElementById('setting-rate').value = settings.rate;
    document.getElementById('setting-pitch').value = settings.pitch;
    document.getElementById('setting-volume').value = settings.volume;
    document.getElementById('setting-prefix').value = settings.prefix;
    document.getElementById('setting-suffix').value = settings.suffix;

    document.getElementById('rate-val').textContent = settings.rate.toFixed(1);
    document.getElementById('pitch-val').textContent = settings.pitch.toFixed(1);
    document.getElementById('volume-val').textContent = Math.round(settings.volume * 100);
}

function testVoice() {
    saveSettings();
    const testText = 'Ini adalah tes suara sistem antrian. Perhatian, kendaraan nomor polisi B satu dua tiga empat A B C harap menuju area timbangan.';
    speak(testText);
    showToast('🔊 Memutar tes suara...', 'info');
}

// ─── SYSTEM INFO ─────────────────────────────────────────────────────────────
function setSystemInfo() {
    const ua = navigator.userAgent;
    const isFirefox = ua.includes('Firefox');
    const isChrome = ua.includes('Chrome') && !ua.includes('Edg');
    const isEdge = ua.includes('Edg');
    const isBrave = navigator.brave !== undefined;
    const isFileProto = location.protocol === 'file:';

    const browserName = isEdge ? 'Microsoft Edge' :
        isBrave ? 'Brave Browser' :
            isChrome ? 'Google Chrome' :
                isFirefox ? 'Mozilla Firefox' : 'Browser lainnya';

    document.getElementById('info-browser').textContent = browserName;

    const supported = 'speechSynthesis' in window;
    document.getElementById('info-tts').textContent = supported ? '✅ Didukung' : '❌ Tidak Didukung';
    document.getElementById('info-voices').textContent = 'Memuat...';

    // Tampilkan peringatan jika Firefox + file://
    if ((isFirefox || isBrave) && isFileProto) {
        document.getElementById('warn-banner').style.display = 'flex';
    }
}

// ─── UTILITIES ───────────────────────────────────────────────────────────────
function formatTime(date) {
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function escHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escAttr(str) {
    return str.replace(/'/g, "\\'").replace(/\n/g, ' ');
}

let toastTimer;
function showToast(msg, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = `toast ${type} show`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}
