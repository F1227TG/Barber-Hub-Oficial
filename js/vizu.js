(() => {
  const root = document.documentElement;
  root.classList.add('vizu-has-js');
  const menuButton = document.querySelector('.vizu-menu-toggle');
  const navigation = document.querySelector('#navegacao-vizu');
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reducedMotion = motionPreference.matches;
  const revealItems = [...document.querySelectorAll('.vizu-reveal')];

  if (!reducedMotion && 'IntersectionObserver' in window) {
    root.classList.add('vizu-motion');
    const observer = new IntersectionObserver((entries, currentObserver) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          currentObserver.unobserve(entry.target);
        }
      }
    }, { threshold: 0.12 });
    revealItems.forEach(item => observer.observe(item));
  } else {
    revealItems.forEach(item => item.classList.add('is-visible'));
  }

  const motionButton = document.querySelector('.vizu-motion-toggle');
  let paused = reducedMotion;
  const applyMotion = () => {
    root.classList.toggle('vizu-paused', paused);
    motionButton.setAttribute('aria-pressed', String(paused));
    motionButton.textContent = paused ? 'Ativar animações' : 'Pausar animações';
    motionButton.disabled = motionPreference.matches;
    if (motionPreference.matches) motionButton.textContent = 'Movimento reduzido pelo dispositivo';
  };
  motionButton.hidden = false;
  applyMotion();
  motionButton.addEventListener('click', () => { paused = !paused; applyMotion(); });
  motionPreference.addEventListener('change', event => { paused = event.matches; applyMotion(); });

  const progress = document.querySelector('.vizu-reading-progress');
  let pendingFrame = false;
  const updateProgress = () => {
    const height = root.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${height > 0 ? Math.min(1, scrollY / height) : 0})`;
    pendingFrame = false;
  };
  window.addEventListener('scroll', () => {
    if (!pendingFrame) { pendingFrame = true; requestAnimationFrame(updateProgress); }
  }, { passive: true });
  window.addEventListener('resize', updateProgress, { passive: true });
  updateProgress();

  const worlds = {
    barber: {
      label: 'O UNIVERSO BARBER HUB', link: 'https://www.barberhuboficial.com.br/', action: 'Explorar Barber Hub',
      steps: [
        ['Descubra seu estilo', 'Explore barbearias, serviços e profissionais para encontrar o lugar que combina com você.'],
        ['Abra espaço na agenda', 'Escolha serviços, profissional e horário em uma jornada de agendamento contextual.'],
        ['Faça a relação continuar', 'Para o negócio, agenda, clientes, financeiro e retenção se encontram na operação diária.']
      ]
    },
    beauty: {
      label: 'A PROPOSTA BEAUTY HUB', link: 'https://beautyhuboficial.vercel.app/', action: 'Conhecer Beauty Hub',
      steps: [
        ['Descubra formas de se cuidar', 'Cabelo, unhas, maquiagem e bem-estar: diferentes especialidades, espaço para a sua identidade.'],
        ['Encontre novas conexões', 'Uma proposta para aproximar pessoas de salões, estúdios e profissionais do universo da beleza.'],
        ['Acompanhe essa evolução', 'Conheça o Beauty Hub no seu próprio site e descubra os recursos disponíveis nesta etapa do produto.']
      ]
    }
  };
  const panel = document.querySelector('#journey-content');
  const switches = [...document.querySelectorAll('[data-world]')];
  let panelAnimation;
  switches.forEach(button => button.addEventListener('click', () => {
    const world = worlds[button.dataset.world];
    switches.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    panel.querySelector('.vizu-journey-label').textContent = world.label;
    panel.querySelectorAll('.vizu-steps li').forEach((item, index) => {
      item.querySelector('h3').textContent = world.steps[index][0];
      item.querySelector('p').textContent = world.steps[index][1];
    });
    const link = panel.querySelector('a');
    link.href = world.link;
    link.firstChild.textContent = `${world.action} `;
    panelAnimation?.cancel();
    if (!paused && !motionPreference.matches) panelAnimation = panel.animate([
      { opacity: .3, transform: 'translateY(12px)' }, { opacity: 1, transform: 'translateY(0)' }
    ], { duration: 350, easing: 'ease-out' });
  }));

  if (!menuButton || !navigation) return;

  const closeMenu = () => {
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Abrir navegação');
    navigation.classList.remove('is-open');
  };

  menuButton.addEventListener('click', () => {
    const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
    menuButton.setAttribute('aria-expanded', String(!isOpen));
    menuButton.setAttribute('aria-label', isOpen ? 'Abrir navegação' : 'Fechar navegação');
    navigation.classList.toggle('is-open', !isOpen);
  });

  navigation.addEventListener('click', event => {
    if (event.target.closest('a')) closeMenu();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
      closeMenu();
      menuButton.focus();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 680) closeMenu();
  }, { passive: true });
})();
