const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors());

app.use(express.static(__dirname));

// Kendi API anahtarını buraya koy
const API_KEY = 'db786facb4203f3d034f25e87e1bcf28'; 

// 1. HAVA DURUMU VE TAHMİN VERİSİ
app.get('/hava', async (req, res) => {
    const sehir = req.query.sehir || 'Ankara';
    try {
        // Güncel hava durumu
        const currentRes = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${sehir}&appid=${API_KEY}&units=metric&lang=tr`);
        const { lat, lon } = currentRes.data.coord;

        // Hava Kalitesi (AQI)
        const aqiRes = await axios.get(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`);
        
        // 5 Günlük / 3 Saatlik Tahmin (Yağış olasılığı buradan gelir)
        const forecastRes = await axios.get(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=tr`);

        res.json({
            current: currentRes.data,
            aqi: aqiRes.data.list[0].main.aqi,
            forecast: forecastRes.data.list.slice(0, 8) // İlk 24 saatlik veriyi gönderir
        });
    } catch (error) {
        res.status(404).json({ error: "Şehir bulunamadı" });
    }
});

app.get('/search', async (req, res) => {
    const query = req.query.q;
    if (!query || query.length < 2) return res.json([]);

    try {
        // Geniş bir liste çekiyoruz (limit 20)
        const geoRes = await axios.get(`http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=20&appid=${API_KEY}`);
        
        let results = geoRes.data.map(item => ({
            name: item.name,
            // Display kısmına yerel ismi de ekleyelim (varsa)
            local: item.local_names && item.local_names.tr ? item.local_names.tr : item.name,
            display: `${item.name}${item.state ? ', ' + item.state : ''} (${item.country})`,
            country: item.country
        }));

        // 🔥 KESİN SIRALAMA: Türkiye (TR) her zaman 1 numara!
        results.sort((a, b) => {
            if (a.country === 'TR' && b.country !== 'TR') return -1;
            if (a.country !== 'TR' && b.country === 'TR') return 1;
            return 0;
        });

        res.json(results.slice(0, 5)); // En iyi 5'i gönder
    } catch (e) {
        res.status(500).json([]);
    }
});

app.listen(3000, () => {
    console.log("🚀 Sunucu 3000 portunda çalışıyor...");
});