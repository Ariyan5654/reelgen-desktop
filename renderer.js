let selectedFilePath = '';

document.getElementById('video_file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    selectedFilePath = file.path;
    const fileNameDisplay = document.getElementById('file-name');
    fileNameDisplay.textContent = `Selected Local File: ${file.name}`;
    fileNameDisplay.classList.remove('hidden');
    document.getElementById('video_url').value = '';
  }
});

document.getElementById('reelForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const videoUrl = document.getElementById('video_url').value.trim();
  const clipDurationType = document.getElementById('clip_duration').value;

  if (!videoUrl && !selectedFilePath) {
    alert('Please enter a YouTube link or choose a video file.');
    return;
  }

  const submitBtn = document.getElementById('submitBtn');
  const progressSection = document.getElementById('progressSection');
  const resultsSection = document.getElementById('resultsSection');

  submitBtn.disabled = true;
  progressSection.classList.remove('hidden');
  resultsSection.classList.add('hidden');

  const result = await window.electronAPI.processVideo({
    videoUrl,
    filePath: selectedFilePath,
    clipDurationType
  });

  submitBtn.disabled = false;
  progressSection.classList.add('hidden');

  if (result.status === 'success') {
    renderClips(result.clips);
    resultsSection.classList.remove('hidden');
  } else {
    alert('Error: ' + result.message);
  }
});

function renderClips(clips) {
  const grid = document.getElementById('clipsGrid');
  grid.innerHTML = '';

  clips.forEach(clip => {
    const card = document.createElement('div');
    card.className = "bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col justify-between hover:border-slate-700 transition shadow-xl";

    card.innerHTML = `
      <div class="relative bg-black aspect-[9/16] flex items-center justify-center overflow-hidden">
        <video controls class="w-full h-full object-cover">
          <source src="${clip.fileUrl}" type="video/mp4">
        </video>
      </div>
      <div class="p-5 flex-grow flex flex-col justify-between space-y-3">
        <div>
          <h3 class="font-bold text-base text-white mb-1">${clip.title}</h3>
          <p class="text-xs text-slate-400">${clip.reason}</p>
        </div>
        <div>
          <a href="${clip.fileUrl}" download="reel_${clip.id}.mp4" 
             class="w-full py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs rounded-xl transition flex items-center justify-center">
            <i class="fa-solid fa-download mr-2"></i> Save Clip
          </a>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}
