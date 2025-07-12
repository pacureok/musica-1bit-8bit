let audioContext;
let oscillator;
let gainNode;
let isPlaying = false; // Para saber si un sonido está activo

// Para controlar si una tecla ya está presionada y evitar repeticiones rápidas
let keyOnePressed = false;
let keyZeroPressed = false;

// Variables para controlar la secuencia
let sequenceTimeoutId = null; // Para poder cancelar la secuencia en curso

// Función para inicializar el contexto de audio y los nodos
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        oscillator = audioContext.createOscillator();
        gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.type = 'square';
        oscillator.start(0);
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    }
}

// Función para reproducir un sonido con una frecuencia y volumen específicos
function playSound(frequency, volumePercentage) {
    initAudio(); // Asegura que el contexto de audio esté inicializado

    // Detener cualquier sonido anterior de forma suave para evitar clics
    if (isPlaying && gainNode) {
        gainNode.gain.cancelScheduledValues(audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.005); // Muy rápido
        isPlaying = false;
    }

    const maxBaseFrequency = 2000; // Frecuencia máxima base en Hz
    // Asegura que la frecuencia esté dentro de un rango razonable
    const targetFrequency = Math.max(20, Math.min(maxBaseFrequency, frequency));

    const maxVolume = 0.5; // Un volumen máximo de 0.5 para evitar saturación
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
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.05); // Baja el volumen suavemente
        isPlaying = false;
    }
    // Si hay una secuencia en curso, la cancelamos
    if (sequenceTimeoutId) {
        clearTimeout(sequenceTimeoutId);
        sequenceTimeoutId = null;
    }
}

// --- Event Listeners para la interacción ---

// Obtener referencias a los elementos del DOM
const masterFrequencyRange = document.getElementById('masterFrequencyRange');
const masterFrequencyValueSpan = document.getElementById('masterFrequencyValue');
const volumeRange = document.getElementById('volumeRange');
const volumeValueSpan = document.getElementById('volumeValue');
const buttonOne = document.getElementById('buttonOne');
const buttonZero = document.getElementById('buttonZero');
const stopButton = document.getElementById('stopButton');
const sequenceInput = document.getElementById('sequenceInput'); // Nuevo
const playSequenceButton = document.getElementById('playSequenceButton'); // Nuevo

// Variables para almacenar los valores actuales de los deslizadores
let currentMasterFrequency = parseInt(masterFrequencyRange.value);
let currentVolume = parseInt(volumeRange.value);

// Actualizar valores al mover los deslizadores
masterFrequencyRange.addEventListener('input', (event) => {
    currentMasterFrequency = parseInt(event.target.value);
    masterFrequencyValueSpan.textContent = currentMasterFrequency;
});

volumeRange.addEventListener('input', (event) => {
    currentVolume = parseInt(event.target.value);
    volumeValueSpan.textContent = currentVolume;
});

// Eventos para el botón '1' (mantener pulsado)
buttonOne.addEventListener('mousedown', () => {
    const frequencyForOne = currentMasterFrequency * 1.1;
    playSound(frequencyForOne, currentVolume);
});
buttonOne.addEventListener('mouseup', stopSound);
buttonOne.addEventListener('mouseleave', stopSound);

// Eventos para el botón '0' (mantener pulsado)
buttonZero.addEventListener('mousedown', () => {
    const frequencyForZero = currentMasterFrequency * 0.9;
    playSound(frequencyForZero, currentVolume);
});
buttonZero.addEventListener('mouseup', stopSound);
buttonZero.addEventListener('mouseleave', stopSound);

// Evento para el botón de detener
stopButton.addEventListener('click', stopSound);

// --- NUEVA FUNCIONALIDAD: Eventos de teclado ---

document.addEventListener('keydown', (event) => {
    initAudio(); // Asegurarse de que el contexto de audio esté listo

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

// --- NUEVA FUNCIONALIDAD: Reproducción de Secuencia desde el Input ---

playSequenceButton.addEventListener('click', () => {
    stopSound(); // Detener cualquier sonido o secuencia anterior
    const sequenceText = sequenceInput.value.trim();
    if (sequenceText === '') {
        alert('Por favor, ingresa una secuencia válida (ej: 1,0,300hz,80%).');
        return;
    }

    const segments = sequenceText.split(',').map(s => s.trim());
    let segmentIndex = 0;
    const delayBetweenTones = 200; // milisegundos de pausa entre tonos en secuencia

    function playNextSegment() {
        if (segmentIndex >= segments.length) {
            stopSound(); // Terminó la secuencia
            return;
        }

        const segment = segments[segmentIndex];
        let targetFrequency = currentMasterFrequency * 1.0; // Frecuencia base por defecto
        let targetVolume = currentVolume; // Volumen base por defecto

        // Intentar parsear el segmento
        const hzMatch = segment.match(/(\d+)hz/i); // Coincide con números seguidos de 'hz'
        const percentMatch = segment.match(/(\d+)%/); // Coincide con números seguidos de '%'

        if (hzMatch) {
            // Si el segmento es una frecuencia (ej: "300hz")
            targetFrequency = parseInt(hzMatch[1]);
            // Si no hay volumen explícito, usa el actual del deslizador
            targetVolume = percentMatch ? parseInt(percentMatch[1]) : currentVolume;
        } else if (percentMatch) {
            // Si el segmento es solo un porcentaje de volumen (ej: "80%")
            targetVolume = parseInt(percentMatch[1]);
            // La frecuencia se mantiene como la base actual del deslizador
        } else if (segment === '1') {
            // Si es '1', usa la frecuencia "para 1" y el volumen actual
            targetFrequency = currentMasterFrequency * 1.1;
        } else if (segment === '0') {
            // Si es '0', usa la frecuencia "para 0" y el volumen actual
            targetFrequency = currentMasterFrequency * 0.9;
        } else {
            console.warn(`Segmento desconocido en la secuencia: ${segment}. Ignorando.`);
            // No hacer nada si el segmento no se puede interpretar
            segmentIndex++;
            sequenceTimeoutId = setTimeout(playNextSegment, delayBetweenTones);
            return;
        }

        playSound(targetFrequency, targetVolume);

        segmentIndex++;
        // Programar el siguiente tono después de un pequeño retardo
        sequenceTimeoutId = setTimeout(() => {
            stopSound(); // Apagar el sonido actual antes de pasar al siguiente
            playNextSegment();
        }, delayBetweenTones);
    }

    playNextSegment(); // Iniciar la reproducción de la secuencia
});
