// Web Audio Context setup
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Drum Synthesis Functions using Web Audio API
const playKick = (velocity = 1) => {
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);

    gainNode.gain.setValueAtTime(velocity, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);

    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.5);
};

const playSnare = (velocity = 1) => {
    // Noise buffer for the snare rattle length
    const bufferSize = audioCtx.sampleRate * 0.2;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 1000;

    const noiseEnvelope = audioCtx.createGain();
    noiseEnvelope.gain.setValueAtTime(velocity * 0.8, audioCtx.currentTime);
    noiseEnvelope.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseEnvelope);
    noiseEnvelope.connect(audioCtx.destination);

    // Tonal part (drum body)
    const osc = audioCtx.createOscillator();
    const oscEnvelope = audioCtx.createGain();

    osc.type = 'triangle';
    osc.connect(oscEnvelope);
    oscEnvelope.connect(audioCtx.destination);

    osc.frequency.setValueAtTime(250, audioCtx.currentTime);
    oscEnvelope.gain.setValueAtTime(velocity * 0.6, audioCtx.currentTime);
    oscEnvelope.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

    osc.start(audioCtx.currentTime);
    noise.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.2);
};

const playHiHat = (velocity = 1, open = false) => {
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
    envelope.connect(audioCtx.destination);

    noise.start(audioCtx.currentTime);
};

const playTom = (freq = 150, duration = 0.5, velocity = 1) => {
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.1, audioCtx.currentTime + duration);

    gainNode.gain.setValueAtTime(velocity, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + duration);
};

const playCymbal = (velocity = 1, type = 'crash') => {
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

    gainNode.connect(audioCtx.destination);
    source.start(audioCtx.currentTime);
};

const playSound = (type, velocity = 1.0) => {
    // Browsers require user interaction to start audio, A-Frame handles this partially on Enter VR, but ensure it's resumed
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    switch (type) {
        case 'kick': playKick(velocity); break;
        case 'snare': playSnare(velocity); break;
        case 'hihat': playHiHat(velocity, false); break;
        case 'tom1': playTom(250, 0.4, velocity); break;
        case 'tom2': playTom(200, 0.5, velocity); break;
        case 'floortom': playTom(100, 0.6, velocity); break;
        case 'crash': playCymbal(velocity, 'crash'); break;
        case 'ride': playCymbal(velocity, 'ride'); break;
    }
};

// A-Frame: Drumstick component to track velocity and position
AFRAME.registerComponent('drumstick', {
    schema: {
        hand: { type: 'string', default: 'right' }
    },
    tick: function () {
        const tip = this.el.querySelector('.stick-tip');
        if (!tip) return;

        const currentPos = new THREE.Vector3();
        tip.object3D.getWorldPosition(currentPos);

        if (!this.prevPos) {
            this.prevPos = currentPos.clone();
            return;
        }

        const delta = this.el.sceneEl.delta || 16;
        const velocity = currentPos.distanceTo(this.prevPos) / (delta / 1000);

        // Expose velocity and positions to be read by drums
        this.el.setAttribute('data-velocity', velocity);
        this.el.setAttribute('data-prev-pos', AFRAME.utils.coordinates.stringify(this.prevPos));
        this.el.setAttribute('data-curr-pos', AFRAME.utils.coordinates.stringify(currentPos));

        this.prevPos.copy(currentPos);
    }
});

// A-Frame: Drum component for hit detection and visual response
AFRAME.registerComponent('drum', {
    schema: {
        type: { type: 'string', default: 'snare' }
    },
    init: function () {
        this.hitCooldowns = new Map();
        this.isBeingHit = new Map();

        // Add minimal animation component if we want bouncing
        this.el.setAttribute('animation__hit', {
            property: 'scale',
            dir: 'alternate',
            dur: 50,
            to: '1.02 0.95 1.02', // Compress slightly
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
    },
    tick: function (time, delta) {
        const sticks = document.querySelectorAll('[drumstick]');

        // Create an accurate bounding box each frame (drums shouldn't move, but just in case)
        const bbox = new THREE.Box3().setFromObject(this.el.object3D);
        bbox.expandByScalar(0.04); // Slightly larger hit area for easier drumming

        sticks.forEach(stick => {
            const stickId = stick.id || stick.getAttribute('drumstick').hand;

            // Check specific stick cooldown
            let cooldown = this.hitCooldowns.get(stickId) || 0;
            if (cooldown > 0) {
                this.hitCooldowns.set(stickId, cooldown - delta);
                return;
            }

            const currPosStr = stick.getAttribute('data-curr-pos');
            if (!currPosStr) return;

            const currPos = AFRAME.utils.coordinates.parse(currPosStr);
            const stickVec = new THREE.Vector3(currPos.x, currPos.y, currPos.z);

            if (bbox.containsPoint(stickVec)) {
                // Determine if this is a new hit
                if (!this.isBeingHit.get(stickId)) {
                    // Trigger sound
                    let rawVel = parseFloat(stick.getAttribute('data-velocity')) || 0;

                    // The faster the controller moves, the stronger the drum hit
                    // Map raw speed (m/s) to 0.1 - 1.5 range
                    let velocityVolume = Math.min(Math.max(rawVel / 3.0, 0.2), 1.5);

                    playSound(this.data.type, velocityVolume);

                    // Trigger visual feedback
                    this.el.emit('drum-hit', null, false);

                    // Reset animation slightly to ensure re-triggering looks good
                    this.el.object3D.scale.set(1, 1, 1);

                    this.hitCooldowns.set(stickId, 100); // 100ms cooldown per stick
                }
                this.isBeingHit.set(stickId, true);
            } else {
                this.isBeingHit.set(stickId, false);
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
            // Reset scale/rotation slightly to allow rapid re-trigger animations
            if (drumType === 'crash' || drumType === 'ride' || drumType === 'hihat') {
                const rot = drumEl.object3D.rotation; // Get original/current before emitting might be complex, just rely on animation
            } else {
                drumEl.object3D.scale.set(1, 1, 1);
            }
        }
        playSound(drumType, 1.0); // Play at max velocity
    }
});
