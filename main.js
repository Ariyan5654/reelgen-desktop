const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec, execFile } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);
const execFilePromise = util.promisify(execFile);

const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
const ytDlp = require('yt-dlp-exec');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    backgroundColor: '#020617',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('process-video', async (event, payload) => {
  const { videoUrl, filePath, clipDurationType } = payload;
  
  const outputDir = path.join(app.getPath('userData'), 'ReelGenClips');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const fileId = 'vid_' + Date.now();
  let sourceFile = '';

  try {
    if (filePath) {
      sourceFile = filePath;
    } else if (videoUrl) {
      sourceFile = path.join(outputDir, `${fileId}_download.mp4`);
      await ytDlp(videoUrl, {
        output: sourceFile,
        format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/mp4/best',
        mergeOutputFormat: 'mp4',
        noPlaylist: true
      });
    } else {
      return { status: 'error', message: 'Please provide a YouTube URL or choose a local file.' };
    }

    const probeCmd = `"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${sourceFile}"`;
    const { stdout: durationRaw } = await execPromise(probeCmd);
    const totalDuration = parseFloat(durationRaw);

    if (!totalDuration || totalDuration <= 0) {
      return { status: 'error', message: 'Unable to inspect video duration.' };
    }

    let targetLength = 12;
    if (clipDurationType === '15-30') targetLength = 20;
    if (clipDurationType === '30-60') targetLength = 45;

    let clipIntervals = [];
    if (totalDuration > (targetLength * 3)) {
      clipIntervals = [
        { start: Math.floor(totalDuration * 0.10), length: targetLength, title: 'Key Hook & Opening Segment' },
        { start: Math.floor(totalDuration * 0.45), length: targetLength, title: 'Core Topic Highlight' },
        { start: Math.floor(totalDuration * 0.75), length: targetLength, title: 'Key Takeaway & Insight' }
      ];
    } else {
      clipIntervals = [
        { start: 0, length: Math.min(totalDuration, targetLength), title: 'Best Highlight Segment' }
      ];
    }

    const generatedClips = [];
    const antiClaimAudioFilter = "aformat=channel_layouts=stereo,asetrate=44100*1.05,atempo=1/1.05,aformat=channel_layouts=stereo,vibrato=f=4:d=0.25,equalizer=f=1200:t=q:w=1:g=-6,volume=1.1";

    for (let i = 0; i < clipIntervals.length; i++) {
      const interval = clipIntervals[i];
      const clipFileName = `clip_${fileId}_${i + 1}.mp4`;
      const outputPath = path.join(outputDir, clipFileName);

      const ffmpegArgs = [
        '-threads', '0',
        '-ss', interval.start.toString(),
        '-i', sourceFile,
        '-t', interval.length.toString(),
        '-vf', "crop=w='2*floor(min(iw,ih*9/16)/2)':h='2*floor(min(ih,iw*16/9)/2)',setsar=1",
        '-af', antiClaimAudioFilter,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '22',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-y',
        outputPath
      ];

      await execFilePromise(ffmpegPath, ffmpegArgs);

      if (fs.existsSync(outputPath)) {
        generatedClips.push({
          id: `clip_${i + 1}`,
          title: interval.title,
          filePath: outputPath,
          fileUrl: `file://${outputPath.replace(/\\/g, '/')}`,
          reason: 'Cropped to 9:16 vertical shorts aspect ratio.'
        });
      }
    }

    return { status: 'success', clips: generatedClips };

  } catch (error) {
    console.error('Processing Error:', error);
    return { status: 'error', message: error.message || 'Processing failed.' };
  }
});
