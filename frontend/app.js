const canvas = document.getElementById('drawing-canvas');
const ctx = canvas.getContext('2d');
const responseOverlay = document.getElementById('response-overlay');
const statusIndicator = document.getElementById('status-indicator');

let isDrawing = false;
let lastX = 0;
let lastY = 0;
let idleTimer = null;
const IDLE_TIMEOUT_MS = 1500;

// Resize canvas to fill window
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    // Set drawing styles
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#2b1f1a'; // Dark sepia/ink
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function startDrawing(e) {
    if (e.type.includes('mouse') && e.button !== 0) return;
    
    isDrawing = true;
    const { x, y } = getCoordinates(e);
    lastX = x;
    lastY = y;
    
    // Clear any previous ink animations or overlay text when user starts writing again
    canvas.classList.remove('sink-ink');
    responseOverlay.innerHTML = '';
    
    // If we were waiting for idle, clear it
    if (idleTimer) clearTimeout(idleTimer);
}

function draw(e) {
    if (!isDrawing) return;
    e.preventDefault(); // Prevent scrolling on touch
    
    const { x, y } = getCoordinates(e);
    
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    
    lastX = x;
    lastY = y;
    
    // Reset timer on every stroke movement just in case
    if (idleTimer) clearTimeout(idleTimer);
}

function stopDrawing() {
    if (!isDrawing) return;
    isDrawing = false;
    
    // User lifted pen, start 1.5s idle countdown
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(triggerSinkAndSubmit, IDLE_TIMEOUT_MS);
}

function getCoordinates(e) {
    if (e.touches && e.touches.length > 0) {
        return {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY
        };
    }
    return {
        x: e.clientX,
        y: e.clientY
    };
}

// Event Listeners
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);

canvas.addEventListener('touchstart', startDrawing, { passive: false });
canvas.addEventListener('touchmove', draw, { passive: false });
canvas.addEventListener('touchend', stopDrawing);
canvas.addEventListener('touchcancel', stopDrawing);


async function triggerSinkAndSubmit() {
    // 1. Export canvas image BEFORE we start fading it out
    const base64Image = getCanvasWithBackground();
    
    // Check if canvas is actually empty (don't submit if nothing drawn)
    if (isCanvasBlank(canvas)) {
        return; 
    }
    
    // 2. Trigger CSS animation to make ink sink into paper
    canvas.classList.add('sink-ink');
    statusIndicator.innerText = "The ink is sinking...";
    statusIndicator.style.opacity = 1;
    
    // 3. Clear canvas state internally after animation completes, 
    //    so next draw is fresh, but keep the CSS class so it stays invisible until next draw starts
    setTimeout(() => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, 1000); 

    // 4. Send to Ollama Backend
    try {
        await sendToOllama(base64Image);
    } catch (err) {
        console.error("Failed to communicate with the diary:", err);
        statusIndicator.innerText = "The connection to the diary was severed.";
        setTimeout(() => statusIndicator.style.opacity = 0, 3000);
    }
}

// Utility: Vision models often prefer solid backgrounds over transparency
function getCanvasWithBackground() {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Fill white/solid background
    tempCtx.fillStyle = '#ffffff';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // Draw original canvas on top
    tempCtx.drawImage(canvas, 0, 0);
    
    return tempCanvas.toDataURL('image/jpeg', 0.8).split(',')[1]; // Return base64 without prefix
}

function isCanvasBlank(c) {
    const blank = document.createElement('canvas');
    blank.width = c.width;
    blank.height = c.height;
    return c.toDataURL() === blank.toDataURL();
}

async function sendToOllama(base64Image) {
    statusIndicator.innerText = "The diary is responding...";
    
    const prompt = "You are an enigmatic, sentient ink-based diary trapped within parchment. Respond to the user's handwritten thoughts as if writing back to a close confidant. Keep responses relatively brief, poetic, slightly eerie, and deeply captivating. Do not mention that you are an AI model or a computer program.";
    
    const requestBody = {
        model: "llama3.2-vision", // Must match what we run in start.sh
        messages: [
            {
                role: "system",
                content: prompt
            },
            {
                role: "user",
                content: "Read my handwritten message and write back to me.",
                images: [base64Image]
            }
        ],
        stream: true,
        options: {
            temperature: 0.7,
            num_predict: 150
        }
    };

    const ollamaUrl = `http://${window.location.hostname}:11434/api/chat`;
    const response = await fetch(ollamaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    statusIndicator.style.opacity = 0;
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    
    let charDelayIndex = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');
        
        for (const line of lines) {
            const parsed = JSON.parse(line);
            if (parsed.message && parsed.message.content) {
                renderTextChunk(parsed.message.content, charDelayIndex);
                charDelayIndex += parsed.message.content.length;
            }
        }
    }
}

// Renders incoming text as animated bleeding ink characters
function renderTextChunk(text, startIndex) {
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const span = document.createElement('span');
        
        if (char === '\n') {
            responseOverlay.appendChild(document.createElement('br'));
            continue;
        } else if (char === ' ') {
            span.innerHTML = '&nbsp;';
        } else {
            span.innerText = char;
        }

        span.className = 'char';
        // Base delay depending on chunk streaming, plus a little offset so it looks like writing
        span.style.animationDelay = `${(startIndex + i) * 0.05}s`; 
        
        responseOverlay.appendChild(span);
    }
}
