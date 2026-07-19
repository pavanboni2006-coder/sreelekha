const fs = require('fs');
const path = require('path');

const imagesDir = path.join(__dirname, 'assets', 'images');
const manifestPath = path.join(imagesDir, 'manifest.json');

// Supported image extensions
const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.heic'];

try {
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  const files = fs.readdirSync(imagesDir);
  const imageFiles = files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return validExtensions.includes(ext);
  });

  const manifestData = {
    images: imageFiles
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2));
  console.log(`✅ Gallery updated! Found ${imageFiles.length} photos in assets/images/`);
  console.log(imageFiles);
} catch (err) {
  console.error("❌ Error updating gallery manifest:", err);
}
