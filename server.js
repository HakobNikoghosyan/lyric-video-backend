const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const cors = require('cors');

const app = express();
const upload = multer();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Get audio duration using ffprobe
const getAudioDuration = (filePath) =>
  new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration);
    });
  });

// POST /render route
app.post('/render', upload.fields([{ name: 'audio' }, { name: 'subs' }]), async (req, res) => {
  try {
    const audio = req.files['audio'][0];
    const srt = req.files['subs'][0];

    const tempDir = path.join(__dirname, 'tmp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

    const id = Date.now();
    const audioPath = path.join(tempDir, `audio-${id}.mp3`);
    const srtPath = path.join(tempDir, `subs-${id}.srt`);
    const outPath = path.join(tempDir, `video-${id}.mp4`);

    fs.writeFileSync(audioPath, audio.buffer);
    fs.writeFileSync(srtPath, srt.buffer);

    const duration = await getAudioDuration(audioPath);

    ffmpeg()
      .input(`color=black:s=1280x720:d=${duration}`)
      .inputOptions('-f', 'lavfi')
      .input(audioPath)
      .input(srtPath)
      .videoCodec('libx264')
      .outputOptions('-preset', 'ultrafast', '-shortest')
      .complexFilter(`subtitles=${srtPath}:force_style='FontName=Arial,FontSize=24'`)
      .save(outPath)
      .on('end', () => {
        res.download(outPath, 'lyric-video.mp4', () => {
          fs.unlinkSync(audioPath);
          fs.unlinkSync(srtPath);
          fs.unlinkSync(outPath);
        });
      })
      .on('error', (err) => {
        console.error('FFmpeg error:', err);
        res.status(500).send('Video rendering failed');
      });
  } catch (err) {
    console.error('Render error:', err);
    res.status(500).send('Unexpected error');
  }
});

// Optional health check route
app.get('/', (_, res) => res.send('✅ Backend running'));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
