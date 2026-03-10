// Web Audio Context setup
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const dest = audioCtx.createMediaStreamDestination(); // For recording
const globalGain = audioCtx.createGain(); // Master output gain
const analyser = audioCtx.createAnalyser(); // For visualizer

globalGain.connect(analyser);
analyser.connect(audioCtx.destination);
globalGain.connect(dest);

// --- Realistic Drum Sample Library Loading ---
const drumSamples = {
    rock: { kick: null, snare_soft: null, snare_hard: null, hihat: null, tom1: null, tom2: null, floortom: null, crash: null, ride: null },
    electronic: { kick: null, snare: null, hihat: null },
    trap808: { kick: null, snare: null, hihat: null }
};

let samplesLoaded = false;

// We point to online public domain or freely available drum sample URLs for demo purposes
// In a real production app these would be local assets or a dedicated CDN
const sampleUrls = {
    rock: {
        kick: 'https://cdn.freesound.org/previews/171/171104_2394245-lq.mp3', // Example freesound public domain
        snare_soft: 'https://cdn.freesound.org/previews/387/387186_7255507-lq.mp3',
        snare_hard: 'https://cdn.freesound.org/previews/100/100492_1250280-lq.mp3',
        hihat: 'https://cdn.freesound.org/previews/132/132626_2140134-lq.mp3',
        tom1: 'https://cdn.freesound.org/previews/516/516027_10826955-lq.mp3',
        tom2: 'https://cdn.freesound.org/previews/516/516029_10826955-lq.mp3',
        floortom: 'https://cdn.freesound.org/previews/516/516028_10826955-lq.mp3',
        crash: 'https://cdn.freesound.org/previews/346/346124_5121236-lq.mp3',
        ride: 'https://cdn.freesound.org/previews/538/538965_4486188-lq.mp3'
    }
    // We can fall back to synth for electronic/trap if samples aren't defined, showing hybrid engine capability
};

const loadSample = async (url) => {
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        return await audioCtx.decodeAudioData(arrayBuffer);
    } catch (e) {
        console.warn('Could not load sample:', url);
        return null;
    }
};

const initSampleLibrary = async () => {
    const loadingText = document.getElementById('loading-text');
    if (loadingText) loadingText.textContent = 'Loading HQ Drum Samples...';

    // Load Rock Kit
    const promises = [];
    for (const [key, url] of Object.entries(sampleUrls.rock)) {
        promises.push(
            loadSample(url).then(buffer => {
                drumSamples.rock[key] = buffer;
            })
        );
    }
    await Promise.all(promises);
    samplesLoaded = true;
    if (loadingText) loadingText.textContent = 'Samples Loaded...';
};

// Play a loaded sample buffer
const playSample = (buffer, velocity, outNode) => {
    if (!buffer) return false;
    const source = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();

    source.buffer = buffer;
    source.connect(gain);
    gain.connect(outNode);

    // Map velocity to gain exponentially for dynamic expression
    gain.gain.value = Math.pow(velocity, 1.5);

    source.start(0);
    return true;
};

// --- Drum Synthesis Functions (and Sample Playback Routing) ---
const createPannerNode = (position) => {
    if (!position) {
        return globalGain;
    }
    const panner = audioCtx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1;
    panner.maxDistance = 10000;
    panner.rolloffFactor = 1;
    panner.positionX.value = position.x;
    panner.positionY.value = position.y;
    panner.positionZ.value = position.z;
    panner.connect(globalGain);
    return panner;
};

const playKick = (velocity = 1, outNode) => {
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.connect(gainNode);
    gainNode.connect(outNode);

    // Change pitch drop and envelope based on kit
    let baseFreq = 150;
    let endFreq = 0.01;
    let dur = 0.5;

    switch (currentDrumKit) {
        case 'electronic': baseFreq = 120; dur = 0.3; break;
        case 'trap808': baseFreq = 60; dur = 1.0; break;
        case 'jazz': baseFreq = 180; dur = 0.4; break;
    }

    osc.frequency.setValueAtTime(baseFreq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, audioCtx.currentTime + dur);

    gainNode.gain.setValueAtTime(velocity, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + dur);

    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + dur);
};

const playSnare = (velocity = 1, outNode = audioCtx.destination, isRimshot = false) => {
    let duration = isRimshot ? 0.05 : 0.2;
    let pitch = 250;

    if (currentDrumKit === 'trap808') { pitch = 300; duration = 0.1; }
    else if (currentDrumKit === 'electronic') { pitch = 200; duration = 0.15; }
    else if (currentDrumKit === 'jazz') { pitch = 280; duration = 0.25; }

    const bufferSize = audioCtx.sampleRate * duration;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = isRimshot ? 3000 : 1000;

    const noiseEnvelope = audioCtx.createGain();
    noiseEnvelope.gain.setValueAtTime(velocity * (isRimshot ? 0.3 : 0.8), audioCtx.currentTime);
    noiseEnvelope.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseEnvelope);
    noiseEnvelope.connect(outNode);

    // Tonal part (drum body)
    const osc = audioCtx.createOscillator();
    const oscEnvelope = audioCtx.createGain();

    osc.type = 'triangle';
    osc.connect(oscEnvelope);
    oscEnvelope.connect(outNode);

    osc.frequency.setValueAtTime(isRimshot ? 400 : pitch, audioCtx.currentTime);
    if (currentDrumKit === 'trap808' || currentDrumKit === 'electronic') {
        osc.frequency.exponentialRampToValueAtTime(pitch * 0.5, audioCtx.currentTime + (isRimshot ? 0.05 : 0.1));
    }

    oscEnvelope.gain.setValueAtTime(velocity * (isRimshot ? 0.9 : 0.6), audioCtx.currentTime);
    oscEnvelope.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + (isRimshot ? 0.05 : 0.1));

    osc.start(audioCtx.currentTime);
    noise.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + duration);
};

const playHiHat = (velocity = 1, open = false, outNode = audioCtx.destination) => {
    const duration = open ? 0.5 : 0.1;
    const bufferSize = audioCtx.sampleRate * duration;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    const bandpass = audioCtx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 8000;

    const highpass = audioCtx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 7000;

    const envelope = audioCtx.createGain();
    envelope.gain.setValueAtTime(velocity * 0.5, audioCtx.currentTime);
    envelope.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

    noise.connect(bandpass);
    bandpass.connect(highpass);
    highpass.connect(envelope);
    envelope.connect(outNode);

    noise.start(audioCtx.currentTime);
};

const playTom = (freq = 150, duration = 0.5, velocity = 1, outNode = audioCtx.destination) => {
    if (currentDrumKit === 'electronic' || currentDrumKit === 'trap808') freq *= 1.2;
    if (currentDrumKit === 'trap808') duration *= 1.5;

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.connect(gainNode);
    gainNode.connect(outNode);

    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.1, audioCtx.currentTime + duration);

    gainNode.gain.setValueAtTime(velocity, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + duration);
};

const playCymbal = (velocity = 1, type = 'crash', outNode = audioCtx.destination) => {
    const duration = type === 'crash' ? 1.5 : 2.0;
    const bufferSize = audioCtx.sampleRate * duration;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.5;
    }

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;

    const freqs = type === 'crash' ? [300, 450, 750, 1100, 1800, 3200] : [400, 600, 1200, 2400, 3600];
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(velocity * (type === 'crash' ? 0.6 : 0.8), audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

    freqs.forEach((freq, idx) => {
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = freq;
        filter.Q.value = type === 'crash' ? 10 : 20 + idx * 5;

        source.connect(filter);
        filter.connect(gainNode);
    });

    gainNode.connect(outNode);
    source.start(audioCtx.currentTime);
};

// Visual Effect generation on hit
const createHitEffect = (position, color = '#4facfe') => {
    const scene = document.querySelector('a-scene');
    if (!scene) return;

    // Create a ring
    const ring = document.createElement('a-ring');
    ring.setAttribute('radius-inner', '0.01');
    ring.setAttribute('radius-outer', '0.03');
    ring.setAttribute('color', color);
    ring.setAttribute('material', 'shader: flat; transparent: true; opacity: 1');

    // Position it at the collision point
    ring.setAttribute('position', position);

    // Face the user (roughly)
    const camera = document.querySelector('#head');
    if (camera) {
        const camPos = new THREE.Vector3();
        camera.object3D.getWorldPosition(camPos);
        ring.object3D.lookAt(camPos);
    }

    // Animate expansion and fade out
    ring.setAttribute('animation__scale', {
        property: 'scale',
        to: '5 5 5',
        dur: 300,
        easing: 'easeOutQuad'
    });

    ring.setAttribute('animation__fade', {
        property: 'material.opacity',
        to: '0',
        dur: 300,
        easing: 'easeOutQuad'
    });

    scene.appendChild(ring);

    // Clean up after animation finishes
    setTimeout(() => {
        if (ring.parentNode) {
            ring.parentNode.removeChild(ring);
        }
    }, 350);
};

const playSound = (type, velocity = 1.0, position = null, isRimshot = false) => {
    // Limit and enhance velocity for realistic response
    velocity = Math.min(Math.max(velocity, 0.1), 1.5) * 1.5;

    // Browsers require user interaction to start audio, A-Frame handles this partially on Enter VR, but ensure it's resumed
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    // Create 3D spatial node
    const outNode = createPannerNode(position);

    // Hybrid Engine: Try to play realistic multi-layer samples first
    let playedSample = false;
    if (samplesLoaded && currentDrumKit === 'rock') {
        let bufferToPlay = null;
        if (type === 'snare') {
            // Velocity layer switching!
            if (velocity > 1.0 || isRimshot) {
                bufferToPlay = drumSamples.rock.snare_hard;
            } else {
                bufferToPlay = drumSamples.rock.snare_soft;
            }
        } else {
            bufferToPlay = drumSamples.rock[type];
        }

        if (bufferToPlay) {
            playedSample = playSample(bufferToPlay, velocity, outNode);
        }
    }

    // Fallback to purely synthesized WebAudio if samples failed or using alternative kits (Trap/Electronic)
    if (!playedSample) {
        switch (type) {
            case 'kick': playKick(velocity, outNode); break;
            case 'snare': playSnare(velocity, outNode, isRimshot); break;
            case 'hihat': playHiHat(velocity, false, outNode); break;
            case 'tom1': playTom(250, 0.4, velocity, outNode); break;
            case 'tom2': playTom(200, 0.5, velocity, outNode); break;
            case 'floortom': playTom(100, 0.6, velocity, outNode); break;
            case 'crash': playCymbal(velocity, 'crash', outNode); break;
            case 'ride': playCymbal(velocity, 'ride', outNode); break;
        }
    }
};

// --- Metronome Logic ---
let metronomePlaying = false;
let metronomeTimer = null;
let currentBpm = 120;

const playMetronomeClick = () => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.connect(gain);
    gain.connect(globalGain);

    osc.frequency.value = 800;
    gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.1);

    // Visual feedback
    const light = document.getElementById('metro-light');
    if (light) {
        light.style.background = '#4facfe';
        setTimeout(() => light.style.background = 'rgba(255, 255, 255, 0.1)', 100);
    }
};

const toggleMetronome = () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    metronomePlaying = !metronomePlaying;

    const btn = document.getElementById('metro-btn');
    if (metronomePlaying) {
        btn.textContent = 'Stop Metronome';
        btn.classList.add('active');

        const interval = (60 / currentBpm) * 1000;
        playMetronomeClick(); // Play first click immediately
        metronomeTimer = setInterval(playMetronomeClick, interval);
    } else {
        btn.textContent = 'Start Metronome';
        btn.classList.remove('active');
        clearInterval(metronomeTimer);
    }
};

// --- Recording Logic ---
let mediaRecorder;
let recordedChunks = [];
let isRecording = false;
let audioBlob = null;
let audioUrl = null;
let replayAudioElement = null;

const toggleRecording = () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const recordBtn = document.getElementById('record-btn');
    const replayBtn = document.getElementById('replay-btn');
    const downloadBtn = document.getElementById('download-btn');
    const light = document.getElementById('record-light');

    if (!isRecording) {
        // Start Recording
        recordedChunks = [];
        mediaRecorder = new MediaRecorder(dest.stream);

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) recordedChunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
            audioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
            audioUrl = URL.createObjectURL(audioBlob);

            replayBtn.disabled = false;
            downloadBtn.disabled = false;
        };

        mediaRecorder.start();
        isRecording = true;

        recordBtn.textContent = '⏹ Stop Recording';
        recordBtn.classList.add('recording');
        light.style.background = '#ff4444';

        // Disable replay/download while recording
        replayBtn.disabled = true;
        downloadBtn.disabled = true;

        if (replayAudioElement) {
            replayAudioElement.pause();
        }
    } else {
        // Stop Recording
        mediaRecorder.stop();
        isRecording = false;

        recordBtn.textContent = '⏺ Start Recording';
        recordBtn.classList.remove('recording');
        light.style.background = 'rgba(255, 255, 255, 0.1)';
    }
};

const replayRecording = () => {
    if (!audioUrl) return;

    if (!replayAudioElement) {
        replayAudioElement = new Audio();
    }

    // Toggle play/pause
    if (replayAudioElement.src === audioUrl && !replayAudioElement.paused) {
        replayAudioElement.pause();
        replayAudioElement.currentTime = 0;
        document.getElementById('replay-btn').textContent = '▶ Replay';
    } else {
        replayAudioElement.src = audioUrl;
        replayAudioElement.play();
        const btn = document.getElementById('replay-btn');
        btn.textContent = '⏸ Stop Replay';
        btn.classList.add('active');

        replayAudioElement.onended = () => {
            btn.textContent = '▶ Replay';
            btn.classList.remove('active');
        };
    }
};

const downloadRecording = () => {
    if (!audioUrl) return;
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = audioUrl;
    a.download = `neon-beats-VR-${new Date().getTime()}.webm`; // MediaRecorder usually spits out webm audio or ogg
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 100);
};

// UI Initialization
window.addEventListener('DOMContentLoaded', () => {
    // Mobile UI Toggle
    const toggleUiBtn = document.getElementById('toggle-ui-btn');
    const uiContainer = document.getElementById('ui-container');
    let uiVisible = true;
    if (toggleUiBtn) {
        toggleUiBtn.addEventListener('click', () => {
            uiVisible = !uiVisible;
            if (uiContainer) uiContainer.style.display = uiVisible ? 'flex' : 'none';
        });
    }

    // Metronome
    const metroBtn = document.getElementById('metro-btn');
    const bpmSlider = document.getElementById('bpm-slider');
    const bpmDisplay = document.getElementById('bpm-display');

    if (metroBtn) metroBtn.addEventListener('click', toggleMetronome);

    if (bpmSlider) {
        bpmSlider.addEventListener('input', (e) => {
            currentBpm = e.target.value;
            if (bpmDisplay) bpmDisplay.textContent = currentBpm;

            // Restart timer if playing to apply new BPM
            if (metronomePlaying) {
                clearInterval(metronomeTimer);
                const interval = (60 / currentBpm) * 1000;
                metronomeTimer = setInterval(playMetronomeClick, interval);
            }
        });
    }

    // Customization - Themes
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
        themeSelect.addEventListener('change', (e) => {
            applyTheme(e.target.value);
        });
    }

    // Customization - Drum Kits
    const kitSelect = document.getElementById('kit-select');
    if (kitSelect) {
        kitSelect.addEventListener('change', (e) => {
            currentDrumKit = e.target.value;
        });
    }

    // Recording
    const recordBtn = document.getElementById('record-btn');
    const replayBtn = document.getElementById('replay-btn');
    const downloadBtn = document.getElementById('download-btn');

    if (recordBtn) recordBtn.addEventListener('click', toggleRecording);
    if (replayBtn) replayBtn.addEventListener('click', replayRecording);
    if (downloadBtn) downloadBtn.addEventListener('click', downloadRecording);
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            e.preventDefault(); // prevent scrolling
            const kickDrum = document.querySelector(`[drum="type: kick"]`);
            if (kickDrum) {
                kickDrum.emit('drum-hit', null, false);
                kickDrum.object3D.scale.set(1, 1, 1);
                playSound('kick', 1.0, null, false);
                handleUserHit('kick');

                // Track Analytics
                sessionHits++;
                sessionMaxVel = Math.max(sessionMaxVel, 1.0);
            }
        }
    });
});

// A-Frame: Drumstick component to track velocity and position
AFRAME.registerComponent('drumstick', {
    schema: {
        hand: { type: 'string', default: 'right' }
    },
    init: function () {
        this.nodes = [];
        this.currentPositions = [];
        this.prevPositions = [];
        this.velocity = 0;
        this.hasInitialized = false;

        // Wake up audio on controller interactions in VR
        this.el.addEventListener('triggerdown', () => {
            if (audioCtx.state === 'suspended') audioCtx.resume();
        });
        this.el.addEventListener('gripdown', () => {
            if (audioCtx.state === 'suspended') audioCtx.resume();
        });
    },
    tick: function (time, delta) {
        if (this.nodes.length === 0) {
            this.nodes = Array.from(this.el.querySelectorAll('.stick-node'));
            if (this.nodes.length === 0) return;

            this.nodes.forEach(() => {
                this.currentPositions.push(new THREE.Vector3());
                this.prevPositions.push(new THREE.Vector3());
            });
        }

        let totalVelocity = 0;
        const dt = delta / 1000;

        for (let i = 0; i < this.nodes.length; i++) {
            this.nodes[i].object3D.getWorldPosition(this.currentPositions[i]);

            if (!this.hasInitialized) {
                this.prevPositions[i].copy(this.currentPositions[i]);
            } else if (dt > 0) {
                totalVelocity += this.currentPositions[i].distanceTo(this.prevPositions[i]) / dt;
            }
        }

        if (!this.hasInitialized) {
            this.hasInitialized = true;
            return;
        }

        if (dt > 0) {
            // Average velocity across all stick length points
            this.velocity = totalVelocity / this.nodes.length;
        }
    }
});

// --- Analytics Tracking ---
let sessionHits = 0;
let sessionMaxVel = 0;
let sessionStartTime = null;

// --- Customization Logic ---
let currentDrumKit = 'rock'; // 'rock', 'jazz', 'electronic', 'trap808'

// Helper function to color stage lights
const updateStageLights = (color) => {
    const light1 = document.getElementById('stage-light-1');
    const light2 = document.getElementById('stage-light-2');
    if (light1) {
        light1.setAttribute('color', color);
        // Add random moving animation on theme swap
        light1.setAttribute('animation__move', `property: rotation; to: -45 ${Math.random() * 90} 0; dur: 2000; dir: alternate; loop: true; easing: easeInOutSine;`);
    }
    if (light2) {
        light2.setAttribute('color', color);
        light2.setAttribute('animation__move', `property: rotation; to: -45 ${-Math.random() * 90} 0; dur: 2200; dir: alternate; loop: true; easing: easeInOutSine;`);
    }
};

const applyTheme = (themeName) => {
    const scene = document.querySelector('a-scene');
    if (!scene) return;

    // Default: 'classic'
    let bgColor = '#050505';
    let ambientColor = '#222';
    let spotColor = '#e6f2ff';
    let floorColor = '#2b1d14';
    let backWallColor = '#1a1a1a';
    let sideWallColor = '#141414';
    let ceilingColor = '#0a0a0a';
    let neonColor = '#ff3333';
    let neonText = 'ON AIR';
    let stageLightIntensity = '0.5';

    switch (themeName) {
        case 'cyberpunk':
            bgColor = '#001122';
            ambientColor = '#112244';
            spotColor = '#00f2fe';
            floorColor = '#05101f';
            backWallColor = '#000814';
            sideWallColor = '#00050d';
            ceilingColor = '#000000';
            neonColor = '#4facfe';
            neonText = 'CYBER DRUMS';
            stageLightIntensity = '1.5';
            break;
        case 'dark':
            bgColor = '#000000';
            ambientColor = '#050505';
            spotColor = '#333333';
            floorColor = '#111111';
            backWallColor = '#050505';
            sideWallColor = '#020202';
            ceilingColor = '#000000';
            neonColor = '#222222';
            neonText = 'STUDIO 2';
            stageLightIntensity = '0.1';
            break;
        case 'arcade':
            bgColor = '#1a0033';
            ambientColor = '#330066';
            spotColor = '#ff00ff';
            floorColor = '#26004d';
            backWallColor = '#1a0033';
            sideWallColor = '#0d001a';
            ceilingColor = '#000000';
            neonColor = '#ff00ff';
            neonText = 'ARCADE';
            stageLightIntensity = '2.0';
            break;
    }

    scene.setAttribute('background', `color: ${bgColor}`);

    // Update stage spotlights
    const light1 = document.getElementById('stage-light-1');
    const light2 = document.getElementById('stage-light-2');
    if (light1) light1.setAttribute('intensity', stageLightIntensity);
    if (light2) light2.setAttribute('intensity', stageLightIntensity);
    updateStageLights(neonColor);

    const ambientLight = document.querySelector('a-light[type="ambient"]');
    if (ambientLight) ambientLight.setAttribute('color', ambientColor);

    const spotLight = document.querySelector('a-light[type="spot"]');
    if (spotLight) spotLight.setAttribute('color', spotColor);

    const floor = document.querySelector('#studio a-plane[rotation="-90 0 0"]');
    if (floor) floor.setAttribute('color', floorColor);

    const backWall = document.querySelector('#studio a-plane[position="0 2 -4"]');
    if (backWall) backWall.setAttribute('color', backWallColor);

    const leftWall = document.querySelector('#studio a-plane[position="-6 2 2"]');
    if (leftWall) leftWall.setAttribute('color', sideWallColor);

    const rightWall = document.querySelector('#studio a-plane[position="6 2 2"]');
    if (rightWall) rightWall.setAttribute('color', sideWallColor);

    const ceiling = document.querySelector('#studio a-plane[rotation="90 0 0"]');
    if (ceiling) ceiling.setAttribute('color', ceilingColor);

    const neonEntity = document.querySelector('#studio a-entity[text]');
    if (neonEntity) {
        neonEntity.setAttribute('text', `value: ${neonText}; color: ${neonColor}; width: 8; align: center; font: kelsonsans;`);
        const neonLight = document.querySelector('#studio a-light[type="point"]');
        if (neonLight) neonLight.setAttribute('color', neonColor);
    }
};

// A-Frame: Drum component for hit detection and visual response
AFRAME.registerComponent('drum', {
    schema: {
        type: { type: 'string', default: 'snare' },
        hitRadius: { type: 'number', default: 0.22 }, // Radius bounds for cylindrical collision
        hitHeight: { type: 'number', default: 0.1 }   // Height bounds for cylindrical collision
    },
    init: function () {
        this.hitCooldowns = new Map();
        this.isBeingHit = new Map();

        // Authentic animated drum skin compression (ChatGPT suggestion)
        this.el.setAttribute('animation__hit', {
            property: 'scale',
            dir: 'alternate',
            dur: 60,
            to: '1 0.9 1',
            startEvents: 'drum-hit'
        });

        if (this.data.type === 'crash' || this.data.type === 'ride' || this.data.type === 'hihat') {
            const rot = this.el.object3D.rotation;
            this.el.setAttribute('animation__hit', {
                property: 'rotation',
                dir: 'alternate',
                dur: 150,
                to: `${THREE.MathUtils.radToDeg(rot.x) + 5} ${THREE.MathUtils.radToDeg(rot.y)} ${THREE.MathUtils.radToDeg(rot.z) + 5}`,
                startEvents: 'drum-hit'
            });
        }

        // Add mobile Touch/Click Event Listener
        this.el.addEventListener('mousedown', (evt) => {
            if (audioCtx.state === 'suspended') audioCtx.resume();

            let velocityVolume = 1.0; // Max velocity for screen tap

            // Mobile Touch Simulation: Use hit position to simulate velocity
            // Tapping the exact center is 1.0 (loud), tapping the edge is 0.3 (soft)
            if (evt.detail && evt.detail.intersection) {
                const intersectWorld = evt.detail.intersection.point.clone();
                const localPos = this.el.object3D.worldToLocal(intersectWorld);
                const distFromCenter = Math.sqrt(localPos.x * localPos.x + localPos.z * localPos.z);

                const normalizedDist = Math.max(0, Math.min(distFromCenter / this.data.hitRadius, 1.0));

                // Map the distance so center = 1.0 velocity, and edge = 0.3 velocity
                velocityVolume = 0.3 + ((1.0 - normalizedDist) * 0.7);
            }

            const drumPos = new THREE.Vector3();
            this.el.object3D.getWorldPosition(drumPos);

            // Check for Rimshot (edge of snare)
            let isRimshot = (this.data.type === 'snare' && velocityVolume < 0.45);

            playSound(this.data.type, velocityVolume, drumPos, isRimshot);

            if (!sessionStartTime) sessionStartTime = Date.now();
            sessionHits++;
            sessionMaxVel = Math.max(sessionMaxVel, velocityVolume);

            handleUserHit(this.data.type);

            this.el.emit('drum-hit', null, false);
            this.el.object3D.scale.set(1, 1, 1);

            let fxColor = '#4facfe'; // Default cyan
            if (this.data.type === 'crash' || this.data.type === 'ride' || this.data.type === 'hihat') {
                fxColor = '#ffdd44'; // Gold for cymbals
            } else if (this.data.type === 'kick') {
                fxColor = '#ff4444'; // Red for kick
            }

            // Highlight exactly where they tapped
            if (evt.detail && evt.detail.intersection) {
                createHitEffect(evt.detail.intersection.point, fxColor);
            } else {
                createHitEffect(drumPos, fxColor);
            }
        });
    },
    tick: function (time, delta) {
        if (!this.sticks || this.sticks.length === 0) {
            this.sticks = Array.from(this.el.sceneEl.querySelectorAll('[drumstick]'));
        }

        // Cache the inverse world matrix to convert stick tip to drum's local coordinate space
        const worldToLocal = new THREE.Matrix4().copy(this.el.object3D.matrixWorld).invert();

        const checkLocalHit = (worldPos) => {
            const localPos = worldPos.clone().applyMatrix4(worldToLocal);
            const radiusSq = localPos.x * localPos.x + localPos.z * localPos.z;

            // Allow a 5cm vertical margin above/below the visual drum height
            const heightLimit = (this.data.hitHeight / 2) + 0.05;

            return {
                isHit: (radiusSq <= this.data.hitRadius * this.data.hitRadius) && (Math.abs(localPos.y) <= heightLimit),
                radius: Math.sqrt(radiusSq)
            };
        };

        this.sticks.forEach(stick => {
            const stickComp = stick.components.drumstick;
            if (!stickComp || !stickComp.hasInitialized || stickComp.nodes.length === 0) return;

            const stickId = stick.id || stickComp.data.hand;

            // Check specific stick cooldown
            let cooldown = this.hitCooldowns.get(stickId) || 0;
            if (cooldown > 0) {
                this.hitCooldowns.set(stickId, cooldown - delta);
            }

            let isHitNow = false;
            let hitPos = null;
            let isRimshot = false;

            // Check collision against all nodes along the entire stick
            for (let i = 0; i < stickComp.currentPositions.length; i++) {
                const currPos = stickComp.currentPositions[i];
                const prevPos = stickComp.prevPositions[i];

                // Fast Controller Support: Sample midpoint between frames to catch swings
                const midPos = new THREE.Vector3().addVectors(prevPos, currPos).multiplyScalar(0.5);

                // Strict Cylindrical Collision provides exactly perfect surface hits
                const checkCurr = checkLocalHit(currPos);
                const checkPrev = checkLocalHit(prevPos);
                const checkMid = checkLocalHit(midPos);

                if (checkCurr.isHit || checkPrev.isHit || checkMid.isHit) {
                    isHitNow = true;
                    hitPos = currPos; // Record exactly where the collision occurred on the stick

                    let hitRadius = checkCurr.isHit ? checkCurr.radius : (checkMid.isHit ? checkMid.radius : checkPrev.radius);
                    isRimshot = (this.data.type === 'snare' && hitRadius > this.data.hitRadius * 0.75);
                    break;
                }
            }

            if (isHitNow) {
                // Determine if this is a new hit
                if (!this.isBeingHit.get(stickId) && cooldown <= 0) {
                    // Trigger sound
                    let rawVel = stickComp.velocity || 0;
                    // Realistic velocity mapping
                    let velocityVolume = rawVel * 0.8;

                    if (audioCtx.state === 'suspended') audioCtx.resume();

                    // Trigger Haptics
                    if (stick.components['gamepad-controls'] && stick.components['gamepad-controls'].controller) {
                        const gamepad = stick.components['gamepad-controls'].controller;
                        if (gamepad.hapticActuators && gamepad.hapticActuators.length > 0) {
                            // Scale haptic pulse strength from 0.1 to 1.0 based on swing velocity
                            const pulseStrength = Math.min(Math.max(rawVel * 0.5, 0.1), 1.0);
                            gamepad.hapticActuators[0].pulse(pulseStrength, 60);
                        }
                    }

                    // Get drum 3D position for spatial audio
                    const drumPos = new THREE.Vector3();
                    this.el.object3D.getWorldPosition(drumPos);

                    playSound(this.data.type, velocityVolume, drumPos, isRimshot);

                    // Track Analytics
                    if (!sessionStartTime) sessionStartTime = Date.now();
                    sessionHits++;
                    sessionMaxVel = Math.max(sessionMaxVel, velocityVolume);

                    // Notify AI Trainer
                    handleUserHit(this.data.type);

                    // Determine effect color based on drum type
                    let fxColor = '#4facfe'; // Default cyan
                    if (this.data.type === 'crash' || this.data.type === 'ride' || this.data.type === 'hihat') {
                        fxColor = '#ffdd44'; // Gold for cymbals
                    } else if (this.data.type === 'kick') {
                        fxColor = '#ff4444'; // Red for kick
                    }

                    // Trigger impact visual effect at the exact node position that hit
                    if (hitPos) {
                        createHitEffect(hitPos, fxColor);
                    }

                    // Trigger visual feedback on the drum itself
                    this.el.emit('drum-hit', null, false);
                    this.el.object3D.scale.set(1, 1, 1);

                    this.hitCooldowns.set(stickId, 100); // 100ms cooldown per stick
                }
                this.isBeingHit.set(stickId, true);
            } else {
                this.isBeingHit.set(stickId, false);
            }

            // Advance prevPos inside drum tick to ensure drum checking finishes before stick updates it
            for (let i = 0; i < stickComp.currentPositions.length; i++) {
                stickComp.prevPositions[i].copy(stickComp.currentPositions[i]);
            }
        });
    }
});

// Ensure Audio Context wakes up when user starts interacting (e.g. clicks anything or enters VR)
document.addEventListener('click', () => {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}, { once: true });

window.addEventListener('enter-vr', () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
});

// Provide keyboard fallbacks for testing on desktop
window.addEventListener('keydown', (e) => {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    // Animate drum and play sound if key matches
    let drumType = null;
    switch (e.key) {
        case '1': drumType = 'kick'; break;
        case '2': drumType = 'snare'; break;
        case '3': drumType = 'hihat'; break;
        case '4': drumType = 'tom1'; break;
        case '5': drumType = 'tom2'; break;
        case '6': drumType = 'floortom'; break;
        case '7': drumType = 'crash'; break;
        case '8': drumType = 'ride'; break;
    }

    if (drumType) {
        // Find the visual element to animate it
        const drumEl = document.querySelector(`[drum="type: ${drumType}"]`);
        if (drumEl) {
            drumEl.emit('drum-hit', null, false);

            // Generate visual effect above the drum for keyboard testing
            const drumPos = new THREE.Vector3();
            drumEl.object3D.getWorldPosition(drumPos);
            drumPos.y += 0.1; // Slightly above

            let fxColor = '#4facfe';
            if (drumType === 'crash' || drumType === 'ride' || drumType === 'hihat') fxColor = '#ffdd44';
            else if (drumType === 'kick') fxColor = '#ff4444';

            createHitEffect(drumPos, fxColor);

            // Reset scale/rotation slightly to allow rapid re-trigger animations
            if (drumType === 'crash' || drumType === 'ride' || drumType === 'hihat') {
                const rot = drumEl.object3D.rotation; // Get original/current before emitting might be complex, just rely on animation
            } else {
                drumEl.object3D.scale.set(1, 1, 1);
            }
        }

        // Pass dummy 3D position for desktop testing (center)
        playSound(drumType, 1.0, new THREE.Vector3(0, 1, -1), false); // Play at max velocity

        // Track Analytics
        if (!sessionStartTime) sessionStartTime = Date.now();
        sessionHits++;
        sessionMaxVel = Math.max(sessionMaxVel, 1.0);

        // Notify AI Trainer
        handleUserHit(drumType);
    }
});

// --- AI Drum Trainer Logic ---
let trainerState = 'idle'; // 'idle', 'playing', 'listening'
let pattern = [];
let userPlaybackIndex = 0;
let trainerScore = 0;
let trainerStreak = 0;
const availableDrums = ['kick', 'snare', 'hihat', 'tom1', 'crash'];

const updateTrainerUI = (statusText) => {
    const statusEl = document.getElementById('trainer-status');
    const scoreEl = document.getElementById('trainer-score');
    const streakEl = document.getElementById('trainer-streak');

    if (statusEl && statusText) statusEl.textContent = statusText;
    if (scoreEl) scoreEl.textContent = trainerScore;
    if (streakEl) streakEl.textContent = trainerStreak;
};

const handleUserHit = (drumType) => {
    if (trainerState !== 'listening') return;

    if (pattern[userPlaybackIndex] === drumType) {
        // Correct Hit!
        userPlaybackIndex++;

        if (userPlaybackIndex >= pattern.length) {
            // Completed pattern successfully
            trainerScore += (100 * pattern.length) + (trainerStreak * 50);
            trainerStreak++;
            updateTrainerUI('Perfect! Expanding pattern...');

            // Generate cheers at high streak thresholds
            if (trainerStreak > 0 && trainerStreak % 3 === 0) {
                playAudienceCheer();
            }

            trainerState = 'idle';
            setTimeout(() => {
                generateAndPlayPattern();
            }, 1000);
        }
    } else {
        // Incorrect hit!
        trainerState = 'idle';
        trainerStreak = 0;
        updateTrainerUI(`Missed! Expected ${pattern[userPlaybackIndex]}. Try again.`);
        const btn = document.getElementById('trainer-btn');
        if (btn) {
            btn.textContent = '🎮 Restart Training';
            btn.disabled = false;
        }
    }
};

const playAudienceCheer = () => {
    // Generate pink noise for a 'cheering crowd' effect
    const bufferSize = audioCtx.sampleRate * 2.5; // 2.5s cheer
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);

    // Pink noise approximation
    let b0, b1, b2, b3, b4, b5, b6;
    b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
    for (let i = 0; i < bufferSize; i++) {
        let white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        data[i] *= 0.11; // compensate gain
        b6 = white * 0.115926;
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    filter.Q.value = 0.5;

    const envelope = audioCtx.createGain();
    envelope.gain.setValueAtTime(0.01, audioCtx.currentTime);
    envelope.gain.exponentialRampToValueAtTime(0.4, audioCtx.currentTime + 0.5);
    envelope.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 2.5);

    noise.connect(filter);
    filter.connect(envelope);
    envelope.connect(globalGain);

    noise.start();
};

const playTrainerBeat = (index) => {
    if (index >= pattern.length) {
        trainerState = 'listening';
        userPlaybackIndex = 0;
        updateTrainerUI('Your Turn!');
        return;
    }

    const drumToPlay = pattern[index];

    // Animate drum
    const drumEl = document.querySelector(`[drum="type: ${drumToPlay}"]`);
    if (drumEl) {
        drumEl.emit('drum-hit', null, false);
        drumEl.object3D.scale.set(1, 1, 1);

        // Setup Highlight Box
        const drumPos = new THREE.Vector3();
        drumEl.object3D.getWorldPosition(drumPos);
        createHitEffect(drumPos, '#ffffff'); // White highlight to show AI
        playSound(drumToPlay, 1.0, drumPos, false);
    } else {
        playSound(drumToPlay, 1.0, null, false);
    }

    // Next beat
    setTimeout(() => {
        playTrainerBeat(index + 1);
    }, 600 - Math.min(trainerStreak * 20, 300)); // Speed up as streak increases
};

const generateAndPlayPattern = () => {
    trainerState = 'playing';
    updateTrainerUI('Listen...');

    // Add 1 random drum to the sequence every turn
    const nextDrum = availableDrums[Math.floor(Math.random() * availableDrums.length)];
    pattern.push(nextDrum);

    playTrainerBeat(0);
};

const startTrainer = () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const btn = document.getElementById('trainer-btn');
    if (btn) btn.disabled = true;

    trainerScore = 0;
    trainerStreak = 0;
    pattern = [];
    updateTrainerUI('Starting...');

    setTimeout(() => {
        generateAndPlayPattern();
    }, 1000);
};

window.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('trainer-btn');
    if (btn) btn.addEventListener('click', startTrainer);
});

// --- Beat Visualizer Setup ---
// Configure the Web Audio analyser
analyser.fftSize = 64;
const bufferLength = analyser.frequencyBinCount;
const dataArray = new Uint8Array(bufferLength);

AFRAME.registerComponent('beat-visualizer', {
    init: function () {
        this.visualizerBars = [];
        this.baseScale = new THREE.Vector3(1, 1, 1);

        // We will scale up the studio foam panels based on the beat!
        setTimeout(() => {
            this.visualizerBars = Array.from(document.querySelectorAll('.visualizer-bar'));

            // Also add neon rings around the player
            const ringsContainer = document.getElementById('visualizer-rings');
            if (ringsContainer) {
                for (let i = 0; i < 8; i++) {
                    const ring = document.createElement('a-ring');
                    ring.setAttribute('radius-inner', '4');
                    ring.setAttribute('radius-outer', '4.1');
                    ring.setAttribute('color', '#00f2fe');
                    ring.setAttribute('material', 'shader: flat; transparent: true; opacity: 0.8');
                    ring.setAttribute('position', `0 ${0.5 + (i * 0.5)} 0`);
                    ring.setAttribute('rotation', '90 0 0');
                    ringsContainer.appendChild(ring);
                    this.visualizerBars.push(ring);
                }
            }
        }, 1000);
    },
    tick: function () {
        if (!this.visualizerBars.length || audioCtx.state === 'suspended') return;

        analyser.getByteFrequencyData(dataArray);

        // Average low freq (kick)
        let lowFreq = (dataArray[1] + dataArray[2] + dataArray[3]) / 3;
        // Average mid/high
        let highFreq = (dataArray[10] + dataArray[15] + dataArray[20]) / 3;

        // Scale visualizer entities
        for (let i = 0; i < this.visualizerBars.length; i++) {
            const bar = this.visualizerBars[i];
            const dataVal = dataArray[(i * 2) % bufferLength] || 0;
            const normalized = dataVal / 255.0; // 0.0 to 1.0

            if (bar.tagName === 'A-RING') {
                // Pulse Rings
                const scl = 1.0 + (normalized * 0.5);
                bar.object3D.scale.set(scl, scl, scl);

                // Opacity pulses largely with Kick drum
                bar.setAttribute('material', `opacity: ${0.2 + (lowFreq / 255.0) * 0.8}`);
            } else {
                // Subtly push Foam Panels forward
                bar.object3D.scale.set(1, 1, 1.0 + (normalized * 5.0));
            }
        }
    }
});

// Attach visualizer component to scene and handle loading screen
window.addEventListener('DOMContentLoaded', () => {
    const scene = document.querySelector('a-scene');
    if (scene) {
        scene.setAttribute('beat-visualizer', '');

        // Handle Loading Screen & Sample Library
        const loadingScreen = document.getElementById('loading-screen');
        const loadingBar = document.getElementById('loading-bar');
        const loadingText = document.getElementById('loading-text');

        if (loadingScreen) {
            // 1. Start fetching audio samples immediately
            initSampleLibrary().then(() => {
                if (loadingBar) loadingBar.style.width = '50%';

                // 2. Wait for A-Frame model loading
                if (scene.hasLoaded) {
                    finishLoading(loadingScreen, loadingBar);
                } else {
                    scene.addEventListener('loaded', () => {
                        finishLoading(loadingScreen, loadingBar);
                    });
                }
            });
        }
    }

    function finishLoading(loadingScreen, loadingBar) {
        if (loadingBar) loadingBar.style.width = '100%';
        setTimeout(() => {
            loadingScreen.style.opacity = '0';
            setTimeout(() => loadingScreen.style.display = 'none', 1000); // Wait for fade out
            sessionStartTime = Date.now(); // Start tracking duration
        }, 500);
    }

    // Analytics Panel Toggle
    // (We'll assume closing VR or clicking a hidden 'End Session' opens it, 
    // for this demo we'll show it when they type 'Q')
    const analyticsPanel = document.getElementById('analytics-panel');
    const closeAnalyticsBtn = document.getElementById('close-analytics-btn');
    if (closeAnalyticsBtn && analyticsPanel) {
        closeAnalyticsBtn.addEventListener('click', () => {
            analyticsPanel.style.display = 'none';
        });
    }

    window.addEventListener('keydown', (e) => {
        if (e.key === 'q' || e.key === 'Q') {
            if (analyticsPanel && analyticsPanel.style.display === 'none') {
                analyticsPanel.style.display = 'block';

                // Calculate stats
                document.getElementById('stat-total').textContent = sessionHits;
                document.getElementById('stat-vel').textContent = sessionMaxVel.toFixed(2);

                let hpm = 0;
                if (sessionStartTime) {
                    const elapsedMs = Date.now() - sessionStartTime;
                    const elapsedMins = elapsedMs / 60000;
                    if (elapsedMins > 0) {
                        hpm = Math.floor(sessionHits / elapsedMins);
                    }
                }
                document.getElementById('stat-hpm').textContent = hpm;
            } else if (analyticsPanel) {
                analyticsPanel.style.display = 'none';
            }
        }
    });
});
