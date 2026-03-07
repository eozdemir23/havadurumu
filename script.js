/* WeatherOS v3.3 - Kararlı Final Sürümü */

// 1. GLOBAL DEĞİŞKENLER & KONFİGÜRASYON
const firebaseConfig = {
    apiKey: "AIzaSyCIaCoQtzaMyYMJol0FVSGv6A4eCBIhXx8 ",
    authDomain: "weatheros-auth.firebaseapp.com",
    projectId: "weatheros-auth",
    storageBucket: "weatheros-auth.firebasestorage.app",
    messagingSenderId: "614450364655",
    appId: "1:614450364655:web:48b4d765684443e538db1a"
};

const OPENWEATHER_API_KEY = "db786facb4203f3d034f25e87e1bcf28";

if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const auth = firebase.auth();

let myChart = null;
let map = null;
let fullMap = null;
let radarLayers = [];
let fullRadarLayers = [];
let animationTimer = null; // Global tanımlandı

// 2. MERKEZİ HATA SÖZLÜĞÜ
const WeatherOS_Errors = {
    translate: (error, context = "") => {
        const msg = error.toString().toLowerCase();
        if (msg.includes("404")) return `"${context}" bulunamadı. Lütfen geçerli bir şehir girin.`;
        if (msg.includes("failed to fetch")) return "İnternet bağlantınızı kontrol edin.";
        return "Teknik bir sorun oluştu.";
    }
};

// --- MODAL & UI YÖNETİMİ ---
function showAlert(title, message) {
    const overlay = document.getElementById('os-alert');
    if (!overlay) return;
    document.getElementById('alert-title').innerText = title.toUpperCase();
    document.getElementById('alert-message').innerText = message;
    overlay.classList.add('active');
}

function closeAlert() { document.getElementById('os-alert').classList.remove('active'); }

function toggleSearchModal() {
    const modal = document.getElementById('searchModal');
    if (!modal) return;
    
    const isHidden = modal.style.display === 'none' || modal.style.display === '';
    modal.style.display = isHidden ? 'flex' : 'none';
    
    if (isHidden) { 
        const input = document.getElementById('sehirInput');
        if(input) {
            input.value = ''; 
            input.focus(); 
        }
    }
}

function updateAstronomy(sys) {
    if (!sys) return;

    const now = Math.floor(Date.now() / 1000);
    const sunrise = sys.sunrise;
    const sunset = sys.sunset;

    // Saatleri her zaman yazdır
    document.getElementById('sunrise-time').innerText = new Date(sunrise * 1000).toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'});
    document.getElementById('sunset-time').innerText = new Date(sunset * 1000).toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'});

    const sunPath = document.getElementById('sun-path');
    const sunIcon = document.getElementById('sun-icon');

    if (sunPath && sunIcon) {
        // GÜNDÜZ MÜ?
        if (now >= sunrise && now <= sunset) {
            const total = sunset - sunrise;
            const current = now - sunrise;
            const progress = current / total;

            const pathLength = sunPath.getTotalLength();
            const point = sunPath.getPointAtLength(pathLength * progress);

            sunIcon.setAttribute('cx', point.x);
            sunIcon.setAttribute('cy', point.y);
            sunIcon.style.display = "block"; // Gündüz göster
        } else {
            // GECEYSE: İkonu gizle ama yayı bırak
            sunIcon.style.display = "none";
        }
    }
}

// Arka planı ve animasyonları tetikleyen ana fonksiyon
function arkaPlanGuncelle(durumAna) {
    if (!durumAna) return;
    
    const condition = durumAna.toLowerCase();
    
    // Body sınıfını değiştir (CSS geçişleri için)
    document.body.className = `weather-${condition}`;
    
    // JS tabanlı fiziksel efektleri başlat (Yağmur, Güneş vb.)
    if (typeof createDynamicWeatherEffects === "function") {
        createDynamicWeatherEffects(condition);
    } else {
        console.warn("createDynamicWeatherEffects fonksiyonu bulunamadı.");
    }
}

// --- ANA VERİ MOTORU ---
async function verileriGetir(sehir = null, lat = null, lon = null) {
    // --- 0. BAŞLANGIÇ: Yükleme Hissi (UX) ---
    document.body.style.opacity = "0.7";
    document.body.style.filter = "blur(3px)";
    document.body.style.transition = "all 0.5s ease";

    let temizSehir = sehir ? sehir.trim() : 'Istanbul';
    const searchContext = sehir || (lat ? `${lat.toFixed(2)},${lon.toFixed(2)}` : 'Istanbul');
    
    let url = `/hava?`;
    url += (lat && lon) ? `lat=${lat}&lon=${lon}` : `sehir=${encodeURIComponent(temizSehir)}`;

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(res.status);
        const data = await res.json();

        const cur = data.current;
        
        // --- 1. PREMIUM KAYIT SİSTEMİ ---
        if (cur.name) {
            saveCity(cur.name); 
        }

        // --- 2. ATMOSFERİK MOTOR ---
        arkaPlanGuncelle(cur.weather[0].main);
        
        // --- 3. ANA DEĞERLER & APPLE STYLE ISI ŞERİDİ ---
        updateElementWithAnim('sehirAd', cur.name.toUpperCase());
        updateElementWithAnim('derece', Math.round(cur.main.temp), "°");
        updateElementWithAnim('durum', cur.weather[0].description.toUpperCase());
        
        // Isı Şeridi Hesaplaması (Apple Style)
        // Forecast verisindeki ilk günün (bugün) min/max değerlerini kullanmak en doğrusudur
        const dailyMin = (data.forecast && data.forecast[0]) ? data.forecast[0].main.temp_min : cur.main.temp_min;
        const dailyMax = (data.forecast && data.forecast[0]) ? data.forecast[0].main.temp_max : cur.main.temp_max;
        
        updateTempBar(cur.main.temp, dailyMin, dailyMax);

        // Diğer Statlar
        updateElementWithAnim('humidity', cur.main.humidity, "%");
        updateElementWithAnim('ruzgar', Math.round(cur.wind.speed), " km/s");
        updateElementWithAnim('hissedilen', Math.round(cur.main.feels_like), "°");

        // --- 4. YAĞIŞ & AKILLI BİLDİRİM ---
        const popValue = data.forecast && data.forecast[0] ? Math.round(data.forecast[0].pop * 100) : 0;
        updateElementWithAnim('rainChance', popValue, "%");
        
        if (typeof checkRainAlert === "function") {
            checkRainAlert(popValue);
        }

        // --- 5. MODÜL GÜNCELLEMELERİ ---
        if (data.aqi) updateAQIVisual(data.aqi);
        if (cur.sys && cur.sys.sunrise) updateAstronomy(cur.sys); 
        if (data.uv !== undefined) updateUVVisual(data.uv); 

        // --- 6. ANALİTİK & GRAFİK ---
        oneriUret(cur.main.temp, cur.weather[0].description, popValue);
        
        if (data.forecast && data.forecast.length > 0) {
            grafikCiz(data.forecast);
            renderHaftalik(data.fullForecast || data.forecast);
        }

        initRadar(cur.coord.lat, cur.coord.lon);
        syncRadarToCoords(cur.coord.lat, cur.coord.lon);

        // --- BAŞARI: Efektleri Kaldır ---
        document.body.style.opacity = "1";
        document.body.style.filter = "none";

    } catch (e) {
        console.error("WeatherOS Motor Hatası:", e);
        // Hata durumunda ekranı canlandır ki kullanıcı etkileşime devam edebilsin
        document.body.style.opacity = "1";
        document.body.style.filter = "none";
        
        if (typeof showAlert === "function") {
            showAlert("SİSTEM HATASI", "Veriler alınırken bir sorun oluştu.");
        }
    }
}

/**
 * Apple Style Isı Şeridi Güncelleyici
 */
function updateTempBar(current, min, max) {
    const dot = document.getElementById('temp-dot');
    const minLabel = document.getElementById('min-temp');
    const maxLabel = document.getElementById('max-temp');

    if (!dot || !minLabel || !maxLabel) return;

    minLabel.innerText = Math.round(min) + "°";
    maxLabel.innerText = Math.round(max) + "°";

    let range = max - min;
    if (range <= 0) range = 1; 
    
    let percent = ((current - min) / range) * 100;
    percent = Math.max(2, Math.min(percent, 98));

    dot.style.left = `${percent}%`;

    // Mekatronik dokunuş: Sıcaklığa göre nokta rengini belirle
    if (current >= 30) {
        dot.style.background = "orange";
        dot.style.boxShadow = "0 0 10px orange";
    } else if (current <= 5) {
        dot.style.background = "#00d4ff";
        dot.style.boxShadow = "0 0 10px #00d4ff";
    } else {
        dot.style.background = "white";
        dot.style.boxShadow = "none";
    }
}

// --- RADAR SİSTEMİ (KÜÇÜK VE TAM EKRAN) ---
async function initRadar(lat, lon) {
    // 1. Harita İlk Kurulum veya Merkez Güncelleme
    if (!map) {
        map = L.map('map', { 
            zoomControl: false, 
            attributionControl: false,
            minZoom: 3,
            maxZoom: 18,
            dragging: false, // Küçük widget üzerinde sürüklemeyi kapat (Apple tarzı)
            touchZoom: false,
            scrollWheelZoom: false
        }).setView([lat, lon], 8);
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);
    } else {
        map.setView([lat, lon], 8);
    }

    try {
        // 2. RainViewer Verisi Çekme
        const rvRes = await fetch('/radar-data');
        const timestamps = await rvRes.json();
        
        // Eğer veri yoksa çık
        if (!timestamps || timestamps.length === 0) return;

        // 3. Eski Katmanları Temizle (Bellek Yönetimi)
        radarLayers.forEach(l => map.removeLayer(l));
        radarLayers = [];

        // 4. Son 6 Kareyi Hazırla (Animasyon için)
        // Sadece son kareyi değil, son 6 taneyi döngüye hazır halde ekliyoruz
        const lastFrames = timestamps.slice(-6); 

        radarLayers = lastFrames.map((ts, index) => {
            const radarUrl = `https://tilecache.rainviewer.com/v2/radar/${ts}/256/{z}/{x}/{y}/1/1_1.png`;
            
            const layer = L.tileLayer(radarUrl, { 
                opacity: 0, // Başlangıçta hepsi gizli
                zIndex: 100 + index 
            }).addTo(map);

            return layer;
        });

        // 5. En Güncel Kareyi Görünür Yap
        if (radarLayers.length > 0) {
            radarLayers[radarLayers.length - 1].setOpacity(0.8);
        }

    } catch(e) { 
        console.error("WeatherOS Radar Motoru Hatası:", e); 
    }
}

async function openFullRadar() {
    const modal = document.getElementById('radar-fullscreen'); 
    const fullMapContainer = document.getElementById('full-map');
    
    if (!modal || !fullMapContainer) return;

    // MODAL GÖRÜNÜRLÜK ZIRHLAMA
    modal.style.display = 'flex';
    modal.style.zIndex = '99999'; // En üstte olduğundan emin ol
    modal.style.opacity = '1';
    modal.style.pointerEvents = 'auto'; // Tıklamaları yakala
    document.body.style.overflow = 'hidden';

    // 1. KOORDİNAT HAZIRLIĞI
    let lat = 41.0082, lon = 28.9784; 
    try {
        if (typeof map !== 'undefined' && map) {
            const center = map.getCenter();
            const cLat = parseFloat(center.lat || center[0]);
            const cLon = parseFloat(center.lng || center[1]);
            if (!isNaN(cLat) && !isNaN(cLon)) {
                lat = cLat;
                lon = cLon;
            }
        }
    } catch (e) { console.warn("Harita merkezi alınamadı."); }

    // 2. IFRAME YÖNETİMİ
    let iframe = document.getElementById('windy-frame');
    const windyUrl = `https://embed.windy.com/embed2.html?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&zoom=8&overlay=radar&product=radar&marker=true&metricWind=km/h&metricTemp=%C2%B0C&radarRange=-1`;

    if (!iframe) {
        fullMapContainer.innerHTML = `
            <div class="radar-loading-overlay" style="position: absolute; inset:0; background: #000; display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:100; border-radius:15px;">
                <div class="radar-spinner"></div>
                <p style="color:#a855f7; margin-top:15px; font-family:monospace; font-size:11px;">SİSTEMLER BAĞLANIYOR...</p>
            </div>`;

        iframe = document.createElement('iframe');
        iframe.id = "windy-frame";
        iframe.src = windyUrl;
        iframe.style.width = "100%";
        iframe.style.height = "100%";
        iframe.style.border = "none";
        iframe.style.borderRadius = "15px";
        iframe.style.display = "none"; 

        iframe.onload = () => {
            const loader = fullMapContainer.querySelector('.radar-loading-overlay');
            if (loader) loader.remove();
            iframe.style.display = "block";
        };

        fullMapContainer.appendChild(iframe);
    } else {
        // Eğer zaten varsa sadece konumu güncelle (URL değişince onload tekrar tetiklenir)
        if (iframe.src !== windyUrl) {
            iframe.style.display = "none"; // Yüklenene kadar gizle
            iframe.src = windyUrl;
        }
    }
}

// --- 2. RADAR KAPATMA & BELLEK TEMİZLİĞİ ---
function closeFullRadar() {
    const modal = document.getElementById('radar-fullscreen');
    if (modal) {
        modal.style.display = 'none';
        modal.style.pointerEvents = 'none'; // Tıklama engelini kaldır
    }
    document.body.style.overflow = 'auto'; // Scroll'u kesinlikle geri aç
    
    // Windy frame'i bellekte bırak ama durdur (CPU koruması)
    const iframe = document.getElementById('windy-frame');
    if (iframe) iframe.src = 'about:blank'; 
}


function toggleLayerMenu() {
    document.getElementById('radar-layer-menu').classList.toggle('active');
}

async function changeLayer(type) {
    fullRadarLayers.forEach(l => fullMap.removeLayer(l));
    fullRadarLayers = [];

    if (type === 'precipitation') {
        syncFullRadarLayers();
    } else {
        const layerMap = { 'temp': 'temp_new', 'wind': 'wind_new' };
        const url = `https://tile.openweathermap.org/map/${layerMap[type]}/{z}/{x}/{y}.png?appid=${OPENWEATHER_API_KEY}`;
        const l = L.tileLayer(url, { opacity: 0.7, zIndex: 1000 }).addTo(fullMap);
        fullRadarLayers.push(l);
    }
    setTimeout(toggleLayerMenu, 300);
}

async function syncFullRadarLayers() {
    try {
        const res = await fetch('/radar-data');
        const ts = await res.json();
        const lastTS = ts[ts.length - 1];
        const url = `https://tilecache.rainviewer.com/v2/radar/${lastTS}/256/{z}/{x}/{y}/1/1_1.png`;
        
        fullRadarLayers.forEach(l => fullMap.removeLayer(l));
        fullRadarLayers = [];

        const l = L.tileLayer(url, { opacity: 0.8, zIndex: 1000 }).addTo(fullMap);
        fullRadarLayers.push(l);
    } catch (e) { console.error("Radar URL Hatası"); }
}

function changeWindyLayer(layerName) {
    const iframe = document.getElementById('windy-frame');
    const loader = document.querySelector('.radar-loading-overlay');
    
    if (!iframe) {
        // Eğer radar hiç açılmamışsa önce radarı aç
        openFullRadar().then(() => changeWindyLayer(layerName));
        return;
    }

    try {
        const url = new URL(iframe.src);
        
        // Eğer zaten aynı katmandaysak işlem yapma (Sistem yorulmasın)
        if (url.searchParams.get('overlay') === layerName) return;

        // Katmanı güncelle
        url.searchParams.set('overlay', layerName);
        
        // Kullanıcıya görsel geri bildirim ver (Loading ekranını tekrar göster)
        if (loader) loader.style.display = "flex";
        iframe.style.display = "none";

        // Yeni URL'i yükle
        iframe.src = url.toString();

        // Iframe yüklendiğinde loading ekranını kaldır (Zaten onload event'in vardı)
        iframe.onload = () => {
            if (loader) loader.style.display = "none";
            iframe.style.display = "block";
        };

    } catch (e) {
        console.error("Katman değişim hatası:", e);
    }
}


function syncRadarToCoords(lat, lon) {
    const iframe = document.getElementById('windy-frame');
    if (!iframe) return;

    // Koordinatları zorla sayıya çevir ve kontrol et
    let safeLat = parseFloat(lat);
    let safeLon = parseFloat(lon);

    if (isNaN(safeLat) || isNaN(safeLon)) {
        safeLat = 41.0082; // Hata durumunda İstanbul
        safeLon = 28.9784;
    }

    try {
        const currentUrl = new URL(iframe.src);
        currentUrl.searchParams.set('lat', safeLat.toFixed(4));
        currentUrl.searchParams.set('lon', safeLon.toFixed(4));
        
        if (iframe.src !== currentUrl.toString()) {
            iframe.src = currentUrl.toString();
        }
    } catch (e) {
        console.error("Radar senkronizasyon hatası:", e);
    }
}

function radarOynat() {
    // Eğer tam ekran Windy açıksa, bu fonksiyonu devre dışı bırak (Windy'nin kendi oynatıcısı var)
    if (document.getElementById('radar-fullscreen').style.display === 'flex') {
        console.log("Windy Iframe aktif, yerel animasyon durduruldu.");
        return;
    }

    if (radarLayers.length === 0) return;
    let i = 0;
    const playBtn = document.getElementById('playBtn');

    if (animationTimer) {
        clearInterval(animationTimer);
        animationTimer = null;
        if(playBtn) playBtn.innerText = "▶ OYNAT";
        // Tüm katmanları gizle, sadece sonuncuyu (en güncel) göster
        radarLayers.forEach(l => l.setOpacity(0));
        radarLayers[radarLayers.length - 1].setOpacity(0.8);
        return;
    }

    if(playBtn) playBtn.innerText = "⏸ DURDUR";

    animationTimer = setInterval(() => {
        radarLayers.forEach(l => l.setOpacity(0));
        if (radarLayers[i]) radarLayers[i].setOpacity(0.8);
        i = (i + 1) % radarLayers.length;
    }, 600);
}

// --- YARDIMCI UI FONKSİYONLARI ---
// 1. RAKAMLARIN SAYARAK YÜKSELMESİ (Apple Animation Effect)
function updateElementWithAnim(id, endValue, suffix = "") {
    const el = document.getElementById(id);
    if (!el) return;
    
    // Eğer gelen değer rakam değilse (Örn: "AÇIK"), direkt yaz ve çık
    if (isNaN(endValue)) { 
        el.innerText = `${endValue}${suffix}`; 
        return; 
    }

    const startValue = 0;
    const duration = 1200; // 1.2 saniye sürsün
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease-out formülü: Hareket sona doğru yavaşlar, daha doğal durur
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.floor(easeOut * endValue);
        
        el.innerText = `${currentValue}${suffix}`;

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    requestAnimationFrame(update);
}

// 2. AQI GÜNCELLEME (Kayan Nokta ve Durum Metni)
function updateAQIVisual(val) {
    const dot = document.getElementById('aqi-progress');
    const statusText = document.getElementById('aqi-status-text'); // HTML'de bu ID olduğundan emin ol
    const labels = ["MÜKEMMEL", "İYİ", "ORTA", "ZAYIF", "KÖTÜ"];
    
    if (dot) {
        // Barın soluna (left) %5 ile %95 arası bir değer veriyoruz
        const position = (val - 1) * 21.25 + 7.5; 
        dot.style.left = position + "%";
        dot.style.width = "10px"; 
    }

    if (statusText) {
        statusText.innerText = labels[val - 1] || "BİLİNMİYOR";
        
        // Renk değişimi (Opsiyonel: Metin rengini de AQI durumuna göre günceller)
        const colors = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#a855f7"];
        statusText.style.color = colors[val - 1] || "white";
    }
}

function saatiGuncelle() {
    const el = document.getElementById('liveTime');
    if (el) el.innerText = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function createDynamicWeatherEffects(condition) {
    const bgContainer = document.getElementById('weather-bg-canvas');
    if (!bgContainer) return;
    
    bgContainer.innerHTML = ''; 
    const cond = condition.toLowerCase();

    // ☀️ GÜNEŞLİ (Clear)
    if (cond.includes('clear')) {
        const sun = document.createElement('div');
        sun.className = 'sun-sphere';
        bgContainer.appendChild(sun);
        
        // Hafif lens parlaması etkisi için ikinci bir katman
        const glow = document.createElement('div');
        glow.className = 'sun-glow-overlay';
        bgContainer.appendChild(glow);
    }

    // ☁️ BULUTLU (Clouds)
    else if (cond.includes('cloud')) {
        // 3 farklı derinlikte yavaşça süzülen bulut katmanları
        for (let i = 0; i < 4; i++) {
            const cloud = document.createElement('div');
            cloud.className = 'cloud-layer';
            cloud.style.top = (10 + i * 20) + 'vh';
            cloud.style.animationDuration = (50 + i * 25) + 's';
            cloud.style.opacity = (0.05 + (i * 0.04));
            bgContainer.appendChild(cloud);
        }
    }

    // 🌧️ YAĞMURLU (Rain / Drizzle)
    else if (cond.includes('rain') || cond.includes('drizzle')) {
        for (let i = 0; i < 120; i++) {
            const drop = document.createElement('div');
            drop.className = 'rain-drop';
            drop.style.left = Math.random() * 100 + 'vw';
            drop.style.animationDuration = (Math.random() * 0.4 + 0.4) + 's';
            drop.style.animationDelay = Math.random() * 2 + 's';
            bgContainer.appendChild(drop);
        }
    }

    // ❄️ KARLI (Snow)
    else if (cond.includes('snow')) {
        for (let i = 0; i < 60; i++) {
            const flake = document.createElement('div');
            flake.className = 'snow-flake';
            flake.style.left = Math.random() * 100 + 'vw';
            flake.style.opacity = Math.random();
            flake.style.animationDuration = (Math.random() * 3 + 5) + 's';
            flake.style.animationDelay = Math.random() * 5 + 's';
            bgContainer.appendChild(flake);
        }
    }

    // ⚡ ŞİMŞEK (Thunderstorm)
if (cond.includes('thunderstorm')) {
        createDynamicWeatherEffects('rain');
        
        // Önceki flash döngülerini temizlemek için bir ID atayalım
        if (window.thunderTimeout) clearTimeout(window.thunderTimeout);

        const flash = () => {
            // Sadece hava hala fırtınalıysa ve body sınıfı değişmemişse çalış
            if (document.body.classList.contains('weather-thunderstorm')) {
                if (Math.random() > 0.94) {
                    bgContainer.style.backgroundColor = 'rgba(255,255,255,0.15)';
                    setTimeout(() => bgContainer.style.backgroundColor = 'transparent', 80);
                }
                window.thunderTimeout = setTimeout(flash, 400);
            }
        };
        flash();
    }
}


async function sehirOnerileriGetir() {
    const input = document.getElementById('sehirInput');
    const list = document.getElementById('suggestions');
    
    if (!input || input.value.length < 2) {
        list.innerHTML = '<div class="suggestion-item" style="color: rgba(255,255,255,0.3); justify-content: center;">Aramaya başlayın...</div>';
        return;
    }

    try {
        const res = await fetch(`/search?q=${input.value}`);
        const cities = await res.json();
        
        if (cities.length === 0) {
            list.innerHTML = '<div class="suggestion-item">Sonuç bulunamadı</div>';
            return;
        }

        list.innerHTML = cities.map(c => `
            <div class="suggestion-item" onclick="verileriGetir('${c.name}'); toggleSearchModal();">
                <i class="fas fa-location-dot"></i>
                <div style="display: flex; flex-direction: column;">
                    <span>${c.display}</span>
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error("Öneri hatası:", e);
    }
}

function grafikCiz(forecastData) {
    const ctx = document.getElementById('weatherChart');
    if (!ctx || !forecastData) return;
    if (myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: forecastData.slice(0, 8).map(i => new Date(i.dt * 1000).getHours() + ":00"),
            datasets: [{ data: forecastData.slice(0, 8).map(i => Math.round(i.main.temp)), borderColor: '#a855f7', tension: 0.4, fill: true }]
        },
        options: { plugins: { legend: false }, scales: { y: { display: false } } }
    });
}

function renderHaftalik(list) {
    const container = document.getElementById('weeklyForecast');
    if (!container || !list) return;

    const now = new Date().getHours();

    container.innerHTML = list.slice(0, 10).map((gun, index) => {
        const date = new Date(gun.dt * 1000);
        const hourValue = date.getHours();
        
        // İlk elemanı "Şimdi" olarak işaretle (Apple Tarzı)
        const hourDisplay = index === 0 ? "Şimdi" : `${hourValue}:00`;
        
        const temp = Math.round(gun.main.temp);
        const pop = Math.round(gun.pop * 100); 
        const wind = Math.round(gun.wind.speed);
        const icon = gun.weather[0].icon;

        // Yağış rengini vurgula (%20 altını gösterme ki kalabalık yapmasın)
        const popColor = pop > 50 ? '#00d4ff' : '#a0a0a0';

        return `
            <div class="forecast-item" style="scroll-snap-align: start; flex: 0 0 85px;">
                <span class="forecast-time" style="font-weight: ${index === 0 ? '700' : '400'}">${hourDisplay}</span>
                
                <span class="forecast-pop" style="color: ${popColor}; font-size: 10px; height: 12px;">
                    ${pop > 10 ? '%' + pop : ''}
                </span>
                
                <img src="https://openweathermap.org/img/wn/${icon}@2x.png" 
                     alt="weather" 
                     style="width: 45px; height: 45px; margin: 5px 0;">
                
                <span class="forecast-temp-val" style="font-size: 19px; font-weight: 700; letter-spacing: -1px;">${temp}°</span>
                
                <div class="forecast-wind-row" style="display: flex; align-items: center; gap: 3px; margin-top: 5px; opacity: 0.6;">
                    <i class="fas fa-wind" style="font-size: 8px;"></i>
                    <span style="font-size: 9px; font-weight: 500;">${wind}<small>km/s</small></span>
                </div>
            </div>
        `;
    }).join('');
}

function oneriUret(temp, desc, pop) {
    let msg = temp < 12 ? "Sıkı giyinmelisin." : "Hava dengeli.";
    if (pop > 30) msg = "Şemsiye almalısın.";
    const el = document.getElementById('suggestionText');
    if (el) el.innerText = msg;
}

function focusOnCurrentLoc() {
    if (!navigator.geolocation) {
        showAlert("DESTEKLENMİYOR", "Tarayıcınız konum servislerini desteklemiyor.");
        return;
    }

    // Kullanıcıya işlemin başladığını hissettirmek için bir feedback verilebilir
    console.log("Konum verisi okunuyor...");

    navigator.geolocation.getCurrentPosition(
        pos => {
            const lat = parseFloat(pos.coords.latitude);
            const lon = parseFloat(pos.coords.longitude);

            if (!isNaN(lat) && !isNaN(lon)) {
                // 1. KÜÇÜK HARİTAYI GÜNCELLE (Leaflet)
                if (map) {
                    map.flyTo([lat, lon], 10, {
                        animate: true,
                        duration: 1.5
                    });
                }

                // 2. TAM EKRAN RADARI GÜNCELLE (Merkezi Fonksiyon Kullanımı)
                // Daha önce tanımladığın bu fonksiyonu çağırmak DRY (Don't Repeat Yourself) prensibine uygundur
                syncRadarToCoords(lat, lon);

                // 3. HAVA DURUMU VERİLERİNİ GÜNCELLE
                verileriGetir(null, lat, lon);
            }
        },
        err => {
            // Hata koduna göre daha spesifik mesajlar
            let errorMsg = "Konum alınamadı.";
            if (err.code === 1) errorMsg = "Konum izni reddedildi.";
            else if (err.code === 3) errorMsg = "Konum isteği zaman aşımına uğradı.";
            
            console.warn(`Hata: ${errorMsg}`);
            showAlert("KONUM HATASI", errorMsg);
            
            // Hata durumunda varsayılan merkeze dön
            verileriGetir('Istanbul');
        },
        { 
            enableHighAccuracy: true, 
            timeout: 8000, // Biraz daha toleranslı bir süre
            maximumAge: 0 
        }
    );
}

// 1. YAĞIŞ BİLDİRİM SİSTEMİ (Apple Style Alert)
function checkRainAlert(popValue) {
    const alertPanel = document.getElementById('rain-alert');
    const alertText = document.getElementById('rain-alert-text');
    if (!alertPanel) return;

    if (popValue >= 40) {
        alertPanel.style.display = 'flex';
        alertPanel.classList.remove('hide'); // Varsa önceki kapanış sınıfını kaldır
        alertText.innerText = `Önümüzdeki saatlerde %${popValue} ihtimalle yağış bekleniyor.`;
        
        // 8 Saniye sonra otomatik kapat
        setTimeout(() => {
            alertPanel.classList.add('hide'); // CSS'teki slideUp animasyonunu tetikler
            setTimeout(() => { alertPanel.style.display = 'none'; }, 500);
        }, 8000);
    } else {
        alertPanel.style.display = 'none';
    }
}

// 2. UV İNDEKSİ GÖRSELLEŞTİRME
function updateUVVisual(uvVal) {
    const uvText = document.getElementById('uv-value');
    const uvDesc = document.getElementById('uv-description');
    const uvDot = document.getElementById('uv-progress');
    
    if (!uvText || !uvDot) return;

    // Değeri yazdır
    uvText.innerText = Math.round(uvVal);

    // Durum metni ve renk belirleme
    let desc = "DÜŞÜK";
    let color = "#10b981"; // Yeşil
    if (uvVal >= 3) { desc = "ORTA"; color = "#f59e0b"; }
    if (uvVal >= 6) { desc = "YÜKSEK"; color = "#ef4444"; }
    if (uvVal >= 8) { desc = "ÇOK YÜKSEK"; color = "#a855f7"; }

    uvDesc.innerText = desc;
    uvDesc.style.color = color;

    // Noktanın pozisyonu (0-11 arası ölçeklendirildi)
    const position = Math.min((uvVal / 11) * 100, 95);
    uvDot.style.left = `${position}%`;
}

let savedCities = JSON.parse(localStorage.getItem('weatherOS_cities')) || [];

// 1. Şehri Listeye Ekle
async function saveCity(cityName) {
    if (!cityName) return;
    
    // Büyük-küçük harf duyarlılığını kaldır (Duble kayıt engelleme)
    const isAlreadySaved = savedCities.some(c => c.toLowerCase() === cityName.toLowerCase());
    
    if (isAlreadySaved) return;
    
    savedCities.push(cityName);
    localStorage.setItem('weatherOS_cities', JSON.stringify(savedCities));
    renderCityCards();
}

// 2. Şehir Kartlarını Oluştur (API Verisiyle)
async function renderCityCards() {
    const container = document.getElementById('saved-cities-list');
    if (!container) return;

    // Yükleniyor animasyonu (Shimmer Effect) için boşalt
    container.innerHTML = '<div class="loading-shimmer">Şehirler güncelleniyor...</div>';

    const cardsHTML = await Promise.all(savedCities.map(async (city) => {
        try {
            const res = await fetch(`/hava?sehir=${encodeURIComponent(city)}`);
            const data = await res.json();
            const cur = data.current;
            const condition = cur.weather[0].main.toLowerCase();

            // Her şehir için özel bir kart şablonu (Zirve Tasarım)
            return `
                <div class="city-card ${condition}" onclick="verileriGetir('${city}'); toggleCityManager();">
                    <div class="city-card-overlay"></div>
                    <div class="city-info-left">
                        <span class="card-time">${new Date().toLocaleTimeString('tr-TR', {hour:'2-digit', minute:'2-digit'})}</span>
                        <h3>${cur.name}</h3>
                        <p>${cur.weather[0].description.toUpperCase()}</p>
                    </div>
                    <div class="city-info-right">
                        <div class="card-temp">${Math.round(cur.main.temp)}°</div>
                        <div class="card-hi-lo">Y:${Math.round(cur.main.temp_max)}°  A:${Math.round(cur.main.temp_min)}°</div>
                    </div>
                    <button class="delete-city-btn" onclick="event.stopPropagation(); removeCity('${city}')">
                        <i class="fas fa-minus-circle"></i>
                    </button>
                </div>
            `;
        } catch (e) {
            return `<div class="city-card error"><h3>${city}</h3><p>Veri alınamadı</p></div>`;
        }
    }));

    container.innerHTML = cardsHTML.join('');
}

// 3. Şehri Sil
function removeCity(city) {
    savedCities = savedCities.filter(c => c !== city);
    localStorage.setItem('weatherOS_cities', JSON.stringify(savedCities));
    renderCityCards();
}

// Modal aç/kapat
function toggleCityManager() {
    const modal = document.getElementById('city-manager');
    modal.classList.toggle('active');
    if(modal.classList.contains('active')) renderCityCards();
}


// 4. BAŞLATICI
window.addEventListener('load', () => {
    saatiGuncelle();
    initNavigation(); // Navigasyonu bağla
    setInterval(saatiGuncelle, 60000);
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            p => verileriGetir(null, p.coords.latitude, p.coords.longitude),
            () => verileriGetir('Istanbul')
        );
    } else { verileriGetir('Istanbul'); }
});

function initNavigation() {
    const searchBtn = document.querySelector('.search-circle');
    const searchWrapper = document.querySelector('.search-wrapper');

    // Hem daireye hem de dışındaki kapsayıcıya tıklanabilir yapalım
    if (searchBtn) {
        searchBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Diğer eventleri tetiklemesin
            toggleSearchModal();
        });
    }

    if (searchWrapper) {
        searchWrapper.addEventListener('click', () => {
            toggleSearchModal();
        });
    }
}
