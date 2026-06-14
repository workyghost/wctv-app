import React, { useState, useEffect, useRef } from 'react';
import Hls from 'hls.js';

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
    name: 'TRT 1 (2K/1440p)',
    isDynamic: true,
    channelKey: 'trt-1',
    description: 'Resmi tabii.com 2K/1440p Ultra HD Canlı Dünya Kupası Akışı'
  },
  {
    id: 'trt-spor-dynamic',
    name: 'TRT Spor (1080p)',
    isDynamic: true,
    channelKey: 'trt-spor',
    description: 'Resmi tabii.com 1080p Full HD Canlı Spor Akışı'
  },
  {
    id: 'trt-spor-yildiz-dynamic',
    name: 'TRT Spor Yıldız (1080p)',
    isDynamic: true,
    channelKey: 'trt-spor-yildiz',
    description: 'Resmi tabii.com 1080p Canlı Alternatif Spor Akışı'
  },
  {
    id: 'trt-haber-dynamic',
    name: 'TRT Haber (1080p)',
    isDynamic: true,
    channelKey: 'trt-haber',
    description: 'Resmi tabii.com 1080p Canlı Haber Akışı'
  },
  {
    id: 'trt-belgesel-dynamic',
    name: 'TRT Belgesel (1080p)',
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

const INITIAL_CHAT = [
  { id: 1, user: "Mert_Fan88", text: "HAYDİ TÜRKİYEM! 🇹🇷🇹🇷🇹🇷", time: "03:42", isPrimary: true },
  { id: 2, user: "BrazilLover_XX", text: "Brazil still has time. Vini will score 🇧🇷", time: "03:43", isPrimary: false },
  { id: 3, user: "SelimSports", text: "Stadyumda inanılmaz bir atmosfer var! 10/10", time: "03:43", isPrimary: true },
  { id: 4, user: "SystemBot", text: "Oyuncu Değişikliği: Arda Güler ÇIKTI, Kerem Aktürkoğlu GİRDİ.", time: "03:44", isSystem: true }
];

function App() {
  const [channels, setChannels] = useState(() => {
    const saved = localStorage.getItem('aether_channels');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const filteredSaved = parsed.filter(c => 
          !c.id.startsWith('bbc') && 
          !c.id.startsWith('cbbc') && 
          !c.id.startsWith('cbeebies')
        );
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

  const [selectedLevelIndex, setSelectedLevelIndex] = useState('auto');
  const [availableLevels, setAvailableLevels] = useState([]);
  const [latencyMode, setLatencyMode] = useState('balanced'); 

  const [customName, setCustomName] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  
  // Chat States
  const [chatMessages, setChatMessages] = useState(INITIAL_CHAT);
  const [chatInput, setChatInput] = useState('');

  // Active Tab for Bento area
  const [activeTab, setActiveTab] = useState('lineups');

  // Scoreboard visibility
  const [showScoreboard, setShowScoreboard] = useState(true);

  // Diagnostics HUD overlay visibility
  const [showHud, setShowHud] = useState(true);
  
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
  const chatContainerRef = useRef(null);

  // Sync channels to local storage
  useEffect(() => {
    localStorage.setItem('aether_channels', JSON.stringify(channels));
  }, [channels]);

  // Scroll chat to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Simulated Chat Bot
  useEffect(() => {
    const interval = setInterval(() => {
      const names = ['Caner_4', 'WorldCupFan', 'StadiumVibes', 'Hakan_T', 'NeymarClass'];
      const msgs = [
        'Uğurcan devleşti kalede! 🇹🇷', 
        'Bu karar net penaltı, VAR kontrol etmeli.', 
        'Bastır Türkiye! Son 15 dakika!', 
        'What a match! Incredible tension.', 
        'Vini is completely blocked by our defense tonight.'
      ];
      
      const randomName = names[Math.floor(Math.random() * names.length)];
      const randomMsg = msgs[Math.floor(Math.random() * msgs.length)];
      
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      setChatMessages(prev => [
        ...prev, 
        { 
          id: Date.now(), 
          user: randomName, 
          text: randomMsg, 
          time: timeStr,
          isPrimary: Math.random() > 0.4 
        }
      ].slice(-25)); // Keep last 25 messages
    }, 9000);

    return () => clearInterval(interval);
  }, []);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => {
      setToast('');
    }, 3500);
  };

  const activeChannel = channels.find(c => c.id === activeChannelId) || channels[0];

  // Hls Setup
  useEffect(() => {
    if (!videoRef.current || !activeChannel) return;

    let streamUrl = '';
    let blobUrl = '';
    const sid = generateRandomSid();

    if (activeChannel.isDynamic) {
      const m3u8Content = getVirtualMasterPlaylist(activeChannel, sid);
      const blob = new Blob([m3u8Content], { type: 'application/x-mpegURL' });
      blobUrl = URL.createObjectURL(blob);
      streamUrl = blobUrl;
    } else {
      streamUrl = activeChannel.url;
    }

    console.log('Loading Virtual Stream URL:', streamUrl);

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
      let hlsConfig = {
        enableWorker: true,
        lowLatencyMode: latencyMode === 'low',
        backBufferLength: 90,
        capLevelToPlayerSize: false
      };

      if (latencyMode === 'low') {
        hlsConfig.liveSyncDuration = 5;
        hlsConfig.liveMaxLatencyDuration = 10;
        hlsConfig.maxBufferLength = 10;
      } else if (latencyMode === 'balanced') {
        hlsConfig.liveSyncDuration = 15;
        hlsConfig.liveMaxLatencyDuration = 25;
        hlsConfig.maxBufferLength = 35;
      } else {
        hlsConfig.liveSyncDuration = 30;
        hlsConfig.liveMaxLatencyDuration = 50;
        hlsConfig.maxBufferLength = 60;
      }

      const hls = new Hls(hlsConfig);
      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(videoRef.current);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const discovered = hls.levels.map((level, index) => ({
          index,
          name: level.name || `${level.height}p`,
          height: level.height,
          bitrate: level.bitrate
        }));
        
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
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              break;
          }
        }
      });

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

        const resolution = video.videoWidth && video.videoHeight 
          ? `${video.videoWidth}x${video.videoHeight}` 
          : 'N/A';

        let bitrate = 'N/A';
        const currentLvl = hls.currentLevel;
        if (currentLvl !== -1 && hls.levels[currentLvl]) {
          const levelInfo = hls.levels[currentLvl];
          bitrate = `${(levelInfo.bitrate / 1000000).toFixed(2)} Mbps`;
        }

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
      videoRef.current.src = streamUrl;
      videoRef.current.addEventListener('loadedmetadata', () => {
        videoRef.current.play().catch(e => console.log('Autoplay blocked:', e));
        setHudData(prev => ({ 
          ...prev, 
          status: 'Aktif (Safari Native)', 
          resolution: `${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`
        }));
      });

      videoRef.current.addEventListener('error', () => {
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

  const handleQualityChange = (levelIdx) => {
    setSelectedLevelIndex(levelIdx);
    if (!hlsRef.current) return;

    if (levelIdx === 'auto') {
      hlsRef.current.currentLevel = -1;
      showToast('Yayın kalitesi "Otomatik (Adaptif)" olarak güncellendi.');
    } else {
      hlsRef.current.currentLevel = levelIdx;
      const lvl = hlsRef.current.levels[levelIdx];
      const name = lvl ? (lvl.name || `${lvl.height}p`) : 'Seçilen';
      showToast(`Kalite ${name} değerine kilitlendi.`);
    }
  };

  const handleAddChannel = (e) => {
    e.preventDefault();
    if (!customName.trim() || !customUrl.trim()) {
      showToast('Kanal adı ve URL alanlarını doldurun.');
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
      description: 'Kullanıcı IPTV Kanalı'
    };

    setChannels(prev => [...prev, newChannel]);
    setActiveChannelId(newChannel.id);
    setCustomName('');
    setCustomUrl('');
    showToast('Yeni IPTV kanalı başarıyla eklendi!');
  };

  const handleDeleteChannel = (id, e) => {
    e.stopPropagation();
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

  const sendChatMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    setChatMessages(prev => [
      ...prev,
      {
        id: Date.now(),
        user: "Siz",
        text: chatInput,
        time: timeStr,
        isPrimary: true,
        isUser: true
      }
    ]);
    setChatInput('');
  };

  const insertEmoji = (emoji) => {
    setChatInput(prev => prev + emoji);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#131313] text-[#e5e2e1] font-sans">
      
      {/* Top Header Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-[#131313]/90 backdrop-blur-xl border-b border-white/10 shadow-2xl flex justify-between items-center px-6 py-4 max-w-[1440px] mx-auto left-0 right-0">
        <div className="flex items-center gap-2">
          <span className="font-display-hero text-2xl font-black uppercase tracking-tighter text-[#ffb4aa] cursor-pointer">
            TÜRKİYE 2026
          </span>
        </div>
        <div className="hidden md:flex gap-6 items-center">
          <a className="text-[#ffb4aa] font-bold border-b-2 border-[#ffb4aa] pb-1 text-sm tracking-wide" href="#live">Live TV</a>
          <a className="text-[#e5e2e1]/70 hover:text-[#e5e2e1] transition-colors text-sm" href="#schedule">Fikstür</a>
          <a className="text-[#e5e2e1]/70 hover:text-[#e5e2e1] transition-colors text-sm" href="#team">Milli Takım</a>
          <button 
            onClick={() => setShowHud(!showHud)}
            className="text-[#e5e2e1]/70 hover:text-[#ffb4aa] transition-colors text-sm flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-base">monitoring</span> HUD
          </button>
          <button 
            onClick={() => setShowScoreboard(!showScoreboard)}
            className="text-[#e5e2e1]/70 hover:text-[#ffb4aa] transition-colors text-sm flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-base">sports_score</span> Skorboard
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button className="bg-[#e30a17] text-[#fff5f4] px-5 py-2 rounded-lg font-bold text-xs uppercase tracking-wider hover:scale-95 active:scale-90 transition-transform">
            CANLI İZLE
          </button>
          <img 
            alt="Profil" 
            className="w-10 h-10 rounded-full border-2 border-[#ffb4aa]/20" 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuB7-YXDM8z3WPpDhUU541iCB_AgKBjYRaooElKmUWv1dIm-ofJCQ9WqoAcdEQZMemD742TBtMUROZpnjbIguJVmt66kzouuDg8G29XCHyfT5JTlD3AF2t4WJd1FJTJl6Ih0Qp_PbpO05wIZwO7X-QnC3ULjDaMEB-KjXyIisbHM9BRzT-xaW97EgkPFS8zy3HALgMQPCwPA3nzhKj4bHhl7qoFCXTn9-rTupN1Yvk11ZpWQgZlTQjgydw"
          />
        </div>
      </nav>

      {/* Main Container */}
      <main className="pt-[80px] min-h-[calc(100vh-80px)] flex flex-col lg:flex-row bg-[#131313]">
        
        {/* Left Sidebar: Channels List & Add Channel Form */}
        <aside className="w-full lg:w-72 xl:w-80 bg-[#1c1b1b] border-r border-white/5 flex flex-col shrink-0 overflow-y-auto max-h-[calc(100vh-80px)]">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <h3 className="font-bold text-sm tracking-widest text-[#ffb4aa] flex items-center gap-2">
              <span className="material-symbols-outlined text-red-500" style={{ fontVariationSettings: "'FILL' 1" }}>live_tv</span>
              KANALLAR
            </h3>
            <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded font-mono text-zinc-400">{channels.length} Yayın</span>
          </div>

          <div className="flex flex-col flex-1 divide-y divide-white/5">
            {channels.map((channel) => {
              const isActive = channel.id === activeChannelId;
              return (
                <div 
                  key={channel.id}
                  onClick={() => setActiveChannelId(channel.id)}
                  className={`p-4 cursor-pointer transition-all border-l-4 group flex justify-between items-start ${
                    isActive 
                      ? 'bg-[#e30a17]/10 border-[#e30a17]' 
                      : 'border-transparent hover:bg-white/5'
                  }`}
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-2 mb-1">
                      {channel.isDynamic ? (
                        <span className="bg-[#e30a17] text-[#fff5f4] text-[9px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1 shrink-0">
                          <span className="w-1 h-1 bg-white rounded-full pulse-dot"></span> CANLI
                        </span>
                      ) : (
                        <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0">
                          IPTV
                        </span>
                      )}
                      <span className="text-[10px] text-zinc-500 font-mono truncate">
                        {channel.isDynamic ? 'tabii.com CDN' : 'Eklenen Akış'}
                      </span>
                    </div>
                    <p className={`text-sm font-bold truncate transition-colors ${
                      isActive ? 'text-[#ffb4aa]' : 'text-zinc-200 group-hover:text-[#ffb4aa]'
                    }`}>
                      {channel.name}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5 truncate">{channel.description}</p>
                  </div>

                  {!channel.isDynamic && (
                    <button 
                      onClick={(e) => handleDeleteChannel(channel.id, e)}
                      className="text-zinc-500 hover:text-red-400 p-1 rounded transition-colors"
                      title="Kanalı Sil"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add Channel Form */}
          <div className="p-4 border-t border-white/5 bg-[#0e0e0e]/50 mt-auto">
            <h4 className="text-xs font-bold text-[#ffb4aa] mb-3 uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-xs">add_box</span> Hızlı Akış Ekle
            </h4>
            <form onSubmit={handleAddChannel} className="space-y-3">
              <div>
                <input 
                  type="text" 
                  className="w-full bg-[#131313] border border-white/10 rounded-lg py-2 px-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#e30a17] transition-all"
                  placeholder="Kanal Adı"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                />
              </div>
              <div className="relative">
                <input 
                  type="text" 
                  className="w-full bg-[#131313] border border-white/10 rounded-lg py-2 px-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#e30a17] pr-8 transition-all"
                  placeholder="M3U8 Yayın Linki"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                />
              </div>
              <button 
                type="submit" 
                className="w-full bg-[#e30a17] text-[#fff5f4] py-2 rounded-lg text-xs font-bold tracking-wider hover:scale-[0.98] active:scale-95 transition-all flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">add</span> Listeye Ekle
              </button>
            </form>
          </div>
        </aside>

        {/* Center: Video Player Canvas & Stats Bento */}
        <section className="flex-1 flex flex-col bg-[#0e0e0e] relative overflow-y-auto max-h-[calc(100vh-80px)]">
          
          {/* TV Screen Wrapper */}
          <div className="relative aspect-video w-full bg-black group overflow-hidden shadow-2xl">
            <video 
              ref={videoRef} 
              className="w-full h-full object-contain"
              controls
              autoPlay
              playsInline
            />

            {/* Scoreboard Overlay (TV Style) */}
            {showScoreboard && (
              <div className="absolute top-4 left-4 flex items-center gap-4 z-10 transition-opacity duration-300">
                <div className="glass-panel px-4 py-2 rounded-xl flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#e30a17] border border-white/20 flex items-center justify-center overflow-hidden">
                      <img 
                        alt="Turkey Flag" 
                        className="w-full h-full object-cover" 
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuAbHjWhyhpzYcm9oL3jZl_7Y2mVsXJU7AHvmsk3np4rgu0AwAQvm_diSxg7SYkMgpN57z_q_h11jaos_mLjy5WaZFd--Xdcps_rAggjiVEw8uh7m6B57luK_P6ZhCyTCU7UZiVkfUU1tVPCaWT4spX_dvzoM1cXSuzHJ4K8HT3TOSejBGFEbGdHAs4x43fUhsJsZdtql8YYVIVYhhuBM25RVq4phCQQgVmKP6DPMggAVGHRUwx1yQVZeQ"
                      />
                    </div>
                    <span className="font-bold text-sm tracking-tight">TUR</span>
                  </div>
                  <div className="bg-[#131313]/60 px-3 py-1 rounded font-black text-lg text-white border border-white/10 tracking-widest">
                    2 - 1
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm tracking-tight">BRA</span>
                    <div className="w-8 h-8 rounded-full bg-yellow-500 border border-white/20 flex items-center justify-center overflow-hidden">
                      <img 
                        alt="Brazil Flag" 
                        className="w-full h-full object-cover" 
                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuAekXdIZMG1BijQACJIxqJFUu6zcgLPid5_KstotuYdp2dhWs_Va4BElNJaOSMJzydQXfhWlmZGRcsB99A6Kjpsnp__0rYh98GpCbJyn3jkTSb0UhJmmGSa63arU9UhKy8yG8v7aKjaI3tR-Z8QPPLex0dnbN0yGH4tmfaUVNIQzIRL6fzJNUfkx9GnMuwEQQXQJkGRY18AiizOMVmByYFF7sNv--IDZQQ6WwOrOYCpOvly4bRCUtVvlg"
                      />
                    </div>
                  </div>
                  <div className="border-l border-white/20 pl-4 flex items-center">
                    <span className="font-mono font-bold text-[#e30a17] animate-pulse">74'</span>
                  </div>
                </div>
              </div>
            )}

            {/* Diagnostic HUD Overlay */}
            {showHud && (
              <div className="absolute top-4 right-4 bg-[#0e0e0e]/85 border border-white/10 rounded-xl p-4 flex flex-col gap-2 text-xs backdrop-blur-xl z-10 w-64 shadow-xl">
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="font-bold text-[#ffb4aa] uppercase tracking-wider flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">analytics</span> ANALİZ
                  </span>
                  <span className="text-[10px] text-zinc-500">{hudData.latencyModeName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Durum:</span>
                  <span className="font-bold flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${hudData.isError ? 'bg-red-500' : 'bg-emerald-500 pulse-dot'}`}></span>
                    {hudData.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Çözünürlük:</span>
                  <span className="font-bold font-mono">{hudData.resolution}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Bitrate:</span>
                  <span className="font-bold font-mono">{hudData.bitrate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Buffer Bellek:</span>
                  <span className="font-bold font-mono text-emerald-400">{hudData.buffer}</span>
                </div>
                <div className="flex justify-between border-t border-white/5 pt-2">
                  <span className="text-zinc-500">Yayın FPS:</span>
                  <span className="font-bold font-mono text-[#ffb4aa]">{hudData.fps} FPS</span>
                </div>
              </div>
            )}
          </div>

          {/* Stats, Bento Grid & Controls */}
          <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/5 pb-4">
              <div>
                <h1 className="font-display-hero text-2xl font-black text-white tracking-wide uppercase">
                  {activeChannel?.name}
                </h1>
                <p className="text-zinc-400 text-sm mt-1">{activeChannel?.description}</p>
              </div>
              <div className="flex gap-2.5 shrink-0">
                <button 
                  onClick={() => showToast('Bağlantı linki kopyalandı!')}
                  className="bg-[#2a2a2a] hover:bg-[#353534] text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">share</span> PAYLAŞ
                </button>
                <button 
                  onClick={() => showToast('Favori kanallara kaydedildi.')}
                  className="bg-[#2a2a2a] hover:bg-[#353534] text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">star</span> FAVORİ
                </button>
              </div>
            </div>

            {/* Stats Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Possession Widget */}
              <div className="glass-panel p-4 rounded-xl flex flex-col justify-between">
                <span className="text-zinc-400 text-xs font-bold uppercase tracking-wider block mb-3">TOPLA OYNAMA</span>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between text-[10px] font-mono mb-1 text-zinc-500">
                      <span>TUR</span>
                      <span>BRA</span>
                    </div>
                    <div className="h-2 bg-[#2a2a2a] rounded-full flex overflow-hidden">
                      <div className="h-full bg-[#e30a17]" style={{ width: '52%' }}></div>
                      <div className="h-full bg-yellow-500" style={{ width: '48%' }}></div>
                    </div>
                  </div>
                  <span className="font-black text-xl text-[#ffb4aa] tracking-tighter">52%</span>
                </div>
              </div>

              {/* Shots Widget */}
              <div className="glass-panel p-4 rounded-xl flex flex-col justify-between">
                <span className="text-zinc-400 text-xs font-bold uppercase tracking-wider block mb-3">İSABETLİ ŞUTLAR</span>
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <span className="block font-black text-2xl text-[#ffb4aa]">6</span>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">TÜRKİYE</span>
                  </div>
                  <div className="w-px h-8 bg-white/10"></div>
                  <div className="text-center">
                    <span className="block font-black text-2xl text-zinc-400">4</span>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">BREZİLYA</span>
                  </div>
                </div>
              </div>

              {/* Expected Goals xG Widget */}
              <div className="glass-panel p-4 rounded-xl flex flex-col justify-between">
                <span className="text-zinc-400 text-xs font-bold uppercase tracking-wider block mb-3">GOL BEKLENTİSİ (xG)</span>
                <div className="flex items-center justify-between">
                  <span className="font-black text-2xl text-white">1.84</span>
                  <div className="flex-1 max-w-[120px] h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
                    <div className="h-full bg-[#e30a17]" style={{ width: '75%' }}></div>
                  </div>
                  <span className="text-xs text-zinc-400">0.96 (BRA)</span>
                </div>
              </div>
            </div>

            {/* Lineups / Tabs Section */}
            <div className="glass-panel p-6 rounded-2xl">
              <div className="flex gap-6 border-b border-white/5 mb-4">
                <button 
                  onClick={() => setActiveTab('lineups')}
                  className={`pb-3 text-sm font-bold tracking-wider uppercase border-b-2 transition-all ${
                    activeTab === 'lineups' ? 'border-[#e30a17] text-[#e30a17]' : 'border-transparent text-zinc-400 hover:text-white'
                  }`}
                >
                  KADROLAR
                </button>
                <button 
                  onClick={() => setActiveTab('events')}
                  className={`pb-3 text-sm font-bold tracking-wider uppercase border-b-2 transition-all ${
                    activeTab === 'events' ? 'border-transparent text-zinc-400 hover:text-white' : 'border-transparent text-zinc-400 hover:text-white'
                  }`}
                >
                  MAÇ OLAYLARI
                </button>
                <button 
                  onClick={() => setActiveTab('h2h')}
                  className={`pb-3 text-sm font-bold tracking-wider uppercase border-b-2 transition-all ${
                    activeTab === 'h2h' ? 'border-transparent text-zinc-400 hover:text-white' : 'border-transparent text-zinc-400 hover:text-white'
                  }`}
                >
                  GEÇMİŞ MAÇLAR
                </button>
              </div>

              {activeTab === 'lineups' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
                  <div className="space-y-3">
                    <h4 className="text-[#e30a17] font-bold text-xs flex items-center gap-2 uppercase tracking-widest">
                      <span className="w-2 h-2 rounded-full bg-[#e30a17] pulse-dot"></span> TÜRKİYE (4-3-3)
                    </h4>
                    <ul className="space-y-2 text-sm divide-y divide-white/5">
                      <li className="flex justify-between items-center py-1 text-zinc-300"><span>Uğurcan Çakır</span><span className="text-[10px] text-zinc-500 italic">KL</span></li>
                      <li className="flex justify-between items-center py-1 text-zinc-300"><span>Merih Demiral</span><span className="text-[10px] text-zinc-500 italic">DF</span></li>
                      <li className="flex justify-between items-center py-1 text-zinc-300"><span>Zeki Çelik</span><span className="text-[10px] text-zinc-500 italic">DF</span></li>
                      <li className="flex justify-between items-center py-1 text-[#ffb4aa] font-bold"><span>Hakan Çalhanoğlu (C)</span><span className="text-[10px] text-zinc-500 italic">OS</span></li>
                      <li className="flex justify-between items-center py-1 text-zinc-300"><span>Arda Güler</span><span className="text-[10px] text-zinc-500 italic">OS</span></li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-yellow-500 font-bold text-xs flex items-center gap-2 uppercase tracking-widest">
                      <span className="w-2 h-2 rounded-full bg-yellow-500"></span> BREZİLYA (4-2-3-1)
                    </h4>
                    <ul className="space-y-2 text-sm divide-y divide-white/5">
                      <li className="flex justify-between items-center py-1 text-zinc-300"><span>Alisson</span><span className="text-[10px] text-zinc-500 italic">KL</span></li>
                      <li className="flex justify-between items-center py-1 text-zinc-300"><span>Marquinhos</span><span className="text-[10px] text-zinc-500 italic">DF</span></li>
                      <li className="flex justify-between items-center py-1 text-zinc-300"><span>Casemiro</span><span className="text-[10px] text-zinc-500 italic">OS</span></li>
                      <li className="flex justify-between items-center py-1 text-zinc-300"><span>Vinicius Jr.</span><span className="text-[10px] text-zinc-500 italic">FV</span></li>
                      <li className="flex justify-between items-center py-1 text-zinc-300"><span>Rodrygo</span><span className="text-[10px] text-zinc-500 italic">FV</span></li>
                    </ul>
                  </div>
                </div>
              )}

              {activeTab !== 'lineups' && (
                <div className="py-4 text-center text-xs text-zinc-500 italic">
                  Detaylar Dünya Kupası 2026 canlı veritabanı üzerinden güncellenmektedir.
                </div>
              )}
            </div>

            {/* Custom Interactive Player Controls Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Quality Settings Card */}
              <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-sm tracking-widest text-[#ffb4aa] mb-4 flex items-center gap-2 uppercase">
                    <span className="material-symbols-outlined text-[#e30a17]">tune</span> Kalite Seçimi
                  </h3>
                  
                  {availableLevels.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleQualityChange('auto')}
                        className={`py-2 px-3 rounded-lg text-xs font-bold transition-all border flex flex-col items-center justify-center gap-0.5 ${
                          selectedLevelIndex === 'auto'
                            ? 'bg-[#e30a17] text-white border-[#e30a17]'
                            : 'bg-white/5 hover:bg-white/10 text-zinc-300 border-white/5'
                        }`}
                      >
                        <span>Otomatik</span>
                        <span className="text-[8px] opacity-75">Adaptif (ABR)</span>
                      </button>

                      {availableLevels.map((level) => {
                        const is2K = level.height === 1440;
                        const isActive = selectedLevelIndex === level.index;
                        return (
                          <button
                            key={level.index}
                            onClick={() => handleQualityChange(level.index)}
                            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all border flex flex-col items-center justify-center gap-0.5 ${
                              isActive
                                ? 'bg-[#e30a17] text-white border-[#e30a17]'
                                : 'bg-white/5 hover:bg-white/10 text-zinc-300 border-white/5'
                            }`}
                          >
                            <span>{is2K ? '1440p (2K)' : `${level.height}p`}</span>
                            <span className="text-[8px] opacity-75">{(level.bitrate / 1000000).toFixed(1)} Mbps</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-zinc-500 italic p-3 bg-white/5 rounded-lg border border-white/5">
                      Bu yayın tekli kalitedir. Oynatıcı otomatik en yüksek kalitede yürütecektir.
                    </div>
                  )}
                </div>
                
                <p className="text-[10px] text-zinc-500 leading-relaxed mt-4">
                  * <strong>Otomatik (Adaptif)</strong> mod, internet hızınız dalgalandığında yayının donmasını önlemek için kaliteyi dinamik ayarlar.
                </p>
              </div>

              {/* Latency / Buffer Mode Card */}
              <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-sm tracking-widest text-[#ffb4aa] mb-4 flex items-center gap-2 uppercase">
                    <span className="material-symbols-outlined text-[#e30a17]">speed</span> Akış Donma Engelleme Modu
                  </h3>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'low', label: 'Düşük Gecikme', desc: '5s Gecikme' },
                      { key: 'balanced', label: 'Dengeli', desc: '15s Tampon (Maç)' },
                      { key: 'stable', label: 'Süper Stabil', desc: '30s Tampon (Sıfır Donma)' }
                    ].map((mode) => (
                      <button
                        key={mode.key}
                        onClick={() => {
                          setLatencyMode(mode.key);
                          showToast(`Oynatma modu: ${mode.label} olarak değiştirildi. Yayın yükleniyor...`);
                        }}
                        className={`py-2 px-1 rounded-lg text-xs font-bold transition-all border flex flex-col items-center justify-center gap-0.5 ${
                          latencyMode === mode.key
                            ? 'bg-[#e30a17] text-white border-[#e30a17]'
                            : 'bg-white/5 hover:bg-white/10 text-zinc-300 border-white/5'
                        }`}
                      >
                        <span className="text-[11px]">{mode.label}</span>
                        <span className="text-[8px] opacity-75">{mode.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-[10px] text-zinc-500 leading-relaxed mt-4">
                  * Canlı yayın sağlayıcısının video paketleri 10 saniye boyutunda olduğu için, akıcı bir canlı maç deneyimi için <strong>Dengeli</strong> mod önerilir.
                </p>
              </div>

            </div>

          </div>

        </section>

        {/* Right Sidebar: Fan Chat */}
        <aside className="w-full lg:w-80 xl:w-96 bg-[#0e0e0e] border-l border-white/5 flex flex-col shrink-0 max-h-[calc(100vh-80px)]">
          <div className="p-4 border-b border-white/5 flex justify-between items-center bg-[#1c1b1b]/50">
            <h3 className="font-bold text-sm tracking-widest text-[#ffb4aa] uppercase flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#e30a17] pulse-dot"></span> SOHBET
            </h3>
            <span className="text-[10px] text-zinc-500 font-mono">CANLI CHAT</span>
          </div>

          {/* Chat Messages Log */}
          <div 
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4"
          >
            {chatMessages.map((msg) => (
              <div key={msg.id} className="flex gap-3 items-start animate-fade-in">
                {msg.isSystem ? (
                  <div className="w-8 h-8 rounded-lg bg-[#e30a17]/25 flex items-center justify-center text-[#ffb4aa] text-xs font-bold shrink-0">
                    SYS
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-300 text-xs font-bold shrink-0">
                    {msg.user[0]}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <span className={`text-xs font-bold truncate ${msg.isUser ? 'text-[#ffb4aa]' : msg.isPrimary ? 'text-zinc-300' : 'text-zinc-400'}`}>
                      {msg.user}
                    </span>
                    <span className="text-[9px] text-zinc-500 font-mono shrink-0 ml-2">{msg.time}</span>
                  </div>
                  <p className={`text-xs px-3 py-2 rounded-xl rounded-tl-none break-words leading-relaxed ${
                    msg.isSystem 
                      ? 'bg-red-500/5 text-zinc-400 italic border border-red-500/10' 
                      : msg.isUser 
                        ? 'bg-[#e30a17]/20 text-[#fff5f4] border border-[#e30a17]/30'
                        : 'bg-[#1c1b1b] text-zinc-300'
                  }`}>
                    {msg.text}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Chat Input & Quick Actions */}
          <div className="p-4 bg-[#1c1b1b]/50 border-t border-white/5 mt-auto">
            <form onSubmit={sendChatMessage} className="relative">
              <input 
                type="text" 
                className="w-full bg-[#131313] border border-white/10 rounded-lg py-2.5 px-4 pr-10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#e30a17] transition-all"
                placeholder="Mesaj gönder..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
              />
              <button 
                type="submit" 
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#e30a17] hover:scale-110 active:scale-95 transition-transform"
              >
                <span className="material-symbols-outlined text-lg">send</span>
              </button>
            </form>
            
            <div className="flex gap-2.5 mt-2.5">
              {['🇹🇷', '⚽', '🔥', '👏', '💥'].map((emoji) => (
                <button 
                  key={emoji}
                  onClick={() => insertEmoji(emoji)}
                  className="text-lg hover:scale-125 transition-transform active:scale-90"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </aside>

      </main>

      {/* Global Footer */}
      <footer className="bg-[#0e0e0e] border-t border-white/5 mt-auto z-10">
        <div className="flex flex-col md:flex-row justify-between items-center px-6 py-6 max-w-[1440px] mx-auto gap-4 text-xs text-zinc-500">
          <div className="font-display-hero text-[#ffb4aa] font-black tracking-wide uppercase text-sm">
            TÜRKİYE 2026
          </div>
          <div className="flex flex-wrap justify-center gap-4 text-zinc-500">
            <a className="hover:text-[#ffb4aa] transition-colors" href="#broadcast">Yayın Bilgileri</a>
            <a className="hover:text-[#ffb4aa] transition-colors" href="#privacy">Gizlilik Politikası</a>
            <a className="hover:text-[#ffb4aa] transition-colors" href="#terms">Kullanım Şartları</a>
            <a className="hover:text-[#ffb4aa] transition-colors" href="#support">Destek</a>
          </div>
          <p>© 2026 TÜRKİYE FUTBOL FEDERASYONU RESMİ IPTV. TÜM HAKLARI SAKLIDIR.</p>
        </div>
      </footer>

      {/* Toast Alert */}
      {toast && (
        <div className="toast-msg font-sans z-[999] border-[#e30a17]/30">
          <span className="material-symbols-outlined text-[#e30a17]">info</span>
          <span className="text-xs font-semibold">{toast}</span>
        </div>
      )}

    </div>
  );
}

export default App;
