const axios = require('axios');
const readline = require('readline');
const { exec } = require('child_process');
const fs = require('fs');
const chalk = require('chalk');
const notifier = require('node-notifier');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

// --- AYARLAR VE VERİ TABANI ---
const API_KEY = 'db786facb4203f3d034f25e87e1bcf28';
const DATA_FILE = 'hava_durumu_data.json';
let takipInterval = null;
let sonKoordinat = { lat: 37.91, lon: 40.24 };

let ayarlar = { favoriler: [], sonDurumlar: {}, dil: 'tr' };
if (fs.existsSync(DATA_FILE)) {
    try { ayarlar = JSON.parse(fs.readFileSync(DATA_FILE)); } catch (e) {}
}

const veriyiKaydet = () => fs.writeFileSync(DATA_FILE, JSON.stringify(ayarlar, null, 2));

// --- GÖRSEL VE TEKNİK ARAÇLAR ---
const getAQIInfo = (aqi) => {
    const list = ["Mükemmel", "İyi", "Orta", "Zayıf", "Tehlikeli"];
    const colors = [chalk.green, chalk.blue, chalk.yellow, chalk.red, chalk.magenta];
    return colors[aqi - 1](list[aqi - 1]);
};

const radarAc = () => {
    const url = `https://www.windy.com/${sonKoordinat.lat}/${sonKoordinat.lon}?rain,${sonKoordinat.lat},${sonKoordinat.lon},10`;
    console.log(chalk.magenta("\n📡 Canlı Radar tarayıcıda açılıyor..."));
    const start = process.platform == 'darwin' ? 'open' : process.platform == 'win32' ? 'start' : 'xdg-open';
    exec(`${start} ${url}`);
    anaMenu();
};

const grafikCiz = (tahminler) => {
    console.log(chalk.bold.cyan("\n📊 24 SAATLİK ANALİZ (Sıcaklık & Yağış)"));
    console.log(chalk.dim("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
    const temps = tahminler.map(t => t.main.temp);
    const max = Math.max(...temps);
    const min = Math.min(...temps);

    tahminler.forEach(t => {
        const saat = t.dt_txt.split(" ")[1].substring(0, 5);
        const pop = Math.round(t.pop * 100);
        const bar = "█".repeat(Math.round(((t.main.temp - min) / (max - min || 1)) * 12) + 2);
        const rain = pop > 0 ? chalk.blue(` 💧%${pop}`) : "";
        console.log(`${saat} | ${t.main.temp.toFixed(1)}°C ${chalk.yellow(bar)}${rain}`);
    });
};

// --- KOMUT FONKSİYONLARI ---
const yardimGoster = () => {
    console.clear();
    console.log(chalk.bold.white.bgBlue("\n 📖 TAM KOMUT LİSTESİ "));
    console.log(chalk.blue("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
    console.log(chalk.yellow("1. [Şehir]") + "      : Detaylı analiz & Grafik");
    console.log(chalk.yellow("2. radar") + "        : Canlı yağış haritasını açar");
    console.log(chalk.yellow("3. fav [Şehir]") + "  : Favorilere ekler");
    console.log(chalk.yellow("4. fav sil [Ş]") + " : Şehri favoriden çıkarır");
    console.log(chalk.yellow("5. fav temizle") + "  : Tüm listeyi siler");
    console.log(chalk.yellow("6. liste") + "        : Favorileri gösterir");
    console.log(chalk.yellow("7. takip") + "        : Arka plan gözcüsünü açar");
    console.log(chalk.yellow("8. durdur") + "       : Gözcüyü kapatır");
    console.log(chalk.yellow("9. exit") + "         : Uygulamadan çıkar");
    console.log(chalk.blue("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
    console.log(chalk.italic.gray("Geri dönmek için ENTER'a basın..."));
    rl.once('line', () => { console.clear(); anaMenu(); });
};

const havaDurumuSorgula = async (sehir, sessiz = false) => {
    try {
        const res = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${sehir}&appid=${API_KEY}&units=metric&lang=tr`);
        const { coord, name, main, weather, wind, visibility } = res.data;
        sonKoordinat = { lat: coord.lat, lon: coord.lon };

        const aqiRes = await axios.get(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${coord.lat}&lon=${coord.lon}&appid=${API_KEY}`);
        const fRes = await axios.get(`https://api.openweathermap.org/data/2.5/forecast?lat=${coord.lat}&lon=${coord.lon}&appid=${API_KEY}&units=metric&lang=tr`);

        if (!sessiz) console.clear();
        console.log(chalk.bold.white.bgBlue(`   ${name.toUpperCase()} ANALİZ MERKEZİ  `));
        console.log(`${chalk.bold("DURUM:")} ${weather[0].description.toUpperCase()} | ${chalk.bold("AQI:")} ${getAQIInfo(aqiRes.data.list[0].main.aqi)}`);
        console.log(`${chalk.bold("SICAKLIK:")} ${chalk.yellow(main.temp + "°C")} | ${chalk.cyan("Nem:")} %${main.humidity} | ${chalk.cyan("Görüş:")} ${(visibility / 1000).toFixed(1)}km`);
        
        grafikCiz(fRes.data.list.slice(0, 8));
        anaMenu();
    } catch (e) {
        console.log(chalk.red("\n❌ Hata: Şehir bulunamadı."));
        anaMenu();
    }
};

function anaMenu() {
    const mod = takipInterval ? chalk.bgRed.white(" TAKİP AKTİF ") : chalk.bgGreen.black(" HAZIR ");
    console.log(`\n[${mod}] 'yardim' | 'radar' | 'liste' | 'exit'`);
    rl.question(chalk.bold.green('👉 '), (input) => {
        const cmd = input.trim().toLowerCase();
        if (cmd === 'exit') process.exit();
        else if (cmd === 'yardim') yardimGoster();
        else if (cmd === 'radar') radarAc();
        else if (cmd === 'liste') {
            console.log(chalk.yellow("\n⭐ FAVORİLER: " + (ayarlar.favoriler.join(", ") || "Boş")));
            anaMenu();
        } else if (cmd === 'fav temizle') {
            ayarlar.favoriler = []; veriyiKaydet();
            console.log(chalk.red("Favoriler silindi.")); anaMenu();
        } else if (cmd.startsWith('fav sil ')) {
            const s = cmd.replace('fav sil ', '');
            ayarlar.favoriler = ayarlar.favoriler.filter(f => f !== s);
            veriyiKaydet(); console.log(chalk.yellow(`${s} silindi.`)); anaMenu();
        } else if (cmd.startsWith('fav ')) {
            const s = cmd.replace('fav ', '');
            if (!ayarlar.favoriler.includes(s)) ayarlar.favoriler.push(s);
            veriyiKaydet(); console.log(chalk.green(`${s} eklendi.`)); anaMenu();
        } else if (cmd !== "") {
            havaDurumuSorgula(cmd);
        } else { anaMenu(); }
    });
}

// BAŞLAT
console.clear();
console.log(chalk.bold.white.bgMagenta("      WEATHER ULTIMATE v14.0 (HER ŞEY DAHİL)      "));
axios.get('http://ip-api.com/json').then(res => {
    if (res.data.status === 'success') havaDurumuSorgula(res.data.city, true);
    else anaMenu();
}).catch(() => anaMenu());