let audioContext;
let oscillator;
let gainNode;
let isPlaying = false; // Para saber si un sonido está activo

// Para controlar si una tecla ya está presionada y evitar repeticiones rápidas
let keyOnePressed = false;
let keyZeroPressed = false;

// Variables para controlar la secuencia
let sequenceTimeoutId = null; // Para poder cancelar la secuencia en curso

// Variables para la grabación de audio
let mediaRecorder;
let audioChunks = [];
let audioStreamDestination; // Para conectar el audio a la grabadora
let isRecording = false;

// Función para inicializar el contexto de audio y los nodos
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        oscillator = audioContext.createOscillator();
        gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        // Conectar el nodo de ganancia a un destino que puede ser la salida (altavoces) o la grabadora
        // Inicialmente, solo a los altavoces
        gainNode.connect(audioContext.destination);

        oscillator.type = 'square';
        oscillator.start(0);
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    }
}

// Función para reproducir un sonido con una frecuencia y volumen específicos
function playSound(frequency, volumePercentage) {
    initAudio();

    if (isPlaying && gainNode) {
        gainNode.gain.cancelScheduledValues(audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.005);
        isPlaying = false;
    }

    const maxBaseFrequency = 2000;
    const targetFrequency = Math.max(20, Math.min(maxBaseFrequency, frequency));

    const maxVolume = 0.5;
    const targetVolume = maxVolume * (volumePercentage / 100);

    oscillator.frequency.setValueAtTime(targetFrequency, audioContext.currentTime);

    gainNode.gain.cancelScheduledValues(audioContext.currentTime);
    gainNode.gain.setValueAtTime(gainNode.gain.value, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(targetVolume, audioContext.currentTime + 0.01);
    isPlaying = true;
}

// Función para detener el sonido suavemente
function stopSound() {
    if (isPlaying && gainNode) {
        gainNode.gain.cancelScheduledValues(audioContext.currentTime);
        gainNode.gain.setValueAtTime(gainNode.gain.value, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.05);
        isPlaying = false;
    }
    if (sequenceTimeoutId) {
        clearTimeout(sequenceTimeoutId);
        sequenceTimeoutId = null;
    }
}

// --- Event Listeners para la interacción ---

const masterFrequencyRange = document.getElementById('masterFrequencyRange');
const masterFrequencyValueSpan = document.getElementById('masterFrequencyValue');
const volumeRange = document.getElementById('volumeRange');
const volumeValueSpan = document.getElementById('volumeValue');
const buttonOne = document.getElementById('buttonOne');
const buttonZero = document.getElementById('buttonZero');
const stopButton = document.getElementById('stopButton');
const sequenceInput = document.getElementById('sequenceInput');
const playSequenceButton = document.getElementById('playSequenceButton');
const recordButton = document.getElementById('recordButton'); // Nuevo
const stopRecordButton = document.getElementById('stopRecordButton'); // Nuevo
const downloadLink = document.getElementById('downloadLink'); // Nuevo

let currentMasterFrequency = parseInt(masterFrequencyRange.value);
let currentVolume = parseInt(volumeRange.value);

masterFrequencyRange.addEventListener('input', (event) => {
    currentMasterFrequency = parseInt(event.target.value);
    masterFrequencyValueSpan.textContent = currentMasterFrequency;
});

volumeRange.addEventListener('input', (event) => {
    currentVolume = parseInt(event.target.value);
    volumeValueSpan.textContent = currentVolume;
});

buttonOne.addEventListener('mousedown', () => {
    const frequencyForOne = currentMasterFrequency * 1.1;
    playSound(frequencyForOne, currentVolume);
});
buttonOne.addEventListener('mouseup', stopSound);
buttonOne.addEventListener('mouseleave', stopSound);

buttonZero.addEventListener('mousedown', () => {
    const frequencyForZero = currentMasterFrequency * 0.9;
    playSound(frequencyForZero, currentVolume);
});
buttonZero.addEventListener('mouseup', stopSound);
buttonZero.addEventListener('mouseleave', stopSound);

stopButton.addEventListener('click', stopSound);

document.addEventListener('keydown', (event) => {
    initAudio();

    if (event.key === '1' && !keyOnePressed) {
        const frequencyForOne = currentMasterFrequency * 1.1;
        playSound(frequencyForOne, currentVolume);
        keyOnePressed = true;
        buttonOne.classList.add('active');
    } else if (event.key === '0' && !keyZeroPressed) {
        const frequencyForZero = currentMasterFrequency * 0.9;
        playSound(frequencyForZero, currentVolume);
        keyZeroPressed = true;
        buttonZero.classList.add('active');
    }
});

document.addEventListener('keyup', (event) => {
    if (event.key === '1') {
        stopSound();
        keyOnePressed = false;
        buttonOne.classList.remove('active');
    } else if (event.key === '0') {
        stopSound();
        keyZeroPressed = false;
        buttonZero.classList.remove('active');
    }
});

playSequenceButton.addEventListener('click', () => {
    stopSound();
    const sequenceText = sequenceInput.value.trim();
    if (sequenceText === '') {
        alert('Por favor, ingresa una secuencia válida (ej: 1,0,300hz,80%).');
        return;
    }

    const segments = sequenceText.split(',').map(s => s.trim());
    let segmentIndex = 0;
    const delayBetweenTones = 200;

    function playNextSegment() {
        if (segmentIndex >= segments.length) {
            stopSound();
            return;
        }

        const segment = segments[segmentIndex];
        let targetFrequency = currentMasterFrequency * 1.0;
        let targetVolume = currentVolume;

        const hzMatch = segment.match(/(\d+)hz/i);
        const percentMatch = segment.match(/(\d+)%/);

        if (hzMatch) {
            targetFrequency = parseInt(hzMatch[1]);
            targetVolume = percentMatch ? parseInt(percentMatch[1]) : currentVolume;
        } else if (percentMatch) {
            targetVolume = parseInt(percentMatch[1]);
        } else if (segment === '1') {
            targetFrequency = currentMasterFrequency * 1.1;
        } else if (segment === '0') {
            targetFrequency = currentMasterFrequency * 0.9;
        } else {
            console.warn(`Segmento desconocido en la secuencia: ${segment}. Ignorando.`);
            segmentIndex++;
            sequenceTimeoutId = setTimeout(playNextSegment, delayBetweenTones);
            return;
        }

        playSound(targetFrequency, targetVolume);

        segmentIndex++;
        sequenceTimeoutId = setTimeout(() => {
            stopSound();
            playNextSegment();
        }, delayBetweenTones);
    }

    playNextSegment();
});


// --- NUEVA FUNCIONALIDAD: Grabación de Audio ---

recordButton.addEventListener('click', () => {
    initAudio(); // Asegura que el AudioContext esté listo
    if (!audioContext) {
        alert("El AudioContext no está inicializado. Intenta interactuar con la página primero.");
        return;
    }

    // Desconectar el gainNode de la salida directa del navegador
    // Si ya está conectado, primero desconéctalo
    gainNode.disconnect();
    
    // Crear un MediaStreamDestination para grabar el audio
    audioStreamDestination = audioContext.createMediaStreamDestination();
    // Conectar el gainNode (donde sale el audio generado) a este destino de stream
    gainNode.connect(audioStreamDestination);
    // Conectar también al destino de los altavoces para seguir escuchando
    gainNode.connect(audioContext.destination);

    // Inicializar MediaRecorder
    mediaRecorder = new MediaRecorder(audioStreamDestination.stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = event => {
        audioChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' }); // O 'audio/webm'
        const audioUrl = URL.createObjectURL(audioBlob);

        downloadLink.href = audioUrl;
        downloadLink.download = `musica_arcade_${new Date().getTime()}.wav`;
        downloadLink.style.display = 'block'; // Mostrar el enlace de descarga
        downloadLink.textContent = 'Descargar Audio';

        // Una vez que se detiene la grabación, reconectar el gainNode solo a los altavoces
        gainNode.disconnect(audioStreamDestination); // Desconectar de la grabadora
        gainNode.connect(audioContext.destination); // Asegurar que sigue conectado a los altavoces
        isRecording = false; // Actualizar estado de grabación
        updateRecordingButtons();
    };

    mediaRecorder.start();
    isRecording = true;
    updateRecordingButtons();
    downloadLink.style.display = 'none'; // Ocultar el enlace de descarga mientras se graba
    downloadLink.removeAttribute('href');
    downloadLink.removeAttribute('download');
    downloadLink.textContent = '';
    console.log("Grabación iniciada...");
});

stopRecordButton.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        console.log("Grabación detenida.");
    }
});

function updateRecordingButtons() {
    recordButton.disabled = isRecording;
    stopRecordButton.disabled = !isRecording;
}

// Inicializar el estado de los botones de grabación al cargar
document.addEventListener('DOMContentLoaded', updateRecordingButtons);
