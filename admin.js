// Admin Ayarlarını Yerel Depolamaya Kaydetme (Simülasyon)
function saveAdminConfig() {
    const config = {
        sunnyList: document.getElementById('sunny-list').value,
        rainyList: document.getElementById('rainy-list').value,
        aiTone: document.getElementById('ai-tone').value,
        blur: document.getElementById('blur-range').value,
        glow: document.getElementById('glow-range').value
    };
    
    localStorage.setItem('adminConfig', JSON.stringify(config));
    console.log("Ayarlar Kaydedildi:", config);
}

// Canlı Önizleme Güncelleme (Görsel Lab)
function updateLivePreview() {
    const blur = document.getElementById('blur-range').value;
    const glow = document.getElementById('glow-range').value;
    
    // Admin panelindeki kartlarda anlık test
    document.querySelectorAll('.admin-card').forEach(card => {
        card.style.backdropFilter = `blur(${blur/2}px)`;
        card.style.boxShadow = `0 0 ${glow}px rgba(59, 130, 246, 0.2)`;
    });
}

// Sayfa Yüklendiğinde Mevcut Ayarları Çek
window.onload = () => {
    // Güvenlik Kontrolü
    if(localStorage.getItem('isLoggedIn') !== 'true') {
        window.location.href = 'index.html'; // Giriş yapılmamışsa ana sayfaya at
    }

    const savedConfig = JSON.parse(localStorage.getItem('adminConfig'));
    if(savedConfig) {
        document.getElementById('sunny-list').value = savedConfig.sunnyList;
        document.getElementById('rainy-list').value = savedConfig.rainyList;
        document.getElementById('ai-tone').value = savedConfig.aiTone;
        document.getElementById('blur-range').value = savedConfig.blur;
        document.getElementById('glow-range').value = savedConfig.glow;
        updateLivePreview();
    }
};