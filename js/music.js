/* Music Player — Audio files saved and loaded ONLY from public/assets/audio/ */
class BirthdayAudioPlayer {
  constructor() {
    this.isPlaying = false;
    this.audioElement = new Audio();
    this.audioElement.loop = false;
    
    this.playlist = [];
    this.currentTrackIndex = -1;

    this.toggleBtn = document.getElementById('music-toggle');
    this.initListeners();
    this.loadPlaylistFromManifest();
  }

  async loadPlaylistFromManifest() {
    try {
      const res = await fetch('public/assets/manifest.json?t=' + Date.now());
      if (res.ok) {
        const data = await res.json();
        this.playlist = data.songs || [];
        this.updatePlaylistUI();
        return;
      }
    } catch(e) {}

    try {
      const res = await fetch('/api/manifest');
      if (res.ok) {
        const data = await res.json();
        this.playlist = data.songs || [];
        this.updatePlaylistUI();
      }
    } catch(e) {
      console.error('Could not fetch music manifest', e);
    }
  }

  initListeners() {
    if (this.toggleBtn) {
      this.toggleBtn.addEventListener('click', () => this.togglePlay());
    }

    this.audioElement.addEventListener('ended', () => {
      if (this.playlist.length > 0) {
        let nextIndex = (this.currentTrackIndex + 1) % this.playlist.length;
        this.playTrack(nextIndex);
      } else {
        this.pause();
      }
    });

    // Custom MP3 song uploader -> saves to public/assets/audio/
    const musicUploader = document.getElementById('music-file-input');
    if (musicUploader) {
      musicUploader.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        for (const file of files) {
          if (file && file.type.startsWith('audio/')) {
            await this.uploadAudioFile(file);
          }
        }

        await this.loadPlaylistFromManifest();

        // Auto-play first uploaded song if not playing
        if (!this.isPlaying && this.playlist.length > 0 && this.currentTrackIndex === -1) {
          this.playTrack(0);
        }

        musicUploader.value = '';
      });
    }
  }

  async uploadAudioFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const res = await fetch('/api/upload-song', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              filename: file.name,
              base64Data: e.target.result
            })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            resolve(data);
          } else {
            reject(new Error(data.error || 'Upload failed'));
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  togglePlay() {
    if (this.playlist.length === 0) {
      alert("Please click '🎶 Add Song (.mp3)' to upload your favorite songs to public/assets/audio/ first!");
      return;
    }

    if (this.isPlaying) {
      this.pause();
    } else {
      if (this.currentTrackIndex === -1) {
        this.playTrack(0);
      } else {
        this.play();
      }
    }
  }

  play() {
    if (this.playlist.length === 0 || this.currentTrackIndex < 0) return;
    const currentTrack = this.playlist[this.currentTrackIndex];

    if (currentTrack) {
      const trackSrc = currentTrack.path || `public/assets/audio/${currentTrack.filename}`;
      if (this.audioElement.src !== trackSrc) {
        this.audioElement.src = trackSrc;
      }
      this.audioElement.play().then(() => {
        this.isPlaying = true;
        if (this.toggleBtn) {
          this.toggleBtn.classList.add('playing');
          this.toggleBtn.innerHTML = '🎵';
          this.toggleBtn.title = "Pause Music";
        }
        this.updatePlaylistUI();
      }).catch(err => {
        console.log('Audio playback notice:', err);
      });
    }
  }

  pause() {
    this.isPlaying = false;
    if (this.toggleBtn) {
      this.toggleBtn.classList.remove('playing');
      this.toggleBtn.innerHTML = '🎶';
      this.toggleBtn.title = "Play Music";
    }
    if (this.audioElement) {
      this.audioElement.pause();
    }
    this.updatePlaylistUI();
  }

  playTrack(index) {
    if (index < 0 || index >= this.playlist.length) return;
    this.currentTrackIndex = index;
    const currentTrack = this.playlist[index];
    const trackSrc = currentTrack.path || `public/assets/audio/${currentTrack.filename}`;
    this.audioElement.src = trackSrc;
    this.play();
  }

  async deleteTrack(index) {
    if (index < 0 || index >= this.playlist.length) return;
    const track = this.playlist[index];
    const trackSrc = track.path || `public/assets/audio/${track.filename}`;

    if (index === this.currentTrackIndex) {
      this.pause();
      this.audioElement.src = '';
      this.currentTrackIndex = -1;
    } else if (index < this.currentTrackIndex) {
      this.currentTrackIndex--;
    }

    try {
      await fetch('/api/delete-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relativePath: trackSrc })
      });
    } catch(e) {}

    await this.loadPlaylistFromManifest();
  }

  updatePlaylistUI() {
    const playlistContainer = document.getElementById('playlist-container');
    if (!playlistContainer) return;

    playlistContainer.innerHTML = '';

    if (this.playlist.length === 0) {
      const emptyCard = document.createElement('div');
      emptyCard.className = 'glass-panel';
      emptyCard.style.gridColumn = '1 / -1';
      emptyCard.style.textAlign = 'center';
      emptyCard.style.padding = '40px 20px';
      emptyCard.style.borderRadius = '22px';
      emptyCard.innerHTML = `
        <div style="font-size: 2.8rem; margin-bottom: 10px;">🎵</div>
        <h4 style="font-size: 1.3rem; color: #4a2840; margin-bottom: 8px;">No Songs Added Yet</h4>
        <p style="color: var(--text-muted); font-size: 0.95rem; max-width: 400px; margin: 0 auto;">
          Click the <strong>"🎶 Add Song (.mp3)"</strong> button above to upload songs to <code>public/assets/audio/</code>!
        </p>
      `;
      playlistContainer.appendChild(emptyCard);
      return;
    }

    this.playlist.forEach((track, index) => {
      const isCurrent = index === this.currentTrackIndex;
      const card = document.createElement('div');
      card.className = `glass-panel track-card ${isCurrent ? 'active' : ''}`;
      card.style.position = 'relative';
      card.innerHTML = `
        <div class="track-icon">${isCurrent && this.isPlaying ? '▶️' : '🎵'}</div>
        <div class="track-info" style="flex: 1;">
          <h4>${track.title || track.filename}</h4>
          <p>Saved in public/assets/audio/</p>
        </div>
        <button class="track-delete-btn" title="Remove song" style="background: transparent; border: none; font-size: 1.1rem; cursor: pointer; opacity: 0.7; transition: opacity 0.2s;" data-index="${index}">🗑️</button>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('track-delete-btn')) return;
        this.playTrack(index);
      });

      const delBtn = card.querySelector('.track-delete-btn');
      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.deleteTrack(index);
        });
      }

      playlistContainer.appendChild(card);
    });
  }
}

window.birthdayAudio = new BirthdayAudioPlayer();
document.addEventListener('DOMContentLoaded', () => {
  if (window.birthdayAudio) {
    window.birthdayAudio.loadPlaylistFromManifest();
  }
});
