/* ==============================================
   app.js — TTS Antrian & Pengumuman
   Engine: edge-tts (via server.py di port 5000)
============================================== */

'use strict';

const TTS_SERVER = 'http://localhost:5000';

// ─── STATE ───────────────────────────────────────────────────────────────────
const state = {
    queue: [],
    history: [],
    nextId: 1,
    lastCalled: null,
    isSpeaking: false,
    currentAudio: null,   // HTMLAudioElement yang sedang aktif
};

// ─── SETTINGS ────────────────────────────────────────────────────────────────
let settings = {
    voiceURI: 'id-ID-GadisNeural',
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

// ─── KONVERSI NILAI SLIDER → FORMAT EDGE-TTS ─────────────────────────────────
/** rate  : slider 0.5–2.0  → "+X%" (mis. 1.5 → "+50%", 0.8 → "-20%") */
function rateToEdge(r)   { const p = Math.round((r - 1) * 100); return (p >= 0 ? '+' : '') + p + '%'; }
/** volume: slider 0–1.0   → "+X%" (mis. 1.0 → "+0%",  0.5 → "-50%") */
function volToEdge(v)    { const p = Math.round((v - 1) * 100); return (p >= 0 ? '+' : '') + p + '%'; }
/** pitch : slider 0.5–2.0 → "+XHz" (mis. 1.0 → "+0Hz", 1.5 → "+12Hz") */
function pitchToEdge(p)  { const hz = Math.round((p - 1) * 24); return (hz >= 0 ? '+' : '') + hz + 'Hz'; }

// ─── INIT ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    renderTemplates();
    updateQueueUI();
    setSystemInfo();
    loadEdgeVoices();

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

// ─── VOICE LOADING (dari server edge-tts) ────────────────────────────────────
async function loadEdgeVoices() {
    const select = document.getElementById('setting-voice');
    select.innerHTML = '<option value="">Memuat daftar suara...</option>';

    try {
        const res = await fetch(`${TTS_SERVER}/voices`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const voices = await res.json();

        select.innerHTML = '';

        const idVoices    = voices.filter(v => v.lang.startsWith('id'));
        const otherVoices = voices.filter(v => !v.lang.startsWith('id'));

        if (idVoices.length > 0) {
            const grp = document.createElement('optgroup');
            grp.label = '🇮🇩 Bahasa Indonesia';
            idVoices.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v.name;
                opt.textContent = v.label;
                if (v.name === settings.voiceURI) opt.selected = true;
                grp.appendChild(opt);
            });
            select.appendChild(grp);
        }

        if (otherVoices.length > 0) {
            const grp = document.createElement('optgroup');
            grp.label = '🌐 Bahasa Lain';
            otherVoices.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v.name;
                opt.textContent = v.label;
                if (v.name === settings.voiceURI) opt.selected = true;
                grp.appendChild(opt);
            });
            select.appendChild(grp);
        }

        if (settings.voiceURI) select.value = settings.voiceURI;

        document.getElementById('info-voices').textContent =
            `${voices.length} suara (${idVoices.length} Indonesia)`;

        showToast('✅ Suara Edge-TTS berhasil dimuat', 'success');
    } catch (err) {
        select.innerHTML = '<option value="">⚠️ Server tidak tersedia</option>';
        document.getElementById('info-voices').textContent = 'Server offline';
        showToast('❌ Tidak dapat terhubung ke server TTS (port 5000). Pastikan server.py berjalan.', 'error');
        console.error('[loadEdgeVoices]', err);
    }
}

// ─── TTS ENGINE (edge-tts via HTTP) ──────────────────────────────────────────
async function speak(text, onDone) {
    // Hentikan audio yang sedang berjalan
    if (state.currentAudio) {
        state.currentAudio.pause();
        state.currentAudio = null;
    }

    state.isSpeaking = true;
    setSpeakingStatus(true);

    try {
        const body = {
            text,
            voice:  settings.voiceURI || 'id-ID-GadisNeural',
            rate:   rateToEdge(settings.rate),
            volume: volToEdge(settings.volume),
            pitch:  pitchToEdge(settings.pitch),
        };

        const res = await fetch(`${TTS_SERVER}/speak`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(body),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `HTTP ${res.status}`);
        }

        const blob     = await res.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio    = new Audio(audioUrl);
        state.currentAudio = audio;

        audio.onended = () => {
            state.isSpeaking  = false;
            state.currentAudio = null;
            setSpeakingStatus(false);
            URL.revokeObjectURL(audioUrl);
            if (typeof onDone === 'function') onDone();
        };

        audio.onerror = (e) => {
            state.isSpeaking  = false;
            state.currentAudio = null;
            setSpeakingStatus(false);
            URL.revokeObjectURL(audioUrl);
            console.error('[Audio] Error memutar audio', e);
            showToast('❌ Gagal memutar audio', 'error');
        };

        audio.play();

    } catch (err) {
        state.isSpeaking  = false;
        state.currentAudio = null;
        setSpeakingStatus(false);
        console.error('[speak]', err);
        showToast(`❌ TTS gagal: ${err.message}. Pastikan server.py berjalan.`, 'error');
    }
}

function setSpeakingStatus(active) {
    const dot  = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    dot.className  = 'status-dot' + (active ? ' speaking' : '');
    text.textContent = active ? 'Memanggil...' : 'Siap';
}

// ─── QUEUE MANAGEMENT ────────────────────────────────────────────────────────
function addToQueue() {
    const platInput    = document.getElementById('input-plat');
    const kerluanInput = document.getElementById('input-keperluan');

    const name     = platInput.value.trim().toUpperCase();
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
        time:   formatTime(new Date()),
        called: false,
    };

    state.queue.push(item);
    platInput.value   = '';
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
    callItem(uncalled[0]);
}

function callItem(item) {
    item.called = true;
    state.lastCalled = buildCallText(item.name);

    const box = document.getElementById('current-call-box');
    box.style.display = 'block';
    document.getElementById('current-call-name').textContent = item.name;

    speak(state.lastCalled);
    updateQueueUI();
    showToast(`🔊 Memanggil: ${item.name}`, 'info');
}

function expandDigits(text) {
    //pisahkan digit
    return text.replace(/\d{2,}/g, m => m.split(''));
}

function buildCallText(name) {
    const prefix = settings.prefix || '';
    const suffix = settings.suffix || '';
    return `${prefix} ${expandDigits(name)}. ${suffix}`.replace(/\s+/g, ' ').trim();
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
    const name  = input.value.trim().toUpperCase();
    if (!name) {
        showToast('⚠️ Masukkan nomor atau nama kendaraan!', 'error');
        input.focus();
        return;
    }

    state.lastCalled = buildCallText(name);
    speak(state.lastCalled);

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
    state.queue      = [];
    state.lastCalled = null;
    document.getElementById('current-call-box').style.display = 'none';
    updateQueueUI();
    showToast('🗑️ Semua antrian dihapus', 'info');
}

// ─── QUEUE UI RENDER ─────────────────────────────────────────────────────────
function updateQueueUI() {
    const list    = document.getElementById('queue-list');
    const empty   = document.getElementById('queue-empty');
    const counter = document.getElementById('queue-count');
    const btnNext = document.getElementById('btn-call-next');
    const btnRpt  = document.getElementById('btn-repeat');

    const uncalled = state.queue.filter(q => !q.called);
    counter.textContent = `${uncalled.length} antrian`;
    btnNext.disabled = uncalled.length === 0;
    btnRpt.disabled  = !state.lastCalled;

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
    const text  = input.value.trim();
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
    settings.rate     = parseFloat(document.getElementById('setting-rate').value);
    settings.pitch    = parseFloat(document.getElementById('setting-pitch').value);
    settings.volume   = parseFloat(document.getElementById('setting-volume').value);
    settings.prefix   = document.getElementById('setting-prefix').value;
    settings.suffix   = document.getElementById('setting-suffix').value;

    localStorage.setItem('tts_settings', JSON.stringify(settings));
    showToast('💾 Pengaturan disimpan!', 'success');
}

function loadSettings() {
    const saved = localStorage.getItem('tts_settings');
    if (saved) {
        try { settings = { ...settings, ...JSON.parse(saved) }; } catch { }
    }

    document.getElementById('setting-rate').value   = settings.rate;
    document.getElementById('setting-pitch').value  = settings.pitch;
    document.getElementById('setting-volume').value = settings.volume;
    document.getElementById('setting-prefix').value = settings.prefix;
    document.getElementById('setting-suffix').value = settings.suffix;

    document.getElementById('rate-val').textContent   = settings.rate.toFixed(1);
    document.getElementById('pitch-val').textContent  = settings.pitch.toFixed(1);
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
    const ua        = navigator.userAgent;
    const isEdge    = ua.includes('Edg');
    const isBrave   = navigator.brave !== undefined;
    const isChrome  = ua.includes('Chrome') && !ua.includes('Edg');
    const isFirefox = ua.includes('Firefox');

    const browserName = isEdge ? 'Microsoft Edge' :
        isBrave  ? 'Brave Browser'    :
        isChrome ? 'Google Chrome'    :
        isFirefox? 'Mozilla Firefox'  : 'Browser lainnya';

    document.getElementById('info-browser').textContent = browserName;
    document.getElementById('info-tts').textContent     = '✅ Edge-TTS (server.py)';
    document.getElementById('info-voices').textContent  = 'Memuat...';
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
    toast.className   = `toast ${type} show`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}
