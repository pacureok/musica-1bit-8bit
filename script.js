let audioContext;
let masterGainNode; // Un nodo de ganancia principal para controlar todo el volumen general

let keyOnePressed = false;
let keyZeroPressed = false;

let sequenceTimeoutId = null;
let melodyTimeoutId = null;

// Variables para la grabación de audio (general y melodías)
let mediaRecorder;
let audioChunks = [];
let audioStreamDestination; // Para conectar el audio a la grabadora
let isRecording = false; // Bandera general de grabación

// Variables para la grabación de audio de 32 bits
let mediaRecorder32Bit;
let audioChunks32Bit = [];
let isRecording32Bit = false; // Bandera específica para la grabación de 32 bits
let record32BitTimeoutId = null; // Para detener la grabación de 32 bits automáticamente

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
const recordMelodyButton = document.getElementById('recordMelodyButton');
const stopRecordMelodyButton = document.getElementById('stopRecordMelodyButton');
const downloadMelodyLink = document.getElementById('downloadMelodyLink');

// --- Elementos del DOM para Notas Personalizadas ---
const customNotesText = document.getElementById('customNotesText');

// --- Elementos del DOM para 32-bit ---
const waveTypeSelect = document.getElementById('waveType');
const chordNotesInput = document.getElementById('chordNotes');
const chordDurationRange = document.getElementById('chordDuration');
const chordDurationValueSpan = document.getElementById('chordDurationValue');
const delayAmountRange = document.getElementById('delayAmount');
const delayAmountValueSpan = document.getElementById('delayAmountValue');
const play32BitButton = document.getElementById('play32BitButton');
const stop32BitButton = document.getElementById('stop32BitButton');
const record32BitButton = document.getElementById('record32BitButton'); // Nuevo botón de grabar 32-bit
const stopRecord32BitButton = document.getElementById('stopRecord32BitButton'); // Nuevo botón de detener grabación 32-bit
const download32BitLink = document.getElementById('download32BitLink'); // Nuevo enlace de descarga 32-bit

let current32BitOscillators = []; // Para manejar múltiples osciladores en 32-bit
let currentDelayNode = null;
let currentDelayFeedback = 0.5; // Valor por defecto para el feedback del delay
let currentDelayTime = 0.5; // Valor por defecto para el tiempo del delay

// Mapa de frecuencias para notas musicales (A4 = 440 Hz)
const noteFrequencies = {
    'C3': 130.81, 'C#3': 138.59, 'D3': 146.83, 'D#3': 155.56, 'E3': 164.81, 'F3': 174.61, 'F#3': 185.00, 'G3': 196.00, 'G#3': 207.65, 'A3': 220.00, 'A#3': 233.08, 'B3': 246.94,
    'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13, 'E4': 329.63, 'F4': 349.23, 'F#4': 369.99, 'G4': 392.00, 'G#4': 415.30, 'A4': 440.00, 'A#4': 466.16, 'B4': 493.88,
    'C5': 523.25, 'C#5': 554.37, 'D5': 587.33, 'D#5': 622.25, 'E5': 659.25, 'F5': 698.46, 'F#5': 739.99, 'G5': 783.99, 'G#5': 830.61, 'A5': 880.00, 'A#5': 932.33, 'B5': 987.77,
    'C6': 1046.50, 'C#6': 1108.73, 'D6': 1174.66, 'D#6': 1244.51, 'E6': 1318.51, 'F6': 1396.91, 'F#6': 1479.98, 'G6': 1567.98, 'G#6': 1661.22, 'A6': 1760.00, 'A#6': 1864.66, 'B6': 1975.53
};


// Función para inicializar el contexto de audio y los nodos globales
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        masterGainNode = audioContext.createGain(); // Nodo de ganancia maestro
        masterGainNode.gain.setValueAtTime(0.5, audioContext.currentTime); // Volumen inicial global
        masterGainNode.connect(audioContext.destination);

        // Inicializar nodos para el audio de fondo (MP3)
        backgroundGainNode = audioContext.createGain();
        backgroundGainNode.gain.setValueAtTime(0.5, audioContext.currentTime); // Volumen inicial para MP3
        backgroundGainNode.connect(masterGainNode); // Conectar al masterGainNode
    }
}

// --- Sección de Sonidos 1-bit/8-bit y Melodías (comparten un oscilador y gainNode) ---
let current8BitOscillator = null;
let current8BitGainNode = null;

function create8BitSoundNodes() {
    if (current8BitOscillator) {
        current8BitOscillator.stop();
        current8BitOscillator.disconnect();
    }
    if (current8BitGainNode) {
        current8BitGainNode.disconnect();
    }

    current8BitOscillator = audioContext.createOscillator();
    current8BitGainNode = audioContext.createGain();

    current8BitOscillator.connect(current8BitGainNode);
    current8BitGainNode.connect(masterGainNode); // Conectar al masterGainNode
    current8BitOscillator.type = 'square'; // Siempre cuadrada para 8-bit
    current8BitOscillator.start(0);
    current8BitGainNode.gain.setValueAtTime(0, audioContext.currentTime);
}


// Función para reproducir un sonido con una frecuencia y volumen específicos (para 1-bit/8-bit y melodías)
function playSound(frequency, volumePercentage) {
    initAudio();
    if (!current8BitOscillator || !current8BitGainNode) {
        create8BitSoundNodes();
    }

    // Detener cualquier sonido generado anteriormente de forma suave
    if (current8BitGainNode) {
        current8BitGainNode.gain.cancelScheduledValues(audioContext.currentTime);
        current8BitGainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.005);
    }

    const maxBaseFrequency = 2000;
    const targetFrequency = Math.max(20, Math.min(maxBaseFrequency, frequency));

    const maxVolume = 0.5; // Volumen máximo para estos sonidos
    const targetVolume = maxVolume * (volumePercentage / 100);

    current8BitOscillator.frequency.setValueAtTime(targetFrequency, audioContext.currentTime);
    current8BitGainNode.gain.cancelScheduledValues(audioContext.currentTime);
    current8BitGainNode.gain.setValueAtTime(current8BitGainNode.gain.value, audioContext.currentTime);
    current8BitGainNode.gain.linearRampToValueAtTime(targetVolume, audioContext.currentTime + 0.01);
}

// Función para detener el sonido generado (1-bit/8-bit y melodías)
function stopGeneratedSound() {
    if (current8BitGainNode) {
        current8BitGainNode.gain.cancelScheduledValues(audioContext.currentTime);
        current8BitGainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.05);
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

// Función para detener TODO el sonido (generado, MP3 y 32-bit)
function stopAllSound() {
    stopGeneratedSound();
    stopMp3();
    stop32BitSound(); // Detener sonidos de 32-bit
    if (isRecording) { // Asegurarse de detener la grabación si está activa (general)
        mediaRecorder.stop();
    }
    if (isRecording32Bit) { // Asegurarse de detener la grabación si está activa (32-bit)
        mediaRecorder32Bit.stop();
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
    // Ajustar el volumen general del masterGainNode
    if (masterGainNode) {
        masterGainNode.gain.setValueAtTime(currentVolume / 100 * 0.5, audioContext.currentTime);
    }
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
    initAudio(); // Asegurar que el contexto de audio esté activo

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


// --- Lógica de Grabación de Audio General (para 1-bit/8-bit sonidos y melodías) ---

recordButton.addEventListener('click', () => {
    initAudio();
    if (!audioContext) {
        alert("El AudioContext no está inicializado. Intenta interactuar con la página primero.");
        return;
    }
    
    // Conectar el masterGainNode a la grabadora
    audioStreamDestination = audioContext.createMediaStreamDestination();
    masterGainNode.connect(audioStreamDestination);

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

        // Desconectar la grabadora y restaurar la conexión normal del masterGainNode
        masterGainNode.disconnect(audioStreamDestination);
       
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
        // backgroundGainNode ya está conectado a masterGainNode
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
    audioStreamDestination = audioContext.createMediaStreamDestination();
    masterGainNode.connect(audioStreamDestination); // Conectar el masterGainNode a la grabadora

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
        masterGainNode.disconnect(audioStreamDestination);
        
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
    chordDurationValueSpan.textContent = chordDurationRange.value; // Para la nueva sección 32-bit
    delayAmountValueSpan.textContent = delayAmountRange.value; // Para la nueva sección 32-bit
    update32BitRecordingButtons(); // Para la nueva sección de grabación de 32-bit
});


// --- Lógica para el Generador de Sonido 32-bit (Experimental) ---

play32BitButton.addEventListener('click', () => {
    initAudio();
    // No detenemos todo para permitir la grabación de MP3 de fondo, etc.
    // Solo detenemos los sonidos específicos de 32-bit si están activos
    stop32BitSound(); 

    const waveType = waveTypeSelect.value;
    const notesText = chordNotesInput.value.trim();
    const duration = parseInt(chordDurationRange.value);
    const delayPercentage = parseInt(delayAmountRange.value);

    if (notesText === '') {
        alert('Por favor, ingresa al menos una nota para el acorde (ej: C4).');
        return;
    }

    const notes = notesText.split(',').map(note => note.trim().toUpperCase());
    const frequencies = notes.map(note => noteFrequencies[note]).filter(freq => freq !== undefined);

    if (frequencies.length === 0) {
        alert('Ninguna de las notas ingresadas es válida. Por favor, usa notas como C4, E5, etc.');
        return;
    }

    // Crear un GainNode para controlar el volumen de este acorde
    const chordGain = audioContext.createGain();
    chordGain.gain.setValueAtTime(currentVolume / 100 * 0.5, audioContext.currentTime); // Volumen basado en el general

    // Configurar Delay (Eco)
    if (delayPercentage > 0) {
        currentDelayNode = audioContext.createDelay(1.0); // Max delay time
        currentDelayNode.delayTime.setValueAtTime(currentDelayTime, audioContext.currentTime); // default 0.5s

        const delayFeedbackGain = audioContext.createGain();
        delayFeedbackGain.gain.setValueAtTime(currentDelayFeedback * (delayPercentage / 100), audioContext.currentTime);

        chordGain.connect(currentDelayNode); // Conectar la señal al delay
        currentDelayNode.connect(delayFeedbackGain); // Conectar el delay a su feedback
        delayFeedbackGain.connect(currentDelayNode); // Conectar el feedback de vuelta al delay (para eco)

        currentDelayNode.connect(masterGainNode); // Conectar la salida del delay al master
    } else {
        currentDelayNode = null; // No hay delay
    }

    // Crear y conectar los osciladores para cada nota del acorde
    frequencies.forEach(freq => {
        const osc = audioContext.createOscillator();
        osc.type = waveType;
        osc.frequency.setValueAtTime(freq, audioContext.currentTime);
        osc.start(audioContext.currentTime);
        
        osc.connect(chordGain); // Conectar cada oscilador al gain del acorde
        current32BitOscillators.push(osc);
    });

    chordGain.connect(masterGainNode); // Conectar el gain del acorde al master, si no hay delay o para la señal directa

    // Detener los osciladores después de la duración especificada
    current32BitOscillators.forEach(osc => {
        osc.stop(audioContext.currentTime + (duration / 1000));
    });

    // Desconectar los nodos de ganancia después de que el sonido termine (para evitar clics)
    chordGain.gain.setValueAtTime(chordGain.gain.value, audioContext.currentTime);
    chordGain.gain.linearRampToValueAtTime(0, audioContext.currentTime + (duration / 1000) + 0.05); // Fade out

    // Limpiar osciladores y nodos de delay después de la reproducción
    setTimeout(() => {
        if (chordGain) chordGain.disconnect();
        if (currentDelayNode) currentDelayNode.disconnect();
        current32BitOscillators = []; // Limpiar la lista
    }, duration + 100); // Un poco más de tiempo para el fade out

    // Si la grabación de 32-bit está activa, detenerla después de la duración del sonido
    if (isRecording32Bit) {
        if (record32BitTimeoutId) clearTimeout(record32BitTimeoutId);
        record32BitTimeoutId = setTimeout(() => {
            if (mediaRecorder32Bit && mediaRecorder32Bit.state === 'recording') {
                mediaRecorder32Bit.stop();
            }
        }, duration + 200); // Dar un poco más de tiempo para capturar el final y el eco
    }
});


stop32BitButton.addEventListener('click', stop32BitSound);

function stop32BitSound() {
    current32BitOscillators.forEach(osc => {
        try {
            osc.stop(0); // Detener inmediatamente
            osc.disconnect();
        } catch (e) {
            // Ya parado, no hacer nada
        }
    });
    current32BitOscillators = [];

    if (currentDelayNode) {
        currentDelayNode.disconnect();
        currentDelayNode = null;
    }
    if (record32BitTimeoutId) {
        clearTimeout(record32BitTimeoutId);
        record32BitTimeoutId = null;
    }
    // Si la grabación de 32-bit está activa, y se detiene manualmente el sonido, también detener la grabación
    if (isRecording32Bit && mediaRecorder32Bit && mediaRecorder32Bit.state === 'recording') {
        mediaRecorder32Bit.stop();
    }
}

chordDurationRange.addEventListener('input', (event) => {
    chordDurationValueSpan.textContent = event.target.value;
});

delayAmountRange.addEventListener('input', (event) => {
    delayAmountValueSpan.textContent = event.target.value;
    currentDelayFeedback = parseInt(event.target.value) / 100;
});


// --- Lógica de Grabación para 32-bit ---
record32BitButton.addEventListener('click', () => {
    initAudio();
    if (!audioContext) {
        alert("El AudioContext no está inicializado. Intenta interactuar con la página primero.");
        return;
    }
    
    // Conectar el masterGainNode a la grabadora de 32-bit
    audioStreamDestination = audioContext.createMediaStreamDestination();
    masterGainNode.connect(audioStreamDestination); // La grabadora captura todo el sonido saliente

    mediaRecorder32Bit = new MediaRecorder(audioStreamDestination.stream);
    audioChunks32Bit = [];

    mediaRecorder32Bit.ondataavailable = event => {
        audioChunks32Bit.push(event.data);
    };

    mediaRecorder32Bit.onstop = () => {
        const audioBlob = new Blob(audioChunks32Bit, { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);

        download32BitLink.href = audioUrl;
        download32BitLink.download = `sonido_32bit_${new Date().getTime()}.wav`;
        download32BitLink.style.display = 'block';
        download32BitLink.textContent = 'Descargar Sonido 32-bit';

        // Desconectar la grabadora y restaurar la conexión normal del masterGainNode
        masterGainNode.disconnect(audioStreamDestination);
       
        isRecording32Bit = false;
        update32BitRecordingButtons();
        console.log("Grabación 32-bit detenida.");
    };

    mediaRecorder32Bit.start();
    isRecording32Bit = true;
    update32BitRecordingButtons();
    download32BitLink.style.display = 'none';
    download32BitLink.removeAttribute('href');
    download32BitLink.removeAttribute('download');
    download32BitLink.textContent = '';
    console.log("Grabación 32-bit iniciada...");
});

stopRecord32BitButton.addEventListener('click', () => {
    if (mediaRecorder32Bit && mediaRecorder32Bit.state === 'recording') {
        mediaRecorder32Bit.stop();
        console.log("Grabación 32-bit detenida por el usuario.");
    }
});

function update32BitRecordingButtons() {
    record32BitButton.disabled = isRecording32Bit;
    play32BitButton.disabled = isRecording32Bit; // Deshabilita play mientras grabas
    stopRecord32BitButton.disabled = !isRecording32Bit;
}
