/* Robust Gallery & Lightbox Controller with IndexedDB + LocalStorage Persistence */
document.addEventListener('DOMContentLoaded', () => {
  const lightboxModal = document.getElementById('lightbox-modal');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxClose = document.getElementById('lightbox-close');
  const galleryGrid = document.getElementById('gallery-grid');
  const addPhotoBtn = document.getElementById('add-photo-btn');
  const photoUploader = document.getElementById('photo-upload-input');
  const gallerySection = document.getElementById('gallery');

  const DB_NAME = 'AkkaGalleryDB';
  const STORE_NAME = 'photos';
  const LOCAL_STORAGE_KEY = 'akka_uploaded_gallery_photos_backup';

  // --- 1. IndexedDB Persistence Layer ---
  function openDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        resolve(null);
        return;
      }
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => resolve(null);
    });
  }

  async function getStoredPhotos() {
    const db = await openDB();
    if (db) {
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          const result = req.result || [];
          // Sort newest first
          result.sort((a, b) => b.timestamp - a.timestamp);
          resolve(result);
        };
        req.onerror = () => resolve(getLocalStoragePhotos());
      });
    }
    return getLocalStoragePhotos();
  }

  async function savePhotoItem(photoItem) {
    const db = await openDB();
    if (db) {
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(photoItem);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => {
          saveToLocalStorage(photoItem);
          resolve(false);
        };
      });
    } else {
      saveToLocalStorage(photoItem);
    }
  }

  async function deleteStoredPhoto(id) {
    const db = await openDB();
    if (db) {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
    }
    deleteFromLocalStorage(id);
  }

  function getLocalStoragePhotos() {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function saveToLocalStorage(photoItem) {
    try {
      const existing = getLocalStoragePhotos();
      existing.unshift(photoItem);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(existing.slice(0, 15)));
    } catch (e) {
      console.warn("LocalStorage fallback limit reached", e);
    }
  }

  function deleteFromLocalStorage(id) {
    try {
      const existing = getLocalStoragePhotos().filter(p => p.id !== id);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(existing));
    } catch (e) {}
  }

  // --- 2. Image Compression & Processing (Up to 10MB support) ---
  function processAndCompressImage(file) {
    return new Promise((resolve, reject) => {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      const fileExt = file.name.split('.').pop().toLowerCase();
      const isExtValid = ['jpg', 'jpeg', 'png', 'webp'].includes(fileExt);

      if (!validTypes.includes(file.type) && !isExtValid) {
        reject(new Error(`"${file.name}" is not a valid JPG, PNG, or WEBP image.`));
        return;
      }

      // Max size: 10MB (10 * 1024 * 1024 bytes)
      const MAX_SIZE = 10 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        reject(new Error(`"${file.name}" exceeds the 10MB size limit.`));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Resize canvas if larger than 1400px to guarantee fast rendering & saving
          const maxDim = 1400;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Produce high quality WEBP/JPEG compressed Data URL
          const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          const dataUrl = canvas.toDataURL(outputType, 0.85);

          resolve({
            id: 'photo_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            src: dataUrl,
            title: file.name.replace(/\.[^/.]+$/, "") || 'Precious Memory ❤️',
            timestamp: Date.now()
          });
        };
        img.onerror = () => reject(new Error(`Failed to load image "${file.name}".`));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error(`Failed to read file "${file.name}".`));
      reader.readAsDataURL(file);
    });
  }

  // --- 3. UI Rendering ---
  async function renderGallery() {
    if (!galleryGrid) return;
    const photos = await getStoredPhotos();

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
          Click the <strong>"📷 Add / Replace Photos"</strong> button above to upload your favorite memories with Akka!
        </p>
      `;
      galleryGrid.appendChild(emptyState);
      return;
    }

    photos.forEach((photoData) => {
      const card = document.createElement('div');
      card.className = 'glass-panel gallery-card';
      card.innerHTML = `
        <img src="${photoData.src}" alt="${photoData.title}" />
        <button class="gallery-delete-btn" title="Delete Photo" data-id="${photoData.id}">🗑️</button>
        <div class="gallery-card-overlay">
          <h3>${photoData.title}</h3>
          <p>Click to view full screen</p>
        </div>
      `;

      // Lightbox click
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('gallery-delete-btn')) return;
        if (lightboxImg && lightboxModal) {
          lightboxImg.src = photoData.src;
          lightboxModal.classList.add('active');
        }
      });

      // Delete click
      const deleteBtn = card.querySelector('.gallery-delete-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await deleteStoredPhoto(photoData.id);
          renderGallery();
        });
      }

      galleryGrid.appendChild(card);
    });
  }

  // --- 4. Upload Trigger & Handlers ---
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
        const photoItem = await processAndCompressImage(file);
        await savePhotoItem(photoItem);
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

  // Drag and drop support on gallery section
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
