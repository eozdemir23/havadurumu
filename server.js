/* WeatherOS 1.0 - Backend Kernel
    Engine: Node.js + Express
    Purpose: Data Proxy & Multi-Source Routing
*/

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.static(__dirname));

// SİSTEM ANAHTARI (WeatherOS Core Key)
const API_KEY = 'db786facb4203f3d034f25e87e1bcf28'; 

// 1. ANA HAVA DURUMU MOTORU
app.get('/hava', async (req, res) => {
    // 1. Parametreleri alıyoruz (lat/lon veya sehir)
    const { sehir, lat, lon } = req.query;
    const API_KEY = "db786facb4203f3d034f25e87e1bcf28"; // API KEY'in burada tanımlı olduğundan emin ol

    try {
        let currentUrl;
        
        // 2. Dinamik Kaynak Belirleme
        if (lat && lon && lat !== "undefined" && lon !== "undefined") {
            // Koordinat varsa (Örn: Konum izni verildiğinde)
            currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=tr`;
        } else {
            // Şehir ismi varsa veya varsayılan Istanbul
            const rawCity = sehir || 'Istanbul';
            const searchCity = rawCity.split(',')[0].trim();
            currentUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(searchCity)}&appid=${API_KEY}&units=metric&lang=tr`;
        }

        // 3. Mevcut Hava Durumunu Çek
        const currentRes = await axios.get(currentUrl);
        
        // OpenWeather bazen 'coord' objesini farklı seviyede dönebilir, güvenli alalım
        const cLat = currentRes.data.coord.lat;
        const cLon = currentRes.data.coord.lon;

        // 4. PARALEL VERİ ÇEKİMİ
        const [aqiRes, forecastRes] = await Promise.all([
            axios.get(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${cLat}&lon=${cLon}&appid=${API_KEY}`),
            axios.get(`https://api.openweathermap.org/data/2.5/forecast?lat=${cLat}&lon=${cLon}&appid=${API_KEY}&units=metric&lang=tr`)
        ]);

        // 5. Veri Paketleme (WeatherOS Standart Formatı)
        res.json({
            current: currentRes.data,
            aqi: aqiRes.data.list[0].main.aqi,
            forecast: forecastRes.data.list.slice(0, 8),
            fullForecast: forecastRes.data.list
        });

    } catch (error) {
        // Hata ayıklama için konsola detay yazdır
        console.error("WeatherOS Server Error Detayı:", error.response ? error.response.data : error.message);
        
        // 404 yerine daha açıklayıcı bir hata dönelim
        const statusCode = error.response ? error.response.status : 500;
        res.status(statusCode).json({ 
            error: "Hava durumu verisi alınamadı.",
            detail: error.message 
        });
    }
});

// 2. AKILLI ŞEHİR ARAMA (Türkiye Öncelikli Algoritma)
app.get('/search', async (req, res) => {
    const query = req.query.q;
    if (!query || query.length < 2) return res.json([]);

    try {
        const geoRes = await axios.get(`http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=15&appid=${API_KEY}`);
        
        let results = geoRes.data.map(item => ({
            name: item.name,
            display: `${item.local_names?.tr || item.name}${item.state ? ', ' + item.state : ''} (${item.country})`,
            country: item.country
        }));

        // TR Öncelikli Sıralama Mantığı
        results.sort((a, b) => {
            if (a.country === 'TR' && b.country !== 'TR') return -1;
            if (a.country !== 'TR' && b.country === 'TR') return 1;
            return 0;
        });

        res.json(results.slice(0, 6)); // En alakalı 6 sonucu gönder
    } catch (e) {
        console.error("Search API Error:", e.message);
        res.status(500).json([]);
    }
});


let lastValidRadarTimestamps = [];

app.get('/radar-data', async (req, res) => {
    try {
        // RainViewer API bazen yavaş olduğu için timeout'u 8 saniyeye çıkardım
        const rvRes = await axios.get('https://api.rainviewer.com/public/maps.json', { timeout: 8000 });
        
        // RainViewer maps.json direkt dizi (array) döndürür
        if (Array.isArray(rvRes.data) && rvRes.data.length > 0) {
            lastValidRadarTimestamps = rvRes.data; // Veri sağlamsa önbelleğe al
            return res.json(rvRes.data);
        }
        
        throw new Error("Boş veri döndü");

    } catch (error) {
        console.warn("⚠️ Radar API Gecikmesi:", error.message);
        
        // Eğer API boş dönerse veya hata verirse son başarılı veriyi gönder
        if (lastValidRadarTimestamps.length > 0) {
            console.log("🔄 Önbellekteki eski radar verisi servis ediliyor.");
            return res.json(lastValidRadarTimestamps);
        }
        
        res.json([]); // Hiç veri yoksa boş dön
    }
});

// 3. SİSTEM BAŞLATMA
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
    -------------------------------------------
    🚀 WeatherOS Kernel v1.0 Aktif!
    📡 Port: ${PORT}
    🏠 Adres: http://localhost:${PORT}
    -------------------------------------------
    `);
});
