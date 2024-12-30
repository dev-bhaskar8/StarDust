// Track mouse state
let isMouseInPopup = false;

// Track mouse enter/leave
document.addEventListener('mouseenter', function() {
    isMouseInPopup = true;
    startStardust();
});

document.addEventListener('mouseleave', function() {
    isMouseInPopup = false;
    stopStardust();
});

// Create star SVG element
function createStarSVG() {
    const starPath = "M3.5,0L4.5,2.5L7,2.8L5.2,4.7L5.7,7L3.5,5.9L1.3,7L1.8,4.7L0,2.8L2.5,2.5L3.5,0Z";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    
    svg.setAttribute("viewBox", "0 0 7 7");
    svg.setAttribute("fill", "currentColor");
    path.setAttribute("d", starPath);
    
    svg.appendChild(path);
    return svg;
}

// Create falling stardust particle
function createStardustParticle() {
    if (!isMouseInPopup) return;

    const rect = document.body.getBoundingClientRect();
    
    // Start from random position at the top
    const x = Math.random() * rect.width;
    const y = -10; // Start above viewport
    
    const particle = document.createElement('div');
    particle.className = 'stardust-particle';
    particle.appendChild(createStarSVG());
    
    // Random initial rotation
    const rotation = Math.random() * 360;
    particle.style.transform = `rotate(${rotation}deg)`;
    
    particle.style.left = x + 'px';
    particle.style.top = y + 'px';
    
    document.body.appendChild(particle);

    // Remove particle after animation
    setTimeout(() => {
        if (particle && particle.parentNode) {
            particle.remove();
        }
    }, 2000);
}

let stardustInterval;

function startStardust() {
    // Create particles every 200ms
    stardustInterval = setInterval(createStardustParticle, 200);
}

function stopStardust() {
    if (stardustInterval) {
        clearInterval(stardustInterval);
    }
}

// Start stardust if mouse is initially in popup
if (document.hasFocus()) {
    isMouseInPopup = true;
    startStardust();
} 