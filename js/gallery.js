/* Gallery Controller — Files loaded and saved ONLY to public/assets/images/ */
document.addEventListener('DOMContentLoaded', () => {
  const lightboxModal = document.getElementById('lightbox-modal');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxClose = document.getElementById('lightbox-close');
  const galleryGrid = document.getElementById('gallery-grid');
  const addPhotoBtn = document.getElementById('add-photo-btn');
  const photoUploader = document.getElementById('photo-upload-input');
  const gallerySection = document.getElementById('gallery');

  // Load photos list from public/assets/manifest.json or API
  async function fetchGalleryPhotos() {
    try {
      const res = await fetch('public/assets/manifest.json?t=' + Date.now());
      if (res.ok) {
        const data = await res.json();
        return data.photos || [];
      }
    } catch (e) {
      console.log('Manifest fetch fallback to API');
    }

    try {
      const res = await fetch('/api/manifest');
      if (res.ok) {
        const data = await res.json();
        return data.photos || [];
      }
    } catch (e) {
      console.error('Could not fetch manifest', e);
    }
    return [];
  }

  // Render Gallery items strictly from public/assets/images/
  async function renderGallery() {
    if (!galleryGrid) return;
    const photos = await fetchGalleryPhotos();

    galleryGrid.innerHTML = '';

    if (photos.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.style.gridColumn = '1 / -1';
      emptyState.style.textAlign = 'center';
      emptyState.style.padding = '60px 20px';
      emptyState.style.borderRadius = '24px';
      emptyState.className = 'glass-panel';
      emptyState.innerHTML = `
        <div style="font-size: 3.2rem; margin-bottom: 15px;">📸</div>
        <h3 style="font-size: 1.5rem; color: #4a2840; margin-bottom: 10px;">Your Gallery is Empty</h3>
        <p style="color: var(--text-muted); font-size: 1rem; max-width: 450px; margin: 0 auto;">
          Click the <strong>"📷 Add / Replace Photos"</strong> button above to upload photos directly to <code>public/assets/images/</code>!
        </p>
      `;
      galleryGrid.appendChild(emptyState);
      return;
    }

    photos.forEach((photoData) => {
      const card = document.createElement('div');
      card.className = 'glass-panel gallery-card';
      const imagePath = photoData.path || `public/assets/images/${photoData.filename}`;

      card.innerHTML = `
        <img src="${imagePath}" alt="${photoData.title || 'Sister Memory'}" />
        <button class="gallery-delete-btn" title="Delete Photo" data-path="${imagePath}">🗑️</button>
        <div class="gallery-card-overlay">
          <h3>${photoData.title || 'Precious Memory ❤️'}</h3>
          <p>Click to view full screen</p>
        </div>
      `;

      // Lightbox click
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('gallery-delete-btn')) return;
        if (lightboxImg && lightboxModal) {
          lightboxImg.src = imagePath;
          lightboxModal.classList.add('active');
        }
      });

      // Delete click
      const deleteBtn = card.querySelector('.gallery-delete-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await deletePhotoFile(imagePath);
          renderGallery();
        });
      }

      galleryGrid.appendChild(card);
    });
  }

  async function deletePhotoFile(relativePath) {
    try {
      await fetch('/api/delete-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relativePath })
      });
    } catch (e) {
      console.error('Failed to delete file', e);
    }
  }

  // File Upload Handler -> Uploads directly to backend public/assets/images/
  async function uploadImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const res = await fetch('/api/upload-photo', {
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

  // Trigger file selection
  if (addPhotoBtn && photoUploader) {
    addPhotoBtn.addEventListener('click', (e) => {
      e.preventDefault();
      photoUploader.click();
    });
  }

  async function handleFiles(files) {
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    let successCount = 0;
    let errorMsgs = [];

    for (const file of fileList) {
      try {
        await uploadImageFile(file);
        successCount++;
      } catch (err) {
        errorMsgs.push(err.message);
      }
    }

    if (successCount > 0) {
      await renderGallery();
      if (window.confettiEngine) {
        window.confettiEngine.spawn(100);
      }
    }

    if (errorMsgs.length > 0) {
      alert("Upload notice:\n" + errorMsgs.join("\n"));
    }
  }

  if (photoUploader) {
    photoUploader.addEventListener('change', (e) => {
      handleFiles(e.target.files);
      photoUploader.value = '';
    });
  }

  // Drag & drop support
  if (gallerySection) {
    gallerySection.addEventListener('dragover', (e) => {
      e.preventDefault();
      gallerySection.style.border = '2px dashed var(--primary-pink)';
    });

    gallerySection.addEventListener('dragleave', (e) => {
      e.preventDefault();
      gallerySection.style.border = 'none';
    });

    gallerySection.addEventListener('drop', (e) => {
      e.preventDefault();
      gallerySection.style.border = 'none';
      if (e.dataTransfer && e.dataTransfer.files) {
        handleFiles(e.dataTransfer.files);
      }
    });
  }

  // Lightbox close handlers
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

  // Initial render on page load
  renderGallery();
});
