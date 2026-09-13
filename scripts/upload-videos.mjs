import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

async function batchUpload() {
  const videosDir = path.resolve('./videos');
  if (!fs.existsSync(videosDir)) {
    console.error('Error: Directory ./videos does not exist.');
    process.exit(1);
  }

  const files = fs.readdirSync(videosDir);
  const supportedExtensions = ['.mp4', '.mov', '.webm'];
  
  const videoFiles = files.filter(file => 
    supportedExtensions.includes(path.extname(file).toLowerCase())
  );

  const totalFiles = videoFiles.length;
  console.log(`Found ${totalFiles} video files in ./videos/\n`);

  if (totalFiles === 0) {
    console.error('No supported video files (.mp4, .mov, .webm) found.');
    process.exit(1);
  }

  const registry = [];

  for (let i = 0; i < videoFiles.length; i++) {
    const filename = videoFiles[i];
    const ext = path.extname(filename);
    const rawName = path.basename(filename, ext);
    // Sanitize filename to lowercase, replacing special chars with hyphen
    const sanitizedId = rawName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const fullPublicId = `aesthetic-split/${sanitizedId}`;
    const filePath = path.join(videosDir, filename);

    let videoDetails = null;

    // Check if asset already exists on Cloudinary to save upload calls
    try {
      videoDetails = await cloudinary.api.resource(fullPublicId, { resource_type: 'video' });
      console.log(`[${i + 1}/${totalFiles}] Skipped (Already exists): ${filename}`);
    } catch (err) {
      // Asset does not exist yet, upload it
    }

    if (!videoDetails) {
      console.log(`[${i + 1}/${totalFiles}] Uploading: ${filename}...`);
      try {
        videoDetails = await cloudinary.uploader.upload(filePath, {
          folder: 'aesthetic-split',
          resource_type: 'video',
          public_id: sanitizedId,
          overwrite: false,
        });
        console.log(`[${i + 1}/${totalFiles}] Completed: ${filename}`);
      } catch (uploadErr) {
        console.error(`[${i + 1}/${totalFiles}] Failed to upload ${filename}:`, uploadErr.message);
        continue;
      }
    }

    // Construct delivery URLs
    const videoUrl = cloudinary.url(videoDetails.public_id, {
      resource_type: 'video',
      secure: true,
      transformation: [
        { quality: 'auto', fetch_format: 'auto', width: 600 }
      ]
    });

    const posterUrl = cloudinary.url(videoDetails.public_id, {
      resource_type: 'video',
      secure: true,
      format: 'jpg',
      transformation: [
        { start_offset: '0', quality: 'auto', fetch_format: 'auto', width: 600 }
      ]
    });

    registry.push({
      id: sanitizedId,
      filename: filename,
      publicId: videoDetails.public_id,
      videoUrl: videoUrl,
      posterUrl: posterUrl,
      width: Number(videoDetails.width),
      height: Number(videoDetails.height),
      duration: Number(videoDetails.duration)
    });
  }

  // Save to src/data/exerciseVideos.json
  const outputDir = path.resolve('./src/data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'exerciseVideos.json');
  fs.writeFileSync(outputPath, JSON.stringify(registry, null, 2), 'utf-8');

  console.log(`\n========================================`);
  console.log(`BATCH UPLOAD COMPLETE`);
  console.log(`Successfully processed ${registry.length} / ${totalFiles} items.`);
  console.log(`Media registry saved to: ${outputPath}`);
  console.log(`========================================\n`);
}

batchUpload();
