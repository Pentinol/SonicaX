(function() {
    // Элементы
    const header = document.querySelector('.header');
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.section');
    
    // ========== СОЗДАНИЕ ЗВЕЗД ==========
    function createStarsForSection(sectionId) {
        const section = document.getElementById(sectionId);
        if (!section) return;
        
        const starsContainer = section.querySelector('.stars-background');
        if (!starsContainer) return;
        
        // Очищаем контейнер
        starsContainer.innerHTML = '';
        
        // Создаем звезды
        const starCount = 150; // Увеличиваем количество звезд
        
        for (let i = 0; i < starCount; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            
            // Случайные параметры
            const size = Math.random() * 3 + 1; // Размер от 1px до 4px
            const opacity = Math.random() * 0.5 + 0.1; // Прозрачность от 0.1 до 0.6
            const left = Math.random() * 100; // Позиция слева от 0% до 100%
            const top = Math.random() * 100; // Позиция сверху от 0% до 100%
            const duration = Math.random() * 3 + 2; // Длительность мерцания от 2s до 5s
            const delay = Math.random() * 2; // Задержка от 0s до 2s
            
            star.style.cssText = `
                width: ${size}px;
                height: ${size}px;
                left: ${left}%;
                top: ${top}%;
                --opacity: ${opacity};
                opacity: ${opacity};
                animation: twinkle ${duration}s ease-in-out infinite;
                animation-delay: ${delay}s;
                box-shadow: 0 0 ${size * 2}px rgba(255, 255, 255, 0.5);
            `;
            
            starsContainer.appendChild(star);
        }
    }
    
    // Создаем звезды для каждой секции
    createStarsForSection('home');
    createStarsForSection('about');
    createStarsForSection('algorithm');
    createStarsForSection('subscription');
    
    // ========== ИЗМЕНЕНИЕ ШАПКИ ПРИ СКРОЛЛЕ ==========
    let ticking = false;
    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                if (window.scrollY > 50) {
                    header.classList.add('scrolled');
                } else {
                    header.classList.remove('scrolled');
                }
                
                // Подсветка активного пункта меню
                let current = '';
                sections.forEach(section => {
                    const sectionTop = section.offsetTop - 100;
                    const sectionHeight = section.clientHeight;
                    if (window.scrollY >= sectionTop && window.scrollY < sectionTop + sectionHeight) {
                        current = section.getAttribute('id');
                    }
                });
                
                navLinks.forEach(link => {
                    link.classList.remove('active-nav');
                    if (link.getAttribute('href') === `#${current}`) {
                        link.classList.add('active-nav');
                    }
                });
                
                ticking = false;
            });
            
            ticking = true;
        }
    });
    
    // ========== ПЛАВНАЯ НАВИГАЦИЯ ==========
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                const targetPosition = targetSection.offsetTop - 70;
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // ========== ИНТЕРАКТИВНЫЙ ЭФФЕКТ ДЛЯ КАРТОЧЕК АЛГОРИТМОВ ==========
    const algorithmCards = document.querySelectorAll('.algorithm-card');
    
    algorithmCards.forEach(card => {
        let frame;
        card.addEventListener('mousemove', (e) => {
            if (frame) cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                const rect = card.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
                const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
                
                const inner = card.querySelector('.algorithm-card-inner');
                inner.style.transform = `translateY(-10px) rotateY(${x * 3}deg) rotateX(${y * -3}deg)`;
            });
        });
        
        card.addEventListener('mouseleave', () => {
            const inner = card.querySelector('.algorithm-card-inner');
            inner.style.transform = 'translateY(-10px) rotateY(0deg) rotateX(0deg)';
        });
    });
    
    // ========== АНИМАЦИЯ ПРИ СКРОЛЛЕ ==========
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    document.querySelectorAll('.algorithm-card, .about-text p').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'all 0.6s ease';
        observer.observe(el);
    });
    
    // ========== ДОБАВЛЯЕМ CSS ДЛЯ АНИМАЦИИ ЗВЕЗД ==========
    const style = document.createElement('style');
    style.textContent = `
        .stars-background {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 0;
            overflow: hidden;
        }
        
        .star {
            position: absolute;
            background: white;
            border-radius: 50%;
            pointer-events: none;
            z-index: 0;
        }
        
        @keyframes twinkle {
            0%, 100% {
                opacity: var(--opacity);
                transform: scale(1);
            }
            50% {
                opacity: calc(var(--opacity) * 0.3);
                transform: scale(0.8);
            }
        }
    `;
    document.head.appendChild(style);
})();