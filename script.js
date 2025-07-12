let audioContext;
let oscillator;
let gainNode;
let isPlaying = false; // Para saber si un sonido está activo

// Para controlar si una tecla ya está presionada y evitar repeticiones rápidas
let keyOnePressed = false;
let keyZeroPressed = false;

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

    // Si ya está sonando algo por una tecla o botón, detenlo antes de iniciar uno nuevo
    if (isPlaying && gainNode) {
        // Usa linearRampToValueAtTime para un desvanecimiento suave si ya está sonando
        gainNode.gain.cancelScheduledValues(audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.005); // Muy rápido
        isPlaying = false;
    }

    const maxBaseFrequency = 2000; // Frecuencia máxima base en Hz
    const calculatedFrequency = maxBaseFrequency * (frequency / 100);

    const maxVolume = 0.5; // Un volumen máximo de 0.5 para evitar saturación
    const calculatedVolume = maxVolume * (volumePercentage / 100);

    oscillator.frequency.setValueAtTime(calculatedFrequency, audioContext.currentTime);

    gainNode.gain.cancelScheduledValues(audioContext.currentTime);
    gainNode.gain.setValueAtTime(gainNode.gain.value, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(calculatedVolume, audioContext.currentTime + 0.01);
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
    // Asegurarse de que el contexto de audio esté listo al interactuar con el teclado
    initAudio();

    if (event.key === '1' && !keyOnePressed) {
        const frequencyForOne = currentMasterFrequency * 1.1;
        playSound(frequencyForOne, currentVolume);
        keyOnePressed = true; // Marca que la tecla '1' está presionada
        buttonOne.classList.add('active'); // Opcional: añade una clase para indicar visualmente que está activo
    } else if (event.key === '0' && !keyZeroPressed) {
        const frequencyForZero = currentMasterFrequency * 0.9;
        playSound(frequencyForZero, currentVolume);
        keyZeroPressed = true; // Marca que la tecla '0' está presionada
        buttonZero.classList.add('active'); // Opcional: añade una clase para indicar visualmente que está activo
    }
});

document.addEventListener('keyup', (event) => {
    if (event.key === '1') {
        stopSound();
        keyOnePressed = false; // Restablece el estado de la tecla '1'
        buttonOne.classList.remove('active'); // Opcional: quita la clase de activo
    } else if (event.key === '0') {
        stopSound();
        keyZeroPressed = false; // Restablece el estado de la tecla '0'
        buttonZero.classList.remove('active'); // Opcional: quita la clase de activo
    }
});

// Opcional: añadir un poco de CSS para el estado 'active' de los botones
// En style.css podrías añadir:
/*
button.active {
    transform: translateY(0);
    box-shadow: 0 2px 5px rgba(0, 255, 255, 0.4);
    background-color: #00aaaa; // O un color que indique que está "presionado"
}
*/
