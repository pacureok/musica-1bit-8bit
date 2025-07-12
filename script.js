let audioContext;
let oscillator;
let gainNode;
let isPlaying = false; // Para saber si un sonido está activo

let keyOnePressed = false;
let keyZeroPressed = false;

let sequenceTimeoutId = null;

// Variables para la grabación de audio
let mediaRecorder;
let audioChunks = [];
let audioStreamDestination;
let isRecording = false;

// --- NUEVAS VARIABLES PARA REPRODUCCIÓN MP3 ---
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
        backgroundAudio = audioContext.createBufferSource(); // Se usará para cargar el MP3
        backgroundGainNode = audioContext.createGain();
        backgroundGainNode.gain.setValueAtTime(0.5, audioContext.currentTime); // Volumen inicial para MP3

        backgroundAudio.connect(backgroundGainNode);
        backgroundGainNode.connect(audioContext.destination);
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

// Función para detener el sonido generado (1-bit/8-bit)
function stopGeneratedSound() {
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

// Función para detener TODO el sonido (generado y MP3)
function stopAllSound() {
    stopGeneratedSound();
    stopMp3(); // Nueva función para detener MP3
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

stopButton.addEventListener('click', stopAllSound); // Cambiado a stopAllSound


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

        // Regex mejoradas para mayor flexibilidad
        const hzMatch = segment.match(/^(\d+)hz$/i); // "300hz"
        const percentMatch = segment.match(/^(\d+)%$/); // "80%"
        const numberMatch = segment.match(/^(\d+)$/); // "100" (interpretado como Hz por defecto)

        if (segment === '1') {
            targetFrequency = currentMasterFrequency * 1.1;
        } else if (segment === '0') {
            targetFrequency = currentMasterFrequency * 0.9;
        } else if (hzMatch) {
            targetFrequency = parseInt(hzMatch[1]);
        } else if (percentMatch) { // Si solo es porcentaje, se aplica al volumen pero no cambia la frecuencia base
            targetVolume = parseInt(percentMatch[1]);
        } else if (numberMatch) { // Si es solo un número, lo tratamos como frecuencia en Hz
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
            stopGeneratedSound(); // Asegura que no suene nada durante la pausa
        } else {
            playSound(targetFrequency, targetVolume);
        }

        segmentIndex++;
        // Programar el siguiente tono/pausa
        sequenceTimeoutId = setTimeout(() => {
            stopGeneratedSound(); // Apagar el sonido generado antes de pasar al siguiente
            playNextSegment();
        }, delayBetweenTones);
    }

    playNextSegment(); // Iniciar la reproducción de la secuencia
});


// --- Lógica de Grabación de Audio ---

recordButton.addEventListener('click', () => {
    initAudio();
    if (!audioContext) {
        alert("El AudioContext no está inicializado. Intenta interactuar con la página primero.");
        return;
    }

    // Desconectar el gainNode de la salida directa del navegador si ya está conectado
    if (gainNode.numberOfOutputs > 0) {
        gainNode.disconnect();
    }
    
    audioStreamDestination = audioContext.createMediaStreamDestination();
    gainNode.connect(audioStreamDestination);
    gainNode.connect(audioContext.destination); // Conectar también a los altavoces para seguir escuchando

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

        gainNode.disconnect(audioStreamDestination); // Desconectar de la grabadora
        // Asegurarse de que el gainNode esté conectado a la salida principal después de la grabación
        if (!gainNode._isAlreadyConnectedToDestination) { // Una bandera simple para evitar doble conexión
             gainNode.connect(audioContext.destination);
             gainNode._isAlreadyConnectedToDestination = true;
        }
       
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

// --- NUEVA FUNCIONALIDAD: Reproducción de MP3 de Fondo (Estilo Mario Bros) ---

mp3FileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
        alert('Por favor, selecciona un archivo de audio (MP3, WAV, etc.).');
        mp3FileInput.value = ''; // Limpiar el input
        return;
    }

    const reader = new FileReader();
    reader.onload = e => {
        initAudio(); // Asegura que el AudioContext esté listo
        audioContext.decodeAudioData(e.target.result, (buffer) => {
            // Asegúrate de que solo se reproduzca la primera vez
            if (backgroundAudio.buffer) {
                backgroundAudio.stop();
                backgroundAudio.disconnect();
                backgroundAudio = audioContext.createBufferSource();
                backgroundAudio.connect(backgroundGainNode);
                backgroundGainNode.connect(audioContext.destination);
            }
            
            backgroundAudio.buffer = buffer;
            backgroundAudio.loop = true; // Para que se repita como en Mario Bros

            // Limitamos la duración a MAX_MP3_DURATION
            const originalDuration = backgroundAudio.buffer.duration;
            if (originalDuration > MAX_MP3_DURATION) {
                // Si el audio es más largo, lo reproducimos hasta el límite
                // Para esto, no podemos simplemente cortar el buffer, tendríamos que re-codificarlo
                // o usar la propiedad `loopEnd` (si no estamos haciendo loop completo, que aquí sí)
                // O, más simple para un loop limitado: reiniciar si pasa el límite.
                backgroundAudio.onended = () => {
                    if (backgroundIsPlaying) {
                        // Si está loopeando y pasa el límite, lo reiniciamos
                        backgroundAudio = audioContext.createBufferSource(); // Crear una nueva fuente
                        backgroundAudio.buffer = buffer;
                        backgroundAudio.loop = true;
                        backgroundAudio.connect(backgroundGainNode);
                        backgroundGainNode.connect(audioContext.destination);
                        backgroundAudio.start(0);
                        // Programar el fin si excede el límite
                        if (backgroundAudio.buffer.duration > MAX_MP3_DURATION) {
                            setTimeout(() => {
                                if(backgroundIsPlaying) {
                                    backgroundAudio.stop();
                                    backgroundAudio = audioContext.createBufferSource(); // Reset para siguiente reproducción
                                    backgroundAudio.connect(backgroundGainNode);
                                    backgroundGainNode.connect(audioContext.destination);
                                }
                            }, MAX_MP3_DURATION * 1000);
                        }
                    }
                };
                 // Si es loop, el onended no se dispara a menos que lo detengamos.
                 // Entonces, un temporizador es la forma más directa de limitar el loop.
            }

            playMp3Button.disabled = false;
            stopMp3Button.disabled = true; // No se puede detener si no ha empezado
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
        // Detener cualquier reproducción anterior del mismo bufferSource
        if (backgroundIsPlaying) {
            backgroundAudio.stop();
            backgroundAudio.disconnect(); // Desconectar para evitar conexiones duplicadas
            backgroundAudio = audioContext.createBufferSource(); // Crea un nuevo bufferSource para reproducir
            backgroundAudio.buffer = backgroundAudio.buffer; // Reasigna el buffer
            backgroundAudio.connect(backgroundGainNode);
            backgroundGainNode.connect(audioContext.destination);
        }

        backgroundAudio.start(0);
        backgroundIsPlaying = true;
        playMp3Button.disabled = true;
        stopMp3Button.disabled = false;
        console.log("MP3 reproduciendo...");

        // Establecer un temporizador para detener la reproducción si excede el límite
        // Solo si la duración original es mayor al límite
        if (backgroundAudio.buffer.duration > MAX_MP3_DURATION) {
            setTimeout(() => {
                if (backgroundIsPlaying) { // Solo detener si sigue reproduciéndose
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
        // Después de detener, si queremos volver a reproducir, necesitamos un nuevo BufferSource
        if (backgroundAudio.buffer) { // Guarda el buffer original
             const oldBuffer = backgroundAudio.buffer;
             backgroundAudio.disconnect();
             backgroundAudio = audioContext.createBufferSource();
             backgroundAudio.buffer = oldBuffer; // Reasigna el buffer
             backgroundAudio.connect(backgroundGainNode);
             backgroundGainNode.connect(audioContext.destination);
        }
    }
}

mp3VolumeRange.addEventListener('input', (event) => {
    const volume = parseInt(event.target.value) / 100; // Convertir de % a 0-1
    if (backgroundGainNode) {
        backgroundGainNode.gain.setValueAtTime(volume, audioContext.currentTime);
    }
    mp3VolumeValueSpan.textContent = event.target.value;
});

// Inicializar estado de botones MP3 al cargar
document.addEventListener('DOMContentLoaded', () => {
    updateRecordingButtons(); // Existente
    playMp3Button.disabled = true; // Deshabilitar hasta que se cargue un MP3
    stopMp3Button.disabled = true;
    mp3VolumeValueSpan.textContent = mp3VolumeRange.value; // Establecer el valor inicial
});
