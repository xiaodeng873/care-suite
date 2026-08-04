function initTheme() {
  const root = document.documentElement;
  const isDark = () => root.classList.contains('dark');

  function updateIcons() {
    document.querySelectorAll('.icon-btn').forEach(btn => {
      const sun = btn.querySelector('.sun-icon');
      const moon = btn.querySelector('.moon-icon');
      if (sun && moon) {
        sun.style.display = isDark() ? 'none' : 'inline';
        moon.style.display = isDark() ? 'inline' : 'none';
      }
    });
  }

  function toggleTheme() {
    const dark = isDark();
    if (dark) {
      root.classList.remove('dark');
      root.classList.add('light');
      localStorage.setItem('cs-theme', 'light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
      localStorage.setItem('cs-theme', 'dark');
    }
    updateIcons();
  }

  document.querySelectorAll('#theme-toggle, #theme-toggle-mobile').forEach(btn => {
    btn.addEventListener('click', toggleTheme);
  });

  updateIcons();
}

function initMobileMenu() {
  const toggles = document.querySelectorAll('.navbar-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  const mobileLinks = mobileMenu ? mobileMenu.querySelectorAll('a') : [];

  function openMenu() {
    if (!mobileMenu) return;
    mobileMenu.classList.add('open');
    document.body.style.overflow = 'hidden';
    toggles.forEach(t => t.setAttribute('aria-expanded', 'true'));
  }

  function closeMenu() {
    if (!mobileMenu) return;
    mobileMenu.classList.remove('open');
    document.body.style.overflow = '';
    toggles.forEach(t => t.setAttribute('aria-expanded', 'false'));
  }

  toggles.forEach(toggle => {
    toggle.addEventListener('click', () => {
      if (mobileMenu && mobileMenu.classList.contains('open')) {
        closeMenu();
      } else {
        openMenu();
      }
    });
  });

  mobileLinks.forEach(link => {
    link.addEventListener('click', closeMenu);
  });
}

function initFaq() {
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    if (!question) return;
    question.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      faqItems.forEach(other => {
        if (other !== item) other.classList.remove('open');
      });
      item.classList.toggle('open', !isOpen);
    });
  });
}

function initActiveNav() {
  const currentPath = window.location.pathname.replace(/\/$/, '') || '/';

  // Main nav: mark /features active for all /features/* pages
  document.querySelectorAll('.navbar-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPath || (currentPath !== '/' && href !== '/' && currentPath.startsWith(href))) {
      link.classList.add('active');
    }
  });

  // Feature sub-nav
  document.querySelectorAll('.feature-nav-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPath) {
      link.classList.add('active');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initMobileMenu();
  initFaq();
  initActiveNav();
});
