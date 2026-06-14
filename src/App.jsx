import { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { 
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
  RefreshCw,
  Settings,
  X,
  Menu
} from 'lucide-react';

// Version 1.4.0 - Premium Minimalist IPTV Dashboard
const APP_VERSION = "1.4.0";
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

// Preset channels (TRT 1 only as requested)
const PRESET_CHANNELS = [
  {
    id: 'trt-1-dynamic',
    name: 'TRT 1 (Dynamic 2K/1440p)',
    isDynamic: true,
    channelKey: 'trt-1',
    description: 'Resmi tabii.com 2K/1440p Ultra HD Canlı Yayın Akışı'
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
${proxyBase}/trt-1/master_1440p.m3u8?sid=${sid}&app=${APP_GUID}&ce=2
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080,NAME="1080p"
${proxyBase}/trt-1/master_1080p.m3u8?sid=${sid}&app=${APP_GUID}&ce=2
#EXT-X-STREAM-INF:BANDWIDTH=3000000,RESOLUTION=1280x720,NAME="720p"
${proxyBase}/trt-1/master_720p.m3u8?sid=${sid}&app=${APP_GUID}&ce=2
#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=854x480,NAME="480p"
${proxyBase}/trt-1/master_480p.m3u8?sid=${sid}&app=${APP_GUID}&ce=2
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360,NAME="360p"
${proxyBase}/trt-1/master_360p.m3u8?sid=${sid}&app=${APP_GUID}&ce=2`;
  } else {
    // Other TRT channels typically cap at 1080p
    return `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080,NAME="1080p"
${proxyBase}/${channel.channelKey}/master_1080p.m3u8?sid=${sid}&app=${APP_GUID}&ce=2
#EXT-X-STREAM-INF:BANDWIDTH=3000000,RESOLUTION=1280x720,NAME="720p"
${proxyBase}/${channel.channelKey}/master_720p.m3u8?sid=${sid}&app=${APP_GUID}&ce=2
#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=854x480,NAME="480p"
${proxyBase}/${channel.channelKey}/master_480p.m3u8?sid=${sid}&app=${APP_GUID}&ce=2
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360,NAME="360p"
${proxyBase}/${channel.channelKey}/master_360p.m3u8?sid=${sid}&app=${APP_GUID}&ce=2`;
  }
};

function App() {
  const [channels, setChannels] = useState(() => {
    const saved = localStorage.getItem('aether_channels');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Clean up legacy channels and old presets
        const filteredSaved = parsed.filter(c => 
          !c.id.startsWith('bbc') && 
          !c.id.startsWith('cbbc') && 
          !c.id.startsWith('cbeebies') &&
          c.id !== 'trt-spor-dynamic' &&
          c.id !== 'trt-spor-yildiz-dynamic' &&
          c.id !== 'trt-haber-dynamic' &&
          c.id !== 'trt-belgesel-dynamic'
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

  // UI state toggles
  const [sidebarOpen, setSidebarOpen] = useState(false); // Default collapsed for large TV look
  const [showSettings, setShowSettings] = useState(false);

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

  // Mobile landscape fullscreen state
  const [isLandscape, setIsLandscape] = useState(false);
  
  // User activity overlay auto-hide state
  const [userActive, setUserActive] = useState(true);
  const activeTimeoutRef = useRef(null);

  const handlePlayerActivity = () => {
    setUserActive(true);
    if (activeTimeoutRef.current) {
      clearTimeout(activeTimeoutRef.current);
    }
    activeTimeoutRef.current = setTimeout(() => {
      setUserActive(false);
    }, 3000);
  };

  // Effect to monitor viewport dimensions / orientation and trigger auto-fullscreen
  useEffect(() => {
    const checkOrientation = () => {
      const isMobile = window.innerWidth <= 960 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
      
      if (!isMobile) {
        setIsLandscape(false);
        return;
      }

      const isCurrentlyLandscape = window.innerWidth > window.innerHeight;
      setIsLandscape(isCurrentlyLandscape);

      if (isCurrentlyLandscape) {
        // Attempt browser native Fullscreen API on the player wrapper
        const playerWrapper = document.querySelector('.player-wrapper');
        if (playerWrapper && !document.fullscreenElement) {
          playerWrapper.requestFullscreen?.().catch(err => {
            console.log('Programmatic native fullscreen blocked (waiting for gesture or fallback active):', err);
          });
        }
      } else {
        // Exit native fullscreen if we rotate back to portrait
        if (document.fullscreenElement) {
          document.exitFullscreen?.().catch(err => {
            console.log('Failed to exit fullscreen:', err);
          });
        }
      }
    };

    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    
    // Initial check
    checkOrientation();

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
      if (activeTimeoutRef.current) {
        clearTimeout(activeTimeoutRef.current);
      }
    };
  }, []);

  // Auto-healing and self-ping states
  const [autoHealingEnabled, setAutoHealingEnabled] = useState(true);
  const [pingLatency, setPingLatency] = useState(null);
  const [pingStatus, setPingStatus] = useState('healthy'); // 'healthy', 'checking', 'error', 'disabled'
  const [reloadCount, setReloadCount] = useState(0);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  const lastTimeRef = useRef(0);
  const stallCountRef = useRef(0);
  const autoHealingEnabledRef = useRef(true);
  const lastChannelIdRef = useRef(activeChannelId);

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

    let blobUrl = '';
    const sid = generateRandomSid();
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const proxyBase = `${origin}/trt-proxy`;

    if (activeChannel.isDynamic) {
      // Create virtual master playlist Blob to support Adaptive Bitrate
      const m3u8Content = getVirtualMasterPlaylist(activeChannel, sid);
      const blob = new Blob([m3u8Content], { type: 'application/x-mpegURL' });
      blobUrl = URL.createObjectURL(blob);
    }
    const streamUrl = activeChannel.isDynamic ? blobUrl : activeChannel.url;
    const videoEl = videoRef.current;
    let handleLoadedMetadata = null;
    let handleVideoError = null;

    console.log('Loading Virtual Stream URL:', streamUrl);

    // Clean up previous Hls instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (diagnosticsIntervalRef.current) {
      clearInterval(diagnosticsIntervalRef.current);
    }

    const channelChanged = lastChannelIdRef.current !== activeChannel.id;
    lastChannelIdRef.current = activeChannel.id;

    if (channelChanged) {
      setAvailableLevels([]);
      setSelectedLevelIndex('auto');
    }
    setHudData(prev => ({ ...prev, status: 'Yükleniyor...', isError: false }));

    if (Hls.isSupported()) {
      // Tune Hls.js parameters based on selected latency/buffer mode
      let hlsConfig = {
        enableWorker: false,
        lowLatencyMode: latencyMode === 'low',
        backBufferLength: 90,
        capLevelToPlayerSize: false
      };

      if (latencyMode === 'low') {
        // Ultra-low latency parameters
        hlsConfig.liveSyncDurationCount = 2;
        hlsConfig.maxBufferLength = 10;
      } else if (latencyMode === 'balanced') {
        // Balanced (Recommended for high quality live sports without buffering)
        hlsConfig.liveSyncDurationCount = 3;
        hlsConfig.maxBufferLength = 35;
      } else {
        // Safe buffer mode (extremely stable, IPTV stream style)
        hlsConfig.liveSyncDurationCount = 5;
        hlsConfig.maxBufferLength = 60;
      }

      const hls = new Hls(hlsConfig);
      hlsRef.current = hls;
      hls.attachMedia(videoRef.current);
      hls.loadSource(streamUrl);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
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

        videoRef.current.muted = false; // Start unmuted
        videoRef.current.play().catch(err => {
          console.log('Unmuted autoplay blocked, trying muted autoplay...', err);
          videoRef.current.muted = true;
          videoRef.current.play().catch(err2 => {
            console.log('Muted autoplay also blocked:', err2);
          });
        });
        
        setHudData(prev => ({ ...prev, status: 'Aktif' }));
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
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

    } else if (videoEl && videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (mostly Safari / Mobile)
      const levels = activeChannel.isDynamic 
        ? (activeChannel.channelKey === 'trt-1' 
            ? [
                { index: 0, name: '1440p (2K)', height: 1440, bitrate: 8000000, suffix: '1440p' },
                { index: 1, name: '1080p', height: 1080, bitrate: 5000000, suffix: '1080p' },
                { index: 2, name: '720p', height: 720, bitrate: 3000000, suffix: '720p' },
                { index: 3, name: '480p', height: 480, bitrate: 1500000, suffix: '480p' },
                { index: 4, name: '360p', height: 360, bitrate: 800000, suffix: '360p' }
              ]
            : [
                { index: 0, name: '1080p', height: 1080, bitrate: 5000000, suffix: '1080p' },
                { index: 1, name: '720p', height: 720, bitrate: 3000000, suffix: '720p' },
                { index: 2, name: '480p', height: 480, bitrate: 1500000, suffix: '480p' },
                { index: 3, name: '360p', height: 360, bitrate: 800000, suffix: '360p' }
              ])
        : [];
      
      setAvailableLevels(levels);

      let suffix = '1080p';
      if (activeChannel.isDynamic && selectedLevelIndex !== 'auto') {
        const selectedLevel = levels.find(l => l.index === selectedLevelIndex);
        if (selectedLevel) {
          suffix = selectedLevel.suffix;
        }
      }

      const nativeStreamUrl = activeChannel.isDynamic 
        ? `${proxyBase}/${activeChannel.channelKey}/master_${suffix}.m3u8?sid=${sid}&app=${APP_GUID}&ce=2`
        : activeChannel.url;

      // Start muted to comply with browser autoplay policies and allow metadata to load
      videoEl.muted = true;
      videoEl.src = nativeStreamUrl;

      handleLoadedMetadata = () => {
        // Try to play unmuted first, fallback to muted if blocked
        videoEl.muted = false;
        videoEl.play().catch(e => {
          console.log('Unmuted Safari autoplay blocked, trying muted...', e);
          videoEl.muted = true;
          videoEl.play().catch(err2 => console.log('Muted autoplay blocked:', err2));
        });
        setHudData(prev => ({ 
          ...prev, 
          status: 'Aktif (Safari Native)', 
          resolution: `${videoEl.videoWidth}x${videoEl.videoHeight}`
        }));
      };

      handleVideoError = () => {
        setHudData(prev => ({ ...prev, status: 'Yükleme Hatası (Native)', isError: true }));
      };

      videoEl.addEventListener('loadedmetadata', handleLoadedMetadata);
      videoEl.addEventListener('error', handleVideoError);
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
      if (video.readyState >= 2 && !video.paused && !video.ended) {
        if (video.currentTime === lastTimeRef.current) {
          stallCountRef.current += 1;
          
          if (autoHealingEnabledRef.current && stallCountRef.current >= 12) {
            console.log('[Stream Monitor] Stall limit reached (12s). Initiating Auto-Heal...');
            showToast('Yayın donması algılandı! Donma koruması yayını otomatik olarak tazeleniyor...');
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
        stallCountRef.current = 0;
        lastTimeRef.current = video.currentTime;
      }

      // 2. SELF-PING CONNECTION CHECK (every 8 seconds)
      if (tickCount % 8 === 0) {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const proxyBase = `${origin}/trt-proxy`;
        const pingUrl = activeChannel.isDynamic
          ? `${proxyBase}/${activeChannel.channelKey}/master_1080p.m3u8?sid=${sid}&app=${APP_GUID}&ce=2`
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
      if (videoEl) {
        if (handleLoadedMetadata) {
          videoEl.removeEventListener('loadedmetadata', handleLoadedMetadata);
        }
        if (handleVideoError) {
          videoEl.removeEventListener('error', handleVideoError);
        }
      }
    };
  }, [activeChannel, latencyMode, reloadTrigger]);

  // Adjust quality level override
  const handleQualityChange = (levelIdx) => {
    setSelectedLevelIndex(levelIdx);
    if (!hlsRef.current) {
      // If we are on native player, we must trigger a reload to apply the new stream URL
      setReloadTrigger(t => t + 1);
      showToast('Yayın kalitesi güncelleniyor...');
      return;
    }

    if (levelIdx === 'auto') {
      hlsRef.current.currentLevel = -1; // -1 triggers automatic ABR in Hls.js
      showToast('Kalite ayarı "Otomatik (Adaptif)" olarak güncellendi.');
    } else {
      hlsRef.current.currentLevel = levelIdx; // Set Hls.js level directly
      const lvl = hlsRef.current.levels[levelIdx];
      const name = lvl ? (lvl.name || `${lvl.height}p`) : 'Seçilen';
      showToast(`Yayın kalitesi ${name} değerine kilitlendi.`);
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
    setShowSettings(false); // Close settings for direct watching
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
    <div className={`app-container ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
      )}
      {/* Sidebar Panel */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-glow">
            <Tv size={20} color="white" />
          </div>
          <div>
            <h1 className="logo-title">WCTV IPTV <span style={{ fontSize: '10px', opacity: 0.6, verticalAlign: 'super' }}>v{APP_VERSION}</span></h1>
            <div className="logo-subtitle">2K CANLI YAYIN</div>
          </div>
        </div>

        <div className="sidebar-content">
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
        </div>
      </aside>

      {/* Main Stream Window */}
      <main className="main-display">
        <header className="header-bar">
          <div className="header-left">
            <button 
              className={`menu-toggle-btn ${sidebarOpen ? 'active' : ''}`}
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title="Kanalları Göster/Gizle"
            >
              <Menu size={20} />
            </button>
            
            <div className="header-title-section">
              <h2 className="header-title">{activeChannel?.name}</h2>
              <div className="header-meta">
                <span className="header-badge-live">Canlı</span>
                <span className="header-status">
                  <Wifi size={14} />
                  {activeChannel?.isDynamic ? 'Premium CDN Bağlantısı (ABR Aktif)' : 'Harici Akış'}
                </span>
              </div>
            </div>
          </div>

          <div className="header-right">
            <div className="alert-box flex-align-center">
              <ShieldCheck className="alert-icon" size={16} />
              <span>Donma Koruması Aktif</span>
              <span className={`header-ping-badge ${pingStatus}`}>
                <span className="ping-badge-dot"></span>
                <span>{pingStatus === 'healthy' ? `${pingLatency} ms` : pingStatus === 'checking' ? 'Ölçülüyor...' : 'Kesinti'}</span>
              </span>
            </div>
            
            <button 
              className="settings-toggle-btn"
              onClick={() => setShowSettings(true)}
              title="Ayarlar"
            >
              <Settings size={20} className="settings-gear" />
            </button>
          </div>
        </header>

        {/* Video Player Display */}
        <div 
          className={`player-wrapper ${isLandscape ? 'mobile-landscape-fullscreen' : ''} ${!userActive ? 'user-inactive' : ''}`}
          onMouseMove={handlePlayerActivity}
          onTouchStart={handlePlayerActivity}
        >
          <video 
            ref={videoRef} 
            className="video-element"
            controls
            autoPlay
            playsInline
            muted
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
              <span className="hud-label">Tampon:</span>
              <span className="hud-value" style={{ color: parseFloat(hudData.buffer) < 5 ? '#ef4444' : '#10b981' }}>
                {hudData.buffer}
              </span>
            </div>
            <div className="hud-item">
              <span className="hud-label">FPS/Mod:</span>
              <span className="hud-value">{hudData.fps} FPS ({hudData.latencyModeName})</span>
            </div>
            <div className="hud-item">
              <span className="hud-label">Sinyal:</span>
              <span className="hud-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className={`hud-status-dot ${pingStatus}`}></span>
                {pingStatus === 'healthy' ? `${pingLatency} ms` : pingStatus === 'checking' ? 'Ölçülüyor' : 'Kesinti'} 
                {reloadCount > 0 && ` (${reloadCount}x Kurtarıldı)`}
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Settings Modal/Drawer Overlay */}
      {showSettings && (
        <div className="settings-drawer-backdrop" onClick={() => setShowSettings(false)} />
      )}
      
      <div className={`settings-drawer ${showSettings ? 'open' : ''}`}>
        <div className="settings-drawer-header">
          <h3 className="settings-drawer-title">
            <Settings size={20} className="settings-title-icon-spin" />
            Yayın ve Oynatıcı Ayarları
          </h3>
          <button className="settings-close-btn" onClick={() => setShowSettings(false)}>
            <X size={20} />
          </button>
        </div>
        
        <div className="settings-drawer-body">
          {/* 1. Quality selection grid */}
          <div className="settings-section">
            <h4 className="settings-section-title">
              <Sliders size={16} />
              Yayın Kalitesi (ABR)
            </h4>
            
            {availableLevels.length > 0 ? (
              <>
                <div className="settings-quality-grid">
                  <button
                    className={`quality-btn ${selectedLevelIndex === 'auto' ? 'active' : ''}`}
                    onClick={() => handleQualityChange('auto')}
                  >
                    <span className="quality-label">Otomatik</span>
                    <span className="quality-desc">Adaptif Akış</span>
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
                          {(level.bitrate / 1000000).toFixed(1)} Mbps
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="settings-info-box">
                  <Info className="info-icon" size={14} />
                  <span>
                    Bant genişliğiniz düşerse <strong>Otomatik</strong> mod takılmayı önler. Sabit en net görüntü için <strong>1440p (2K)</strong> veya <strong>1080p</strong> kalitelerini seçebilirsiniz.
                  </span>
                </div>
              </>
            ) : (
              <div className="settings-info-box warning">
                <AlertTriangle className="info-icon" size={14} />
                <span>
                  Özel IPTV akışlarında tekil manifest varsa kalite seçimi otomatik belirlenir. Çoklu kalite varsa oynatıcı otomatik listeleyecektir.
                </span>
              </div>
            )}
          </div>

          {/* 2. Latency mode selection */}
          <div className="settings-section">
            <h4 className="settings-section-title">
              <Clock size={16} />
              Gecikme & Donma Engelleme
            </h4>
            <div className="settings-latency-grid">
              {[
                { key: 'low', label: 'Düşük Gecikme', desc: '5s Tampon (Riskli)' },
                { key: 'balanced', label: 'Dengeli', desc: '15s Tampon (Önerilen)' },
                { key: 'stable', label: 'Süper Stabil', desc: '30s Tampon (Sıfır Donma)' }
              ].map((mode) => (
                <button
                  key={mode.key}
                  className={`latency-btn ${latencyMode === mode.key ? 'active' : ''}`}
                  onClick={() => {
                    setLatencyMode(mode.key);
                    showToast(`Oynatma modu: ${mode.label} olarak değiştirildi. Yayın yeniden yükleniyor...`);
                  }}
                >
                  <span className="latency-label">{mode.label}</span>
                  <span className="latency-desc">{mode.desc}</span>
                </button>
              ))}
            </div>
            <div className="settings-info-box">
              <Info className="info-icon" size={14} />
              <span>
                TRT segmentleri 10 saniye olduğu için donmaları önlemek amacıyla en az 15 saniyelik <strong>Dengeli</strong> veya <strong>Süper Stabil</strong> mod kullanılması önerilir.
              </span>
            </div>
          </div>

          {/* 3. Self-healing stats and settings */}
          <div className="settings-section">
            <h4 className="settings-section-title">
              <Activity size={16} />
              Donma Koruması & Kurtarma
            </h4>
            <div className="settings-healing-stats">
              <div className="status-item">
                <span className="status-label">Bağlantı Sinyali:</span>
                <span className="status-value-group">
                  <span className={`ping-indicator-dot ${pingStatus}`}></span>
                  <span className="status-val font-mono">
                    {pingStatus === 'healthy' 
                      ? `${pingLatency} ms` 
                      : pingStatus === 'checking' 
                      ? 'Ölçülüyor...' 
                      : pingStatus === 'error'
                      ? 'Bağlantı Kesik'
                      : 'Pasif'}
                  </span>
                </span>
              </div>
              <div className="status-item">
                <span className="status-label">Kendi Kendine İyileştirme:</span>
                <span className="status-val" style={{ color: autoHealingEnabled ? '#10b981' : '#af8782', fontWeight: 600 }}>
                  {autoHealingEnabled ? 'Aktif (Otomatik)' : 'Pasif'}
                </span>
              </div>
              <div className="status-item">
                <span className="status-label">Kurtarma Sayacı:</span>
                <span className="status-val" style={{ fontWeight: 600 }}>
                  {reloadCount > 0 ? (
                    <span className="reload-badge danger">{reloadCount} Kez Kurtarıldı</span>
                  ) : (
                    <span className="reload-badge success">Sorunsuz</span>
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
                  showToast(autoHealingEnabled ? 'Otomatik donma koruması devre dışı bırakıldı.' : 'Otomatik donma koruması aktif.');
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
                title="Yayını yeniler"
              >
                <RefreshCw size={13} className="reconnect-icon" />
                Yeniden Bağlan
              </button>
            </div>
          </div>

          {/* 4. Add Custom Channel form */}
          <div className="settings-section">
            <h4 className="settings-section-title">
              <Plus size={16} />
              Özel Yayın Ekle (M3U8)
            </h4>
            <form onSubmit={handleAddChannel} className="custom-form">
              <div className="input-group">
                <label className="input-label">Kanal Adı</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Örn: TRT 4K veya Alternatif Spor"
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
                Listeye Kanal Ekle
              </button>
            </form>
          </div>
        </div>
      </div>

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
