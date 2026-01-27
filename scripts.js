// Cookie Consent Management
const CONSENT_KEY = 'analytics_consent';
const CONSENT_EXPIRY_DAYS = 365;

function getConsent() {
    try {
        const stored = localStorage.getItem(CONSENT_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            // Check if consent has expired (older than 1 year)
            if (parsed.timestamp && Date.now() - parsed.timestamp < CONSENT_EXPIRY_DAYS * 24 * 60 * 60 * 1000) {
                return parsed.value;
            }
        }
    } catch (e) {
        console.error('Error reading consent:', e);
    }
    return null;
}

function setConsent(value) {
    try {
        const consentData = {
            value: value,
            timestamp: Date.now()
        };
        localStorage.setItem(CONSENT_KEY, JSON.stringify(consentData));
        // Also set cookie for server-side access if needed
        document.cookie = `${CONSENT_KEY}=${value}; max-age=${CONSENT_EXPIRY_DAYS * 24 * 60 * 60}; path=/; SameSite=Lax`;
    } catch (e) {
        console.error('Error saving consent:', e);
    }
}

function loadGoogleAnalytics() {
    if (window.analyticsConsent !== true) return;
    
    // Check if already loaded
    if (document.querySelector('script[src*="googletagmanager.com/gtag/js"]')) {
        // Already loaded, just ensure gtag is properly set
        if (typeof window.gtag !== 'function' || window.gtag.toString().includes('analyticsConsent')) {
            window.gtag = function() {
                dataLayer.push(arguments);
            };
        }
        return;
    }
    
    // Load gtag.js script
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=G-Z1NYERTKRS';
    document.head.appendChild(script);
    
    // Initialize gtag after script loads
    script.onload = () => {
        // Restore real gtag function
        window.gtag = function() {
            dataLayer.push(arguments);
        };
        
        gtag('js', new Date());
        gtag('config', 'G-Z1NYERTKRS');
    };
}

function loadMetaPixel() {
    if (window.analyticsConsent !== true) return;
    
    // Check if already initialized
    if (typeof window.fbq === 'function' && window.fbq.loaded) {
        // Process any queued events
        if (window.fbqQueue && window.fbqQueue.length > 0) {
            window.fbqQueue.forEach(args => {
                window.fbq.apply(window, args);
            });
            window.fbqQueue = [];
        }
        return;
    }
    
    // Initialize Meta Pixel if fbq exists
    if (typeof window.fbq === 'function') {
        window.fbq('init', '1602726847528813');
        window.fbq('track', 'PageView');
        
        // Process any queued events
        if (window.fbqQueue && window.fbqQueue.length > 0) {
            window.fbqQueue.forEach(args => {
                window.fbq.apply(window, args);
            });
            window.fbqQueue = [];
        }
    }
}

function initCookieConsent() {
    const banner = document.getElementById('cookie-consent-banner');
    const customizeModal = document.getElementById('cookie-customize-modal');
    const analyticsToggle = document.getElementById('analytics-toggle');
    
    if (!banner) return;
    
    const consent = getConsent();
    
    if (consent === null) {
        // Show banner on first visit
        setTimeout(() => {
            banner.classList.remove('translate-y-full');
        }, 1000);
    } else {
        // Apply stored consent (GA may already be loaded from head script)
        window.analyticsConsent = consent === true;
        if (window.analyticsConsent) {
            // Only load if not already loaded
            loadGoogleAnalytics();
            loadMetaPixel();
        }
    }
    
    // Accept button
    document.getElementById('accept-analytics')?.addEventListener('click', () => {
        window.analyticsConsent = true;
        setConsent(true);
        loadGoogleAnalytics();
        loadMetaPixel();
        banner.classList.add('translate-y-full');
    });
    
    // Reject button
    document.getElementById('reject-analytics')?.addEventListener('click', () => {
        window.analyticsConsent = false;
        setConsent(false);
        banner.classList.add('translate-y-full');
    });
    
    // Customize button
    document.getElementById('customize-analytics')?.addEventListener('click', () => {
        const modalContent = customizeModal.querySelector('.relative');
        customizeModal.classList.remove('opacity-0', 'pointer-events-none');
        if (modalContent) {
            modalContent.classList.remove('scale-95');
            modalContent.classList.add('scale-100');
        }
        
        // Set toggle state based on current consent
        if (analyticsToggle) {
            analyticsToggle.checked = window.analyticsConsent === true;
        }
    });
    
    // Close customize modal
    document.getElementById('close-customize-modal')?.addEventListener('click', () => {
        const modalContent = customizeModal.querySelector('.relative');
        customizeModal.classList.add('opacity-0', 'pointer-events-none');
        if (modalContent) {
            modalContent.classList.remove('scale-100');
            modalContent.classList.add('scale-95');
        }
    });
    
    // Save preferences
    document.getElementById('save-preferences')?.addEventListener('click', () => {
        const analyticsEnabled = analyticsToggle?.checked || false;
        window.analyticsConsent = analyticsEnabled;
        setConsent(analyticsEnabled);
        
        if (analyticsEnabled) {
            loadGoogleAnalytics();
            loadMetaPixel();
        }
        
        const modalContent = customizeModal.querySelector('.relative');
        customizeModal.classList.add('opacity-0', 'pointer-events-none');
        if (modalContent) {
            modalContent.classList.remove('scale-100');
            modalContent.classList.add('scale-95');
        }
        banner.classList.add('translate-y-full');
    });
    
    // Privacy policy links - no special handling needed, they link to privacy-policy.html
}

// Initialize consent on page load
initCookieConsent();

// Mobile Menu
function initMobileMenu() {
    const openBtn = document.getElementById('mobile-menu-open');
    const closeBtn = document.getElementById('mobile-menu-close');
    const menu = document.getElementById('mobile-menu');
    const backdrop = document.getElementById('mobile-menu-backdrop');

    if (!menu) return;

    const toggleMenu = (show) => {
        if (show) {
            menu.classList.remove('translate-x-full');
            backdrop.classList.remove('opacity-0', 'pointer-events-none');
            document.body.style.overflow = 'hidden';
        } else {
            menu.classList.add('translate-x-full');
            backdrop.classList.add('opacity-0', 'pointer-events-none');
            document.body.style.overflow = '';
        }
    };

    openBtn?.addEventListener('click', () => toggleMenu(true));
    closeBtn?.addEventListener('click', () => toggleMenu(false));
    backdrop?.addEventListener('click', () => toggleMenu(false));

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !menu.classList.contains('translate-x-full')) {
            toggleMenu(false);
        }
    });

    // Close when clicking a nav link (but not toggle buttons)
    menu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => toggleMenu(false));
    });

    // Mobile nav collapsible sections
    const mobileToggles = menu.querySelectorAll('.mobile-nav-toggle');
    mobileToggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            const submenu = toggle.nextElementSibling;
            const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
            
            // Close all other submenus
            mobileToggles.forEach(otherToggle => {
                if (otherToggle !== toggle) {
                    otherToggle.setAttribute('aria-expanded', 'false');
                    const otherSubmenu = otherToggle.nextElementSibling;
                    if (otherSubmenu) {
                        otherSubmenu.classList.add('hidden');
                        otherSubmenu.classList.remove('expanded');
                    }
                }
            });
            
            // Toggle current submenu
            toggle.setAttribute('aria-expanded', !isExpanded);
            if (submenu) {
                if (isExpanded) {
                    submenu.classList.add('hidden');
                    submenu.classList.remove('expanded');
                } else {
                    submenu.classList.remove('hidden');
                    submenu.classList.add('expanded');
                }
            }
        });
    });
}

// Initialize mobile menu on page load
initMobileMenu();

// Desktop Navigation Dropdowns
function initNavDropdowns() {
    const dropdowns = document.querySelectorAll('.nav-dropdown');
    let closeTimeout = null;
    
    dropdowns.forEach(dropdown => {
        const trigger = dropdown.querySelector('.nav-dropdown-trigger');
        const menu = dropdown.querySelector('.nav-dropdown-menu');
        
        if (!trigger || !menu) return;
        
        const showDropdown = () => {
            if (closeTimeout) {
                clearTimeout(closeTimeout);
                closeTimeout = null;
            }
            // Close all other dropdowns
            dropdowns.forEach(d => {
                if (d !== dropdown) {
                    d.classList.remove('active');
                    d.querySelector('.nav-dropdown-trigger')?.setAttribute('aria-expanded', 'false');
                }
            });
            dropdown.classList.add('active');
            trigger.setAttribute('aria-expanded', 'true');
        };
        
        const hideDropdown = () => {
            closeTimeout = setTimeout(() => {
                dropdown.classList.remove('active');
                trigger.setAttribute('aria-expanded', 'false');
            }, 100);
        };
        
        // Mouse events
        dropdown.addEventListener('mouseenter', showDropdown);
        dropdown.addEventListener('mouseleave', hideDropdown);
        
        // Keyboard support
        trigger.addEventListener('click', (e) => {
            e.preventDefault();
            if (dropdown.classList.contains('active')) {
                dropdown.classList.remove('active');
                trigger.setAttribute('aria-expanded', 'false');
            } else {
                showDropdown();
            }
        });
        
        trigger.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                showDropdown();
            }
            if (e.key === 'Escape') {
                hideDropdown();
                trigger.focus();
            }
        });
        
        // Keep dropdown open when hovering menu
        menu.addEventListener('mouseenter', () => {
            if (closeTimeout) {
                clearTimeout(closeTimeout);
                closeTimeout = null;
            }
        });
        
        menu.addEventListener('mouseleave', hideDropdown);
    });
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.nav-dropdown')) {
            dropdowns.forEach(d => {
                d.classList.remove('active');
                d.querySelector('.nav-dropdown-trigger')?.setAttribute('aria-expanded', 'false');
            });
        }
    });
    
    // Close dropdowns on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            dropdowns.forEach(d => {
                d.classList.remove('active');
                d.querySelector('.nav-dropdown-trigger')?.setAttribute('aria-expanded', 'false');
            });
        }
    });
}

// Initialize nav dropdowns on page load
initNavDropdowns();

// Analytics Event Helper - Tracks to both Google Analytics and Meta Pixel
function trackEvent(eventName, eventParams = {}) {
    if (window.analyticsConsent !== true) return;
    
    // Google Analytics
    if (typeof gtag !== 'undefined') {
        gtag('event', eventName, eventParams);
    }
    
    // Meta Pixel - Map custom events to Meta Pixel standard events
    if (typeof window.fbq === 'function' && window.fbq.loaded) {
        // Map custom events to Meta Pixel events
        const metaPixelEventMap = {
            'signup_form_submitted': 'Lead',
            'signup_form_success': 'CompleteRegistration',
            'cta_button_clicked': 'ViewContent',
            'modal_opened': 'ViewContent',
            'section_viewed': 'ViewContent'
        };
        
        const metaEventName = metaPixelEventMap[eventName] || 'CustomEvent';
        
        if (metaEventName === 'CustomEvent') {
            // For custom events, send as CustomEvent with event name as parameter
            window.fbq('trackCustom', eventName, eventParams);
        } else {
            // For standard events, send as standard event
            window.fbq('track', metaEventName, eventParams);
        }
    } else if (window.fbqQueue) {
        // Queue events if Meta Pixel isn't loaded yet
        const metaPixelEventMap = {
            'signup_form_submitted': 'Lead',
            'signup_form_success': 'CompleteRegistration',
            'cta_button_clicked': 'ViewContent',
            'modal_opened': 'ViewContent',
            'section_viewed': 'ViewContent'
        };
        
        const metaEventName = metaPixelEventMap[eventName] || 'CustomEvent';
        
        if (metaEventName === 'CustomEvent') {
            window.fbqQueue.push(['trackCustom', eventName, eventParams]);
        } else {
            window.fbqQueue.push(['track', metaEventName, eventParams]);
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    // Set dynamic year
    const yearElement = document.getElementById('year');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }

    // Scroll Animations
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animationPlayState = "running";
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    
    document.querySelectorAll('.animate-enter').forEach(el => {
        el.style.animationPlayState = 'paused';
        observer.observe(el);
    });

    // Flashlight Effect for the Right Card
    const flashlightCard = document.querySelector('.flashlight-container')?.parentElement;
    if (flashlightCard) {
        flashlightCard.addEventListener('mousemove', (e) => {
            const rect = flashlightCard.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            flashlightCard.style.setProperty('--x', `${x}px`);
            flashlightCard.style.setProperty('--y', `${y}px`);
        });
    }

    // Smooth Scroll for Navigation
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            const sectionName = this.getAttribute('href').replace('#', '') || 'unknown';
            
            trackEvent('nav_link_clicked', {
                section: sectionName,
                link_text: this.textContent.trim()
            });
            
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // Modal Logic
    const modal = document.getElementById('signup-modal');
    const modalContent = document.getElementById('modal-content');
    const openModalBtns = document.querySelectorAll('.open-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const successCloseBtn = document.getElementById('success-close');
    const signupForm = document.getElementById('beehiiv-form');
    const successState = document.getElementById('success-state');

    const openModal = () => {
        modal.classList.remove('opacity-0', 'pointer-events-none');
        modalContent.classList.remove('scale-95');
        modalContent.classList.add('scale-100');
        document.body.style.overflow = 'hidden';
        
        trackEvent('modal_opened');
    };

    const closeModal = () => {
        modal.classList.add('opacity-0', 'pointer-events-none');
        modalContent.classList.remove('scale-100');
        modalContent.classList.add('scale-95');
        document.body.style.overflow = '';
        
        trackEvent('modal_closed');
        
        // Reset state after transition
        setTimeout(() => {
            signupForm.classList.remove('hidden');
            successState.classList.add('hidden');
            signupForm.reset();
        }, 300);
    };

    openModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const buttonLocation = btn.closest('section')?.id || 
                                  btn.closest('main') ? 'hero' : 
                                  btn.closest('nav') ? 'navigation' : 'unknown';
            
            trackEvent('cta_button_clicked', {
                button_location: buttonLocation,
                button_text: btn.textContent.trim()
            });
            
            openModal();
        });
    });
    closeModalBtn?.addEventListener('click', closeModal);
    successCloseBtn?.addEventListener('click', closeModal);
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Beehiiv Integration Logic - Primary: API, Fallback: Embed iframe
    signupForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = signupForm.querySelector('button[type="submit"]');
        const email = document.getElementById('email').value;
        const firstName = document.getElementById('first-name').value;
        
        // Loading state
        submitBtn.disabled = true;
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span>Sending...</span>';

        // Method 1: Try API endpoint first (if deployed)
        try {
            console.log('Attempting API submission...');
            const response = await fetch('/api/subscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email,
                    first_name: firstName,
                }),
            });

            if (response.ok) {
                console.log('API submission successful');
                
                trackEvent('signup_form_submitted', {
                    method: 'api',
                    email_domain: email.split('@')[1] || 'unknown'
                });
                
                trackEvent('signup_form_success', {
                    method: 'api'
                });
                
                window.location.href = 'starter-kit.html?subscribed=true';
                return;
            } else {
                console.warn('API returned non-ok status');
                throw new Error('API error');
            }
        } catch (error) {
            console.log('API failed or not found, using Beehiiv embed fallback');
            
            // Method 2: Use Beehiiv embed iframe (fallback)
            try {
                // In fallback mode, we redirect almost immediately because we can't reliably
                // know if the iframe submission finished or was blocked by CSP/CORS
                submitViaBeehiivEmbed(email, firstName);
                
                console.log('Fallback submission initiated, redirecting...');
                
                trackEvent('signup_form_submitted', {
                    method: 'embed_fallback',
                    email_domain: email.split('@')[1] || 'unknown'
                });
                
                trackEvent('signup_form_success', {
                    method: 'embed_fallback'
                });
                
                setTimeout(() => {
                    window.location.href = 'starter-kit.html?subscribed=true';
                }, 1000);
            } catch (fallbackError) {
                console.error('Both methods failed:', fallbackError);
                
                trackEvent('signup_form_error', {
                    error: fallbackError.message || 'unknown_error'
                });
                
                submitBtn.innerHTML = '<span>Error. Try again?</span>';
                submitBtn.disabled = false;
            }
        }
    });

    // Fallback: Submit via Beehiiv embed iframe
    async function submitViaBeehiivEmbed(email, firstName) {
        return new Promise((resolve, reject) => {
            // Create hidden form that matches Beehiiv's expected format
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = 'https://www.beehiiv.com/subscribe';
            form.target = 'beehiiv-hidden-frame';
            form.style.display = 'none';

            // Add required fields
            const pubIdInput = document.createElement('input');
            pubIdInput.type = 'hidden';
            pubIdInput.name = 'pub_id';
            pubIdInput.value = 'pub_5fbc631f-7950-4bac-80fe-80ba70dae2da';
            form.appendChild(pubIdInput);

            const formIdInput = document.createElement('input');
            formIdInput.type = 'hidden';
            formIdInput.name = 'form_id';
            formIdInput.value = '7346f13f-9331-48d7-97f8-88c38da780b1';
            form.appendChild(formIdInput);

            const emailInput = document.createElement('input');
            emailInput.type = 'email';
            emailInput.name = 'email';
            emailInput.value = email;
            form.appendChild(emailInput);

            const firstNameInput = document.createElement('input');
            firstNameInput.type = 'text';
            firstNameInput.name = 'first_name';
            firstNameInput.value = firstName;
            form.appendChild(firstNameInput);

            // Create hidden iframe if it doesn't exist
            let iframe = document.getElementById('beehiiv-hidden-frame');
            if (!iframe) {
                iframe = document.createElement('iframe');
                iframe.id = 'beehiiv-hidden-frame';
                iframe.name = 'beehiiv-hidden-frame';
                iframe.style.display = 'none';
                document.body.appendChild(iframe);
            }

            // Handle iframe load (success)
            iframe.onload = () => {
                setTimeout(() => {
                    document.body.removeChild(form);
                    resolve();
                }, 1000);
            };

            // Append form and submit
            document.body.appendChild(form);
            form.submit();

            // Timeout fallback
            setTimeout(() => {
                if (document.body.contains(form)) {
                    document.body.removeChild(form);
                    resolve(); // Assume success after timeout
                }
            }, 3000);
        });
    }

    // Track section views on scroll
    const sections = ['what-you-get', 'process', 'faq'];
    const viewedSections = new Set();
    
    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !viewedSections.has(entry.target.id)) {
                viewedSections.add(entry.target.id);
                trackEvent('section_viewed', {
                    section_id: entry.target.id,
                    section_name: entry.target.querySelector('h2')?.textContent?.trim() || entry.target.id
                });
            }
        });
    }, { threshold: 0.3 });
    
    sections.forEach(sectionId => {
        const section = document.getElementById(sectionId);
        if (section) {
            sectionObserver.observe(section);
        }
    });

    // Track scroll depth
    let scrollDepthTracked = {
        50: false,
        75: false,
        100: false
    };
    
    const trackScrollDepth = () => {
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollPercent = Math.round((scrollTop / (documentHeight - windowHeight)) * 100);
        
        if (scrollPercent >= 50 && !scrollDepthTracked[50]) {
            scrollDepthTracked[50] = true;
            trackEvent('scroll_depth_50');
        }
        if (scrollPercent >= 75 && !scrollDepthTracked[75]) {
            scrollDepthTracked[75] = true;
            trackEvent('scroll_depth_75');
        }
        if (scrollPercent >= 100 && !scrollDepthTracked[100]) {
            scrollDepthTracked[100] = true;
            trackEvent('scroll_depth_100');
        }
    };
    
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
        }
        scrollTimeout = setTimeout(trackScrollDepth, 150);
    }, { passive: true });
});

