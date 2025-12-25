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
    };

    const closeModal = () => {
        modal.classList.add('opacity-0', 'pointer-events-none');
        modalContent.classList.remove('scale-100');
        modalContent.classList.add('scale-95');
        document.body.style.overflow = '';
        
        // Reset state after transition
        setTimeout(() => {
            signupForm.classList.remove('hidden');
            successState.classList.add('hidden');
            signupForm.reset();
        }, 300);
    };

    openModalBtns.forEach(btn => btn.addEventListener('click', openModal));
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
                window.location.href = 'starter-kit.html';
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
                setTimeout(() => {
                    window.location.href = 'starter-kit.html';
                }, 1000);
            } catch (fallbackError) {
                console.error('Both methods failed:', fallbackError);
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
});

