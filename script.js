/* ==========================================================================
   AL-AQSA FURNITURE (الأقصى للأثاث) - DYNAMIC INTERACTIVE SCRIPT
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  // Global variables to store gallery data
  let galleryData = [];
  let currentGalleryIndex = 0;
  let allProducts = [];
  let allVideos = [];
  let currentCategory = 'living';
  let currentMediaType = 'photos';

  // Expose unified category explorer functions globally
  window.selectCategory = (categoryId) => {
    currentCategory = categoryId;
    
    // Update active category tab button
    const catButtons = document.querySelectorAll('.explorer-cat-btn');
    catButtons.forEach(btn => {
      if (btn.getAttribute('data-category') === categoryId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Render filtered gallery (photos)
    const filteredProducts = allProducts.filter(p => p.category === categoryId);
    renderExplorerPhotos(filteredProducts);

    // Render filtered videos
    const filteredVideos = allVideos.filter(v => v.category === categoryId);
    renderExplorerVideos(filteredVideos);
  };

  window.selectMediaType = (mediaType) => {
    currentMediaType = mediaType;

    // Update active media type tab button
    const mediaButtons = document.querySelectorAll('.media-tab-btn');
    mediaButtons.forEach(btn => {
      if (btn.getAttribute('data-media-type') === mediaType) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Toggle active grids
    const photosGrid = document.getElementById('explorerPhotosGrid');
    const videosGrid = document.getElementById('explorerVideosGrid');
    if (!photosGrid || !videosGrid) return;

    if (mediaType === 'photos') {
      photosGrid.classList.add('active');
      videosGrid.classList.remove('active');
    } else {
      photosGrid.classList.remove('active');
      videosGrid.classList.add('active');
    }
  };

  window.selectCategoryAndScroll = (categoryId, mediaType = 'photos', shouldScroll = true) => {
    window.selectCategory(categoryId);
    window.selectMediaType(mediaType);

    if (shouldScroll) {
      const portfolioSec = document.getElementById('portfolio');
      if (portfolioSec) {
        portfolioSec.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  // Initialize data load
  loadWebsiteData();

  // ==========================================
  // Fetch & Dynamic Rendering
  // ==========================================
  async function loadWebsiteData() {
    try {
      const response = await fetch('/api/data');
      const data = await response.json();
      
      allProducts = data.products || [];
      allVideos = data.videos || [];
      
      renderCategories(data.categories);
      
      // Select default category & media type without scrolling
      window.selectCategoryAndScroll('living', 'photos', false);
      
      // Initialize interactive elements after HTML is injected
      initInteractivity();
    } catch (err) {
      console.error('Error loading database data:', err);
      const container = document.getElementById('explorerPhotosGrid');
      if (container) {
        container.innerHTML = 
          '<p style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">عذراً، حدث خطأ أثناء تحميل المعرض من الخادم. يرجى التأكد من تشغيل خادم الويب.</p>';
      }
    }
  }

  // 1. Render Categories Grid
  function renderCategories(categories) {
    const container = document.getElementById('categoriesGrid');
    if (!container) return;
    container.innerHTML = '';
    
    // Icon map corresponding to category IDs
    const iconMap = {
      'living': 'fa-couch',
      'dining': 'fa-utensils',
      'bedroom': 'fa-bed',
      'kids': 'fa-child-reaching',
      'buffet': 'fa-box-archive'
    };
    
    categories.forEach((cat, index) => {
      const icon = iconMap[cat.id] || 'fa-folder';
      // Stagger delays based on index (100ms, 200ms, etc.)
      const delayClass = `delay-${(index % 4 + 1) * 100}`;
      
      const card = document.createElement('div');
      card.className = `category-card reveal active ${delayClass}`;
      card.setAttribute('onclick', `selectCategoryAndScroll('${cat.id}', 'photos', true)`);
      card.innerHTML = `
        <div class="category-img-wrapper">
          <img src="${cat.img}" alt="${cat.title}" class="category-img">
          <div class="category-overlay">
            <i class="fa-solid ${icon} category-icon"></i>
            <h3>${cat.title}</h3>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  }

  // 2. Render Explorer Photos Grid
  function renderExplorerPhotos(products) {
    const container = document.getElementById('explorerPhotosGrid');
    if (!container) return;
    container.innerHTML = '';
    galleryData = []; // Reset global data
    
    if (products.length === 0) {
      container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">لا يوجد صور معروضة حالياً لهذا القسم.</p>';
      return;
    }
    
    products.forEach((prod, index) => {
      const delayClass = `delay-${(index % 4 + 1) * 100}`;
      
      // Store for Lightbox
      galleryData.push({
        src: prod.img,
        ar: prod.title
      });
      
      const item = document.createElement('div');
      item.className = `gallery-item reveal active ${delayClass}`;
      item.setAttribute('data-index', index);
      item.innerHTML = `
        <img src="${prod.img}" alt="${prod.title}">
        <div class="gallery-hover-overlay">
          <i class="fa-solid fa-magnifying-glass-plus gallery-hover-icon"></i>
          <h4 class="gallery-hover-title">${prod.title}</h4>
        </div>
      `;
      container.appendChild(item);
    });
  }

  // 3. Render Explorer Videos Grid
  function renderExplorerVideos(videos) {
    const container = document.getElementById('explorerVideosGrid');
    if (!container) return;
    container.innerHTML = '';
    
    if (videos.length === 0) {
      container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">لا يوجد فيديوهات معروضة حالياً لهذا القسم.</p>';
      return;
    }
    
    videos.forEach((vid, index) => {
      const delayClass = `delay-${(index % 2 + 1) * 100}`;
      
      const card = document.createElement('div');
      card.className = `video-card reveal active ${delayClass}`;
      card.innerHTML = `
        <div class="video-container" data-youtube-id="${vid.youtubeId}">
          <div class="video-thumbnail-placeholder" style="background-image: url('${vid.thumb}');">
            <button class="video-play-btn" aria-label="تشغيل الفيديو">
              <i class="fa-solid fa-play"></i>
            </button>
          </div>
        </div>
        <div class="video-info">
          <h4>${vid.title}</h4>
          <p>${vid.desc}</p>
        </div>
      `;
      container.appendChild(card);
    });
  }

  // ==========================================
  // Core Interactions Initialization
  // ==========================================
  function initInteractivity() {
    
    // --- Sticky Header Scroll ---
    const navbar = document.querySelector('.header-navbar');
    const checkScroll = () => {
      if (window.scrollY > 60) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    };
    window.addEventListener('scroll', checkScroll);
    checkScroll();

    // --- Mobile Hamburger Navigation ---
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.querySelector('.nav-menu');
    const navToggleIcon = navToggle.querySelector('i');
    const navLinks = document.querySelectorAll('.nav-link');

    const toggleMenu = () => {
      navMenu.classList.toggle('open');
      const isOpen = navMenu.classList.contains('open');
      if (isOpen) {
        navToggleIcon.className = 'fa-solid fa-times';
      } else {
        navToggleIcon.className = 'fa-solid fa-bars';
      }
    };
    
    navToggle.replaceWith(navToggle.cloneNode(true)); // Clear old listeners if reload happens
    const activeToggle = document.querySelector('.nav-toggle');
    activeToggle.addEventListener('click', toggleMenu);

    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        if (navMenu.classList.contains('open')) toggleMenu();
      });
    });

    // --- Intersection Observer for Scroll Reveals ---
    const revealElements = document.querySelectorAll('.reveal');
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -40px 0px'
    });
    revealElements.forEach(el => revealObserver.observe(el));

    // --- Lightbox Trigger Events ---
    const galleryItems = document.querySelectorAll('.gallery-item');
    const lightbox = document.getElementById('galleryLightbox');
    const lightboxImg = lightbox.querySelector('.lightbox-img');
    const lightboxClose = lightbox.querySelector('.lightbox-close');
    const lightboxPrev = lightbox.querySelector('.lightbox-prev');
    const lightboxNext = lightbox.querySelector('.lightbox-next');
    const arCaption = lightbox.querySelector('.ar-caption');

    const openLightbox = (index) => {
      currentGalleryIndex = parseInt(index);
      updateLightboxContent();
      lightbox.classList.add('active');
      document.body.style.overflow = 'hidden';
    };

    const closeLightbox = () => {
      lightbox.classList.remove('active');
      document.body.style.overflow = '';
    };

    const updateLightboxContent = () => {
      const data = galleryData[currentGalleryIndex];
      if (data) {
        lightboxImg.setAttribute('src', data.src);
        arCaption.textContent = data.ar;
      }
    };

    const showNextSlide = () => {
      currentGalleryIndex = (currentGalleryIndex + 1) % galleryData.length;
      updateLightboxContent();
    };

    const showPrevSlide = () => {
      currentGalleryIndex = (currentGalleryIndex - 1 + galleryData.length) % galleryData.length;
      updateLightboxContent();
    };

    // Bind clicks to gallery items (via delegation on explorerPhotosGrid)
    const explorerPhotosGrid = document.getElementById('explorerPhotosGrid');
    if (explorerPhotosGrid) {
      explorerPhotosGrid.addEventListener('click', (e) => {
        const item = e.target.closest('.gallery-item');
        if (item) {
          openLightbox(item.getAttribute('data-index'));
        }
      });
    }

    lightboxClose.addEventListener('click', closeLightbox);
    lightboxNext.addEventListener('click', showNextSlide);
    lightboxPrev.addEventListener('click', showPrevSlide);

    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) closeLightbox();
    });

    document.addEventListener('keydown', (e) => {
      if (!lightbox.classList.contains('active')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') showPrevSlide();
      if (e.key === 'ArrowLeft') showNextSlide();
    });

    // Bind clicks to play buttons (via delegation on explorerVideosGrid)
    const explorerVideosGrid = document.getElementById('explorerVideosGrid');
    if (explorerVideosGrid) {
      explorerVideosGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('.video-play-btn');
        if (btn) {
          const card = btn.closest('.video-card');
          const container = card.querySelector('.video-container');
          const placeholder = container.querySelector('.video-thumbnail-placeholder');
          const videoId = container.getAttribute('data-youtube-id');

          if (videoId) {
            const iframe = document.createElement('iframe');
            iframe.setAttribute('src', `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`);
            iframe.setAttribute('title', 'فيديو الأقصى للأثاث');
            iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
            iframe.setAttribute('allowfullscreen', 'true');
            container.appendChild(iframe);
            placeholder.style.display = 'none';
          }
        }
      });
    }

    // --- Explorer Category Tabs click events ---
    const catButtons = document.querySelectorAll('.explorer-cat-btn');
    catButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const catId = btn.getAttribute('data-category');
        window.selectCategory(catId);
      });
    });

    // --- Explorer Media type tabs click events ---
    const mediaButtons = document.querySelectorAll('.media-tab-btn');
    mediaButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-media-type');
        window.selectMediaType(type);
      });
    });

    // --- Header Navbar Actions for portfolio links ---
    const navLinkPortfolio = document.getElementById('nav-link-portfolio');
    if (navLinkPortfolio) {
      navLinkPortfolio.addEventListener('click', (e) => {
        e.preventDefault();
        window.selectCategoryAndScroll(currentCategory, 'photos', true);
      });
    }

    const navLinkVideos = document.getElementById('nav-link-videos');
    if (navLinkVideos) {
      navLinkVideos.addEventListener('click', (e) => {
        e.preventDefault();
        window.selectCategoryAndScroll(currentCategory, 'videos', true);
      });
    }

    // --- Footer Actions for portfolio links ---
    const footerLinkPortfolio = document.getElementById('footer-link-portfolio');
    if (footerLinkPortfolio) {
      footerLinkPortfolio.addEventListener('click', (e) => {
        e.preventDefault();
        window.selectCategoryAndScroll(currentCategory, 'photos', true);
      });
    }

    const footerLinkVideos = document.getElementById('footer-link-videos');
    if (footerLinkVideos) {
      footerLinkVideos.addEventListener('click', (e) => {
        e.preventDefault();
        window.selectCategoryAndScroll(currentCategory, 'videos', true);
      });
    }

  }

});
