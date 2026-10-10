// YouTube to MP4 Converter Widget - High Performance Production Client Controller
interface VideoFormat {
  formatId: string;
  quality: string;
  label: string;
  isAudioOnly?: boolean;
}

interface VideoInfo {
  id: string;
  title: string;
  duration: number;
  durationFormatted: string;
  thumbnail: string;
  author: string;
  formats: VideoFormat[];
}

export function initConverterWidget() {
  const form = document.getElementById('converter-form') as HTMLFormElement | null;
  const urlInput = document.getElementById('video-url') as HTMLInputElement | null;
  const pasteBtn = document.getElementById('paste-btn');
  const convertBtn = document.getElementById('convert-btn') as HTMLButtonElement | null;
  const statusContainer = document.getElementById('converter-status');
  const alertContainer = document.getElementById('converter-alert');
  const previewContainer = document.getElementById('converter-preview');
  const actionContainer = document.getElementById('converter-action');
  const playerSection = document.getElementById('player-preview-section');
  const previewVideo = document.getElementById('preview-video') as HTMLVideoElement | null;

  if (!form || !urlInput || !convertBtn) return;

  // Active API base resolution: prefers Vite env / window.API_BASE_URL / live Render backend / port 8787
  let activeApiBase = (window as any).API_BASE_URL || (import.meta as any).env?.PUBLIC_API_URL || 'https://youtube-to-mp4-backend.onrender.com';
  let isApiBaseLocked = false;
  let currentVideoInfo: VideoInfo | null = null;
  const rootEl = document.getElementById('converter-root');
  const initialQuality = rootEl?.getAttribute('data-default-quality');
  let selectedFormat = initialQuality || '1080p';
  let pollInterval: any = null;

  // Handle Clipboard Paste Button
  pasteBtn?.addEventListener('click', async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        urlInput.value = text.trim();
        urlInput.focus();
      }
    } catch {
      urlInput.focus();
    }
  });

  // Extract YouTube 11-char Video ID from any URL permutation
  function extractYoutubeId(inputUrl: string): string | null {
    if (!inputUrl) return null;
    const trimmed = inputUrl.trim();

    // 1. Direct ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
      return trimmed;
    }

    // 2. Standard and Short Regex
    const regex = /(?:youtu\.be\/|(?:www\.|m\.|music\.)?youtube\.com\/(?:embed\/|v\/|e\/|shorts\/|live\/|watch\?v=|watch\?.+&v=))([a-zA-Z0-9_-]{11})/i;
    const match = trimmed.match(regex);
    if (match && match[1]) {
      return match[1];
    }

    // 3. Fallback URL parser
    try {
      const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
      if (parsed.searchParams.has('v')) {
        const v = parsed.searchParams.get('v');
        if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
      }
      if (parsed.hostname.includes('youtu.be')) {
        const id = parsed.pathname.slice(1).split('/')[0];
        if (id && id.length === 11) return id;
      }
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      for (const part of pathParts) {
        if (/^[a-zA-Z0-9_-]{11}$/.test(part)) return part;
      }
    } catch {}

    return null;
  }

  function showAlert(msg: string, type: 'danger' | 'success' | 'warning' = 'danger') {
    if (!alertContainer) return;
    alertContainer.className = `alert alert-${type}`;
    alertContainer.textContent = msg;
    alertContainer.style.display = 'block';
  }

  function clearAlert() {
    if (!alertContainer) return;
    alertContainer.style.display = 'none';
    alertContainer.textContent = '';
  }

  function setLoading(isLoading: boolean, text: string = 'Processing...') {
    convertBtn!.disabled = isLoading;
    if (isLoading) {
      convertBtn!.innerHTML = `<span class="spinner" aria-hidden="true"></span> <span>${text}</span>`;
    } else {
      convertBtn!.innerHTML = `<span>Convert</span> <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
    }
  }

  // Resilient API Fetcher: automatically detects port 8787, environment URL, or proxied /api
  async function callApi(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const rawCandidates = [
      (window as any).API_BASE_URL,
      (import.meta as any).env?.PUBLIC_API_URL,
      'https://youtube-to-mp4-backend.onrender.com',
      'https://youtube-to-mp4-backend.onrender.com/api',
      activeApiBase,
      'http://127.0.0.1:8787/api',
      'http://localhost:8787/api',
      'http://127.0.0.1:8787',
      'http://localhost:8787',
      '/api'
    ].filter(Boolean);

    const candidates = isApiBaseLocked
      ? [activeApiBase]
      : Array.from(new Set(rawCandidates));

    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    let lastResponse: Response | null = null;

    for (const base of candidates) {
      const cleanBase = base.replace(/\/+$/, '');
      const fullUrl = `${cleanBase}${cleanEndpoint}`;

      try {
        const res = await fetch(fullUrl, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
          }
        });

        // Only lock if the endpoint is a genuine API response
        // (404 or 502/504 means the candidate is not a live converter endpoint)
        if (res.ok || res.status === 400 || res.status === 429) {
          activeApiBase = cleanBase;
          isApiBaseLocked = true;
          return res;
        }

        lastResponse = res;
      } catch (networkErr) {
        // Continue trying next candidate
      }
    }

    if (lastResponse) {
      return lastResponse;
    }

    throw new Error('Unable to connect to the converter service. Please ensure the backend server is running on port 8787 or set PUBLIC_API_URL.');
  }

  // Phase 1: Fetch Video Details
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert();
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }

    const rawUrl = urlInput.value.trim();
    if (!rawUrl) {
      showAlert('Please enter or paste a valid YouTube video URL.');
      return;
    }

    const videoId = extractYoutubeId(rawUrl);
    if (!videoId) {
      showAlert('Invalid URL. Please enter a valid YouTube video, Shorts, or youtu.be link.');
      return;
    }

    const turnstileInput = form.querySelector('[name="cf-turnstile-response"]') as HTMLInputElement;
    const turnstileToken = turnstileInput ? turnstileInput.value : '';

    setLoading(true, 'Fetching video info...');

    try {
      let videoData: VideoInfo | null = null;

      // 1. First attempt: Query configured backend service
      try {
        const res = await callApi('/info', {
          method: 'POST',
          body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${videoId}`, videoId, turnstileToken })
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.video) {
            videoData = data.video;
          }
        }
      } catch (backendError) {
        console.info('[CONVERTER] Local backend not responding to /info, utilizing client oEmbed fallback.');
      }

      // 2. Fallback: Query YouTube's official CORS-friendly oEmbed endpoint
      if (!videoData) {
        try {
          const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
          const oembedRes = await fetch(oembedUrl);
          if (oembedRes.ok) {
            const oembed = await oembedRes.json();
            videoData = {
              id: videoId,
              title: oembed.title || `YouTube Video (${videoId})`,
              author: oembed.author_name || 'YouTube Creator',
              duration: 240,
              durationFormatted: 'HD Stream',
              thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
              formats: [
                { formatId: '1080p', quality: '1080p Full HD', label: '1080p (MP4)' },
                { formatId: '720p', quality: '720p HD', label: '720p (MP4)' },
                { formatId: '4k', quality: '4K Ultra HD', label: '4K (MP4)' },
                { formatId: '360p', quality: '360p Fast', label: '360p (MP4)' },
                { formatId: 'mp3', quality: 'Audio Only', label: 'MP3 Audio', isAudioOnly: true }
              ]
            };
          }
        } catch {
          // Continue to guaranteed fallback
        }
      }

      // 3. Guaranteed Fallback: ALWAYS construct valid preview metadata from video ID
      if (!videoData) {
        videoData = {
          id: videoId,
          title: `YouTube Video (${videoId})`,
          author: 'YouTube Creator',
          duration: 240,
          durationFormatted: 'HD Stream',
          thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          formats: [
            { formatId: '1080p', quality: '1080p Full HD', label: '1080p (MP4)' },
            { formatId: '720p', quality: '720p HD', label: '720p (MP4)' },
            { formatId: '4k', quality: '4K Ultra HD', label: '4K (MP4)' },
            { formatId: '360p', quality: '360p Fast', label: '360p (MP4)' },
            { formatId: 'mp3', quality: 'Audio Only', label: 'MP3 Audio', isAudioOnly: true }
          ]
        };
      }

      currentVideoInfo = videoData;
      renderVideoPreview(videoData);
      setLoading(false);
    } catch (err: any) {
      setLoading(false);
      showAlert(err.message || 'Error occurred while loading video details. Please check your network and URL.');
    }
  });

  // Render Video Preview Card & Quality Selector
  function renderVideoPreview(video: VideoInfo) {
    if (!previewContainer || !actionContainer) return;

    previewContainer.innerHTML = `
      <div class="video-preview-card">
        <div class="video-thumb-container">
          <img src="${video.thumbnail}" alt="${escapeHtml(video.title)}" class="video-thumb" loading="lazy" width="160" height="90" />
        </div>
        <div class="video-meta">
          <h4>${escapeHtml(video.title)}</h4>
          <p>Channel: <strong>${escapeHtml(video.author)}</strong> • Format: <strong>${video.durationFormatted}</strong></p>
          <div class="quality-grid" id="quality-selector">
            <button type="button" class="quality-btn ${selectedFormat === '1080p' ? 'active' : ''}" data-format="1080p">
              <span>1080p Full HD</span>
              <span class="quality-badge">MP4</span>
            </button>
            <button type="button" class="quality-btn ${selectedFormat === '720p' ? 'active' : ''}" data-format="720p">
              <span>720p HD</span>
              <span class="quality-badge">MP4</span>
            </button>
            <button type="button" class="quality-btn ${selectedFormat === '4k' ? 'active' : ''}" data-format="4k">
              <span>4K Ultra HD</span>
              <span class="quality-badge">MP4</span>
            </button>
            <button type="button" class="quality-btn ${selectedFormat === '360p' ? 'active' : ''}" data-format="360p">
              <span>360p Fast</span>
              <span class="quality-badge">MP4</span>
            </button>
            <button type="button" class="quality-btn ${selectedFormat === 'mp3' ? 'active' : ''}" data-format="mp3">
              <span>Audio Only</span>
              <span class="quality-badge" style="background:#8b5cf6;">MP3</span>
            </button>
          </div>
        </div>
      </div>
    `;

    actionContainer.innerHTML = `
      <button type="button" id="start-conversion-btn" class="btn-convert" style="width:100%;">
        Download ${selectedFormat.toUpperCase()}
      </button>
    `;

    const qualityBtns = previewContainer.querySelectorAll('.quality-btn');
    qualityBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        qualityBtns.forEach((b) => b.classList.remove('active'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        selectedFormat = target.getAttribute('data-format') || '1080p';
        const startBtn = document.getElementById('start-conversion-btn');
        if (startBtn) startBtn.textContent = `Download ${selectedFormat.toUpperCase()}`;
      });
    });

    document.getElementById('start-conversion-btn')?.addEventListener('click', () => {
      startConversion();
    });

    if (statusContainer) statusContainer.style.display = 'block';
  }

  // Phase 2: Start Real Conversion
  async function startConversion() {
    if (!currentVideoInfo) return;
    clearAlert();

    const startBtn = document.getElementById('start-conversion-btn') as HTMLButtonElement | null;
    if (startBtn) {
      startBtn.disabled = true;
      startBtn.innerHTML = `<span class="spinner" aria-hidden="true"></span> Initializing conversion...`;
    }

    try {
      const res = await callApi('/convert', {
        method: 'POST',
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${currentVideoInfo.id}`,
          videoId: currentVideoInfo.id,
          format: selectedFormat
        })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error((data && data.error) ? data.error : `Conversion request failed (Status ${res.status}).`);
      }

      if (!data || !data.jobId) {
        throw new Error('Invalid response from conversion backend.');
      }

      // Track the real backend conversion job
      trackBackendJob(data.jobId);
    } catch (err: any) {
      if (startBtn) {
        startBtn.disabled = false;
        startBtn.textContent = `Download ${selectedFormat.toUpperCase()}`;
      }
      showAlert(err.message || 'Error occurred starting conversion. Please check backend server on port 8787.', 'danger');
    }
  }

  // Phase 3: Track Real Backend Job Progress
  function trackBackendJob(jobId: string) {
    if (!actionContainer) return;

    actionContainer.innerHTML = `
      <div style="text-align:center; padding: 1rem 0;">
        <p id="conversion-status-label" style="font-weight:600; margin-bottom: 0.5rem;">Downloading video stream...</p>
        <div class="progress-bar-container">
          <div id="progress-bar-fill" class="progress-bar-fill" style="width: 15%;"></div>
        </div>
        <small style="color:var(--text-muted)">Processing video and audio tracks via yt-dlp/ffmpeg engine on port 8787.</small>
      </div>
    `;

    const statusLabel = document.getElementById('conversion-status-label');
    const progressBar = document.getElementById('progress-bar-fill');

    if (pollInterval) clearInterval(pollInterval);

    pollInterval = setInterval(async () => {
      try {
        const res = await callApi(`/status/${jobId}`);
        const data = await res.json();

        if (data.status === 'processing') {
          if (progressBar) progressBar.style.width = `${Math.max(15, data.progress || 35)}%`;
          if (statusLabel && data.message) statusLabel.textContent = data.message;
        } else if (data.status === 'completed') {
          clearInterval(pollInterval);
          pollInterval = null;
          if (progressBar) progressBar.style.width = '100%';
          renderCompletedState(jobId, data.downloadUrl || `/api/download/${jobId}`);
        } else if (data.status === 'failed') {
          clearInterval(pollInterval);
          pollInterval = null;
          showAlert(data.error || 'Conversion process failed. Please check video availability.', 'danger');
          
          // Restore action button so user can retry
          if (actionContainer) {
            actionContainer.innerHTML = `
              <button type="button" id="start-conversion-btn" class="btn-convert" style="width:100%;">
                Retry Download ${selectedFormat.toUpperCase()}
              </button>
            `;
            document.getElementById('start-conversion-btn')?.addEventListener('click', () => {
              startConversion();
            });
          }
        }
      } catch (pollErr: any) {
        clearInterval(pollInterval);
        pollInterval = null;
        showAlert('Lost connection to backend server on port 8787 during conversion.', 'danger');
      }
    }, 1500);
  }

  // Phase 4: Render Completed State with Direct Physical Download
  function renderCompletedState(jobId: string, downloadUrl: string) {
    if (!actionContainer || !currentVideoInfo) return;

    // Resolve full physical download URL cleanly
    let finalDownloadUrl = downloadUrl;
    if (!finalDownloadUrl.startsWith('http')) {
      const baseWithoutApi = activeApiBase.replace(/\/+$/, '').replace(/\/api$/, '');
      const cleanPath = downloadUrl.startsWith('/') ? downloadUrl : `/${downloadUrl}`;
      finalDownloadUrl = `${baseWithoutApi}${cleanPath}`;
    }

    const filename = `youtube_${currentVideoInfo.id}_${selectedFormat}.${selectedFormat === 'mp3' ? 'mp3' : 'mp4'}`;

    actionContainer.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:0.75rem; align-items:center;">
        <div class="alert alert-success" style="width:100%; text-align:center; margin:0 0 0.5rem; font-weight: 600;">
          ✓ Video ready in <strong>${selectedFormat.toUpperCase()}</strong> format!
        </div>

        <a
          href="${finalDownloadUrl}"
          download="${filename}"
          id="btn-actual-download"
          class="btn-convert"
          style="width:100%; text-decoration:none; display:flex; align-items:center; justify-content:center; gap:0.5rem;"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
          </svg>
          Download ${selectedFormat.toUpperCase()} Video Now
        </a>

        <button type="button" id="btn-preview-in-player" class="quality-btn" style="width:100%; padding:0.75rem;">
          ▶ Preview Converted Video in Player Below ▾
        </button>
      </div>
    `;

    // Cross-origin download trigger fallback
    const downloadBtn = document.getElementById('btn-actual-download') as HTMLAnchorElement | null;
    if (downloadBtn) {
      downloadBtn.addEventListener('click', async (e) => {
        // If cross-origin, fetch as blob to guarantee the browser's download prompt opens
        if (finalDownloadUrl.startsWith('http') && !finalDownloadUrl.startsWith(window.location.origin)) {
          e.preventDefault();
          try {
            downloadBtn.style.opacity = '0.7';
            downloadBtn.innerText = 'Preparing download...';
            const res = await fetch(finalDownloadUrl);
            if (!res.ok) throw new Error('Download failed');
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
            downloadBtn.style.opacity = '1';
            downloadBtn.innerText = `Download ${selectedFormat.toUpperCase()} Video Now`;
          } catch {
            // Direct navigation fallback
            window.location.href = finalDownloadUrl;
          }
        }
      });
    }

    // Connect to Built-in Player with inline stream
    document.getElementById('btn-preview-in-player')?.addEventListener('click', () => {
      if (playerSection && currentVideoInfo) {
        playerSection.scrollIntoView({ behavior: 'smooth' });

        const playerTitle = document.getElementById('player-video-title');
        if (playerTitle) playerTitle.textContent = currentVideoInfo.title;

        if (previewVideo) {
          // Stream the actual converted video using preview=true for inline playback
          previewVideo.src = `${finalDownloadUrl}?preview=true`;
          previewVideo.load();
          previewVideo.play().catch(() => {
            console.log('[PLAYER] Autoplay blocked, user can click play.');
          });
        }
      }
    });
  }

  function escapeHtml(str: string): string {
    return str.replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m] || m));
  }
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initConverterWidget);
  } else {
    initConverterWidget();
  }
}
