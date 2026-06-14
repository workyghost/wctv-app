import React, { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { 
  Play, 
  Plus, 
  Trash2, 
  Info, 
  Wifi, 
  Tv, 
  ShieldCheck, 
  Activity, 
  Sliders, 
  AlertTriangle,
  Clock,
  Gauge
} from 'lucide-react';

const APP_GUID = "ed3904e8-737b-4a5e-856a-1b0d7a0a94e2";

// Helper to generate a dynamic 12-char alphanumeric session ID
const generateRandomSid = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let sid = '';
  for (let i = 0; i < 12; i++) {
    sid += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return sid;
};

// Preset channels
const PRESET_CHANNELS = [
  {
    id: 'trt-1-dynamic',
    name: 'TRT 1 (Dynamic 2K/1440p)',
    isDynamic: true,
    channelKey: 'trt-1',
    description: 'Resmi tabii.com 2K/1440p Ultra HD Canlı Yayın Akışı'
  },
  {
    id: 'trt-spor-dynamic',
    name: 'TRT Spor (Dynamic 1080p)',
    isDynamic: true,
    channelKey: 'trt-spor',
    description: 'Resmi tabii.com 1080p Full HD Spor Canlı Yayın Akışı'
  },
  {
    id: 'trt-spor-yildiz-dynamic',
    name: 'TRT Spor Yıldız (Dynamic 1080p)',
    isDynamic: true,
    channelKey: 'trt-spor-yildiz',
    description: 'Resmi tabii.com 1080p Canlı Alternatif Spor Akışı'
  },
  {
    id: 'trt-haber-dynamic',
    name: 'TRT Haber (Dynamic 1080p)',
    isDynamic: true,
    channelKey: 'trt-haber',
    description: 'Resmi tabii.com 1080p Canlı Haber Akışı'
  },
  {
    id: 'trt-belgesel-dynamic',
    name: 'TRT Belgesel (Dynamic 1080p)',
    isDynamic: true,
    channelKey: 'trt-belgesel',
    description: 'Resmi tabii.com 1080p Canlı Belgesel Akışı'
  }
];

// Generates virtual master playlist containing all resolutions for ABR
const getVirtualMasterPlaylist = (channel, sid) => {
  if (channel.channelKey === 'trt-1') {
    return `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=8000000,RESOLUTION=2560x1440,NAME="1440p"
https://trt.daioncdn.net/trt-1/master_1440p.m3u8?&sid=${sid}&app=${APP_GUID}&ce=2
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080,NAME="1080p"
https://trt.daioncdn.net/trt-1/master_1080p.m3u8?&sid=${sid}&app=${APP_GUID}&ce=2
#EXT-X-STREAM-INF:BANDWIDTH=3000000,RESOLUTION=1280x720,NAME="720p"
https://trt.daioncdn.net/trt-1/master_720p.m3u8?&sid=${sid}&app=${APP_GUID}&ce=2
#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=854x480,NAME="480p"
https://trt.daioncdn.net/trt-1/master_480p.m3u8?&sid=${sid}&app=${APP_GUID}&ce=2
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360,NAME="360p"
https://trt.daioncdn.net/trt-1/master_360p.m3u8?&sid=${sid}&app=${APP_GUID}&ce=2`;
  } else {
    // Other TRT channels typically cap at 1080p
    return `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080,NAME="1080p"
https://trt.daioncdn.net/${channel.channelKey}/master_1080p.m3u8?&sid=${sid}&app=${APP_GUID}&ce=2
#EXT-X-STREAM-INF:BANDWIDTH=3000000,RESOLUTION=1280x720,NAME="720p"
https://trt.daioncdn.net/${channel.channelKey}/master_720p.m3u8?&sid=${sid}&app=${APP_GUID}&ce=2
#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=854x480,NAME="480p"
https://trt.daioncdn.net/${channel.channelKey}/master_480p.m3u8?&sid=${sid}&app=${APP_GUID}&ce=2
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360,NAME="360p"
https://trt.daioncdn.net/${channel.channelKey}/master_360p.m3u8?&sid=${sid}&app=${APP_GUID}&ce=2`;
  }
};

function App() {
  const [channels, setChannels] = useState(() => {
    const saved = localStorage.getItem('aether_channels');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Clean up BBC channels from saved storage
        const filteredSaved = parsed.filter(c => 
          !c.id.startsWith('bbc') && 
          !c.id.startsWith('cbbc') && 
          !c.id.startsWith('cbeebies')
        );
        // Merge preset channels and user custom channels
        const merged = [...PRESET_CHANNELS];
        filteredSaved.forEach(c => {
          if (!merged.some(m => m.id === c.id)) {
            merged.push(c);
          }
        });
        return merged;
      } catch (e) {
        console.error('Failed to parse saved channels', e);
      }
    }
    return PRESET_CHANNELS;
  });

  const [activeChannelId, setActiveChannelId] = useState(() => {
    return channels[0]?.id || 'trt-1-dynamic';
  });

  // 'auto' or levels discovered dynamically (e.g. index number: 0, 1, 2)
  const [selectedLevelIndex, setSelectedLevelIndex] = useState('auto');
  const [availableLevels, setAvailableLevels] = useState([]);
  
  // Latency / Buffer Mode: 'low', 'balanced', 'stable'
  const [latencyMode, setLatencyMode] = useState('balanced'); 

  const [customName, setCustomName] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  
  // Diagnostics states
  const [hudData, setHudData] = useState({
    status: 'Idle',
    resolution: 'N/A',
    bitrate: 'N/A',
    buffer: '0.0s',
    fps: 0,
    droppedFrames: 0,
    latencyModeName: 'Dengeli',
    isError: false
  });

  const [toast, setToast] = useState('');
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const diagnosticsIntervalRef = useRef(null);

  // Save channels to local storage
  useEffect(() => {
    localStorage.setItem('aether_channels', JSON.stringify(channels));
  }, [channels]);

  // Show toast notification
  const showToast = (message) => {
    setToast(message);
    setTimeout(() => {
      setToast('');
    }, 3500);
  };

  const activeChannel = channels.find(c => c.id === activeChannelId) || channels[0];

  // Effect to load and setup Hls.js player
  useEffect(() => {
    if (!videoRef.current || !activeChannel) return;

    let streamUrl = '';
    let blobUrl = '';
    const sid = generateRandomSid();

    if (activeChannel.isDynamic) {
      // Create virtual master playlist Blob to support Adaptive Bitrate
      const m3u8Content = getVirtualMasterPlaylist(activeChannel, sid);
      const blob = new Blob([m3u8Content], { type: 'application/x-mpegURL' });
      blobUrl = URL.createObjectURL(blob);
      streamUrl = blobUrl;
    } else {
      streamUrl = activeChannel.url;
    }

    console.log('Loading Virtual Stream URL:', streamUrl);

    // Clean up previous Hls instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (diagnosticsIntervalRef.current) {
      clearInterval(diagnosticsIntervalRef.current);
    }

    setAvailableLevels([]);
    setSelectedLevelIndex('auto');
    setHudData(prev => ({ ...prev, status: 'Yükleniyor...', isError: false }));

    if (Hls.isSupported()) {
      // Tune Hls.js parameters based on selected latency/buffer mode
      let hlsConfig = {
        enableWorker: true,
        lowLatencyMode: latencyMode === 'low',
        backBufferLength: 90,
        capLevelToPlayerSize: false
      };

      if (latencyMode === 'low') {
        // Ultra-low latency parameters
        hlsConfig.liveSyncDuration = 5;
        hlsConfig.liveMaxLatencyDuration = 10;
        hlsConfig.maxBufferLength = 10;
      } else if (latencyMode === 'balanced') {
        // Balanced (Recommended for high quality live sports without buffering)
        hlsConfig.liveSyncDuration = 15;
        hlsConfig.liveMaxLatencyDuration = 25;
        hlsConfig.maxBufferLength = 35;
      } else {
        // Safe buffer mode (extremely stable, IPTV stream style)
        hlsConfig.liveSyncDuration = 30;
        hlsConfig.liveMaxLatencyDuration = 50;
        hlsConfig.maxBufferLength = 60;
      }

      const hls = new Hls(hlsConfig);
      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(videoRef.current);

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        // Discover available quality levels from virtual master playlist
        const discovered = hls.levels.map((level, index) => ({
          index,
          name: level.name || `${level.height}p`,
          height: level.height,
          bitrate: level.bitrate
        }));
        
        // Sort levels descending (highest resolution first)
        discovered.sort((a, b) => b.height - a.height);
        setAvailableLevels(discovered);

        videoRef.current.play().catch(err => {
          console.log('Autoplay blocked, waiting for user gesture:', err);
        });
        
        setHudData(prev => ({ ...prev, status: 'Aktif' }));
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          setHudData(prev => ({ ...prev, status: `Hata: ${data.details}`, isError: true }));
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('Fatal network error, trying to recover...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('Fatal media error, trying to recover...');
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              break;
          }
        }
      });

      // Periodic diagnostics collection
      diagnosticsIntervalRef.current = setInterval(() => {
        if (!videoRef.current) return;
        
        let bufferLength = 0;
        const video = videoRef.current;
        if (video.buffered.length > 0) {
          const currentTime = video.currentTime;
          for (let i = 0; i < video.buffered.length; i++) {
            if (currentTime >= video.buffered.start(i) && currentTime <= video.buffered.end(i)) {
              bufferLength = video.buffered.end(i) - currentTime;
              break;
            }
          }
        }

        // Get video track resolution
        const resolution = video.videoWidth && video.videoHeight 
          ? `${video.videoWidth}x${video.videoHeight}` 
          : 'N/A';

        // Calculate current bitrate estimation
        let bitrate = 'N/A';
        const currentLvl = hls.currentLevel;
        if (currentLvl !== -1 && hls.levels[currentLvl]) {
          const levelInfo = hls.levels[currentLvl];
          bitrate = `${(levelInfo.bitrate / 1000000).toFixed(2)} Mbps`;
        }

        // Calculate dropped frames details
        let fps = 0;
        let droppedFrames = 0;
        if (video.getVideoPlaybackQuality) {
          const quality = video.getVideoPlaybackQuality();
          fps = quality.totalVideoFrames > 0 ? Math.round(quality.totalVideoFrames / video.currentTime) : 0;
          droppedFrames = quality.droppedVideoFrames;
        }

        const modeLabels = { low: 'Ultra Düşük Gecikme', balanced: 'Dengeli', stable: 'Süper Stabil' };

        setHudData({
          status: 'Aktif',
          resolution,
          bitrate,
          buffer: `${bufferLength.toFixed(1)}s`,
          fps: isNaN(fps) || fps > 120 ? 60 : fps,
          droppedFrames,
          latencyModeName: modeLabels[latencyMode],
          isError: false
        });
      }, 1000);

    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (mostly Safari)
      videoRef.current.src = streamUrl;
      videoRef.current.addEventListener('loadedmetadata', () => {
        videoRef.current.play().catch(e => console.log('Autoplay blocked:', e));
        setHudData(prev => ({ 
          ...prev, 
          status: 'Aktif (Safari Native)', 
          resolution: `${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`
        }));
      });

      videoRef.current.addEventListener('error', (e) => {
        setHudData(prev => ({ ...prev, status: 'Yükleme Hatası (Native)', isError: true }));
      });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (diagnosticsIntervalRef.current) {
        clearInterval(diagnosticsIntervalRef.current);
      }
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [activeChannelId, latencyMode]);

  // Adjust quality level override
  const handleQualityChange = (levelIdx) => {
    setSelectedLevelIndex(levelIdx);
    if (!hlsRef.current) return;

    if (levelIdx === 'auto') {
      hlsRef.current.currentLevel = -1; // -1 triggers automatic ABR in Hls.js
      showToast('Kalite ayarı "Otomatik (Adaptif)" olarak güncellendi. Ağ hızınıza göre ayarlanacaktır.');
    } else {
      hlsRef.current.currentLevel = levelIdx; // Set Hls.js level directly
      const lvl = hlsRef.current.levels[levelIdx];
      const name = lvl ? (lvl.name || `${lvl.height}p`) : 'Seçilen';
      showToast(`Yayın kalitesi kesin olarak ${name} değerine kilitlendi.`);
    }
  };

  // Handle custom channel submit
  const handleAddChannel = (e) => {
    e.preventDefault();
    if (!customName.trim() || !customUrl.trim()) {
      showToast('Lütfen kanal adı ve URL alanlarını doldurun.');
      return;
    }
    if (!customUrl.toLowerCase().includes('.m3u8')) {
      showToast('UYARI: Girdiğiniz URL geçerli bir m3u8 uzantısı içermiyor olabilir.');
    }

    const newChannel = {
      id: `custom-${Date.now()}`,
      name: customName,
      url: customUrl,
      isDynamic: false,
      description: 'Kullanıcı tarafından eklenen özel IPTV kanalı'
    };

    setChannels(prev => [...prev, newChannel]);
    setActiveChannelId(newChannel.id);
    setCustomName('');
    setCustomUrl('');
    showToast('Yeni kanal başarıyla eklendi!');
  };

  // Handle channel delete
  const handleDeleteChannel = (id, e) => {
    e.stopPropagation(); // Prevent activating deleted channel
    if (id.includes('dynamic')) {
      showToast('Sistem kanalları silinemez.');
      return;
    }
    setChannels(prev => prev.filter(c => c.id !== id));
    if (activeChannelId === id) {
      setActiveChannelId(channels[0]?.id || 'trt-1-dynamic');
    }
    showToast('Kanal listeden kaldırıldı.');
  };

  return (
    <div className="app-container">
      {/* Sidebar Panel */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-glow">
            <Tv className="primary-color" size={20} color="white" />
          </div>
          <div>
            <h1 className="logo-title">WCTV IPTV</h1>
            <div className="logo-subtitle">2K CANLI YAYIN</div>
          </div>
        </div>

        <div className="sidebar-content">
          {/* Channel Select Section */}
          <div>
            <div className="section-title">
              <span>Yayın Kanalları</span>
              <Tv size={14} />
            </div>
            <div className="channel-list">
              {channels.map((channel) => {
                const isActive = channel.id === activeChannelId;
                return (
                  <button
                    key={channel.id}
                    className={`channel-btn ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveChannelId(channel.id)}
                  >
                    <div className="channel-info">
                      <span className="channel-name">{channel.name}</span>
                      <span className="channel-url">
                        {channel.isDynamic ? 'tabii.com CDN' : channel.url}
                      </span>
                    </div>
                    <span className={`channel-badge ${channel.isDynamic ? '' : 'custom'}`}>
                      {channel.isDynamic ? '2K/1080p' : 'IPTV'}
                    </span>
                    {!channel.isDynamic && (
                      <button 
                        className="delete-channel-btn"
                        onClick={(e) => handleDeleteChannel(channel.id, e)}
                        title="Kanalı Sil"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Add Custom Channel Section */}
          <div>
            <div className="section-title">
              <span>Özel Yayın Ekle</span>
              <Plus size={14} />
            </div>
            <form onSubmit={handleAddChannel} className="custom-form">
              <div className="input-group">
                <label className="input-label">Kanal Adı</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Örn: TRT 4K veya Benim Kanalım"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label className="input-label">M3U8 Stream URL</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="https://example.com/live/stream.m3u8"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                />
              </div>
              <button type="submit" className="submit-btn">
                <Plus size={16} />
                Listeye Ekle
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main Stream Window */}
      <main className="main-display">
        <header className="header-bar">
          <div className="header-title-section">
            <h2 className="header-title">{activeChannel?.name}</h2>
            <div className="header-meta">
              <span className="header-badge-live">Canlı</span>
              <span className="header-status">
                <Wifi size={14} />
                {activeChannel?.isDynamic ? 'Premium CDN Bağlantısı (ABR Aktif)' : 'Harici IPTV Akışı'}
              </span>
            </div>
          </div>
          <div>
            <div className="alert-box">
              <ShieldCheck className="alert-icon" size={16} />
              <span>Sanal Master Playlist & Donma Önleyici aktif.</span>
            </div>
          </div>
        </header>

        {/* Video Player Display */}
        <div className="player-wrapper">
          <video 
            ref={videoRef} 
            className="video-element"
            controls
            autoPlay
            playsInline
          />
          
          {/* Diagnostics HUD overlay */}
          <div className="hud-overlay">
            <div className="hud-item">
              <span className="hud-label">Durum:</span>
              <span className="hud-value">
                <span className={`hud-status-dot ${hudData.isError ? 'error' : ''}`}></span>
                {hudData.status}
              </span>
            </div>
            <div className="hud-item">
              <span className="hud-label">Çözünürlük:</span>
              <span className="hud-value">{hudData.resolution}</span>
            </div>
            <div className="hud-item">
              <span className="hud-label">Bitrate:</span>
              <span className="hud-value">{hudData.bitrate}</span>
            </div>
            <div className="hud-item">
              <span className="hud-label">Tampon Bellek:</span>
              <span className="hud-value" style={{ color: parseFloat(hudData.buffer) < 5 ? '#ef4444' : '#10b981' }}>
                {hudData.buffer}
              </span>
            </div>
            <div className="hud-item">
              <span className="hud-label">FPS/Gecikme:</span>
              <span className="hud-value">{hudData.fps} FPS ({hudData.latencyModeName})</span>
            </div>
          </div>
        </div>

        {/* Dynamic Controls Grid */}
        <div className="controls-container">
          {/* Quality Panel */}
          <div className="control-card">
            <h3 className="card-title">
              <Sliders size={18} className="primary-color" />
              Yayın Kalitesi Ayarı
            </h3>
            
            {availableLevels.length > 0 ? (
              <>
                <div className="quality-grid">
                  <button
                    className={`quality-btn ${selectedLevelIndex === 'auto' ? 'active' : ''}`}
                    onClick={() => handleQualityChange('auto')}
                  >
                    <span className="quality-label">Otomatik</span>
                    <span className="quality-desc">Adaptif ABR Entegrasyonu</span>
                  </button>

                  {availableLevels.map((level) => {
                    const is2K = level.height === 1440;
                    return (
                      <button
                        key={level.index}
                        className={`quality-btn ${selectedLevelIndex === level.index ? 'active' : ''}`}
                        onClick={() => handleQualityChange(level.index)}
                      >
                        <span className="quality-label">{is2K ? '1440p (2K)' : `${level.height}p`}</span>
                        <span className="quality-desc">
                          {(level.bitrate / 1000000).toFixed(1)} Mbps Sabit
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="alert-box">
                  <Info className="alert-icon" size={16} />
                  <span>
                    Bant genişliğiniz düşerse <strong>Otomatik</strong> mod yayının takılmasını önlemek için anlık kaliteyi düşürür. 
                    Maçın en net halinde kalması için <strong>1440p (2K)</strong> veya <strong>1080p</strong> kalitelerini manuel sabitleyebilirsiniz.
                  </span>
                </div>
              </>
            ) : (
              <div className="alert-box" style={{ background: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
                <AlertTriangle className="alert-icon" size={16} style={{ color: '#f59e0b' }} />
                <span style={{ color: '#f59e0b' }}>
                  Özel IPTV akışlarında tekil manifest varsa kalite seçimi otomatik belirlenir. Çoklu kalite varsa oynatıcı otomatik listeleyecektir.
                </span>
              </div>
            )}
          </div>

          {/* Latency & Buffer Modes Card */}
          <div className="control-card">
            <h3 className="card-title">
              <Clock size={18} className="primary-color" />
              Gecikme & Donma Engelleme Modu
            </h3>
            <div className="quality-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginBottom: '16px' }}>
              {[
                { key: 'low', label: 'Düşük Gecikme', desc: '5s Gecikme (Riskli)' },
                { key: 'balanced', label: 'Dengeli', desc: '15s Tampon (Önerilen)' },
                { key: 'stable', label: 'Süper Stabil', desc: '30s Tampon (Sıfır Donma)' }
              ].map((mode) => (
                <button
                  key={mode.key}
                  className={`quality-btn ${latencyMode === mode.key ? 'active' : ''}`}
                  onClick={() => {
                    setLatencyMode(mode.key);
                    showToast(`Oynatma modu: ${mode.label} olarak değiştirildi. Yayın yeniden yükleniyor...`);
                  }}
                >
                  <span className="quality-label" style={{ fontSize: '13px' }}>{mode.label}</span>
                  <span className="quality-desc">{mode.desc}</span>
                </button>
              ))}
            </div>
            <div className="details-list">
              <div className="detail-item">
                <span className="detail-label">🎯 Maç Canlı Yayın Önerisi:</span>
                <span className="detail-desc">
                  TRT segmentleri 10 saniye olduğu için donmaları önlemek amacıyla en az 15 saniyelik 
                  <strong> Dengeli</strong> veya <strong> Süper Stabil</strong> mod kullanılması şiddetle tavsiye edilir.
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Toast Alert */}
      {toast && (
        <div className="toast-msg">
          <Info size={16} className="primary-color" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}

export default App;
