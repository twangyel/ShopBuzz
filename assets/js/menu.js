   const SUPABASE_URL = 'https://mzkbjfcdagomqirfsjld.supabase.co'
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16a2JqZmNkYWdvbXFpcmZzamxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NTQ0MzcsImV4cCI6MjA5NTQzMDQzN30.H05EbXCSUYADZWlgOU1_rtxcYLFpjpg7W7Iaytc0OS4'

    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    const outletId = localStorage.getItem('selected_outlet')

    // If no outlet selected, go home
 if (!outletId) {
  window.location.href = 'order.html'
}
    // Load cart count on page load
    updateCartCount()

    async function loadMenu() {
      // Get outlet name
      const { data: outlet } = await supabaseClient
        .from('outlets')
        .select('name')
        .eq('id', outletId)
        .single()

      if (outlet) {
        document.getElementById('outlet-name').textContent = outlet.name
      }

      // Get categories
      const { data: categories } = await supabaseClient
        .from('categories')
        .select('*')
        .order('sort_order')

      // Get menu items for this outlet
      const { data: items } = await supabaseClient
        .from('menu_items')
        .select('*')
        .eq('outlet_id', outletId)
        .eq('is_available', true)
        .order('name')

      if (!items || items.length === 0) {
        document.getElementById('menu-container').innerHTML = 
          '<div class="text-center py-20"><p class="text-gray-500 text-lg">No items available at this outlet.</p><p class="text-sm text-gray-400 mt-2">Check back later!</p></div>'
        return
      }

      let html = ''

      categories.forEach(cat => {
        const catItems = items.filter(i => i.category_id === cat.id)
        if (catItems.length === 0) return

        html += `
          <section class="mb-10">
            <h2 class="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-orange-100">${cat.name}</h2>
            <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              ${catItems.map(item => `
                <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition flex flex-col">
                  ${item.image_url ? `
                    <div class="h-48 bg-gray-100 relative">
                      <img src="${item.image_url}" alt="${item.name}" class="w-full h-full object-cover" loading="lazy">
                    </div>
                  ` : `
                    <div class="h-48 bg-gray-100 flex items-center justify-center text-gray-300 text-4xl">🍽️</div>
                  `}
                  <div class="p-4 flex-1 flex flex-col">
                    <div class="flex justify-between items-start mb-1">
                      <h3 class="font-bold text-gray-900">${item.name}</h3>
                      <span class="font-bold text-orange-600">$${item.price}</span>
                    </div>
                    <p class="text-gray-500 text-sm mb-4 flex-1">${item.description || ''}</p>
                    <button onclick='addToCart(${JSON.stringify(item)})' 
                      class="w-full bg-gray-900 text-white py-2.5 rounded-lg hover:bg-gray-800 transition text-sm font-medium">
                      Add to Cart
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          </section>
        `
      })

      document.getElementById('menu-container').innerHTML = html
    }

    function addToCart(item) {
      let cart = JSON.parse(localStorage.getItem('cart') || '[]')
      
      const existing = cart.find(i => i.id === item.id)
      if (existing) {
        existing.quantity += 1
      } else {
        cart.push({
          id: item.id,
          name: item.name,
          price: item.price,
          image_url: item.image_url,
          quantity: 1
        })
      }

      localStorage.setItem('cart', JSON.stringify(cart))
      updateCartCount()
      showToast(`${item.name} added`)
    }

    function updateCartCount() {
      const cart = JSON.parse(localStorage.getItem('cart') || '[]')
      const count = cart.reduce((sum, i) => sum + i.quantity, 0)
      const badge = document.getElementById('cart-count')
      
      if (count > 0) {
        badge.textContent = count
        badge.classList.remove('hidden')
      } else {
        badge.classList.add('hidden')
      }
    }

    function showToast(message) {
      const toast = document.getElementById('toast')
      toast.textContent = message
      toast.classList.remove('translate-y-20', 'opacity-0')
      setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0')
      }, 2000)
    }

    loadMenu()