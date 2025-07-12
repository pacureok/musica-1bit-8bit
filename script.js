let audioContext;
let oscillator;
let gainNode;
let isPlaying = false; // Para saber si un sonido generado está activo

let keyOnePressed = false;
let keyZeroPressed = false;

let sequenceTimeoutId = null; // Para la secuencia de 1,0,hz,%
let melodyTimeoutId = null; // Para la secuencia de notas musicales

// Variables para la grabación de audio
let mediaRecorder;
let audioChunks = [];
let audioStreamDestination;
let isRecording = false;

// Variables para reproducción MP3
let backgroundAudio;
let backgroundGainNode;
let backgroundIsPlaying = false;
const MAX_MP3_DURATION = 20; // Segundos

// --- Elementos del DOM para MP3 ---
const mp3FileInput = document.getElementById('mp3FileInput');
const playMp3Button = document.getElementById('playMp3Button');
const stopMp3Button = document.getElementById('stopMp3Button');
const mp3VolumeRange = document.getElementById('mp3VolumeRange');
const mp3VolumeValueSpan = document.getElementById('mp3VolumeValue');

// --- NUEVOS Elementos del DOM para Melodías ---
const melodyInput = document.getElementById('melodyInput');
const playMelodyButton = document.getElementById('playMelodyButton');
const noteDurationRange = document.getElementById('noteDuration');
const noteDurationValueSpan = document.getElementById('noteDurationValue');


// Mapa de frecuencias para notas musicales (A4 = 440 Hz)
const noteFrequencies = {
    'C3': 130.81, 'C#3': 138.59, 'D3': 146.83, 'D#3': 155.56, 'E3': 164.81, 'F3': 174.61, 'F#3': 185.00, 'G3': 196.00, 'G#3': 207.65, 'A3': 220.00, 'A#3': 233.08, 'B3': 246.94,
    'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13, 'E4': 329.63, 'F4': 349.23, 'F#4': 369.99, 'G4': 392.00, 'G#4': 415.30, 'A4': 440.00, 'A#4': 466.16, 'B4': 493.88,
    'C5': 523.25, 'C#5': 554.37, 'D5': 587.33, 'D#5': 622.25, 'E5': 659.25, 'F5': 698.46, 'F#5': 739.99, 'G5': 783.99, 'G#5': 830.61, 'A5': 880.00, 'A#5': 932.33, 'B5': 987.77,
    'C6': 1046.50, 'C#6': 1108.73, 'D6': 1174.66, 'D#6': 1244.51, 'E6': 1318.51, 'F6': 1396.91, 'F#6': 1479.98, 'G6': 1567.98, 'G#6': 1661.22, 'A6': 1760.00, 'A#6': 1864.66, 'B6': 1975.53
};


// Función para inicializar el contexto de audio y los nodos
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        oscillator = audioContext.createOscillator();
        gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination); // Conecta a los altavoces por defecto

        oscillator.type = 'square';
        oscillator.start(0);
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);

        // Inicializar nodos para el audio de fondo (MP3)
        // backgroundAudio se creará dinámicamente al cargar el archivo
        backgroundGainNode = audioContext.createGain();
        backgroundGainNode.gain.setValueAtTime(0.5, audioContext.currentTime); // Volumen inicial para MP3
        backgroundGainNode.connect(audioContext.destination);
    }
}

// Función para reproducir un sonido con una frecuencia y volumen específicos
function playSound(frequency, volumePercentage) {
    initAudio();

    // Detener cualquier sonido generado anteriormente de forma suave
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

// Función para detener el sonido generado (1-bit/8-bit y melodías)
function stopGeneratedSound() {
    if (isPlaying && gainNode) {
        gainNode.gain.cancelScheduledValues(audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.05);
        isPlaying = false;
    }
    if (sequenceTimeoutId) {
        clearTimeout(sequenceTimeoutId);
        sequenceTimeoutId = null;
    }
    if (melodyTimeoutId) {
        clearTimeout(melodyTimeoutId);
        melodyTimeoutId = null;
    }
}

// Función para detener TODO el sonido (generado y MP3)
function stopAllSound() {
    stopGeneratedSound();
    stopMp3();
}


// --- Event Listeners y Elementos DOM ---

const masterFrequencyRange = document.getElementById('masterFrequencyRange');
const masterFrequencyValueSpan = document.getElementById('masterFrequencyValue');
const volumeRange = document.getElementById('volumeRange');
const volumeValueSpan = document.getElementById('volumeValue');
const buttonOne = document.getElementById('buttonOne');
const buttonZero = document.getElementById('buttonZero');
const stopButton = document.getElementById('stopButton');
const sequenceInput = document.getElementById('sequenceInput');
const playSequenceButton = document.getElementById('playSequenceButton');
const recordButton = document.getElementById('recordButton');
const stopRecordButton = document.getElementById('stopRecordButton');
const downloadLink = document.getElementById('downloadLink');

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
buttonOne.addEventListener('mouseup', stopGeneratedSound);
buttonOne.addEventListener('mouseleave', stopGeneratedSound);

buttonZero.addEventListener('mousedown', () => {
    const frequencyForZero = currentMasterFrequency * 0.9;
    playSound(frequencyForZero, currentVolume);
});
buttonZero.addEventListener('mouseup', stopGeneratedSound);
buttonZero.addEventListener('mouseleave', stopGeneratedSound);

stopButton.addEventListener('click', stopAllSound);


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
        stopGeneratedSound();
        keyOnePressed = false;
        buttonOne.classList.remove('active');
    } else if (event.key === '0') {
        stopGeneratedSound();
        keyZeroPressed = false;
        buttonZero.classList.remove('active');
    }
});


// --- Lógica de Reproducción de Secuencia desde el Input (Mejorada) ---

playSequenceButton.addEventListener('click', () => {
    stopGeneratedSound(); // Detener cualquier sonido generado o secuencia anterior
    const sequenceText = sequenceInput.value.trim();
    if (sequenceText === '') {
        alert('Por favor, ingresa una secuencia válida (ej: 1,0,300hz,80%).');
        return;
    }

    const segments = sequenceText.split(',').map(s => s.trim());
    let segmentIndex = 0;
    const delayBetweenTones = 200; // milisegundos de pausa/duración mínima entre tonos

    function playNextSegment() {
        if (segmentIndex >= segments.length) {
            stopGeneratedSound(); // Terminó la secuencia
            return;
        }

        const segment = segments[segmentIndex];
        let targetFrequency = currentMasterFrequency * 1.0; // Frecuencia base por defecto
        let targetVolume = currentVolume; // Volumen base por defecto
        let isSilence = false; // Nueva bandera para indicar si es un silencio

        const hzMatch = segment.match(/^(\d+)hz$/i);
        const percentMatch = segment.match(/^(\d+)%$/);
        const numberMatch = segment.match(/^(\d+)$/);

        if (segment === '1') {
            targetFrequency = currentMasterFrequency * 1.1;
        } else if (segment === '0') {
            targetFrequency = currentMasterFrequency * 0.9;
        } else if (hzMatch) {
            targetFrequency = parseInt(hzMatch[1]);
        } else if (percentMatch) {
            targetVolume = parseInt(percentMatch[1]);
        } else if (numberMatch) {
            targetFrequency = parseInt(numberMatch[1]);
        } else if (segment.toLowerCase() === 'pausa' || segment.toLowerCase() === 'silencio' || segment === '_') {
            isSilence = true;
        }
        else {
            console.warn(`Segmento desconocido en la secuencia: ${segment}. Ignorando.`);
            segmentIndex++;
            sequenceTimeoutId = setTimeout(playNextSegment, delayBetweenTones);
            return;
        }

        if (isSilence) {
            stopGeneratedSound();
        } else {
            playSound(targetFrequency, targetVolume);
        }

        segmentIndex++;
        sequenceTimeoutId = setTimeout(() => {
            stopGeneratedSound();
            playNextSegment();
        }, delayBetweenTones);
    }

    playNextSegment();
});


// --- Lógica de Grabación de Audio ---

recordButton.addEventListener('click', () => {
    initAudio();
    if (!audioContext) {
        alert("El AudioContext no está inicializado. Intenta interactuar con la página primero.");
        return;
    }

    // Desconectar el gainNode de la salida directa del navegador si ya está conectado
    // y reconectarlo para asegurar que el stream de grabación lo capture.
    // Esto es un poco delicado con AudioContext, a veces es mejor manejarlo con un nodo intermedio.
    // Para simplificar, vamos a asegurar que gainNode esté conectado a *ambos* destinos.
    gainNode.disconnect(); // Desconecta de cualquier destino anterior

    audioStreamDestination = audioContext.createMediaStreamDestination();
    gainNode.connect(audioStreamDestination); // Conecta a la grabadora
    gainNode.connect(audioContext.destination); // Conecta también a los altavoces para seguir escuchando

    mediaRecorder = new MediaRecorder(audioStreamDestination.stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = event => {
        audioChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);

        downloadLink.href = audioUrl;
        downloadLink.download = `musica_arcade_${new Date().getTime()}.wav`;
        downloadLink.style.display = 'block';
        downloadLink.textContent = 'Descargar Audio';

        // Una vez que se detiene la grabación, desconectar de la grabadora
        gainNode.disconnect(audioStreamDestination);
        // Asegurarse de que el gainNode esté conectado a la salida principal después de la grabación
        // Si ya está conectado a audioContext.destination (lo cual debería estarlo por la línea de arriba),
        // no es necesario reconectar, pero lo dejamos para claridad.
        gainNode.connect(audioContext.destination);
       
        isRecording = false;
        updateRecordingButtons();
    };

    mediaRecorder.start();
    isRecording = true;
    updateRecordingButtons();
    downloadLink.style.display = 'none';
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

// --- Lógica de Reproducción de MP3 de Fondo ---

mp3FileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
        alert('Por favor, selecciona un archivo de audio (MP3, WAV, etc.).');
        mp3FileInput.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = e => {
        initAudio();
        audioContext.decodeAudioData(e.target.result, (buffer) => {
            // Si ya hay un backgroundAudio reproduciéndose, detenerlo y desconectarlo
            if (backgroundIsPlaying && backgroundAudio) {
                backgroundAudio.stop();
                backgroundAudio.disconnect();
            }
            // Crear un nuevo BufferSource para el nuevo archivo
            backgroundAudio = audioContext.createBufferSource();
            backgroundAudio.buffer = buffer;
            backgroundAudio.loop = true; // Para que se repita

            backgroundAudio.connect(backgroundGainNode);
            // backgroundGainNode ya está conectado a audioContext.destination en initAudio

            playMp3Button.disabled = false;
            stopMp3Button.disabled = true;
            console.log("MP3 cargado y listo para reproducir.");

        }, (err) => {
            console.error('Error al decodificar el archivo de audio:', err);
            alert('No se pudo cargar el archivo de audio. Asegúrate de que sea un formato válido.');
            mp3FileInput.value = '';
        });
    };
    reader.readAsArrayBuffer(file);
});

playMp3Button.addEventListener('click', () => {
    if (backgroundAudio && backgroundAudio.buffer) {
        // Para reproducir un AudioBufferSourceNode de nuevo, debes crear uno nuevo
        // y asignarle el mismo buffer.
        if (backgroundIsPlaying) {
            backgroundAudio.stop();
            backgroundAudio.disconnect();
        }
        
        const currentBuffer = backgroundAudio.buffer; // Guarda el buffer actual
        backgroundAudio = audioContext.createBufferSource(); // Crea una nueva instancia
        backgroundAudio.buffer = currentBuffer; // Asigna el buffer guardado
        backgroundAudio.loop = true;
        backgroundAudio.connect(backgroundGainNode);
        backgroundGainNode.connect(audioContext.destination);


        backgroundAudio.start(0);
        backgroundIsPlaying = true;
        playMp3Button.disabled = true;
        stopMp3Button.disabled = false;
        console.log("MP3 reproduciendo...");

        // Establecer un temporizador para detener la reproducción si excede el límite
        if (backgroundAudio.buffer.duration > MAX_MP3_DURATION) {
            setTimeout(() => {
                if (backgroundIsPlaying) {
                    stopMp3();
                    alert(`El MP3 se detuvo automáticamente después de ${MAX_MP3_DURATION} segundos.`);
                }
            }, MAX_MP3_DURATION * 1000);
        }
    } else {
        alert('Por favor, carga un archivo MP3 primero.');
    }
});

stopMp3Button.addEventListener('click', stopMp3);

function stopMp3() {
    if (backgroundIsPlaying && backgroundAudio) {
        backgroundAudio.stop();
        backgroundIsPlaying = false;
        playMp3Button.disabled = false;
        stopMp3Button.disabled = true;
        console.log("MP3 detenido.");
        // No es necesario recrear backgroundAudio aquí, se hará al volver a reproducir
        // o al cargar un nuevo archivo.
    }
}

mp3VolumeRange.addEventListener('input', (event) => {
    const volume = parseInt(event.target.value) / 100;
    if (backgroundGainNode) {
        backgroundGainNode.gain.setValueAtTime(volume, audioContext.currentTime);
    }
    mp3VolumeValueSpan.textContent = event.target.value;
});


// --- NUEVA FUNCIONALIDAD: Reproductor de Melodías (Beta) ---

let currentMelodyNotes = [];
let currentMelodyIndex = 0;
let currentNoteDuration = parseInt(noteDurationRange.value);

noteDurationRange.addEventListener('input', (event) => {
    currentNoteDuration = parseInt(event.target.value);
    noteDurationValueSpan.textContent = currentNoteDuration;
});

playMelodyButton.addEventListener('click', () => {
    stopGeneratedSound(); // Detener cualquier sonido generado o secuencia anterior
    const melodyText = melodyInput.value.trim();
    if (melodyText === '') {
        alert('Por favor, ingresa una secuencia de notas (ej: C4, D4, E4).');
        return;
    }

    currentMelodyNotes = melodyText.split(',').map(s => s.trim().toUpperCase()); // Convertir a mayúsculas
    currentMelodyIndex = 0;

    playNextMelodyNote();
});

function playNextMelodyNote() {
    if (currentMelodyIndex >= currentMelodyNotes.length) {
        stopGeneratedSound(); // Melodía terminada
        return;
    }

    const note = currentMelodyNotes[currentMelodyIndex];
    let frequency = 0; // Por defecto, silencio

    if (note.toLowerCase() === 'pausa' || note.toLowerCase() === 'silencio' || note === '_') {
        frequency = 0; // Silencio
    } else if (noteFrequencies[note]) {
        frequency = noteFrequencies[note];
    } else {
        console.warn(`Nota desconocida: ${note}. Ignorando.`);
        frequency = 0; // Tratar como silencio si la nota no se reconoce
    }

    if (frequency > 0) {
        // Usamos un volumen fijo para las melodías, o podrías usar currentVolume
        playSound(frequency, currentVolume); 
    } else {
        stopGeneratedSound(); // Asegura silencio para las pausas o notas no reconocidas
    }

    currentMelodyIndex++;
    melodyTimeoutId = setTimeout(() => {
        stopGeneratedSound(); // Apagar la nota actual antes de la siguiente
        playNextMelodyNote();
    }, currentNoteDuration);
}


// Inicializar estado de botones al cargar
document.addEventListener('DOMContentLoaded', () => {
    updateRecordingButtons();
    playMp3Button.disabled = true;
    stopMp3Button.disabled = true;
    mp3VolumeValueSpan.textContent = mp3VolumeRange.value;
    noteDurationValueSpan.textContent = noteDurationRange.value; // Inicializar valor de duración de nota
});
