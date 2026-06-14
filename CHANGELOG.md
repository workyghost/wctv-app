# Changelog

All notable changes to this project will be documented in this file.

## [1.4.0] - 2026-06-14

### Added
- **Mobil Safari/Chrome Dinamik Kalite Seçimi**: Safari ve diğer iOS/mobil native HLS oynatıcıları için manuel çözünürlük seçimi (1440p, 1080p, 720p, 480p, 360p) aktif edildi. Kullanıcı mobil cihazda bir kaliteyi kilitlediğinde oynatıcı artık yeni kalite manifestini dinamik olarak yeniden yükler.

### Fixed
- **Mobil Autoplay Engeli (Deadlock) Çözümü**: Mobil cihazlarda yayının yüklenmemesi ve siyah dairenin (spinner) sürekli dönmesi sorunu çözüldü. JSX'teki `<video>` elementine varsayılan olarak `muted` niteliği ve JS tarafında `src` atanmadan önce `videoEl.muted = true` eklenerek tarayıcının autoplay politikaları sağlandı, metadatanın başarıyla indirilmesi ve sessiz otomatik oynatmanın başlaması garantilendi.
- **Masaüstü (Desktop) Sürümü Tam Ekrandan Otomatik Çıkma Sorunu**: Masaüstünde tam ekrana geçildiğinde tetiklenen `resize` olayından ötürü yön kontrol fonksiyonunun (`checkOrientation`) yayını tam ekrandan atma bug'ı düzeltildi. Masaüstü tarayıcılarda yön kontrolü erkenden sonlanır (`return`).
- **Bellek Sızıntısı & Olay Dinleyici Temizliği**: Kanal geçişlerinde veya yayın yenilemelerinde video elementinde biriken olay dinleyicilerinin (`loadedmetadata` ve `error`) `useEffect` temizleme fonksiyonu ile güvenle kaldırılması sağlandı.

### Changed
- Sistem genelindeki versiyon numarası `1.4.0` olarak güncellendi (`App.jsx` ve `package.json`).
- `README.md` belgesi yeni mobil özellikler ve mimari değişiklikler ile güncellendi.
