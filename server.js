const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const chalk = require('chalk');

const app = express();

// --- AYARLAR ---
const API_KEY = 'db786facb4203f3d034f25e87e1bcf28';
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(__dirname));

// --- YARDIMCI FONKSİYONLAR ---
// Hava kalitesine göre sağlık tavsiyesi oluşturur
const getHealthAdvice = (aqi) => {
    const advices = [
        "Hava mükemmel! Dışarıda vakit geçirmek için harika bir gün. 🏃‍♂️",
        "Hava kalitesi iyi, normal aktivitelerinize devam edebilirsiniz. 😊",
        "Hassas gruplar için hafif riskli. Maske bulundurmak faydalı olabilir. 😷",
        "Hava kalitesi düşük. Uzun süreli dış mekan aktivitelerinden kaçının. 🏠",
        "Hava çok kirli! Pencereleri kapalı tutun ve mecbur kalmadıkça çıkmayın. ⚠️"
    ];
    return advices[aqi - 1] || "Veri alınamıyor.";
};

// --- API ROTLARI ---

app.get('/hava', async (req, res) => {
    const sehir = req.query.sehir || 'Diyarbakir';
    try {
        // 1. Güncel Hava Durumu
        const currentRes = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(sehir)}&appid=${API_KEY}&units=metric&lang=tr`);
        const { lat, lon } = currentRes.data.coord;

        // 2. Hava Kalitesi (AQI)
        const aqiRes = await axios.get(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`);
        const aqiVal = aqiRes.data.list[0].main.aqi;

        // 3. 5 Günlük Tahmin (Tüm liste)
        const forecastRes = await axios.get(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=tr`);

        // Haftalık tahmin için veriyi filtrele (Her günün öğle saatini al: 12:00)
        const weeklyForecast = forecastRes.data.list.filter(item => item.dt_txt.includes("12:00:00"));

        res.json({
            current: currentRes.data,
            aqi: aqiVal,
            healthAdvice: getHealthAdvice(aqiVal),
            hourly: forecastRes.data.list.slice(0, 8), // 24 saatlik grafik için
            weekly: weeklyForecast // 7 (veya 5) günlük kartlar için
        });
    } catch (error) {
        console.error(chalk.red("❌ API Hatası:"), error.message);
        res.status(404).json({ error: "Veri çekilemedi." });
    }
});

app.get('/search', async (req, res) => {
    const query = req.query.q;
    if (!query || query.length < 2) return res.json([]);
    try {
        const geoRes = await axios.get(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=5&appid=${API_KEY}`);
        res.json(geoRes.data.map(item => ({
            name: item.name,
            display: `${item.name}${item.state ? ', ' + item.state : ''} (${item.country})`,
            country: item.country
        })));
    } catch (e) { res.json([]); }
});

// --- BAŞLAT ---
app.listen(PORT, () => {
    console.clear();
    console.log(chalk.bold.white.bgMagenta(" ☁️  WEATHER VISION PRO v2026 - ENGINE ONLINE "));
    console.log(chalk.blue("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
    console.log(chalk.green(`✅ Port: ${PORT} üzerinden dinleniyor...`));
    console.log(chalk.yellow(`🚀 Render & Local Deployment Hazır!`));
    console.log(chalk.blue("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
});