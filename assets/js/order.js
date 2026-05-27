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
          '<p class="text-red-500 text-sm">Error loading outlets. Check Supabase keys.</p>'
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

    loadOutlets()