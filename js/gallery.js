/* Masonry Gallery & Permanent Relative Image Loader */
document.addEventListener('DOMContentLoaded', () => {
  const lightboxModal = document.getElementById('lightbox-modal');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxClose = document.getElementById('lightbox-close');
  const galleryGrid = document.getElementById('gallery-grid');
  const photoUploader = document.getElementById('photo-upload-input');

  // Load photos from permanent assets/images/manifest.json
  async function loadDeployedGallery() {
    if (!galleryGrid) return;

    try {
      // Fetch manifest containing relative filenames inside assets/images/
      const res = await fetch('assets/images/manifest.json?t=' + Date.now());
      if (!res.ok) throw new Error('Manifest not found');
      
      const data = await res.json();
      const images = data.images || [];

      renderGallery(images);
    } catch (err) {
      console.warn("Manifest loading notice:", err);
      renderGallery([]);
    }
  }

  function renderGallery(imageFiles) {
    if (!galleryGrid) return;
    galleryGrid.innerHTML = '';

    if (!imageFiles || imageFiles.length === 0) {
      // Empty state box
      const emptyState = document.createElement('div');
      emptyState.style.gridColumn = '1 / -1';
      emptyState.style.textAlign = 'center';
      emptyState.style.padding = '60px 20px';
      emptyState.style.borderRadius = '24px';
      emptyState.className = 'glass-panel';
      emptyState.innerHTML = `
        <div style="font-size: 3.2rem; margin-bottom: 15px;">📸</div>
        <h3 style="font-size: 1.5rem; color: #4a2840; margin-bottom: 10px;">Your Gallery is Empty</h3>
        <p style="color: var(--text-muted); font-size: 1rem; max-width: 480px; margin: 0 auto 15px auto;">
          No photos have been added to the deployment gallery yet.
        </p>
        <p style="color: #6e5e6d; font-size: 0.9rem;">
          Drop your photos into <code>assets/images/</code> in your repository and commit to publish them permanently!
        </p>
      `;
      galleryGrid.appendChild(emptyState);
      return;
    }

    imageFiles.forEach(filename => {
      // Permanent relative path
      const relativePath = `assets/images/${filename}`;
      const title = filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");

      const card = document.createElement('div');
      card.className = 'glass-panel gallery-card';
      card.innerHTML = `
        <img src="${relativePath}" alt="${title}" loading="lazy" />
        <div class="gallery-card-overlay">
          <h3>${title || 'Precious Memory ❤️'}</h3>
          <p>Click to expand</p>
        </div>
      `;

      // Lightbox Click Handler
      card.addEventListener('click', () => {
        if (lightboxImg && lightboxModal) {
          lightboxImg.src = relativePath;
          lightboxModal.classList.add('active');
        }
      });

      galleryGrid.appendChild(card);
    });
  }

  // Handle Lightbox Close
  if (lightboxClose) {
    lightboxClose.addEventListener('click', () => {
      if (lightboxModal) lightboxModal.classList.remove('active');
    });
  }

  if (lightboxModal) {
    lightboxModal.addEventListener('click', (e) => {
      if (e.target === lightboxModal) {
        lightboxModal.classList.remove('active');
      }
    });
  }

  // File Upload Helper (Gives direct guidance on how to commit photos permanently)
  if (photoUploader) {
    photoUploader.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      alert(`📷 Selected ${files.length} photo(s)!\n\nTo make them permanent on your deployed website:\n1. Move the photo file(s) into your project's 'assets/images/' folder.\n2. Commit & push to GitHub!\n\nThey will automatically appear on your published site permanently.`);
    });
  }

  // Initial load
  loadDeployedGallery();
});
