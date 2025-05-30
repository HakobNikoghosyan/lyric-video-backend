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

const getAudioDuration = (filePath) =>
  new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration);
    });
  });

app.post(
  '/render',
  upload.fields([
    { name: 'audio' },
    { name: 'subs' },
    { name: 'background', maxCount: 1 },
    { name: 'fontFile', maxCount: 1 },
    { name: 'fontName', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const audio = req.files['audio'][0];
      const srt = req.files['subs'][0];
      const bgImage = req.files['background']?.[0];
      const fontFile = req.files['fontFile']?.[0];
      const fontName = req.body.fontName || (fontFile ? path.parse(fontFile.originalname).name : 'Arial');

      const tempDir = path.join(__dirname, 'tmp');
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

      const id = Date.now();
      const audioPath = path.join(tempDir, `audio-${id}.mp3`);
      const srtPath = path.join(tempDir, `subs-${id}.srt`);
      const outPath = path.join(tempDir, `video-${id}.mp4`);
      const bgPath = bgImage ? path.join(tempDir, `bg-${id}.jpg`) : null;
      const fontPath = fontFile ? path.join(__dirname, 'fonts', `${id}-${fontFile.originalname}`) : null;

      fs.writeFileSync(audioPath, audio.buffer);
      fs.writeFileSync(srtPath, srt.buffer);
      if (bgImage) fs.writeFileSync(bgPath, bgImage.buffer);
      if (fontFile) {
        const fontsDir = path.join(__dirname, 'fonts');
        if (!fs.existsSync(fontsDir)) fs.mkdirSync(fontsDir);
        fs.writeFileSync(fontPath, fontFile.buffer);
      }

      const duration = await getAudioDuration(audioPath);

      const cmd = ffmpeg();

      if (bgPath) {
        cmd.input(bgPath)
          .loop()
          .inputOptions([
            '-t', `${duration}`
          ]);
      } else {
        cmd.input(`color=black:s=1280x720:d=${duration}`).inputOptions(['-f', 'lavfi']);
      }

      cmd.input(audioPath);
      cmd.input(srtPath);

      cmd
        .videoCodec('libx264')
        .outputOptions([
          '-preset', 'ultrafast',
          '-shortest',
          '-pix_fmt', 'yuv420p'
        ])
        .complexFilter(
          `subtitles=${srtPath}:fontsdir=${path.join(__dirname, 'fonts')}:force_style='FontName=${fontName},FontSize=40'`
        )
        .save(outPath)
        .on('end', () => {
          res.download(outPath, 'lyric-video.mp4', () => {
            [audioPath, srtPath, outPath, bgPath, fontPath].forEach((f) => {
              if (f && fs.existsSync(f)) fs.unlinkSync(f);
            });
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
  }
);

app.get('/', (_, res) => res.send('✅ Backend running'));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
