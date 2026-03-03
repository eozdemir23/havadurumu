/* WeatherOS v2.3 - Global Logic Engine (Full & Stable) */

// 1. FIREBASE YAPILANDIRMASI
const firebaseConfig = {
    apiKey: "AIzaSyCIaCoQtzaMyYMJol0FVSGv6A4eCBIhXx8",
    authDomain: "weatheros-auth.firebaseapp.com",
    projectId: "weatheros-auth",
    storageBucket: "weatheros-auth.firebasestorage.app",
    messagingSenderId: "614450364655",
    appId: "1:614450364655:web:48b4d765684443e538db1a",
    measurementId: "G-JC1G3T937E"
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
    modal.style.display = (modal.style.display === 'flex') ? 'none' : 'flex';
    if (modal.style.display === 'flex') document.getElementById('sehirInput').focus();
}

function toggleAdminModal() {
    const modal = document.getElementById('adminModal');
    if (!modal) return;
    modal.style.display = (modal.style.display === 'flex') ? 'none' : 'flex';
}

// --- GOOGLE LOGIN ---
function googleLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();
    const errorMsg = document.getElementById('loginError');
    
    auth.signInWithPopup(provider).then((result) => {
        const ADMIN_EMAIL = "meozdemir2362@gmail.com"; 
        if (result.user.email === ADMIN_EMAIL) {
            alert("🛡️ KERNEL ACCESS GRANTED: " + result.user.displayName);
            toggleAdminModal();
        } else {
            if (errorMsg) {
                errorMsg.innerText = "⚠️ YETKİSİZ HESAP: " + result.user.email;
                errorMsg.style.display = 'block';
            }
            auth.signOut();
        }
    }).catch(e => console.error("Login Error:", e));
}

// --- ANA VERİ MOTORU ---
async function verileriGetir(sehir = null, lat = null, lon = null) {
    const inputSehir = sehir || 'Istanbul';
    let url = `/hava?`;
    url += (lat && lon) ? `lat=${lat}&lon=${lon}` : `sehir=${encodeURIComponent(inputSehir)}`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.error) return;

        const cur = data.current;
        
        // UI GÜNCELLEME
        document.getElementById('sehirAd').innerText = cur.name.toUpperCase();
        document.getElementById('derece').innerText = Math.round(cur.main.temp) + "°";
        document.getElementById('durum').innerText = cur.weather[0].description.toUpperCase();
        document.getElementById('humidity').innerText = "%" + cur.main.humidity;
        document.getElementById('ruzgar').innerText = cur.wind.speed + " m/s";
        document.getElementById('hissedilen').innerText = Math.round(cur.main.feels_like) + "°";
        
        const popValue = data.forecast && data.forecast[0] ? (data.forecast[0].pop * 100).toFixed(0) : "0";
        document.getElementById('rainChance').innerText = popValue + "%";

        // Alt Modüller
        updateAQIVisual(data.aqi || 1);
        oneriUret(cur.main.temp, cur.weather[0].description, popValue);
        grafikCiz(data.forecast);
        renderHaftalik(data.fullForecast || data.forecast);
        initRadar(cur.coord.lat, cur.coord.lon);

    } catch (e) { console.error("WeatherOS Kernel Error:", e); }
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
        const cities = await res.json();
        list.innerHTML = cities.map(city => `
            <div class="suggestion-item" onclick="verileriGetir('${city.name}'); toggleSearchModal();">
                ${city.display}
            </div>
        `).join('');
    } catch (e) { console.error("Search API Error:", e); }
}

// --- GRAFİK MOTORU ---
function grafikCiz(forecastData) {
    const ctx = document.getElementById('weatherChart');
    if (!ctx || !forecastData) return;
    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: forecastData.map(i => new Date(i.dt * 1000).getHours() + ":00"),
            datasets: [{
                data: forecastData.map(i => Math.round(i.main.temp)),
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                tension: 0.4,
                pointRadius: 0,
                borderWidth: 2,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { 
                x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 10 } } },
                y: { display: false }
            }
        }
    });
}

// --- ANALİZ & ÖNERİ ---
function oneriUret(temp, desc, pop) {
    const el = document.getElementById('suggestionText');
    if (!el) return;
    
    let msg = "Hava şu an dengeli, keyfini çıkar.";
    if (temp < 10) msg = "Hava soğuk, kat kat giyinmeyi ihmal etme.";
    else if (temp > 25) msg = "Sıcak bir gün, bol su içmeyi unutma.";
    if (pop > 40) msg = "Yağmur ihtimali var, yanına bir şemsiye al.";
    
    el.innerText = msg;
}

// --- HAVA KALİTESİ ---
function updateAQIVisual(val) {
    const bar = document.getElementById('aqi-progress');
    const badge = document.getElementById('aqiBadge');
    const colors = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];
    if (bar && badge) {
        bar.style.width = (val * 20) + "%";
        bar.style.backgroundColor = colors[val - 1] || colors[0];
        badge.innerText = "HAVA KALİTESİ: " + (["Mükemmel", "İyi", "Orta", "Zayıf", "Kötü"][val-1] || "Bilinmiyor");
    }
}

// --- RADAR SİSTEMİ ---
async function initRadar(lat, lon) {
    if (map) { map.remove(); }
    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([lat, lon], 8);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);

    try {
        const rvRes = await fetch('https://api.rainviewer.com/public/maps.json');
        const timestamps = await rvRes.json();
        const last10 = timestamps.slice(-10);
        radarLayers = last10.map(ts => {
            const layer = L.tileLayer(`https://tilecache.rainviewer.com/v2/radar/${ts}/256/{z}/{x}/{y}/2/1_1.png`, { opacity: 0, zIndex: 100 });
            layer.addTo(map);
            return layer;
        });
        if (radarLayers.length > 0) radarLayers[radarLayers.length - 1].setOpacity(0.8);
    } catch(e) { console.error("Radar Error:", e); }
}

function radarOynat() {
    const btn = document.getElementById('playBtn');
    if (!radarLayers.length) return;
    if (animationTimer) {
        clearInterval(animationTimer);
        animationTimer = null;
        btn.innerText = "▶ Oynat";
        return;
    }
    btn.innerText = "⏸ Durdur";
    animationTimer = setInterval(() => {
        radarLayers[currentFrameIndex].setOpacity(0);
        currentFrameIndex = (currentFrameIndex + 1) % radarLayers.length;
        radarLayers[currentFrameIndex].setOpacity(0.8);
    }, 600);
}

// --- HAFTALIK TAHMİN ---
function renderHaftalik(list) {
    const container = document.getElementById('weeklyForecast');
    if (!container || !list) return;
    container.innerHTML = '';
    const daily = list.filter((item, index) => index % 8 === 0).slice(0, 5);
    daily.forEach(gun => {
        const gunAd = new Date(gun.dt * 1000).toLocaleDateString('tr-TR', { weekday: 'short' }).toUpperCase();
        container.innerHTML += `
            <div class="forecast-item">
                <span style="font-size:9px; opacity: 0.5; font-weight: 700;">${gunAd}</span>
                <img src="https://openweathermap.org/img/wn/${gun.weather[0].icon}@2x.png" width="40">
                <p style="font-size: 14px; font-weight: 600;">${Math.round(gun.main.temp)}°</p>
            </div>`;
    });
}

// --- SAAT & BAŞLATMA ---
function saatiGuncelle() {
    const el = document.getElementById('liveTime');
    if (el) el.innerText = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

window.onload = () => {
    saatiGuncelle();
    setInterval(saatiGuncelle, 1000);
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            pos => verileriGetir(null, pos.coords.latitude, pos.coords.longitude),
            () => verileriGetir('Istanbul')
        );
    } else { verileriGetir('Istanbul'); }
};