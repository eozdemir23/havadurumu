/* WeatherOS v3.0 - Global Logic Engine (Full & Stable) 
   Debugged for: Chart lifecycle, Radar layer management, and Modal centering.
*/

// 1. FIREBASE YAPILANDIRMASI
const firebaseConfig = {
    apiKey: "AIzaSyCIaCoQtzaMyYMJol0FVSGv6A4eCBIhXx8",
    authDomain: "weatheros-auth.firebaseapp.com",
    projectId: "weatheros-auth",
    storageBucket: "weatheros-auth.firebasestorage.app",
    messagingSenderId: "614450364655",
    appId: "1:614450364655:web:48b4d765684443e538db1a"
};

if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const auth = firebase.auth();

// 2. GLOBAL DEĞİŞKENLER
let myChart = null;
let map = null;
let radarLayers = [];
let currentFrameIndex = 0;
let animationTimer = null;

// --- MODAL YÖNETİMİ ---
function toggleSearchModal() {
    const modal = document.getElementById('searchModal');
    if (!modal) return;
    
    // CSS'de 'active' class kullanımı veya direkt display kontrolü
    const isHidden = modal.style.display === 'none' || modal.style.display === '';
    modal.style.display = isHidden ? 'flex' : 'none';
    
    if (isHidden) {
        document.getElementById('sehirInput').value = '';
        document.getElementById('sehirInput').focus();
    }
}

function toggleAdminModal() {
    const modal = document.getElementById('adminModal');
    if (!modal) return;
    modal.style.display = (modal.style.display === 'flex') ? 'none' : 'flex';
}

// --- ANA VERİ MOTORU ---
async function verileriGetir(sehir = null, lat = null, lon = null) {
    const inputSehir = sehir || 'Istanbul';
    let url = `/hava?`;
    url += (lat && lon) ? `lat=${lat}&lon=${lon}` : `sehir=${encodeURIComponent(inputSehir)}`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        const cur = data.current;
        
        // UI GÜNCELLEME (DOM Güvenliği ile)
        updateElementText('sehirAd', cur.name.toUpperCase());
        updateElementText('derece', Math.round(cur.main.temp) + "°");
        updateElementText('durum', cur.weather[0].description.toUpperCase());
        updateElementText('humidity', "%" + cur.main.humidity);
        updateElementText('ruzgar', cur.wind.speed + " m/s");
        updateElementText('hissedilen', Math.round(cur.main.feels_like) + "°");
        
        const popValue = data.forecast && data.forecast[0] ? (data.forecast[0].pop * 100).toFixed(0) : "0";
        updateElementText('rainChance', popValue + "%");

        // Alt Modülleri Çalıştır
        updateAQIVisual(data.aqi || 1);
        oneriUret(cur.main.temp, cur.weather[0].description, popValue);
        grafikCiz(data.forecast);
        renderHaftalik(data.fullForecast || data.forecast);
        initRadar(cur.coord.lat, cur.coord.lon);

    } catch (e) { 
        console.error("WeatherOS Kernel Error:", e);
    }
}

// Yardımcı Fonksiyon: Element var mı kontrol et ve güncelle
function updateElementText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}

// --- ARAMA ÖNERİLERİ ---
async function sehirOnerileriGetir() {
    const input = document.getElementById('sehirInput');
    const list = document.getElementById('suggestions');
    if (!input || !list) return;

    const query = input.value.trim();
    if (query.length < 2) { list.innerHTML = ''; return; }

    try {
        const res = await fetch(`/search?q=${encodeURIComponent(query)}`);
        if (!res.ok) return; // Yanıt gelmeden kanal kapanırsa durdur
        const cities = await res.json();
     list.innerHTML = cities.map(city => `
    <div class="suggestion-item" onclick="verileriGetir('${city.name}'); toggleSearchModal();">
        ${city.display}
    </div>
`).join('');
    } catch (e) { console.error("Search API Error:", e); }
}

// --- GRAFİK MOTORU (Fix: Lifecycle Management) ---
function grafikCiz(forecastData) {
    const ctx = document.getElementById('weatherChart');
    if (!ctx || !forecastData) return;
    
    // Eski grafiği bellekten temizle (Üst üste binmeyi engeller)
    if (myChart) {
        myChart.destroy();
    }

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: forecastData.slice(0, 8).map(i => new Date(i.dt * 1000).getHours() + ":00"),
            datasets: [{
                data: forecastData.slice(0, 8).map(i => Math.round(i.main.temp)),
                borderColor: '#a855f7',
                backgroundColor: 'rgba(168, 85, 247, 0.15)',
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#a855f7',
                borderWidth: 3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { 
                x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } } },
                y: { display: false }
            }
        }
    });
}

// --- RADAR SİSTEMİ (Fix: Backend Proxy Kullanımı) ---
async function initRadar(lat, lon) {
    // 1. Haritayı yok etmek yerine sadece görünümü güncelle (Daha performanslı)
    if (!map) {
        map = L.map('map', { zoomControl: false, attributionControl: false }).setView([lat, lon], 8);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);
    } else {
        map.setView([lat, lon], 8);
    }

    try {
        const rvRes = await fetch('/radar-data'); 
        const timestamps = await rvRes.json();
        
        if (!Array.isArray(timestamps) || timestamps.length === 0) {
            console.error("❌ Radar verisi alınamadı.");
            return;
        }

        // 2. ESKİ KATMANLARI TAMAMEN TEMİZLE
        if (radarLayers && radarLayers.length > 0) {
            radarLayers.forEach(layer => map.removeLayer(layer));
            radarLayers = []; // Referansları sıfırla (Bellek dostu)
        }

        const last10 = timestamps.slice(-10);
        
        // 3. KATMANLARI OLUŞTUR VE DİZİYE EKLE
        radarLayers = last10.map((ts, index) => {
            const layer = L.tileLayer(`https://tilecache.rainviewer.com/v2/radar/${ts}/256/{z}/{x}/{y}/2/1_1.png`, { 
                opacity: 0, 
                zIndex: 100 + index // Her kareyi bir üst seviyeye koy
            });
            layer.addTo(map);
            return layer;
        });

        // 4. SON KAREYİ GÖSTER (VARSAYILAN DURUM)
        if (radarLayers.length > 0) {
            currentFrameIndex = radarLayers.length - 1;
            radarLayers[currentFrameIndex].setOpacity(0.8);
        }

        console.log(`✅ Radar: ${last10.length} kare başarıyla yüklendi.`);

    } catch(e) { 
        console.error("Radar Sync Error:", e); 
    }
}

function radarOynat() {
    const btn = document.getElementById('playBtn');
    if (!radarLayers || radarLayers.length === 0) return;

    // 1. DURDURMA MANTIĞI: En güncel veriye dön
    if (animationTimer) {
        clearInterval(animationTimer);
        animationTimer = null;
        btn.innerText = "▶ OYNAT";
        
        // Tüm kareleri temizle, sadece en son (güncel) kareyi bırak
        radarLayers.forEach(l => l.setOpacity(0));
        radarLayers[radarLayers.length - 1].setOpacity(0.8);
        return;
    }

    // 2. BAŞLATMA MANTIĞI: İdeal hız 450ms
    btn.innerText = "⑊ DURDUR"; // Daha modern bir ikon
    let frame = 0;

    animationTimer = setInterval(() => {
        // Bir önceki kareyi yumuşakça gizle
        radarLayers.forEach(l => l.setOpacity(0));
        
        // Mevcut kareyi göster
        radarLayers[frame].setOpacity(0.8);
        
        // Döngüyü ilerlet
        frame = (frame + 1) % radarLayers.length;
    }, 450); // İDEAL HIZ: 450ms
}

// --- HAVA KALİTESİ VİZÜALİZASYONU ---
function updateAQIVisual(val) {
    const bar = document.getElementById('aqi-progress');
    const badge = document.getElementById('aqiBadge');
    const colors = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#a855f7"];
    const labels = ["Mükemmel", "İyi", "Orta", "Zayıf", "Kötü"];
    
    if (bar && badge) {
        bar.style.width = (val * 20) + "%";
        bar.style.backgroundColor = colors[val - 1] || colors[0];
        badge.innerText = "HAVA KALİTESİ: " + (labels[val-1] || "Bilinmiyor");
    }
}

// --- HAFTALIK TAHMİN RENDER ---
function renderHaftalik(list) {
    const container = document.getElementById('weeklyForecast');
    if (!container) return;
    
    // Performans için önce temizleyelim
    container.innerHTML = '';

    // 12:00 verilerini al (7 günlük tahmin)
    const daily = list.filter(item => item.dt_txt.includes("12:00:00")).slice(0, 5);

    daily.forEach(gun => {
        const date = new Date(gun.dt * 1000);
        const gunAd = date.toLocaleDateString('tr-TR', { weekday: 'short' }).toUpperCase();
        
        // Elementi manuel oluşturup append etmek her zaman daha stabil çalışır
        const div = document.createElement('div');
        div.className = 'forecast-item';
        div.innerHTML = `
            <span class="forecast-day">${gunAd}</span>
            <div class="forecast-icon">
                <img src="https://openweathermap.org/img/wn/${gun.weather[0].icon}@2x.png" loading="lazy">
            </div>
            <span class="forecast-temp">${Math.round(gun.main.temp)}°</span>
        `;
        container.appendChild(div);
    });
}

// --- SAAT & BAŞLATMA ---
function saatiGuncelle() {
    const el = document.getElementById('liveTime');
    if (el) {
        const simdi = new Date();
        el.innerText = simdi.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    }
}

function oneriUret(temp, desc, pop) {
    const el = document.getElementById('suggestionText');
    if (!el) return;
    let msg = "Hava şu an dengeli, keyfini çıkar.";
    if (temp < 12) msg = "Hava oldukça soğuk, sıkı giyinmelisin.";
    else if (temp > 28) msg = "Sıcak bir gün, güneş kremi ve suyun yanında olsun.";
    if (pop > 30) msg = "Yağmur ihtimali var, bir şemsiye bulundurmak akıllıca olur.";
    el.innerText = msg;
}

window.addEventListener('load', () => {
    saatiGuncelle();
    setInterval(saatiGuncelle, 60000);
    
    // Geolocation isteğini hata yakalamalı yapalım
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            pos => {
                verileriGetir(null, pos.coords.latitude, pos.coords.longitude)
                    .catch(err => console.error("Konum verisi işlenemedi:", err));
            },
            () => verileriGetir('Istanbul')
        );
    } else { 
        verileriGetir('Istanbul'); 
    }
});