// Lightweight typing animation with SEO & no-JS fallback
document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('typing-text');
  if (!el) return;

  const phrases = [
    'Convert YouTube to MP4 in seconds',
    'Download YouTube to MP4 in 1080p',
    'Save videos in 4K quality',
    'Free YouTube to MP4 converter'
  ];

  let phraseIndex = 0;
  let charIndex = phrases[0].length;
  let isDeleting = true;
  let typingSpeed = 50;

  function type() {
    const current = phrases[phraseIndex];
    if (isDeleting) {
      charIndex--;
      el!.textContent = current.substring(0, charIndex);
      typingSpeed = 30;
    } else {
      charIndex++;
      el!.textContent = current.substring(0, charIndex);
      typingSpeed = 60;
    }

    if (!isDeleting && charIndex === current.length) {
      isDeleting = true;
      typingSpeed = 2200; // Hold full phrase
    } else if (isDeleting && charIndex === 0) {
      isDeleting = false;
      phraseIndex = (phraseIndex + 1) % phrases.length;
      typingSpeed = 350; // Pause before new phrase
    }

    setTimeout(type, typingSpeed);
  }

  // Initial delay before first erasure
  setTimeout(type, 2000);
});
