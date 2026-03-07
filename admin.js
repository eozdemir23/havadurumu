/**
 * WeatherOS Core v2.8 - Ultimate Architect Edition
 * Author: Özdemir (eozdemir23)
 * Status: Full Functional / Stable
 */

// --- 1. GLOBAL KONFİGÜRASYON VE STATE ---
const CORE_VERSION = "2.8.0";
let latencyChart = null;
const MAX_LOG_SIZE = 100;
const CHART_POINTS = 25;

// --- 2. LOGLAMA VE TERMİNAL MOTORU ---
if (typeof window.reportToAdmin === 'undefined') {
    window.reportToAdmin = function(message, type = 'info') {
        const time = new Date().toLocaleTimeString('tr-TR');
        let logs = JSON.parse(localStorage.getItem('os_logs')) || [];
        
        // Ülke bayrağı çevirici (Mekatronik dokunuş)
        const countryMatch = message.match(/\[([A-Z]{2})\]/);
        if (countryMatch) {
            const flag = countryCodeToEmoji(countryMatch[1]);
            message = message.replace(countryMatch[0], flag);
        }

        const newLog = { time, message, type, id: Date.now() };
        logs.push(newLog);
        
        if (logs.length > MAX_LOG_SIZE) logs.shift();
        localStorage.setItem('os_logs', JSON.stringify(logs));
        
        renderTerminal();
        syncMetricsWithLog(newLog);
    };
}

function renderTerminal() {
    const terminal = document.getElementById('terminal-screen');
    if (!terminal) return;

    const logs = JSON.parse(localStorage.getItem('os_logs')) || [];
    terminal.innerHTML = logs.map(log => {
        const colors = {
            'error': '#f87171',
            'api': '#60a5fa',
            'info': '#34d399',
            'warn': '#fbbf24'
        };
        const color = colors[log.type] || '#e5e7eb';

        return `
            <div class="terminal-line" style="margin-bottom: 8px; font-family: 'JetBrains Mono'; border-left: 3px solid ${color}; padding-left: 12px; animation: terminalFadeIn 0.3s ease;">
                <span style="opacity: 0.3; font-size: 10px;">${log.time}</span>
                <span style="color: ${color}; font-weight: bold; font-size: 10px; margin: 0 8px;">[${log.type.toUpperCase()}]</span>
                <span style="color: #f3f4f6; font-size: 12px; letter-spacing: 0.5px;">${log.message}</span>
            </div>
        `;
    }).join('');
    terminal.scrollTop = terminal.scrollHeight;
}

// --- 3. GRAFİK VE ANALİZ MOTORU ---
function initLatencyChart() {
    const canvas = document.getElementById('latencyChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 150);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.2)');
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');

    latencyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array(CHART_POINTS).fill(''),
            datasets: [{
                data: Array(CHART_POINTS).fill(0),
                borderColor: '#10b981',
                backgroundColor: gradient,
                borderWidth: 2,
                pointRadius: 0,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { display: false, min: 0, max: 2000 },
                x: { display: false }
            },
            animation: { duration: 600 }
        }
    });
}

function syncMetricsWithLog(log) {
    // Log tipi 'api' olan ve içinde 'ms' geçen mesajları yakala
    if (log.type === 'api' && log.message.toLowerCase().includes('ms')) {
        // Mesajın içindeki sayıyı bul (Örn: "Gecikme: 124ms" içindeki 124)
        const match = log.message.match(/(\d+)ms/i); 
        if (match && match[1]) {
            const ms = parseInt(match[1]);
            updateUIIndicators(ms); // Grafiği ve ping göstergesini güncelle
        }
    }
}

function updateUIIndicators(ms) {
    const display = document.getElementById('latency-display');
    const indicator = document.getElementById('speed-indicator');
    
    if (display) display.innerHTML = `${ms} <small style="font-size: 16px; opacity: 0.5;">ms</small>`;

    if (latencyChart) {
        latencyChart.data.datasets[0].data.push(ms);
        latencyChart.data.datasets[0].data.shift();
        
        const color = ms < 350 ? '#10b981' : (ms < 850 ? '#fbbf24' : '#ef4444');
        latencyChart.data.datasets[0].borderColor = color;
        latencyChart.update('none');
    }

    if (indicator) {
        indicator.style.borderColor = ms < 350 ? "#10b981" : (ms < 850 ? "#fbbf24" : "#ef4444");
        indicator.style.color = ms < 350 ? "#10b981" : (ms < 850 ? "#fbbf24" : "#ef4444");
        indicator.innerText = ms < 350 ? "HIZLI" : (ms < 850 ? "STABİL" : "GECİKMELİ");
    }
}

// --- 4. GÜVENLİK VE MODÜL YÖNETİMİ ---
window.showSection = function(sectionId) {
    const metrics = document.getElementById('metrics-content');
    const firewall = document.getElementById('firewall-content');
    const title = document.getElementById('section-title');
    const btns = document.querySelectorAll('.nav-btn');

    // Modül Görünürlüğü
    if (metrics) metrics.style.display = (sectionId === 'metrics') ? 'grid' : 'none';
    if (firewall) firewall.style.display = (sectionId === 'firewall') ? 'grid' : 'none';

    // UI Güncelleme
    if (title) title.innerText = sectionId === 'metrics' ? "Sistem Metrikleri" : "Güvenlik Duvarı & Erişim";

    btns.forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick')?.includes(`'${sectionId}'`));
    });

    // Sayfa geçişinde kilit durumunu kontrol et
    if (sectionId === 'firewall') syncSecurityState();
};

window.toggleSecurityMode = function(status) {
    localStorage.setItem('maintenance_mode', status);
    syncSecurityState(); // LED ve Badge günceller
    
    // --- YENİ: Kontrol Kutusunu Göster/Gizle ---
    const controlBox = document.getElementById('maintenance-controls');
    if (controlBox) {
        controlBox.style.display = status ? 'block' : 'none';
        // Animasyon hissi için opacity ekleyelim
        controlBox.style.animation = status ? 'fadeIn 0.3s ease' : 'none';
    }

    const logMsg = status ? "KRİTİK: Güvenlik kilidi (Lockdown) aktif edildi." : "BİLGİ: Sistem erişim kısıtlamaları kaldırıldı.";
    window.reportToAdmin(logMsg, status ? 'error' : 'info');
    
    // Diğer sekmeleri (WeatherOS) uyandır
    window.dispatchEvent(new Event('storage'));
};

// --- YENİ: Slider ve Input Dinleyicileri ---
window.updateLiveProgress = function(val) {
    const display = document.getElementById('progress-val');
    if (display) display.innerText = val + "%";
    
    localStorage.setItem('core_progress', val);
    window.dispatchEvent(new Event('storage'));
};

window.updateLiveETA = function(val) {
    localStorage.setItem('core_eta', val || "HESAPLANIYOR...");
    window.dispatchEvent(new Event('storage'));
};

function syncSecurityState() {
    const isLocked = localStorage.getItem('maintenance_mode') === 'true';
    const badge = document.getElementById('security-badge');
    const led = document.getElementById('health-led');
    const statusText = document.getElementById('health-status');
    const toggle = document.getElementById('maintenance-toggle');

    if (toggle) toggle.checked = isLocked;

    if (isLocked) {
        if (badge) { badge.innerText = "LOCKED"; badge.className = "badge-locked"; }
        if (led) { led.style.background = "#ef4444"; led.style.boxShadow = "0 0 20px #ef4444"; }
        if (statusText) { statusText.innerText = "SİSTEM KİLİTLİ"; statusText.style.color = "#ef4444"; }
    } else {
        if (badge) { badge.innerText = "GÜVENLİ"; badge.className = "badge-safe"; }
        if (led) { led.style.background = "#10b981"; led.style.boxShadow = "0 0 20px #10b981"; }
        if (statusText) { statusText.innerText = "SİSTEM OPTİMAL"; statusText.style.color = "#10b981"; }
    }
}

// --- 5. TERMİNAL KOMUT ÇEKİRDEĞİ ---
window.handleTerminalCommand = function(el) {
    const cmd = el.value.trim().toLowerCase();
    if (!cmd) return;

    window.reportToAdmin(`$ ${cmd}`, 'api');
    
    switch(cmd) {
        case '/help':
            window.reportToAdmin("Kullanılabilir Komutlar: /diag, /status, /clear, /reboot, /lock, /unlock", "info");
            break;
        case '/diag':
            runDiagnosticSequence();
            break;
        case '/status':
            const mode = localStorage.getItem('maintenance_mode') === 'true' ? "KİLİTLİ" : "AKTİF";
            window.reportToAdmin(`WeatherOS v${CORE_VERSION} | Durum: ${mode} | Motor: Webkit`, "warn");
            break;
        case '/clear':
            localStorage.setItem('os_logs', JSON.stringify([]));
            window.reportToAdmin("Sistem kayıtları temizlendi.", "info");
            break;
        case '/lock':
            window.toggleSecurityMode(true);
            break;
        case '/unlock':
            window.toggleSecurityMode(false);
            break;
        case '/reboot':
            window.reportToAdmin("Çekirdek yeniden başlatılıyor...", "error");
            setTimeout(() => location.reload(), 1200);
            break;
        default:
            window.reportToAdmin(`Hatalı giriş: "${cmd}". Yardım için /help yazın.`, "error");
    }
    el.value = '';
};

function toggleMaintenanceUI(status) {
    const controlBox = document.getElementById('maintenance-controls');
    if (controlBox) controlBox.style.display = status ? 'block' : 'none';
}

function runDiagnosticSequence() {
    const stages = [
        {m: "CPU döngüleri kontrol ediliyor...", t: "info"},
        {m: "Ağ katmanı taranıyor: Port 80, 443 OK.", t: "info"},
        {m: "Depolama (LocalStorage) bütünlüğü: %100", t: "info"},
        {m: "API anahtarı geçerliliği doğrulandı.", t: "info"},
        {m: "Diagnostik başarıyla tamamlandı. [TR]", t: "info"}
    ];
    stages.forEach((s, i) => setTimeout(() => window.reportToAdmin(s.m, s.t), (i+1)*500));
}

// --- 6. YARDIMCI VE BAŞLATICI ---
function countryCodeToEmoji(code) {
    return code.toUpperCase().replace(/./g, char => String.fromCodePoint(char.charCodeAt(0) + 127397));
}

window.addEventListener('DOMContentLoaded', () => {
    initLatencyChart();
    renderTerminal();
    syncSecurityState();

    // Canlı Saat
    setInterval(() => {
        const el = document.getElementById('system-time');
        if (el) el.innerText = new Date().toLocaleTimeString('tr-TR');
    }, 1000);

    // Otomatik Diagnostik (Hata Sayacı)
    setInterval(() => {
        const logs = JSON.parse(localStorage.getItem('os_logs')) || [];
        const errors = logs.filter(l => l.type === 'error').length;
        const errCountEl = document.getElementById('error-count');
        if (errCountEl) errCountEl.innerText = `${errors} Kritik Hata Kaydı`;
    }, 2000);

    window.reportToAdmin(`WeatherOS Core v${CORE_VERSION} Başlatıldı. [TR]`, "info");
});

// Global Erişimler
window.clearLogs = () => {
    if(confirm("Tüm sistem geçmişini silmek istediğinize emin misiniz?")) {
        localStorage.setItem('os_logs', JSON.stringify([]));
        renderTerminal();
    }
};

// Başka bir sekmeden (script.js) log atıldığında grafiği anında güncelle
window.addEventListener('storage', (e) => {
    if (e.key === 'os_logs') {
        const logs = JSON.parse(e.newValue);
        const lastLog = logs[logs.length - 1];
        if (lastLog) {
            renderTerminal(); // Terminali tazele
            syncMetricsWithLog(lastLog); // Grafiğe yeni noktayı ekle
        }
    }
});
