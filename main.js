function getFullscreenDocument() {
  try {
    if (window.top && window.top.document) {
      return window.top.document;
    }
  } catch (error) {
    // Cross-origin iframe fallback: use the current document.
  }

  return document;
}

function documentIsFullscreen(fullscreenDocument) {
  return !!(
    fullscreenDocument.fullscreenElement ||
    fullscreenDocument.webkitFullscreenElement ||
    fullscreenDocument.mozFullScreenElement ||
    fullscreenDocument.msFullscreenElement
  );
}

function isFullscreen() {
  return documentIsFullscreen(getFullscreenDocument());
}

function shouldManageFullscreenPopup() {
  try {
    return !window.top || window.top === window;
  } catch (error) {
    return true;
  }
}

function ensureFullscreenPopup() {
  let popup = document.getElementById('fullscreen-popup');
  if (popup || !document.body || !shouldManageFullscreenPopup()) {
    return popup;
  }

  popup = document.createElement('div');
  popup.id = 'fullscreen-popup';
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-live', 'polite');
  popup.hidden = true;
  popup.innerHTML = `
    <div class="popup-inner">
      <p>Please enter fullscreen for intended experience.</p>
      <div class="popup-actions">
        <button id="popup-enter-btn" type="button">Go Fullscreen</button>
      </div>
    </div>
  `;
  document.body.prepend(popup);
  return popup;
}

function setPopup(visible) {
  const popup = ensureFullscreenPopup();
  if (!popup) return;
  if (visible) {
    popup.hidden = false;
    popup.classList.add('visible');
  } else {
    popup.hidden = true;
    popup.classList.remove('visible');
  }
}

function requestFullscreen() {
  const fullscreenDocument = getFullscreenDocument();
  const el = fullscreenDocument.documentElement;
  if (el.requestFullscreen) return el.requestFullscreen();
  if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
  if (el.mozRequestFullScreen) return el.mozRequestFullScreen();
  if (el.msRequestFullscreen) return el.msRequestFullscreen();
}

function checkFullscreen() {
  setPopup(!isFullscreen());
}

function resolveArchiveAssetPath(path) {
  if (!path || !path.startsWith('/assets/')) {
    return path;
  }

  const fromHtmls = window.location.pathname.includes('/htmls/');
  const relativePath = fromHtmls ? `..${path}` : `.${path}`;
  return new URL(relativePath, window.location.href).href;
}

window.initRoomMenu = function initRoomMenu(options = {}) {
  const mapTrigger = document.getElementById('map-trigger');
  const mapWindow = document.getElementById('map-window');
  const mapWindowClose = mapWindow ? mapWindow.querySelector('.close') : null;
  const mapWindowImage = mapWindow ? mapWindow.querySelector('.content img') : null;
  const mapWindowLabel = mapWindow ? mapWindow.querySelector('.content p') : null;
  const mapWindowTitle = mapWindow ? mapWindow.querySelector('.title-bar .title') : null;
  const exitTrigger = document.getElementById('exit-trigger');
  const exitConfirmOverlay = document.getElementById('exit-confirm-overlay');
  const exitConfirmYes = document.getElementById('exit-confirm-yes');
  const exitConfirmNo = document.getElementById('exit-confirm-no');
  const mapImageSrc = resolveArchiveAssetPath(options.mapImageSrc || '/assets/map/frontyard-map.svg');
  const mapLabel = options.mapLabel || 'Front Yard';
  const mapTitle = options.mapTitle || 'Site Map';
  const exitHref = options.exitHref
    ? new URL(options.exitHref, window.location.href).href
    : new URL('../index.html', window.location.href).href;
  let mapWindowOpen = sessionStorage.getItem('mapWindowOpen') === 'true';
  let mapTriggerHovered = false;

  if (!mapTrigger || !mapWindow || !exitTrigger || !exitConfirmOverlay || !exitConfirmYes || !exitConfirmNo) {
    return;
  }

  if (mapWindowImage) {
    mapWindowImage.src = mapImageSrc;
  }

  if (mapWindowLabel) {
    mapWindowLabel.textContent = mapLabel;
  }

  if (mapWindowTitle) {
    mapWindowTitle.textContent = mapTitle;
  }

  // Apply stored map state on page load
  mapWindow.classList.toggle('hidden', !mapWindowOpen);
  mapWindow.setAttribute('aria-hidden', String(!mapWindowOpen));

  const updateMapTriggerIcon = () => {
    if (mapWindowOpen) {
      mapTrigger.src = resolveArchiveAssetPath(mapTriggerHovered ? '/assets/map active hover.svg' : '/assets/map active.svg');
    } else {
      mapTrigger.src = resolveArchiveAssetPath(mapTriggerHovered ? '/assets/map hover.svg' : '/assets/map.svg');
    }

    mapTrigger.setAttribute('aria-expanded', String(mapWindowOpen));
  };

  const setMapWindowOpen = (isOpen) => {
    mapWindowOpen = isOpen;
    sessionStorage.setItem('mapWindowOpen', String(isOpen));
    mapWindow.classList.toggle('hidden', !isOpen);
    mapWindow.setAttribute('aria-hidden', String(!isOpen));
    updateMapTriggerIcon();
  };

  const toggleMapWindow = () => {
    setMapWindowOpen(!mapWindowOpen);
  };

  const openExitConfirm = () => {
    exitConfirmOverlay.hidden = false;
  };

  const closeExitConfirm = () => {
    exitConfirmOverlay.hidden = true;
  };

  const goToHome = () => {
    const targetWindow = window.top && window.top !== window ? window.top : window;
    targetWindow.location.href = exitHref;
  };

  updateMapTriggerIcon();

  mapTrigger.addEventListener('mouseenter', () => {
    mapTriggerHovered = true;
    updateMapTriggerIcon();
  });

  mapTrigger.addEventListener('mouseleave', () => {
    mapTriggerHovered = false;
    updateMapTriggerIcon();
  });

  mapTrigger.addEventListener('click', toggleMapWindow);
  mapTrigger.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleMapWindow();
    }
  });

  if (mapWindowClose) {
    mapWindowClose.addEventListener('click', () => {
      setMapWindowOpen(false);
    });
  }

  exitTrigger.addEventListener('click', openExitConfirm);
  exitTrigger.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openExitConfirm();
    }
  });

  exitConfirmNo.addEventListener('click', closeExitConfirm);
  exitConfirmYes.addEventListener('click', goToHome);

  exitConfirmOverlay.addEventListener('click', (event) => {
    if (event.target === exitConfirmOverlay) {
      closeExitConfirm();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;

    if (!exitConfirmOverlay.hidden) {
      closeExitConfirm();
      return;
    }

    if (mapWindowOpen) {
      setMapWindowOpen(false);
    }
  });
};

window.addEventListener('load', () => {
  ensureFullscreenPopup();
  const enterBtn = document.getElementById('enter-fullscreen-btn');
  const popupEnter = document.getElementById('popup-enter-btn');
  const popupDismiss = document.getElementById('popup-dismiss-btn');

  enterBtn && enterBtn.addEventListener('click', requestFullscreen);
  popupEnter && popupEnter.addEventListener('click', requestFullscreen);
  popupDismiss && popupDismiss.addEventListener('click', () => setPopup(false));

  checkFullscreen();
});

['fullscreenchange','webkitfullscreenchange','mozfullscreenchange','MSFullscreenChange'].forEach(evt => {
  document.addEventListener(evt, checkFullscreen);
  try {
    if (window.top && window.top !== window && window.top.document) {
      window.top.document.addEventListener(evt, checkFullscreen);
    }
  } catch (error) {
    // Ignore inaccessible parent documents.
  }
});

window.addEventListener('resize', checkFullscreen);

// clock

function updateClock() {
    const now = new Date();
    let hours = now.getHours();
    let minutes = now.getMinutes();
    let ampm = hours >= 12 ? 'PM' : 'AM'; 

    
    hours = hours % 12;
    hours = hours ? hours : 12; 

   
    hours = hours < 10 ? '0' + hours : hours;
    minutes = minutes < 10 ? '0' + minutes : minutes;

    const clockText = document.getElementById('clock-text');
    if (clockText) {
      clockText.textContent = `${hours}:${minutes} ${ampm}`;
      return;
    }

    const hoursEl = document.getElementById('hours');
    const minutesEl = document.getElementById('minutes');
    const ampmEl = document.getElementById('ampm');

    if (!hoursEl || !minutesEl || !ampmEl) return;

    hoursEl.textContent = hours;
    minutesEl.textContent = minutes;
    ampmEl.textContent = ampm;
}


setInterval(updateClock, 1000); 


updateClock(); 

// end of clock

// Make all `.window` elements draggable by their `.title-bar` (mouse + touch), and wire open/close
window.addEventListener('load', () => {
  const windows = Array.from(document.querySelectorAll('.window'));
  const folderIcon = document.getElementById('folder-icon');

  windows.forEach((win) => {
    const title = win.querySelector('.title-bar');
    if (!title) return;

    let dragging = false;
    let startX = 0, startY = 0, startLeft = 0, startTop = 0;
    const getPoint = (e) => (e.touches && e.touches[0]) || e;

    const onDown = (e) => {
      if (e.type === 'mousedown' && e.button !== 0) return;
      if (e.target.closest('button')) return;
      e.preventDefault();
      const p = getPoint(e);
      const rect = win.getBoundingClientRect();
      startX = p.clientX; startY = p.clientY;
      startLeft = rect.left; startTop = rect.top;
      dragging = true; title.classList.add('dragging');
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onUp);
      win.style.transform = 'none';
      win.style.left = startLeft + 'px';
      win.style.top = startTop + 'px';
      win.style.right = 'auto';
    };

    const onMove = (e) => {
      if (!dragging) return;
      e.preventDefault();
      const p = getPoint(e);
      const dx = p.clientX - startX; const dy = p.clientY - startY;
      win.style.left = (startLeft + dx) + 'px';
      win.style.top = (startTop + dy) + 'px';
    };

    const onUp = () => {
      if (!dragging) return;
      dragging = false; title.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    };

    title.addEventListener('mousedown', onDown);
    title.addEventListener('touchstart', onDown, { passive: false });

    // close button hides the window
    const closeBtn = win.querySelector('.title-bar .close');
    if (closeBtn) closeBtn.addEventListener('click', () => win.classList.add('hidden'));
  });

  // open main window when clicking the folder icon
  if (folderIcon) {
    const openWin = () => {
      const main = document.getElementById('main-window') || windows[0];
      if (!main) return;
      main.classList.remove('hidden');
      const rect = main.getBoundingClientRect();
      if (rect.right > window.innerWidth) main.style.left = Math.max(10, window.innerWidth - rect.width - 10) + 'px';
      if (rect.bottom > window.innerHeight) main.style.top = Math.max(10, window.innerHeight - rect.height - 10) + 'px';
    };
    folderIcon.addEventListener('click', openWin);
    folderIcon.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') openWin(); });
  }

  // listen for messages from iframe to open specific windows
  window.addEventListener('message', (ev) => {
    if (!ev.data || typeof ev.data !== 'string') return;
    if (ev.data === 'open-password') {
      const pw = document.getElementById('password-window'); if (pw) pw.classList.remove('hidden');
    } else if (ev.data === 'open-readme') {
      const rm = document.getElementById('readme-window');
      if (rm) {
        rm.classList.remove('hidden');
      }
    } else if (ev.data.startsWith('open-iframe:')) {
      const src = ev.data.split(':')[1];
      const overlay = document.getElementById('iframe-overlay');
      const iframe = document.getElementById('overlay-iframe');
      const overlayTitleBar = document.querySelector('#iframe-overlay .title-bar');
      if (!overlay || !iframe) return;
      iframe.src = src || '';
      overlay.classList.remove('hidden');
      overlay.setAttribute('aria-hidden', 'false');
      if (overlayTitleBar) {
        if (src.startsWith('htmls/login-success.html')) {
          overlayTitleBar.style.display = 'none';
          iframe.style.height = '100%';
        } else {
          overlayTitleBar.style.display = '';
          iframe.style.height = 'calc(100% - 48px)';
        }
      }
    }
  });

  // overlay close handling (close button + Esc)
  const iframeClose = document.getElementById('iframe-close');
  const iframeOverlay = document.getElementById('iframe-overlay');
  const overlayIframe = document.getElementById('overlay-iframe');
  if (iframeClose && iframeOverlay) {
    const closeOverlay = () => {
      iframeOverlay.classList.add('hidden');
      iframeOverlay.setAttribute('aria-hidden', 'true');
      if (overlayIframe) overlayIframe.src = '';
      const overlayTitleBar = document.querySelector('#iframe-overlay .title-bar');
      if (overlayTitleBar) overlayTitleBar.style.display = '';
      if (overlayIframe) overlayIframe.style.height = 'calc(100% - 48px)';
    };
    iframeClose.addEventListener('click', closeOverlay);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeOverlay(); });
  }
});
