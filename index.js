const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

const app = express();
const upload = multer();
const PORT = process.env.PORT || 3000;

app.post('/render', upload.fields([{ name: 'audio' }, { name: 'subs' }]), (req, res) => {
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

    ffmpeg()
        .input('color=black:s=1280x720:d=30')
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
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
