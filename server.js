const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const chalk = require('chalk');

const app = express();

// --- AYARLAR ---
const API_KEY = 'db786facb4203f3d034f25e87e1bcf28';
const PORT = process.env.PORT || 3000;

// Middleware (Ara Yazılımlar)
app.use(cors());
app.use(express.static(__dirname));

// --- API ROTLARI ---

// 1. Hava Durumu ve Tahmin Verisi
app.get('/hava', async (req, res) => {
    const sehir = req.query.sehir || 'Diyarbakir';
    try {
        // Güncel Hava Durumu
        const currentRes = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(sehir)}&appid=${API_KEY}&units=metric&lang=tr`);
        const { lat, lon } = currentRes.data.coord;

        // Hava Kalitesi (AQI)
        const aqiRes = await axios.get(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`);
        
        // 5 Günlük / 3 Saatlik Tahmin (İlk 8 kayıt = 24 saat)
        const forecastRes = await axios.get(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=tr`);

        res.json({
            current: currentRes.data,
            aqi: aqiRes.data.list[0].main.aqi,
            forecast: forecastRes.data.list.slice(0, 8)
        });
    } catch (error) {
        console.error(chalk.red("❌ Hava durumu hatası:"), error.message);
        res.status(404).json({ error: "Şehir bulunamadı veya API hatası." });
    }
});

// 2. Şehir Arama ve Önerileri (TR Öncelikli)
app.get('/search', async (req, res) => {
    const query = req.query.q;
    if (!query || query.length < 2) return res.json([]);

    try {
        const geoRes = await axios.get(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=10&appid=${API_KEY}`);
        
        let results = geoRes.data.map(item => ({
            name: item.name,
            display: `${item.name}${item.state ? ', ' + item.state : ''} (${item.country})`,
            country: item.country
        }));

        // Türkiye (TR) sonuçlarını en üste taşıma mantığı
        results.sort((a, b) => {
            if (a.country === 'TR' && b.country !== 'TR') return -1;
            if (a.country !== 'TR' && b.country === 'TR') return 1;
            return 0;
        });

        res.json(results.slice(0, 5));
    } catch (e) {
        res.status(500).json([]);
    }
});

// --- SUNUCUYU BAŞLAT ---
app.listen(PORT, () => {
    console.clear();
    console.log(chalk.bold.white.bgMagenta(" ☁️  WEATHER VISION PRO v2026 SUNUCUSU BAŞLATILDI  "));
    console.log(chalk.blue("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
    console.log(chalk.green(`✅ Port: ${PORT}`));
    console.log(chalk.yellow(`🌸 Nevruz Bayramı Teması Aktif!`));
    console.log(chalk.cyan(`📍 Adres: http://localhost:${PORT}`));
    console.log(chalk.blue("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
});