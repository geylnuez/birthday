const SONG_START_TIME = 14;
const SONG_VOLUME = 0.45;
const POP_VOLUME = 1.4;
const balloons = document.querySelectorAll(".balloon");
const balloonArea = document.getElementById("balloonArea");
const balloonScreen = document.getElementById("balloonScreen");
const birthdayScreen = document.getElementById("birthdayScreen");
const photoScreen = document.getElementById("photoScreen");
const photoButton = document.getElementById("photoButton");
const photoCards = document.querySelectorAll(".photo-card");
const scrollHint = document.getElementById("scrollHint");
const messageButton = document.getElementById("messageButton");
const restartButton = document.getElementById("restartButton");
const messageModal = document.getElementById("messageModal");
const modalBackdrop = document.getElementById("modalBackdrop");
const modalClose = document.getElementById("modalClose");
const messageVideo = document.getElementById("messageVideo");

let resumeSongAfterVideo = false;

let pendingTimers = [];

function later(fn, ms) {
    const id = setTimeout(fn, ms);
    pendingTimers.push(id);
    return id;
}

const balloonData = [];
let poppedCount = 0;
let audioContext = null;
let masterGain = null;

const birthdaySong = new Audio("audio/birthday-song.mp3");
birthdaySong.preload = "auto";

function setupBalloons() {
    balloonData.length = 0;

    balloons.forEach((balloon) => {
        const areaRect = balloonArea.getBoundingClientRect();

        balloonData.push({
            x: Math.random() * Math.max(20, areaRect.width - balloon.offsetWidth),
            y: Math.random() * Math.max(20, areaRect.height - balloon.offsetHeight),
            dx: (Math.random() * 0.7 + 0.35) * (Math.random() > 0.5 ? 1 : -1),
            dy: (Math.random() * 0.55 + 0.25) * (Math.random() > 0.5 ? 1 : -1),
            rotation: Math.random() * 20 - 10,
            rotationSpeed: Math.random() * 0.025 - 0.0125,
            popped: false
        });

        const data = balloonData[balloonData.length - 1];
        balloon.style.left = data.x + "px";
        balloon.style.top = data.y + "px";
    });
}

function animateBalloons() {
    const areaRect = balloonArea.getBoundingClientRect();

    balloons.forEach((balloon, index) => {
        const data = balloonData[index];
        if (!data || data.popped) return;

        const maxX = areaRect.width - balloon.offsetWidth;
        const maxY = areaRect.height - balloon.offsetHeight;

        data.x += data.dx;
        data.y += data.dy;
        data.rotation += data.rotationSpeed;

        if (data.x <= 0)    { data.x = 0;    data.dx =  Math.abs(data.dx); }
        if (data.x >= maxX) { data.x = maxX; data.dx = -Math.abs(data.dx); }
        if (data.y <= 0)    { data.y = 0;    data.dy =  Math.abs(data.dy); }
        if (data.y >= maxY) { data.y = maxY; data.dy = -Math.abs(data.dy); }

        balloon.style.left = data.x + "px";
        balloon.style.top = data.y + "px";
        balloon.style.transform = `rotate(${data.rotation}deg)`;
    });

    requestAnimationFrame(animateBalloons);
}

setupBalloons();
animateBalloons();

const TING_NOTES = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

function getAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();

        const compressor = audioContext.createDynamicsCompressor();
        compressor.threshold.value = -14;
        compressor.knee.value = 8;
        compressor.ratio.value = 6;
        compressor.attack.value = 0.002;
        compressor.release.value = 0.15;

        masterGain = audioContext.createGain();
        masterGain.gain.value = POP_VOLUME;

        masterGain.connect(compressor);
        compressor.connect(audioContext.destination);
    }

    if (audioContext.state === "suspended") audioContext.resume();
}

function playPopSound() {
    getAudio();

    const now = audioContext.currentTime;
    const variation = 0.85 + Math.random() * 0.3;
    const thump = audioContext.createOscillator();
    const thumpGain = audioContext.createGain();
    thump.type = "sine";
    thump.frequency.setValueAtTime(260 * variation, now);
    thump.frequency.exponentialRampToValueAtTime(40, now + 0.2);
    thumpGain.gain.setValueAtTime(2.2, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    thump.connect(thumpGain);
    thumpGain.connect(masterGain);
    thump.start(now);
    thump.stop(now + 0.25);

    const length = Math.floor(audioContext.sampleRate * 0.18);
    const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
    const channel = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
        const decay = Math.pow(1 - i / length, 2.5);
        channel[i] = (Math.random() * 2 - 1) * decay;
    }

    const noise = audioContext.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = audioContext.createBiquadFilter();
    noiseFilter.type = "highpass";
    noiseFilter.frequency.value = 900 * variation;

    const noiseGain = audioContext.createGain();
    noiseGain.gain.setValueAtTime(3.2, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);
    noise.start(now);
    noise.stop(now + 0.18);

    const click = audioContext.createOscillator();
    const clickGain = audioContext.createGain();
    click.type = "square";
    click.frequency.setValueAtTime(1100 * variation, now);
    click.frequency.exponentialRampToValueAtTime(150, now + 0.05);
    clickGain.gain.setValueAtTime(0.7, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    click.connect(clickGain);
    clickGain.connect(masterGain);
    click.start(now);
    click.stop(now + 0.05);

    const note = TING_NOTES[poppedCount % TING_NOTES.length];
    const ting = audioContext.createOscillator();
    const tingGain = audioContext.createGain();
    ting.type = "triangle";
    ting.frequency.setValueAtTime(note, now + 0.02);
    tingGain.gain.setValueAtTime(0.0001, now);
    tingGain.gain.linearRampToValueAtTime(0.45, now + 0.03);
    tingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    ting.connect(tingGain);
    tingGain.connect(masterGain);
    ting.start(now);
    ting.stop(now + 0.6);
}

function createParticles(balloon) {
    const rect = balloon.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    const colors = ["#f4a6a6", "#f5cb7a", "#a8d7e7", "#c6b5e6", "#efaac3", "#9fd1b0"];

    for (let i = 0; i < 14; i++) {
        const particle = document.createElement("div");
        particle.className = "particle";
        particle.style.left = x + "px";
        particle.style.top = y + "px";
        particle.style.background = colors[Math.floor(Math.random() * colors.length)];
        particle.style.setProperty("--x", `${(Math.random() - 0.5) * 150}px`);
        particle.style.setProperty("--y", `${(Math.random() - 0.5) * 150}px`);

        document.body.appendChild(particle);
        setTimeout(() => particle.remove(), 750);
    }
}

function popBalloon(balloon, index) {
    const data = balloonData[index];
    if (!data || data.popped) return;

    data.popped = true;

    playPopSound();
    poppedCount++;

    createParticles(balloon);
    balloon.classList.add("popping");

    if (poppedCount === balloons.length) {
        setTimeout(showBirthday, 500);
    }
}

balloons.forEach((balloon, index) => {
    balloon.addEventListener("pointerdown", () => popBalloon(balloon, index));
});

function showBirthday() {
    balloonScreen.style.transition = "opacity .7s ease";
    balloonScreen.style.opacity = "0";

    setTimeout(() => {
        balloonScreen.style.display = "none";
        birthdayScreen.classList.add("show");
    }, 700);
}

function showPhotos() {
    birthdayScreen.style.transition = "opacity .6s ease";
    birthdayScreen.style.opacity = "0";

    birthdaySong.currentTime = SONG_START_TIME;
    birthdaySong.volume = SONG_VOLUME;

    birthdaySong.play().catch((error) => {
        console.log("Audio could not play:", error);
    });

    later(() => {
        birthdayScreen.style.display = "none";
        photoScreen.classList.add("show");

        photoCards.forEach((photo, index) => {
            later(() => photo.classList.add("show"), index * 250);
        });

        later(updateScrollHint, photoCards.length * 250 + 900);
    }, 600);
}

photoButton.addEventListener("click", showPhotos);

function updateScrollHint() {
    const canScroll = photoScreen.scrollHeight > photoScreen.clientHeight + 40;
    const atTop = photoScreen.scrollTop < 40;
    const visible = photoScreen.classList.contains("show") && canScroll && atTop;

    scrollHint.classList.toggle("visible", visible);
}

photoScreen.addEventListener("scroll", updateScrollHint, { passive: true });

function openMessage() {
    messageModal.classList.add("open");
    messageModal.setAttribute("aria-hidden", "false");
    scrollHint.classList.remove("visible");
    modalClose.focus();
}

function closeMessage() {
    messageVideo.pause();
    messageModal.classList.remove("open");
    messageModal.setAttribute("aria-hidden", "true");
}

messageVideo.addEventListener("play", () => {
    resumeSongAfterVideo = !birthdaySong.paused;
    birthdaySong.pause();
});

function resumeSong() {
    if (!resumeSongAfterVideo) return;

    resumeSongAfterVideo = false;
    birthdaySong.play().catch(() => {});
}

messageVideo.addEventListener("pause", resumeSong);
messageVideo.addEventListener("ended", resumeSong);

messageButton.addEventListener("click", openMessage);
modalClose.addEventListener("click", closeMessage);
modalBackdrop.addEventListener("click", closeMessage);

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMessage();
});

function startAgain() {
    pendingTimers.forEach(clearTimeout);
    pendingTimers = [];

    resumeSongAfterVideo = false;
    messageVideo.pause();
    messageVideo.currentTime = 0;
    birthdaySong.pause();
    birthdaySong.currentTime = 0;
    birthdaySong.volume = SONG_VOLUME;

    closeMessage();
    scrollHint.classList.remove("visible");

    photoScreen.classList.remove("show");
    photoScreen.scrollTop = 0;

    birthdayScreen.classList.remove("show");
    birthdayScreen.style.display = "";
    birthdayScreen.style.opacity = "";
    birthdayScreen.style.transition = "";

    photoCards.forEach((card) => card.classList.remove("show", "touching"));

    balloonScreen.style.transition = "none";
    balloonScreen.style.display = "";
    balloonScreen.style.opacity = "1";

    balloons.forEach((balloon) => {
        balloon.classList.remove("popping");
        balloon.style.transform = "";
    });

    poppedCount = 0;
    setupBalloons();
}

restartButton.addEventListener("click", startAgain);

window.addEventListener("resize", updateScrollHint);

photoCards.forEach((card) => {
    card.addEventListener("click", () => {
        if (!window.matchMedia("(hover: none)").matches) return;

        photoCards.forEach((other) => {
            if (other !== card) other.classList.remove("touching");
        });

        card.classList.toggle("touching");
    });
});

window.addEventListener("resize", () => {
    const areaRect = balloonArea.getBoundingClientRect();

    balloons.forEach((balloon, index) => {
        const data = balloonData[index];
        if (!data) return;

        data.x = Math.min(data.x, Math.max(0, areaRect.width - balloon.offsetWidth));
        data.y = Math.min(data.y, Math.max(0, areaRect.height - balloon.offsetHeight));
    });
});
