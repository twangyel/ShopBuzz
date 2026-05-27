const SUPABASE_URL = 'https://mzkbjfcdagomqirfsjld.supabase.co'
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16a2JqZmNkYWdvbXFpcmZzamxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NTQ0MzcsImV4cCI6MjA5NTQzMDQzN30.H05EbXCSUYADZWlgOU1_rtxcYLFpjpg7W7Iaytc0OS4'
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    // ===== LOADING SCREEN =====
    window.addEventListener('load', () => {
      setTimeout(() => {
        document.getElementById('loader').classList.add('hidden');
      }, 1200);
    });

    // ===== MOBILE MENU (FIXED) =====
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const iconOpen = document.getElementById('menu-icon-open');
    const iconClose = document.getElementById('menu-icon-close');
    let menuOpen = false;

    function toggleMenu() {
      menuOpen = !menuOpen;
      mobileMenu.classList.toggle('open', menuOpen);
      iconOpen.classList.toggle('hidden', menuOpen);
      iconClose.classList.toggle('hidden', !menuOpen);
      mobileBtn.setAttribute('aria-expanded', menuOpen);
      document.body.style.overflow = menuOpen ? 'hidden' : '';
    }

    mobileBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      toggleMenu();
    });

    // Close menu when clicking a link
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        if (menuOpen) toggleMenu();
      });
    });

    // Close menu when clicking outside
    document.addEventListener('click', function(e) {
      if (menuOpen && !mobileMenu.contains(e.target) && !mobileBtn.contains(e.target)) {
        toggleMenu();
      }
    });

    // Close menu on escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && menuOpen) toggleMenu();
    });

    // ===== STICKY MOBILE BUTTON =====
    const stickyBtn = document.getElementById('sticky-order');
    window.addEventListener('scroll', () => {
      if (window.scrollY > window.innerHeight * 0.8) {
        stickyBtn.classList.add('visible');
      } else {
        stickyBtn.classList.remove('visible');
      }
    });

    // ===== PWA SERVICE WORKER =====
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(reg => console.log('✅ SW registered:', reg.scope))
          .catch(err => console.log('❌ SW failed:', err));
      });
    }