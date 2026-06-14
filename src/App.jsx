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
  Gauge,
  RefreshCw
} from 'lucide-react';

// Version 1.1.1 - Autoplay Fallback & CI Webhook Integration
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
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const proxyBase = `${origin}/trt-proxy`;
  if (channel.channelKey === 'trt-1') {
    return `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=8000000,RESOLUTION=2560x1440,NAME="1440p"
${proxyBase}/trt-1/master_1440p.m3u8?&sid=${sid}&app=${APP_GUID}&ce=2
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080,NAME="1080p"
${proxyBase}/trt-1/master_1080p.m3u8?&sid=${sid}&app=${APP_GUID}&ce=2
#EXT-X-STREAM-INF:BANDWIDTH=3000000,RESOLUTION=1280x720,NAME="720p"
${proxyBase}/trt-1/master_720p.m3u8?&sid=${sid}&app=${APP_GUID}&ce=2
#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=854x480,NAME="480p"
${proxyBase}/trt-1/master_480p.m3u8?&sid=${sid}&app=${APP_GUID}&ce=2
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360,NAME="360p"
${proxyBase}/trt-1/master_360p.m3u8?&sid=${sid}&app=${APP_GUID}&ce=2`;
  } else {
    // Other TRT channels typically cap at 1080p
    return `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080,NAME="1080p"
${proxyBase}/${channel.channelKey}/master_1080p.m3u8?&sid=${sid}&app=${APP_GUID}&ce=2
#EXT-X-STREAM-INF:BANDWIDTH=3000000,RESOLUTION=1280x720,NAME="720p"
${proxyBase}/${channel.channelKey}/master_720p.m3u8?&sid=${sid}&app=${APP_GUID}&ce=2
#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=854x480,NAME="480p"
${proxyBase}/${channel.channelKey}/master_480p.m3u8?&sid=${sid}&app=${APP_GUID}&ce=2
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360,NAME="360p"
${proxyBase}/${channel.channelKey}/master_360p.m3u8?&sid=${sid}&app=${APP_GUID}&ce=2`;
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

  // Auto-healing and self-ping states
  const [autoHealingEnabled, setAutoHealingEnabled] = useState(true);
  const [pingLatency, setPingLatency] = useState(null);
  const [pingStatus, setPingStatus] = useState('healthy'); // 'healthy', 'checking', 'error', 'disabled'
  const [reloadCount, setReloadCount] = useState(0);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  const lastTimeRef = useRef(0);
  const stallCountRef = useRef(0);
  const autoHealingEnabledRef = useRef(true);

  // Sync auto-healing toggle ref to avoid restarting the player on settings change
  useEffect(() => {
    autoHealingEnabledRef.current = autoHealingEnabled;
  }, [autoHealingEnabled]);

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

    // Periodic diagnostics & self-ping collection (Runs for both Hls.js and Native player)
    let tickCount = 0;
    lastTimeRef.current = 0;
    stallCountRef.current = 0;

    diagnosticsIntervalRef.current = setInterval(() => {
      if (!videoRef.current) return;
      const video = videoRef.current;
      tickCount++;

      // 1. STALL & AUTO-HEAL CHECK (every second)
      // Check if video is playing (i.e. is not paused, not ended, and has readyState >= 2)
      if (video.readyState >= 2 && !video.paused && !video.ended) {
        if (video.currentTime === lastTimeRef.current) {
          stallCountRef.current += 1;
          
          if (autoHealingEnabledRef.current && stallCountRef.current >= 12) {
            console.log('[Stream Monitor] Stall limit reached (12s). Initiating Auto-Heal...');
            showToast('Yayın donması algılandı! Donma koruması yayını otomatik olarak tazeliyor...');
            setReloadCount(r => r + 1);
            setReloadTrigger(t => t + 1);
            stallCountRef.current = 0;
            return;
          }
        } else {
          lastTimeRef.current = video.currentTime;
          stallCountRef.current = 0;
        }
      } else {
        // Reset stall counter if paused, ended, or not ready
        stallCountRef.current = 0;
        lastTimeRef.current = video.currentTime;
      }

      // 2. SELF-PING CONNECTION CHECK (every 8 seconds)
      if (tickCount % 8 === 0) {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const proxyBase = `${origin}/trt-proxy`;
        const pingUrl = activeChannel.isDynamic
          ? `${proxyBase}/${activeChannel.channelKey}/master_1080p.m3u8?&sid=${sid}&app=${APP_GUID}&ce=2`
          : activeChannel.url;

        setPingStatus('checking');
        const startTime = performance.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        fetch(pingUrl, { method: 'HEAD', mode: 'no-cors', signal: controller.signal })
          .then(() => {
            clearTimeout(timeoutId);
            const duration = Math.round(performance.now() - startTime);
            setPingLatency(duration);
            setPingStatus('healthy');
          })
          .catch((err) => {
            clearTimeout(timeoutId);
            console.warn('[Stream Monitor] Ping check failed:', err);
            setPingLatency(null);
            setPingStatus('error');

            // Fast-track auto-heal if ping fails AND we are already seeing some stall (>= 5s)
            if (autoHealingEnabledRef.current && stallCountRef.current >= 5) {
              console.log('[Stream Monitor] Network check failed and stall active. Triggering fast Auto-Heal...');
              showToast('Bağlantı kesintisi ve donma algılandı! Yayın otomatik yenileniyor...');
              setReloadCount(r => r + 1);
              setReloadTrigger(t => t + 1);
              stallCountRef.current = 0;
            }
          });
      }

      // 3. REGULAR HUD DIAGNOSTICS UPDATE (every second)
      let bufferLength = 0;
      if (video.buffered.length > 0) {
        const currentTime = video.currentTime;
        for (let i = 0; i < video.buffered.length; i++) {
          if (currentTime >= video.buffered.start(i) && currentTime <= video.buffered.end(i)) {
            bufferLength = video.buffered.end(i) - currentTime;
            break;
          }
        }
      }

      const resolution = video.videoWidth && video.videoHeight 
        ? `${video.videoWidth}x${video.videoHeight}` 
        : 'N/A';

      let bitrate = 'N/A';
      if (hlsRef.current) {
        const currentLvl = hlsRef.current.currentLevel;
        if (currentLvl !== -1 && hlsRef.current.levels[currentLvl]) {
          const levelInfo = hlsRef.current.levels[currentLvl];
          bitrate = `${(levelInfo.bitrate / 1000000).toFixed(2)} Mbps`;
        }
      }

      let fps = 0;
      let droppedFrames = 0;
      if (video.getVideoPlaybackQuality) {
        const quality = video.getVideoPlaybackQuality();
        fps = quality.totalVideoFrames > 0 ? Math.round(quality.totalVideoFrames / video.currentTime) : 0;
        droppedFrames = quality.droppedVideoFrames;
      }

      const modeLabels = { low: 'Ultra Düşük Gecikme', balanced: 'Dengeli', stable: 'Süper Stabil' };

      setHudData(prev => ({
        status: hlsRef.current ? 'Aktif' : 'Aktif (Safari Native)',
        resolution,
        bitrate,
        buffer: `${bufferLength.toFixed(1)}s`,
        fps: isNaN(fps) || fps > 120 ? 60 : fps,
        droppedFrames,
        latencyModeName: modeLabels[latencyMode] || 'Bilinmiyor',
        isError: prev.isError
      }));
    }, 1000);

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
  }, [activeChannelId, latencyMode, reloadTrigger]);

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
            <div className="alert-box flex-align-center">
              <ShieldCheck className="alert-icon" size={16} />
              <span>Sanal Master Playlist & Donma Önleyici aktif.</span>
              <span className={`header-ping-badge ${pingStatus}`}>
                <span className="ping-badge-dot"></span>
                <span>{pingStatus === 'healthy' ? `${pingLatency} ms` : pingStatus === 'checking' ? 'Ölçülüyor...' : 'Kesinti'}</span>
              </span>
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
            muted
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
            <div className="hud-item">
              <span className="hud-label">Ping / Kurtarma:</span>
              <span className="hud-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className={`hud-status-dot ${pingStatus}`}></span>
                {pingStatus === 'healthy' ? `${pingLatency} ms` : pingStatus === 'checking' ? 'Ölçülüyor' : 'Kesinti'} 
                {reloadCount > 0 && ` (${reloadCount}x Kurtarıldı)`}
              </span>
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

          {/* Self-Healing & Ping Monitor Card */}
          <div className="control-card">
            <h3 className="card-title">
              <Activity size={18} className="primary-color" style={{ animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
              Donma Koruması & Bağlantı
            </h3>
            
            <div className="self-healing-stats">
              <div className="status-item">
                <span className="status-label">Bağlantı Gecikmesi:</span>
                <span className="status-value-group">
                  <span className={`ping-indicator-dot ${pingStatus}`}></span>
                  <span className="status-val font-mono">
                    {pingStatus === 'healthy' 
                      ? `${pingLatency} ms` 
                      : pingStatus === 'checking' 
                      ? 'Ölçülüyor...' 
                      : pingStatus === 'error'
                      ? 'Bağlantı Sorunu'
                      : 'Pasif'}
                  </span>
                </span>
              </div>
              <div className="status-item">
                <span className="status-label">Donma Koruması:</span>
                <span className="status-val" style={{ color: autoHealingEnabled ? '#10b981' : '#af8782', fontWeight: 600 }}>
                  {autoHealingEnabled ? 'Aktif (Otomatik)' : 'Pasif'}
                </span>
              </div>
              <div className="status-item">
                <span className="status-label">Otomatik Kurtarma:</span>
                <span className="status-val" style={{ fontWeight: 600 }}>
                  {reloadCount > 0 ? (
                    <span className="reload-badge danger">{reloadCount} Kez Kurtarıldı</span>
                  ) : (
                    <span className="reload-badge success">Sorunsuz Çalışma</span>
                  )}
                </span>
              </div>
            </div>

            <div className="self-healing-actions">
              <button 
                type="button"
                className={`action-btn-toggle ${autoHealingEnabled ? 'active' : ''}`}
                onClick={() => {
                  setAutoHealingEnabled(!autoHealingEnabled);
                  showToast(autoHealingEnabled ? 'Otomatik donma koruması devre dışı bırakıldı.' : 'Otomatik donma koruması aktif hale getirildi.');
                }}
              >
                {autoHealingEnabled ? 'Korumayı Durdur' : 'Korumayı Başlat'}
              </button>

              <button 
                type="button"
                className="action-btn-reconnect"
                onClick={() => {
                  showToast('Yayın bağlantısı manuel olarak tazeleniyor...');
                  setReloadTrigger(t => t + 1);
                }}
                title="Yeni bir oturum açarak yayını yeniden başlatır"
              >
                <RefreshCw size={13} className="reconnect-icon" />
                Yeniden Bağlan
              </button>
            </div>
            
            <div className="alert-box" style={{ marginTop: '14px', background: 'rgba(227, 10, 23, 0.04)', borderColor: 'rgba(227, 10, 23, 0.15)' }}>
              <ShieldCheck className="alert-icon animate-pulse" size={16} />
              <span style={{ fontSize: '12.5px', lineHeight: '1.4' }}>
                Yayın donarsa oynatıcı arka planda yeni bir <strong>sid (Oturum ID)</strong> üreterek yayını 10-12 saniye içinde otomatik kurtarır.
              </span>
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
