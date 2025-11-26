(async () => {
  const GATE_BACKEND_URL = window.ADMIN_BACKEND_URL || 'https://arena-be.onrender.com';
  const AUTH_KEY = 'adminAuth';
  const AUTH_TTL_MS = 3600 * 1000;

  function showPage() {
    // Remove the hide style and reveal the page
    const hide = document.getElementById('auth-hide');
    if (hide) hide.remove();
    document.body.style.visibility = 'visible';
  }

  function stayHiddenAndExit() {
    // Keep hidden and leave (blank page)
    document.body.innerHTML = '';
    window.location.replace('about:blank');
  }

  async function verify(password) {
    const res = await fetch(`${GATE_BACKEND_URL}/check-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    return !!data?.valid;
  }

  // Check cache first
  try {
    const cached = localStorage.getItem(AUTH_KEY);
    if (cached) {
      const { timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < AUTH_TTL_MS) {
        showPage();
        // Only after showing, load your main script
        const s = document.createElement('script');
        s.src = '../scripts.js';
        document.body.appendChild(s);
        return;
      }
    }
  } catch { /* ignore */ }

  // Prompt loop (page stays hidden)
  while (true) {
    const password = prompt('הכנס סיסמה לצפייה בדף זה:');
    if (!password) {
      // Cancel or empty -> exit without revealing anything
      stayHiddenAndExit();
      return;
    }
    try {
      const ok = await verify(password);
      if (ok) {
        localStorage.setItem(AUTH_KEY, JSON.stringify({ password, timestamp: Date.now() }));
        showPage();
        const s = document.createElement('script');
        s.src = '../scripts.js';
        document.body.appendChild(s);
        return;
      } else {
        alert('סיסמה שגויה, נסה שוב.');
        // Loop again, still hidden
      }
    } catch {
      alert('שגיאה בבדיקת הסיסמה. נסה שוב.');
      // Loop again, still hidden
    }
  }
})();
