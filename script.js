let audioContext;
let oscillator;
let gainNode;
let isPlaying = false; // Para saber si un sonido está activo

// Función para inicializar el contexto de audio y los nodos
function initAudio() {
    // Si ya existe un contexto de audio, lo usamos
    if (audioContext) {
        return;
    }

    // Crea un nuevo AudioContext (puede variar entre navegadores)
    audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // Crea un nodo oscilador (generador de ondas de sonido)
    oscillator = audioContext.createOscillator();
    // Crea un nodo de ganancia (volumen)
    gainNode = audioContext.createGain();

    // Conecta los nodos: oscilador -> ganancia -> destino (tus altavoces)
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Configura el tipo de onda a 'square' para un sonido tipo arcade/8-bit
    oscillator.type = 'square';

    // Inicia el oscilador. No hará sonido hasta que le demos una frecuencia y ganancia.
    oscillator.start(0); // El 0 significa que comienza inmediatamente
    // Inicialmente, el volumen estará en 0 para que no suene al cargar
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
}

// Función para reproducir un sonido con una frecuencia y volumen específicos
function playSound(frequency, volumePercentage) {
    initAudio(); // Asegura que el contexto de audio esté inicializado

    // Detiene cualquier sonido anterior si está reproduciéndose
    if (isPlaying && gainNode) {
        gainNode.gain.cancelScheduledValues(audioContext.currentTime);
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        isPlaying = false;
    }

    // Calcula la frecuencia real basada en el porcentaje del deslizador
    // La frecuencia máxima es arbitraria, puedes ajustarla
    const maxBaseFrequency = 2000; // Frecuencia máxima base en Hz
    const calculatedFrequency = maxBaseFrequency * (frequency / 100);

    // Calcula el volumen real (0 a 1)
    const maxVolume = 0.5; // Un volumen máximo de 0.5 para evitar saturación
    const calculatedVolume = maxVolume * (volumePercentage / 100);

    // Establece la frecuencia del oscilador
    oscillator.frequency.setValueAtTime(calculatedFrequency, audioContext.currentTime);

    // Establece el volumen del nodo de ganancia con un ataque suave para evitar clics
    gainNode.gain.cancelScheduledValues(audioContext.currentTime); // Limpia cualquier cambio de volumen programado
    gainNode.gain.setValueAtTime(gainNode.gain.value, audioContext.currentTime); // Establece el valor actual como punto de partida
    gainNode.gain.linearRampToValueAtTime(calculatedVolume, audioContext.currentTime + 0.01); // Sube el volumen muy rápido
    isPlaying = true;
}

// Función para detener el sonido suavemente
function stopSound() {
    if (isPlaying && gainNode) {
        gainNode.gain.cancelScheduledValues(audioContext.currentTime); // Limpia cualquier cambio de volumen programado
        gainNode.gain.setValueAtTime(gainNode.gain.value, audioContext.currentTime); // Establece el valor actual como punto de partida
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.05); // Baja el volumen suavemente en 0.05 segundos
        isPlaying = false;
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
    // Ligeramente más alta que la frecuencia base
    const frequencyForOne = currentMasterFrequency * 1.1; // 10% más alto
    playSound(frequencyForOne, currentVolume);
});
buttonOne.addEventListener('mouseup', stopSound); // Detener al soltar
buttonOne.addEventListener('mouseleave', stopSound); // Detener si el ratón sale del botón mientras está pulsado

// Eventos para el botón '0' (mantener pulsado)
buttonZero.addEventListener('mousedown', () => {
    // Ligeramente más baja que la frecuencia base
    const frequencyForZero = currentMasterFrequency * 0.9; // 10% más bajo
    playSound(frequencyForZero, currentVolume);
});
buttonZero.addEventListener('mouseup', stopSound); // Detener al soltar
buttonZero.addEventListener('mouseleave', stopSound); // Detener si el ratón sale del botón mientras está pulsado

// Evento para el botón de detener
stopButton.addEventListener('click', stopSound);

// Inicializar el contexto de audio cuando el usuario interactúa por primera vez
// Esto es importante porque los navegadores requieren interacción del usuario para iniciar el AudioContext
document.addEventListener('DOMContentLoaded', () => {
    // Puedes llamar a initAudio() aquí, o esperar al primer click
    // Para este caso, esperar al primer click es mejor para compatibilidad.
});
