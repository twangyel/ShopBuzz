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

    // ===== REVIEWS SYSTEM =====
const reviewsGrid = document.getElementById('reviews-grid');
const reviewModal = document.getElementById('review-modal');
const openReviewBtn = document.getElementById('open-review-modal');
const closeReviewBtn = document.getElementById('close-review-modal');
const reviewOverlay = document.getElementById('review-modal-overlay');
const reviewForm = document.getElementById('review-form');
const starBtns = document.querySelectorAll('.star-btn');
const ratingInput = document.getElementById('review-rating');

let currentRating = 5;

// Star rating interaction
starBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    currentRating = parseInt(btn.dataset.value);
    ratingInput.value = currentRating;
    updateStars();
  });
});

function updateStars() {
  starBtns.forEach(btn => {
    const val = parseInt(btn.dataset.value);
    btn.style.color = val <= currentRating ? '#f97316' : '#e0d4bc'; // orange-500 vs cream-400
  });
}
updateStars();

// Modal controls
function openModal() {
  reviewModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  document.getElementById('review-name').focus();
}
function closeModal() {
  reviewModal.classList.add('hidden');
  document.body.style.overflow = '';
  reviewForm.reset();
  currentRating = 5;
  ratingInput.value = 5;
  updateStars();
  document.getElementById('review-error').classList.add('hidden');
}

openReviewBtn.addEventListener('click', openModal);
closeReviewBtn.addEventListener('click', closeModal);
reviewOverlay.addEventListener('click', closeModal);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !reviewModal.classList.contains('hidden')) closeModal();
});

// Fetch reviews from Supabase
async function loadReviews() {
  try {
    const { data: reviews, error } = await supabaseClient
      .from('reviews')
      .select('*')
      .eq('approved', true)
      .order('created_at', { ascending: false })
      .limit(9);

    if (error) throw error;

    if (!reviews || reviews.length === 0) {
      reviewsGrid.innerHTML = `
        <div class="col-span-full text-center py-12">
          <p class="text-cream-500 text-lg mb-2">No reviews yet</p>
          <p class="text-cream-400 text-sm">Be the first to share your experience!</p>
        </div>`;
      return;
    }

  reviewsGrid.innerHTML = reviews.map(r => `
  <div class="bg-white rounded-2xl p-6 shadow-sm border border-cream-200 hover:shadow-md transition">
    <div class="flex items-center gap-3 mb-3">
      <div class="w-10 h-10 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-semibold text-sm">
        ${r.name ? r.name.charAt(0).toUpperCase() : 'G'}
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <p class="font-semibold text-espresso-900 text-sm truncate">${escapeHtml(r.name || 'Guest')}</p>
          ${r.verified_purchase ? `
            <span class="inline-flex items-center gap-1 bg-green-50 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-green-200">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
              Verified
            </span>
          ` : `
            <span class="inline-flex items-center bg-gray-100 text-gray-500 text-[10px] font-medium px-2 py-0.5 rounded-full">
              Guest
            </span>
          `}
        </div>
        <p class="text-cream-500 text-xs">${formatDate(r.created_at)}</p>
      </div>
    </div>
    <div class="flex gap-0.5 mb-3">
      ${renderStars(r.rating || 5)}
    </div>
    <p class="text-espresso-700 text-sm leading-relaxed">${escapeHtml(r.comment || '')}</p>
    ${r.order_id ? `<p class="text-cream-400 text-[10px] mt-3 font-mono">Order: ${r.order_id.slice(0, 8)}</p>` : ''}
  </div>
`).join('');
          

  } catch (err) {
    console.error('Reviews error:', err);
    reviewsGrid.innerHTML = `
      <div class="col-span-full text-center py-12">
        <p class="text-red-500 text-sm">Unable to load reviews. Please try again later.</p>
      </div>`;
  }
}

// Submit review with verification
reviewForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = document.getElementById('review-submit-btn');
  const spinner = document.getElementById('review-spinner');
  const errorMsg = document.getElementById('review-error');
  
  const name = document.getElementById('review-name').value.trim();
  const comment = document.getElementById('review-comment').value.trim();
  const rating = parseInt(ratingInput.value);
  const orderIdInput = document.getElementById('review-order-id').value.trim().toLowerCase();

  if (!name || !comment) {
    errorMsg.textContent = 'Please fill in all fields.';
    errorMsg.classList.remove('hidden');
    return;
  }

  submitBtn.disabled = true;
  spinner.classList.remove('hidden');
  errorMsg.classList.add('hidden');

  let verifiedPurchase = false;
  let isGuest = true;
  let linkedOrderId = null;

  // If order ID provided, verify it exists and name matches
  if (orderIdInput) {
    try {
      const { data: order, error: orderError } = await supabaseClient
        .from('orders')
        .select('id, customer_name')
        .eq('id', orderIdInput)
        .single();

      if (!orderError && order) {
        // Fuzzy name match: case-insensitive, allow minor variations
        const reviewName = name.toLowerCase().replace(/\s+/g, ' ').trim();
        const orderName = (order.customer_name || '').toLowerCase().replace(/\s+/g, ' ').trim();
        
        // Check if names are similar (exact match or one contains the other)
        if (reviewName === orderName || 
            reviewName.includes(orderName) || 
            orderName.includes(reviewName)) {
          verifiedPurchase = true;
          isGuest = false;
          linkedOrderId = order.id;
        }
      }
    } catch (err) {
      console.log('Order verification failed:', err);
      // Continue as guest if verification fails
    }
  }

  try {
    const { error } = await supabaseClient
      .from('reviews')
      .insert([{ 
        name, 
        comment, 
        rating, 
        approved: false,
        order_id: linkedOrderId,
        verified_purchase: verifiedPurchase,
        is_guest: isGuest
      }]);

    if (error) throw error;

    closeModal();
    
    // Show appropriate success message
    const badgeText = verifiedPurchase ? 'verified customer' : 'guest';
    reviewsGrid.innerHTML = `
      <div class="col-span-full text-center py-12">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-3">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
        </div>
        <p class="text-espresso-800 font-medium">Thank you!</p>
        <p class="text-cream-500 text-sm mt-1">Your review has been submitted as a <strong>${badgeText}</strong> for approval.</p>
        ${verifiedPurchase ? '<p class="text-green-600 text-xs mt-1">✓ Purchase verified</p>' : ''}
      </div>`;
    
    setTimeout(loadReviews, 2000);

  } catch (err) {
    console.error('Submit error:', err);
    errorMsg.textContent = 'Failed to submit review. Please try again.';
    errorMsg.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    spinner.classList.add('hidden');
  }
});

// Helpers
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderStars(rating) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += `<span class="text-lg ${i <= rating ? 'text-orange-500' : 'text-cream-300'}">★</span>`;
  }
  return html;
}

function formatDate(iso) {
  if (!iso) return 'Recently';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Load reviews on page load
document.addEventListener('DOMContentLoaded', loadReviews);