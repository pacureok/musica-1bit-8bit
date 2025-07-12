let audioContext;
let oscillator;
let gainNode;
let isPlaying = false; // Para saber si un sonido generado está activo

let keyOnePressed = false;
let keyZeroPressed = false;

let sequenceTimeoutId = null; // Para la secuencia de 1,0,hz,%
let melodyTimeoutId = null; // Para la secuencia de notas musicales

// Variables para la grabación de audio (general)
let mediaRecorder;
let audioChunks = [];
let audioStreamDestination; // Para conectar el audio a la grabadora
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

// --- Elementos del DOM para Melodías ---
const melodyInput = document.getElementById('melodyInput');
const playMelodyButton = document.getElementById('playMelodyButton');
const recordMelodyButton = document.getElementById('recordMelodyButton'); // Nuevo botón
const stopRecordMelodyButton = document.getElementById('stopRecordMelodyButton'); // Nuevo botón
const downloadMelodyLink = document.getElementById('downloadMelodyLink'); // Nuevo enlace

// --- Elementos del DOM para Notas Personalizadas ---
const customNotesText = document.getElementById('customNotesText'); // Nuevo elemento

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
    if (isRecording) { // Asegurarse de detener la grabación si está activa
        mediaRecorder.stop();
    }
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


// --- Lógica de Grabación de Audio General (para 1-bit/8-bit sonidos) ---

recordButton.addEventListener('click', () => {
    initAudio();
    if (!audioContext) {
        alert("El AudioContext no está inicializado. Intenta interactuar con la página primero.");
        return;
    }
    
    // Desconectar el gainNode del destino principal temporalmente para reconectar a la grabadora
    gainNode.disconnect(audioContext.destination);

    audioStreamDestination = audioContext.createMediaStreamDestination();
    gainNode.connect(audioStreamDestination); // Conectar la salida del sonido a la grabadora
    gainNode.connect(audioContext.destination); // Reconectar al destino principal para seguir escuchando

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

        // Desconectar la grabadora y restaurar la conexión normal del gainNode
        gainNode.disconnect(audioStreamDestination);
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
            if (backgroundIsPlaying && backgroundAudio) {
                backgroundAudio.stop();
                backgroundAudio.disconnect();
            }
            
            backgroundAudio = audioContext.createBufferSource();
            backgroundAudio.buffer = buffer;
            backgroundAudio.loop = true;

            backgroundAudio.connect(backgroundGainNode);

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
        if (backgroundIsPlaying) {
            backgroundAudio.stop();
            backgroundAudio.disconnect();
        }
        
        const currentBuffer = backgroundAudio.buffer;
        backgroundAudio = audioContext.createBufferSource();
        backgroundAudio.buffer = currentBuffer;
        backgroundAudio.loop = true;
        backgroundAudio.connect(backgroundGainNode);
        backgroundGainNode.connect(audioContext.destination);


        backgroundAudio.start(0);
        backgroundIsPlaying = true;
        playMp3Button.disabled = true;
        stopMp3Button.disabled = false;
        console.log("MP3 reproduciendo...");

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
    }
}

mp3VolumeRange.addEventListener('input', (event) => {
    const volume = parseInt(event.target.value) / 100;
    if (backgroundGainNode) {
        backgroundGainNode.gain.setValueAtTime(volume, audioContext.currentTime);
    }
    mp3VolumeValueSpan.textContent = event.target.value;
});


// --- FUNCIONALIDAD: Reproductor de Melodías (Beta) con duración por nota ---

let currentMelodySequence = [];
let currentMelodyNoteIndex = 0;
let isMelodyPlaying = false; // Nueva bandera para el estado de la melodía

playMelodyButton.addEventListener('click', () => {
    stopGeneratedSound(); // Detener cualquier sonido generado o secuencia anterior
    const melodyText = melodyInput.value.trim();
    if (melodyText === '') {
        alert('Por favor, ingresa una secuencia de notas (ej: C4:250, D4:500).');
        return;
    }

    parseMelodySequence(melodyText);
    currentMelodyNoteIndex = 0;
    isMelodyPlaying = true; // La melodía está empezando a sonar
    playNextMelodyNote();
});

function parseMelodySequence(melodyText) {
    currentMelodySequence = melodyText.split(',').map(s => {
        const parts = s.trim().split(':');
        const note = parts[0].toUpperCase();
        let duration = parseInt(parts[1]);

        if (isNaN(duration) || duration <= 0) {
            console.warn(`Duración inválida para ${note}: ${parts[1]}. Usando duración por defecto de 250ms.`);
            duration = 250;
        }
        return { note: note, duration: duration };
    });
}

function playNextMelodyNote() {
    if (!isMelodyPlaying || currentMelodyNoteIndex >= currentMelodySequence.length) {
        stopGeneratedSound(); // Melodía terminada o detenida externamente
        isMelodyPlaying = false; // Asegurar que el estado sea detenido
        if (isRecording) { // Si se estaba grabando la melodía, detener la grabación
            mediaRecorder.stop();
        }
        return;
    }

    const currentItem = currentMelodySequence[currentMelodyNoteIndex];
    const note = currentItem.note;
    const duration = currentItem.duration;

    let frequency = 0; // Por defecto, silencio

    if (note.toLowerCase() === 'pausa' || note.toLowerCase() === 'silencio' || note === '_') {
        frequency = 0; // Silencio
    } else if (noteFrequencies[note]) {
        frequency = noteFrequencies[note];
    } else {
        console.warn(`Nota desconocida: ${note}. Tratando como silencio.`);
        frequency = 0; // Tratar como silencio si la nota no se reconoce
    }

    if (frequency > 0) {
        playSound(frequency, currentVolume);
    } else {
        stopGeneratedSound(); // Asegura silencio para las pausas o notas no reconocidas
    }

    currentMelodyNoteIndex++;
    melodyTimeoutId = setTimeout(() => {
        if (isMelodyPlaying) { // Solo detener y continuar si la melodía sigue activa
            stopGeneratedSound(); // Apagar la nota actual antes de la siguiente
            playNextMelodyNote();
        }
    }, duration);
}

// Lógica de Grabación de Melodías
recordMelodyButton.addEventListener('click', () => {
    initAudio();
    if (!audioContext) {
        alert("El AudioContext no está inicializado. Intenta interactuar con la página primero.");
        return;
    }

    const melodyText = melodyInput.value.trim();
    if (melodyText === '') {
        alert('Por favor, ingresa una secuencia de notas para grabar.');
        return;
    }

    // Preparar MediaRecorder
    gainNode.disconnect(audioContext.destination); // Desconectar temporalmente
    audioStreamDestination = audioContext.createMediaStreamDestination();
    gainNode.connect(audioStreamDestination);
    gainNode.connect(audioContext.destination); // Reconectar para escuchar mientras grabas

    mediaRecorder = new MediaRecorder(audioStreamDestination.stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = event => {
        audioChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);

        downloadMelodyLink.href = audioUrl;
        downloadMelodyLink.download = `melodia_arcade_${new Date().getTime()}.wav`;
        downloadMelodyLink.style.display = 'block';
        downloadMelodyLink.textContent = 'Descargar Melodía';

        // Restaurar conexiones de audio
        gainNode.disconnect(audioStreamDestination);
        gainNode.connect(audioContext.destination);
        
        isRecording = false;
        updateMelodyRecordingButtons();
        console.log("Grabación de melodía detenida.");
    };

    // Iniciar grabación y reproducción de la melodía
    mediaRecorder.start();
    isRecording = true; // Bandera general de grabación activa
    updateMelodyRecordingButtons();
    downloadMelodyLink.style.display = 'none';
    downloadMelodyLink.removeAttribute('href');
    downloadMelodyLink.removeAttribute('download');
    downloadMelodyLink.textContent = '';

    console.log("Grabación de melodía iniciada...");

    // Iniciar la reproducción de la melodía
    parseMelodySequence(melodyText);
    currentMelodyNoteIndex = 0;
    isMelodyPlaying = true;
    playNextMelodyNote();
});

stopRecordMelodyButton.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        // Al detener la grabación, también detén la reproducción de la melodía
        isMelodyPlaying = false; // Esto detendrá el loop de playNextMelodyNote
        mediaRecorder.stop();
    }
});

function updateMelodyRecordingButtons() {
    recordMelodyButton.disabled = isRecording;
    playMelodyButton.disabled = isRecording; // Deshabilitar play mientras grabas
    stopRecordMelodyButton.disabled = !isRecording;
}


// --- Lógica para Notas Personalizadas (Guardar/Cargar en Local Storage) ---

// Cargar notas al iniciar la página
document.addEventListener('DOMContentLoaded', () => {
    const savedNotes = localStorage.getItem('customArcadeNotes');
    if (savedNotes) {
        customNotesText.value = savedNotes;
    }

    // Guardar notas cada vez que el usuario escribe
    customNotesText.addEventListener('input', () => {
        localStorage.setItem('customArcadeNotes', customNotesText.value);
    });

    // Inicializar estado de botones al cargar
    updateRecordingButtons(); // Para la sección general
    updateMelodyRecordingButtons(); // Para la sección de melodías
    playMp3Button.disabled = true;
    stopMp3Button.disabled = true;
    mp3VolumeValueSpan.textContent = mp3VolumeRange.value;
});
