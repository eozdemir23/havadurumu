let myChart = null;
let map = null;
const API_KEY = 'db786facb4203f3d034f25e87e1bcf28';

// 1) Dinamik Video Arka Plan Listesi
const weatherVideos = {
    'Clear': 'https://assets.mixkit.co/videos/preview/mixkit-clouds-floating-in-the-blue-sky-511-large.mp4',
    'Clouds': 'https://assets.mixkit.co/videos/preview/mixkit-timelapse-of-clouds-in-a-blue-sky-622-large.mp4',
    'Rain': 'https://assets.mixkit.co/videos/preview/mixkit-rain-drops-falling-on-a-window-pane-2332-large.mp4',
    'Snow': 'https://assets.mixkit.co/videos/preview/mixkit-snowy-mountain-landscape-1210-large.mp4',
    'Thunderstorm': 'https://assets.mixkit.co/videos/preview/mixkit-thunderstorm-with-lightning-flashes-and-rain-2845-large.mp4'
};

async function verileriGetir() {
    const sehir = document.getElementById('sehirInput').value || 'Diyarbakir';
    try {
        const res = await fetch(`${window.location.origin}/hava?sehir=${sehir}`);
        const data = await res.json();
        
        // UI Güncelleme
        document.getElementById('sehirAd').innerText = data.current.name.toUpperCase();
        document.getElementById('derece').innerText = Math.round(data.current.main.temp) + "°";
        document.getElementById('durum').innerText = data.current.weather[0].description;
        
        // Video Güncelleme
        const mainWeather = data.current.weather[0].main;
        const videoSrc = weatherVideos[mainWeather] || weatherVideos['Clear'];
        const videoElement = document.getElementById('bgVideo');
        videoElement.src = videoSrc;

        // Sağlık Paneli
        const aqiTag = document.getElementById('aqiBadge');
        aqiTag.innerText = `AQI: ${data.aqi}`;
        document.getElementById('healthAdvice').innerText = data.healthAdvice;

        // Haftalık Tahmin
        const container = document.getElementById('forecastContainer');
        container.innerHTML = data.weekly.map(day => `
            <div class="forecast-card">
                <p style="font-size:11px">${new Date(day.dt * 1000).toLocaleDateString('tr-TR', {weekday:'short'})}</p>
                <img src="https://openweathermap.org/img/wn/${day.weather[0].icon}.png">
                <p>${Math.round(day.main.temp)}°</p>
            </div>
        `).join('');

        // Harita & Grafik (Önceki fonksiyonlarını buraya ekleyebilirsin)
        grafikCiz(data.hourly);
        haritayiGuncelle(data.current.coord.lat, data.current.coord.lon);
        
    } catch (e) { console.error("Hata:", e); }
}

// Favori Ekleme Fonksiyonu (Local Storage)
function favoriEkle() {
    const sehir = document.getElementById('sehirAd').innerText;
    let favs = JSON.parse(localStorage.getItem('favCities') || '[]');
    if(!favs.includes(sehir)) {
        favs.push(sehir);
        localStorage.setItem('favCities', JSON.stringify(favs));
        renderFavs();
    }
}

function renderFavs() {
    const bar = document.getElementById('favBar');
    let favs = JSON.parse(localStorage.getItem('favCities') || '[]');
    bar.innerHTML = favs.map(f => `<div class="fav-item" onclick="document.getElementById('sehirInput').value='${f}'; verileriGetir();">${f}</div>`).join('');
}

// Paylaşım Fonksiyonu
function paylas() {
    const text = `${document.getElementById('sehirAd').innerText} şu an ${document.getElementById('derece').innerText}! Weather Vision 2026 ile kontrol et.`;
    if (navigator.share) {
        navigator.share({ title: 'Hava Durumu', text: text, url: window.location.href });
    }
}

window.onload = () => { verileriGetir(); renderFavs(); };