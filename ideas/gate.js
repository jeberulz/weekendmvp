(function () {
    const STORAGE_KEY = 'ideas_email';
    const NEWSLETTER_PLACEHOLDER = '__newsletter__';

    function resolveEls() {
        return {
            gate: document.getElementById('email-gate'),
            content: document.getElementById('idea-content') || document.getElementById('ideas-content')
        };
    }

    function showContent({ gate, content }) {
        if (gate) gate.classList.add('hidden');
        if (content) content.classList.remove('hidden');
    }

    function showGate({ gate, content }) {
        if (gate) gate.classList.remove('hidden');
        if (content) content.classList.add('hidden');
    }

    function isValidEmail(email) {
        return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function stripParam(paramName) {
        try {
            const url = new URL(window.location.href);
            if (!url.searchParams.has(paramName)) return;
            url.searchParams.delete(paramName);
            const newSearch = url.searchParams.toString();
            const newUrl = url.pathname + (newSearch ? '?' + newSearch : '') + url.hash;
            window.history.replaceState({}, '', newUrl);
        } catch (_) { /* ignore */ }
    }

    async function verifyEmailWithBeehiiv(email) {
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isLocalhost) return true;
        try {
            const res = await fetch('/api/ideas-verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            if (!res.ok) return false;
            const data = await res.json();
            return data && data.ok === true;
        } catch (_) {
            return false;
        }
    }

    async function resolveAccess() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) return true;

        const params = new URLSearchParams(window.location.search);
        const emailParam = params.get('e');
        const isBeehiivClick = params.get('utm_source') === 'beehiiv';

        if (emailParam && isValidEmail(emailParam)) {
            const ok = await verifyEmailWithBeehiiv(emailParam);
            stripParam('e');
            if (ok) {
                localStorage.setItem(STORAGE_KEY, emailParam);
                return true;
            }
        }

        if (isBeehiivClick) {
            localStorage.setItem(STORAGE_KEY, NEWSLETTER_PLACEHOLDER);
            return true;
        }

        return false;
    }

    async function handleFormSubmit(form, els) {
        const emailInput = form.querySelector('#gate-email') || form.querySelector('.gate-email');
        const firstNameInput = form.querySelector('#gate-first-name') || form.querySelector('.gate-first-name');
        const submitBtn = form.querySelector('#gate-submit-btn') || form.querySelector('.gate-submit-btn') || form.querySelector('button[type="submit"]');
        if (!emailInput || !submitBtn) return;

        const email = emailInput.value;
        const firstName = firstNameInput ? firstNameInput.value : '';
        const originalBtnHTML = submitBtn.innerHTML;

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<iconify-icon icon="lucide:loader-2" width="16" class="animate-spin"></iconify-icon> <span>Unlocking...</span>';

        try {
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            if (!isLocalhost) {
                const response = await fetch('/api/ideas-subscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, first_name: firstName })
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok && !data.success) {
                    throw new Error(data.error || 'Failed to subscribe');
                }
            }

            localStorage.setItem(STORAGE_KEY, email);
            showContent(els);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            initPageInteractions();
        } catch (error) {
            console.error('Subscription error:', error);
            alert('Something went wrong. Please try again.');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHTML;
        }
    }

    function bindForms(els) {
        const single = document.getElementById('ideas-email-form');
        if (single) {
            single.addEventListener('submit', (e) => {
                e.preventDefault();
                handleFormSubmit(single, els);
            });
        }
        document.querySelectorAll('.email-form').forEach((form) => {
            if (form === single) return;
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                handleFormSubmit(form, els);
            });
        });
    }

    function initSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;

        const backdrop = document.getElementById('mobile-menu-backdrop');
        const openBtn = document.getElementById('mobile-menu-open');
        const closeBtn = document.getElementById('mobile-menu-close');

        const toggleMenu = (show) => {
            if (show) {
                sidebar.classList.remove('-translate-x-full');
                backdrop && backdrop.classList.remove('opacity-0', 'pointer-events-none');
                document.body.style.overflow = 'hidden';
            } else {
                sidebar.classList.add('-translate-x-full');
                backdrop && backdrop.classList.add('opacity-0', 'pointer-events-none');
                document.body.style.overflow = '';
            }
        };

        openBtn && openBtn.addEventListener('click', () => toggleMenu(true));
        closeBtn && closeBtn.addEventListener('click', () => toggleMenu(false));
        backdrop && backdrop.addEventListener('click', () => toggleMenu(false));

        document.querySelectorAll('.sidebar-link').forEach((link) => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href');
                const target = targetId ? document.querySelector(targetId) : null;
                if (target) {
                    const offset = window.innerWidth < 1024 ? 80 : 24;
                    const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - offset;
                    window.scrollTo({ top: targetPosition, behavior: 'smooth' });
                    document.querySelectorAll('.sidebar-link').forEach((l) => l.classList.remove('active'));
                    link.classList.add('active');
                    if (window.innerWidth < 1024) toggleMenu(false);
                }
            });
        });

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const id = entry.target.getAttribute('id');
                    document.querySelectorAll('.sidebar-link').forEach((link) => {
                        link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
                    });
                }
            });
        }, { root: null, rootMargin: '-20% 0px -70% 0px', threshold: 0 });

        document.querySelectorAll('[id^="section-"]').forEach((section) => observer.observe(section));
    }

    function initMobileMenu() {
        const menu = document.getElementById('mobile-menu');
        if (!menu) return;

        const openBtn = document.getElementById('mobile-menu-open');
        const closeBtn = document.getElementById('mobile-menu-close');
        const backdrop = document.getElementById('mobile-menu-backdrop');

        const toggleMenu = (show) => {
            if (show) {
                menu.classList.remove('translate-x-full');
                backdrop && backdrop.classList.remove('opacity-0', 'pointer-events-none');
                document.body.style.overflow = 'hidden';
            } else {
                menu.classList.add('translate-x-full');
                backdrop && backdrop.classList.add('opacity-0', 'pointer-events-none');
                document.body.style.overflow = '';
            }
        };

        openBtn && openBtn.addEventListener('click', () => toggleMenu(true));
        closeBtn && closeBtn.addEventListener('click', () => toggleMenu(false));
        backdrop && backdrop.addEventListener('click', () => toggleMenu(false));
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !menu.classList.contains('translate-x-full')) toggleMenu(false);
        });
        menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => toggleMenu(false)));
    }

    let interactionsInitialized = false;
    function initPageInteractions() {
        if (interactionsInitialized) return;
        interactionsInitialized = true;
        initSidebar();
        initMobileMenu();
    }

    window.copyPrompt = function (button) {
        const target = button.nextElementSibling && button.nextElementSibling.nextElementSibling
            ? button.nextElementSibling.nextElementSibling
            : button.parentElement.querySelector('p');
        if (!target) return;
        const text = target.textContent.trim();
        navigator.clipboard.writeText(text).then(() => {
            const icon = button.querySelector('iconify-icon');
            if (!icon) return;
            icon.setAttribute('icon', 'lucide:check');
            setTimeout(() => icon.setAttribute('icon', 'lucide:copy'), 2000);
        });
    };

    async function boot() {
        const yearEl = document.getElementById('year');
        if (yearEl) yearEl.textContent = new Date().getFullYear();

        const els = resolveEls();
        bindForms(els);

        const hasAccess = await resolveAccess();
        if (hasAccess) {
            showContent(els);
            initPageInteractions();
        } else {
            showGate(els);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
