    // REPLACE THESE WITH YOUR REAL KEYS
   const SUPABASE_URL = 'https://mzkbjfcdagomqirfsjld.supabase.co'
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16a2JqZmNkYWdvbXFpcmZzamxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NTQ0MzcsImV4cCI6MjA5NTQzMDQzN30.H05EbXCSUYADZWlgOU1_rtxcYLFpjpg7W7Iaytc0OS4'

    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    async function loadOutlets() {
      const { data, error } = await supabaseClient
        .from('outlets')
        .select('*')
        .eq('is_active', true)

      if (error || !data || data.length === 0) {
        document.getElementById('outlet-list').innerHTML = 
          '<p class="text-red-500">Error loading outlets. Check Supabase keys.</p>'
        return
      }

      const html = data.map(o => `
        <button onclick="selectOutlet(${o.id})" 
          class="w-full bg-white p-5 rounded-xl shadow-sm border border-orange-100 hover:border-orange-500 hover:shadow-md transition text-left group">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="font-bold text-gray-900 group-hover:text-orange-600 transition">${o.name}</h3>
              <p class="text-sm text-gray-500 mt-1">${o.location || ''}</p>
            </div>
            <span class="text-orange-600 opacity-0 group-hover:opacity-100 transition font-bold">→</span>
          </div>
        </button>
      `).join('')

      document.getElementById('outlet-list').innerHTML = html
    }

    function selectOutlet(id) {
      localStorage.setItem('selected_outlet', id)
      window.location.href = 'menu.html'
    }

    // If already picked an outlet, go straight to menu
    if (localStorage.getItem('selected_outlet')) {
      window.location.href = 'menu.html'
    } else {
      loadOutlets()
    }

       // Navbar scroll effect
    const navbar = document.getElementById('navbar')
    window.addEventListener('scroll', () => {
      if (window.scrollY > 50) {
        navbar.classList.add('bg-white/95', 'backdrop-blur-sm', 'shadow-sm')
      } else {
        navbar.classList.remove('bg-white/95', 'backdrop-blur-sm', 'shadow-sm')
      }
    })

    // Mobile menu toggle
    const mobileBtn = document.getElementById('mobile-menu-btn')
    const mobileMenu = document.getElementById('mobile-menu')
    mobileBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden')
    })

    // Sticky mobile button (show after scrolling past hero)
    const stickyBtn = document.getElementById('sticky-order')
    window.addEventListener('scroll', () => {
      if (window.scrollY > window.innerHeight * 0.8) {
        stickyBtn.classList.add('visible')
      } else {
        stickyBtn.classList.remove('visible')
      }
    })
