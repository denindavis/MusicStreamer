document.addEventListener("DOMContentLoaded", () => {
    const root = document.getElementById("root");

    // Create the music player structure
    root.innerHTML = `
        <div class="music-player">
            <div class="slider">
                <div class="volume-control">
                    <button class="volume-btn">🔉</button>
                    <div class="volume-slider-container">
                        <input type="range" class="volume-slider" min="0" max="1" step="0.1" value="1">
                    </div>
                </div>
                <div class="sound-bars">
                    <span></span><span></span><span></span><span></span>
                    <span></span><span></span><span></span><span></span>
                    <span></span><span></span><span></span><span></span>
                    <span></span><span></span><span></span><span></span>
                    <span></span><span></span><span></span><span></span>
                    <span></span><span></span><span></span><span></span>
                </div>
                <img src="" alt="Cover" />
                <span class="time-remaining"></span>
            </div>
            <div class="progress-bar">
                <div class="progress"></div>
            </div>
            <div class="error-message"></div>
            <div class="controls">
                <button id="prev" class="control-btn">⏮</button>
                <button id="play-pause" class="control-btn">▶</button>
                <button id="next" class="control-btn">⏭</button>
            </div>
            <div class="playlist">
                <ul id="playlist-ul"></ul>
            </div>
        </div>
    `;

    const audioPlayer = new Audio();
    const playPauseBtn = document.getElementById("play-pause");
    const prevBtn = document.getElementById("prev");
    const nextBtn = document.getElementById("next");
    const playlistUl = document.getElementById("playlist-ul");
    const progressBar = document.querySelector(".progress-bar");
    const progress = document.querySelector(".progress");
    const sliderImg = document.querySelector(".slider img");
    const timeRemaining = document.querySelector(".time-remaining");
    const soundBars = document.querySelector(".sound-bars");
    const volumeBtn = document.querySelector('.volume-btn');
    const volumeSlider = document.querySelector('.volume-slider');
    const volumeControl = document.querySelector('.volume-control');

    let playlist = [];
    let currentIndex = 0;
    let lastLogTime = 0; // To throttle logs

    // Update these declarations at the top
    let audioContext = null;
    let analyser = null;
    let audioSource = null;
    let dataArray = null;

    // Fetch the playlist and metadata from the server
    fetch("/list")
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to fetch playlist: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            playlist = data.filter(item => !item.error);
            if (playlist.length === 0) {
                throw new Error("No valid tracks found in the playlist.");
            }
            populatePlaylist();
            loadTrack().then(async () => {
                if (audioPlayer.duration) {
                    timeRemaining.textContent = `-${formatDuration(audioPlayer.duration)}`;
                    timeRemaining.style.display = "block";

                    // Initialize audio context for the first track
                    await initializeAudioContext();
                }
            });
        })
        .catch(error => {
            console.error("Error fetching playlist:", error);
            showError("Failed to load playlist. Please try again later.");
        });

    // Populate the playlist
    function populatePlaylist() {
        playlistUl.innerHTML = "";
        
        playlist.forEach((track, index) => {
            const li = document.createElement("li");
            li.textContent = `${track.name} (${formatDuration(track.duration)})`;
            li.dataset.index = index;
            li.draggable = true;
            
            if (index === currentIndex) {
                li.classList.add('active');
            }

            li.addEventListener("click", async () => {
                try {
                    currentIndex = index;
                    showError("Loading track...");
                    
                    // Reset audio player state
                    audioPlayer.pause();
                    audioPlayer.currentTime = 0;
                    
                    // Load track first
                    await loadTrack();
                    
                    // Initialize audio context if needed
                    if (!audioContext || !audioSource || audioSource.mediaElement !== audioPlayer) {
                        await initializeAudioContext();
                    }
                    
                    await audioPlayer.play();
                } catch (error) {
                    console.error("Error playing track:", error);
                    showError("Error playing track");
                }
            });
            
            li.addEventListener("dragstart", handleDragStart);
            li.addEventListener("dragover", handleDragOver);
            li.addEventListener("drop", handleDrop);
            li.addEventListener("dragenter", handleDragEnter);
            li.addEventListener("dragleave", handleDragLeave);
            
            playlistUl.appendChild(li);
        });
    }

    // Update the initializeAudioContext function
    async function initializeAudioContext() {
        try {
            // Create audio context only once
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                analyser = audioContext.createAnalyser();
                analyser.fftSize = 64;
                dataArray = new Uint8Array(analyser.frequencyBinCount);
            }

            // Resume if suspended
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }

            // If we already have a source connected to this audio element, don't create a new one
            if (audioSource && audioSource.mediaElement === audioPlayer) {
                return;
            }

            // Disconnect old source if exists
            if (audioSource) {
                try {
                    audioSource.disconnect();
                } catch (e) {
                    console.log('Previous source already disconnected');
                }
            }

            // Create new source
            audioSource = audioContext.createMediaElementSource(audioPlayer);
            audioSource.connect(analyser);
            analyser.connect(audioContext.destination);
        } catch (error) {
            console.error('Error initializing audio context:', error);
        }
    }

    async function loadTrack() {
        if (playlist.length === 0) return;
        
        try {
            // Reset the audio player
            audioPlayer.removeAttribute('src');
            audioPlayer.load();
            
            // Stop current playback and reset state
            audioPlayer.pause();
            audioPlayer.currentTime = 0;
            progress.style.width = '0%';
            
            const track = playlist[currentIndex];
            
            // Set up new audio
            audioPlayer.preload = "auto";
            audioPlayer.src = track.name;
            audioPlayer.load();

            // Wait for metadata to load
            await new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => reject(new Error("Loading timeout")), 10000);
                
                const loadHandler = () => {
                    if (!isNaN(audioPlayer.duration) && audioPlayer.duration > 0) {
                        clearTimeout(timeoutId);
                        audioPlayer.removeEventListener('loadedmetadata', loadHandler);
                        audioPlayer.removeEventListener('error', errorHandler);
                        
                        // Show remaining time immediately after metadata loads
                        timeRemaining.textContent = `-${formatDuration(audioPlayer.duration)}`;
                        timeRemaining.style.display = "block";
                        
                        resolve();
                    }
                };
                
                const errorHandler = (error) => {
                    clearTimeout(timeoutId);
                    audioPlayer.removeEventListener('loadedmetadata', loadHandler);
                    audioPlayer.removeEventListener('error', errorHandler);
                    reject(error);
                };
                
                audioPlayer.addEventListener('loadedmetadata', loadHandler);
                audioPlayer.addEventListener('error', errorHandler);
            });

            // Set up event listeners
            const events = ["loadedmetadata", "play", "pause", "canplay", "progress", "waiting", "playing", "ended"];
            events.forEach(event => {
                audioPlayer.removeEventListener(event, handleMetadataLoaded);
                audioPlayer.removeEventListener(event, handlePlayEvent);
                audioPlayer.removeEventListener(event, handlePauseEvent);
                audioPlayer.removeEventListener(event, handleCanPlay);
                audioPlayer.removeEventListener(event, handleProgress);
                audioPlayer.removeEventListener(event, handleWaiting);
                audioPlayer.removeEventListener(event, handlePlaying);
                audioPlayer.removeEventListener(event, handleTrackEnd);
            });

            // Add event listeners
            audioPlayer.addEventListener("loadedmetadata", handleMetadataLoaded);
            audioPlayer.addEventListener("play", handlePlayEvent);
            audioPlayer.addEventListener("pause", handlePauseEvent);
            audioPlayer.addEventListener("canplay", handleCanPlay);
            audioPlayer.addEventListener("progress", handleProgress);
            audioPlayer.addEventListener("waiting", handleWaiting);
            audioPlayer.addEventListener("playing", handlePlaying);
            audioPlayer.addEventListener("ended", handleTrackEnd);

            // Update UI
            sliderImg.style.display = "none";
            soundBars.style.display = "flex";
            timeRemaining.style.display = "none";
            playPauseBtn.textContent = "▶";
            updateActiveTrack();
            
            console.log("Track loaded successfully:", track.name);
            console.log("Duration:", audioPlayer.duration);
            console.log("Ready state:", audioPlayer.readyState);
            
        } catch (error) {
            console.error("Error loading track:", error);
            showError("Error loading audio");
            handleTrackEnd();
        }
    }

    function handleMetadataLoaded() {
        console.log(`Metadata loaded for: ${playlist[currentIndex].name}`);
        console.log(`Duration: ${audioPlayer.duration}`);
        if (audioPlayer.seekable.length > 0) {
            console.log(`Seekable start: ${audioPlayer.seekable.start(0)}`);
            console.log(`Seekable end: ${audioPlayer.seekable.end(0)}`);
            
            // Update remaining time display
            const remainingTime = audioPlayer.duration - audioPlayer.currentTime;
            timeRemaining.textContent = `-${formatDuration(remainingTime)}`;
            timeRemaining.style.display = "block";
        } else {
            console.error("This file is not seekable.");
        }
    }

    function handlePlayEvent() {
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        playPauseBtn.textContent = "⏸";
        soundBars.style.display = "flex";
        
        // Always show remaining time when playing
        const remainingTime = audioPlayer.duration - audioPlayer.currentTime;
        timeRemaining.textContent = `-${formatDuration(remainingTime)}`;
        timeRemaining.style.display = "block";
    }

    function handlePauseEvent() {
        playPauseBtn.textContent = "▶";
        
        // Keep showing remaining time even when paused
        const remainingTime = audioPlayer.duration - audioPlayer.currentTime;
        timeRemaining.textContent = `-${formatDuration(remainingTime)}`;
        timeRemaining.style.display = "block";
    }

    function handleCanPlay() {
        console.log("Audio can now play");
        console.log(`Current time: ${audioPlayer.currentTime}`);
        console.log(`Duration: ${audioPlayer.duration}`);
        console.log(`Ready state: ${audioPlayer.readyState}`);
        if (audioPlayer.seekable.length > 0) {
            console.log(`Seekable range: ${audioPlayer.seekable.start(0)} to ${audioPlayer.seekable.end(0)}`);
            console.log(`Fully loaded: ${isFullyLoaded()}`);
        } else {
            console.log('Seekable range not available yet');
        }
    }

    function handleProgress() {
        if (audioPlayer.buffered.length > 0) {
            const bufferedEnd = audioPlayer.buffered.end(0);
            const duration = audioPlayer.duration;
            const bufferedPercent = (bufferedEnd / duration) * 100;
            console.log(`Buffered: ${bufferedPercent.toFixed(2)}%`);
        }
    }

    function updateActiveTrack() {
        Array.from(playlistUl.children).forEach((li, index) => {
            li.classList.toggle("active", index === currentIndex);
        });
    }

    function formatDuration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
    }

    function showError(message) {
        const errorDiv = document.querySelector('.error-message');
        errorDiv.textContent = message;
        errorDiv.classList.add('show');
        
        // Hide the message after 3 seconds
        setTimeout(() => {
            errorDiv.classList.remove('show');
        }, 3000);
    }

    function handleWaiting() {
        showError("Loading...");
    }

    function handlePlaying() {
        const errorDiv = document.querySelector('.error-message');
        errorDiv.classList.remove('show');
    }

    progressBar.addEventListener("click", async (e) => {
        if (!audioPlayer.duration) {
            showError("Please wait for the track to load");
            return;
        }

        const rect = progressBar.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const percentage = offsetX / rect.width;
        const newTime = percentage * audioPlayer.duration;

        try {
            showError("Preparing to seek...");
            await new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => reject(new Error("Seek timeout")), 5000);
                
                function checkSeekable() {
                    if (audioPlayer.seekable && 
                        audioPlayer.seekable.length > 0 && 
                        audioPlayer.seekable.end(0) > 0) {
                        clearTimeout(timeoutId);
                        resolve();
                    } else {
                        if (audioPlayer.readyState < 3) {
                            audioPlayer.load();
                        }
                        setTimeout(checkSeekable, 100);
                    }
                }
                
                checkSeekable();
            });

            const seekableEnd = audioPlayer.seekable.end(0);
            if (newTime > seekableEnd) {
                showError("That position is not loaded yet");
                return;
            }

            audioPlayer.currentTime = newTime;
            progress.style.width = `${percentage * 100}%`;
            
            if (audioPlayer.paused) {
                await audioPlayer.play();
            }

        } catch (error) {
            console.error("Error while seeking:", error);
            showError("Unable to seek to that position");
            
            progress.style.width = `${(audioPlayer.currentTime / audioPlayer.duration) * 100}%`;
        }
    });

    playPauseBtn.addEventListener("click", () => {
        if (audioPlayer.paused) {
            audioPlayer.play()
                .then(() => {
                    playPauseBtn.textContent = "⏸";
                })
                .catch(error => {
                    console.error("Error playing audio:", error);
                    playPauseBtn.textContent = "▶";
                });
        } else {
            audioPlayer.pause();
            playPauseBtn.textContent = "▶";
        }
    });

    audioPlayer.addEventListener("timeupdate", () => {
        if (!isNaN(audioPlayer.duration)) {
            const percentage = (audioPlayer.currentTime / audioPlayer.duration) * 100;
            progress.style.width = `${percentage}%`;

            const remainingTime = audioPlayer.duration - audioPlayer.currentTime;
            timeRemaining.textContent = `-${formatDuration(remainingTime)}`;

            const currentTime = Date.now();
            if (currentTime - lastLogTime >= 3000) {
                console.log(`Current time: ${audioPlayer.currentTime}`);
                console.log(`Duration: ${audioPlayer.duration}`);
                console.log(`Progress: ${percentage}%`);
                lastLogTime = currentTime;
            }
        } else {
            if (!audioPlayer.dataset.errorLogged) {
                console.error("Cannot update progress: Metadata not available.");
                audioPlayer.dataset.errorLogged = true; // Mark the error as logged
            }
        }
    });

    function isFullyLoaded() {
        return audioPlayer.seekable && 
               audioPlayer.seekable.length > 0 && 
               audioPlayer.seekable.end(0) >= audioPlayer.duration;
    }

    function handleTrackEnd() {
        if (currentIndex < playlist.length - 1) {
            currentIndex++;
            loadTrack().then(() => {
                audioPlayer.play().catch(error => {
                    console.error("Error auto-playing next track:", error);
                    showError("Error playing next track");
                });
            }).catch(error => {
                console.error("Error loading next track:", error);
                showError("Error loading next track");
                timeRemaining.style.display = "block";
            });
        } else {
            // At the end of playlist
            playPauseBtn.textContent = "▶";
            showError("End of playlist");
        }
    }

    let draggedItem = null;

    function handleDragStart(e) {
        draggedItem = this;
        this.classList.add('dragging');
    }

    function handleDragOver(e) {
        e.preventDefault();
    }

    function handleDragEnter(e) {
        e.preventDefault();
        this.classList.add('drag-over');
    }

    function handleDragLeave(e) {
        this.classList.remove('drag-over');
    }

    function handleDrop(e) {
        e.preventDefault();
        this.classList.remove('drag-over');
        
        if (draggedItem !== this) {
            const fromIndex = parseInt(draggedItem.dataset.index);
            const toIndex = parseInt(this.dataset.index);
            
            // Store current track
            const currentTrack = playlist[currentIndex];
            
            // Reorder the playlist array
            const [movedItem] = playlist.splice(fromIndex, 1);
            playlist.splice(toIndex, 0, movedItem);
            
            // Update currentIndex to follow the current track
            currentIndex = playlist.indexOf(currentTrack);
            
            // Refresh the playlist display
            populatePlaylist();
        }
        
        draggedItem.classList.remove('dragging');
        draggedItem = null;
    }

    // Update animateSoundBars function
    function animateSoundBars() {
        if (!audioPlayer.paused && analyser && dataArray) {
            try {
                analyser.getByteFrequencyData(dataArray);
                const bars = document.querySelectorAll('.sound-bars span');
                
                // Get frequency ranges for 12 unique bars (more granular)
                const frequencyRanges = [
                    [0, 1],      // Sub-bass
                    [2, 3],      // Bass
                    [4, 5],      // Low-mids
                    [6, 7],     // Mids
                    [8, 9],    // Mid-highs
                    [10, 11],    // High-mids
                    [12, 13],    // Low-treble
                    [14, 15],    // Mid-treble
                    [16, 17],    // High-treble
                    [18, 19],    // Brilliance
                    [20, 21],    // Air
                    [22, 23]     // Ultra-high
                ];

                // Find the maximum value
                let maxValue = 0;
                frequencyRanges.forEach(([start, end]) => {
                    for (let i = start; i <= end; i++) {
                        maxValue = Math.max(maxValue, dataArray[i]);
                    }
                });

                maxValue = Math.max(maxValue, 128);

                // Process first 12 bars
                for (let i = 0; i < 12; i++) {
                    const [start, end] = frequencyRanges[i];
                    
                    let sum = 0;
                    for (let j = start; j <= end; j++) {
                        sum += dataArray[j];
                    }
                    const average = sum / (end - start + 1);
                    
                    // Normalize and scale
                    const normalizedValue = average / maxValue;
                    const minHeight = 10;
                    const maxHeight = 100;
                    const height = minHeight + (normalizedValue * (maxHeight - minHeight));
                    
                    // Apply to original bar (left side)
                    const leftBar = bars[11 - i];  // Reverse order for left side
                    leftBar.style.height = `${height}px`;
                    leftBar.style.transform = 'none';
                    leftBar.style.marginTop = '0';
                    
                    // Apply to mirrored bar (right side)
                    const rightBar = bars[12 + i];  // Normal order for right side
                    rightBar.style.height = `${height}px`;
                    rightBar.style.transform = 'none';
                    rightBar.style.marginTop = '0';
                    
                    // Color based on height with more vibrant colors
                    const hue = 120 + (normalizedValue * 180);
                    const saturation = 80 + (normalizedValue * 20); // More saturation for higher values
                    const lightness = 45 + (normalizedValue * 25); // More dynamic brightness
                    const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
                    
                    // Apply same color to both bars
                    leftBar.style.backgroundColor = color;
                    rightBar.style.backgroundColor = color;
                }
            } catch (error) {
                // Silently handle errors
            }
        }
        requestAnimationFrame(animateSoundBars);
    }

    // Start animation when page loads
    animateSoundBars();

    // Update the volume control with proper unicode icons
    const VOLUME_ICONS = {
        high: '🔉',    // Speaker with medium volume
        muted: '🔇',   // Speaker muted
    };

    // Update the volume button click handler
    volumeBtn.addEventListener('click', () => {
        if (audioPlayer.muted) {
            audioPlayer.muted = false;
            volumeBtn.textContent = VOLUME_ICONS.high;
            volumeSlider.value = audioPlayer.volume;
        } else {
            audioPlayer.muted = true;
            volumeBtn.textContent = VOLUME_ICONS.muted;
            volumeSlider.value = 0;
        }
    });

    // Update the volume slider input handler
    volumeSlider.addEventListener('input', (e) => {
        const volume = parseFloat(e.target.value);
        audioPlayer.volume = volume;
        audioPlayer.muted = (volume === 0);
        volumeBtn.textContent = volume === 0 ? VOLUME_ICONS.muted : VOLUME_ICONS.high;
        volumeSlider.style.setProperty('--volume-percentage', `${volume * 100}%`);
    });

    // Update the updateVolumeIcon function
    function updateVolumeIcon() {
        if (audioPlayer.muted || audioPlayer.volume === 0) {
            volumeBtn.textContent = VOLUME_ICONS.muted;
        } else {
            volumeBtn.textContent = VOLUME_ICONS.high;
        }
    }

    // Set initial volume icon
    volumeBtn.textContent = VOLUME_ICONS.high;

    // Add this right after the volume slider declaration (near the top with other constants)
    volumeSlider.value = 1; // Set initial volume to 100%
    volumeSlider.style.setProperty('--volume-percentage', '100%');

    // Update the next button click handler
    nextBtn.addEventListener("click", async () => {
        try {
            if (currentIndex < playlist.length - 1) {
                currentIndex++;
                showError("Loading next track...");
                
                // Reset audio player state
                audioPlayer.pause();
                audioPlayer.currentTime = 0;
                
                // Load track first
                await loadTrack();
                
                // Initialize audio context if needed
                if (!audioContext || !audioSource || audioSource.mediaElement !== audioPlayer) {
                    await initializeAudioContext();
                }
                
                await audioPlayer.play();
            } else {
                showError("End of playlist");
            }
        } catch (error) {
            console.error("Error playing next track:", error);
            showError("Error playing next track");
        }
    });

    // Update the previous button click handler
    prevBtn.addEventListener("click", async () => {
        try {
            if (currentIndex > 0) {
                currentIndex--;
                showError("Loading previous track...");
                
                // Reset audio player state
                audioPlayer.pause();
                audioPlayer.currentTime = 0;
                
                // Load track first
                await loadTrack();
                
                // Initialize audio context if needed
                if (!audioContext || !audioSource || audioSource.mediaElement !== audioPlayer) {
                    await initializeAudioContext();
                }
                
                await audioPlayer.play();
            } else {
                showError("Start of playlist");
            }
        } catch (error) {
            console.error("Error playing previous track:", error);
            showError("Error playing previous track");
        }
    });
});
