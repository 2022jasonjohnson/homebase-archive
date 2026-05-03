(() => {
  const DEFAULT_SELECTOR = [
    ".xpify",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "p",
    "label",
    "button",
    ".title",
    ".icon-label",
    "#clock",
    "#clock-text",
    "#hours",
    "#minutes",
    "#ampm",
    "body.filefolder .list li > div:last-child"
  ].join(", ");
  const DEFAULT_SCALE = 2;
  const XP_FONT_FAMILY = 'Tahoma, "MS Sans Serif", "Segoe UI", sans-serif';

  let xpifyResizeObserver = null;
  let xpifyMutationObserver = null;
  let xpifyFrame = 0;

  function normalizeXpifyText(value) {
    return (value || "")
      .replace(/\r\n?/g, "\n")
      .replace(/\u00a0/g, " ")
      .trim();
  }

  function getXpifySource(el) {
    const currentText = normalizeXpifyText(el.textContent || "");
    const hasCanvas = Boolean(el.querySelector('[data-xpify-canvas="true"]'));

    if (!el.dataset.xpifySource || (!hasCanvas && currentText !== el.dataset.xpifySource)) {
      el.dataset.xpifySource = currentText;
    }

    return el.dataset.xpifySource;
  }

  function getXpifyScale(el, computedStyle) {
    const requestedScale = Number.parseFloat(el.dataset.xpifyScale);
    const cssScale = Number.parseFloat(computedStyle.getPropertyValue("--xpify-scale"));

    return Number.isFinite(requestedScale) && requestedScale > 0
      ? requestedScale
      : Number.isFinite(cssScale) && cssScale > 0
        ? cssScale
      : DEFAULT_SCALE;
  }

  function getXpifyFont(computedStyle, scale) {
    const cssFontSize = parseFloat(computedStyle.fontSize) || 16;
    const scaledFontSize = Math.max(1, Math.ceil(cssFontSize / scale));
    const fontWeight = computedStyle.fontWeight || "normal";
    const fontStyle = computedStyle.fontStyle || "normal";
    const fontFamily = computedStyle.fontFamily || XP_FONT_FAMILY;

    return {
      scaledFontSize,
      fontFamily,
      font: `${fontStyle} ${fontWeight} ${scaledFontSize}px ${fontFamily}`
    };
  }

  function getXpifyLineHeight(computedStyle, scaledFontSize, scale) {
    const parsedLineHeight = parseFloat(computedStyle.lineHeight);
    const cssLineHeight = Number.isFinite(parsedLineHeight)
      ? parsedLineHeight
      : (parseFloat(computedStyle.fontSize) || 16) * 1.25;

    return Math.max(scaledFontSize + 2, Math.ceil(cssLineHeight / scale));
  }

  function shouldKeepSingleLine(el, computedStyle) {
    if (computedStyle.whiteSpace.includes("nowrap")) {
      return true;
    }

    return (
      el.classList.contains("title") ||
      el.id === "clock" ||
      el.id === "clock-text" ||
      el.id === "hours" ||
      el.id === "minutes" ||
      el.id === "ampm" ||
      el.tagName.toLowerCase() === "button"
    );
  }

  function getMeasuredTextWidth(context, text) {
    const metrics = context.measureText(text);
    const actualWidth = Math.ceil(
      (metrics.actualBoundingBoxLeft || 0) + (metrics.actualBoundingBoxRight || 0)
    );

    return Math.max(Math.ceil(metrics.width || 0), actualWidth);
  }

  function splitLongWord(word, context, maxWidth) {
    const pieces = [];
    let chunk = "";

    for (const char of word) {
      const testChunk = chunk + char;

      if (chunk && getMeasuredTextWidth(context, testChunk) > maxWidth) {
        pieces.push(chunk);
        chunk = char;
      } else {
        chunk = testChunk;
      }
    }

    if (chunk) {
      pieces.push(chunk);
    }

    return pieces;
  }

  function wrapXpifyText(text, context, maxWidth) {
    const paragraphs = text
      .replace(/\r\n?/g, "\n")
      .split(/\n+/)
      .map((line) => line.trim());

    const lines = [];

    paragraphs.forEach((paragraph, paragraphIndex) => {
      if (!paragraph) {
        if (!lines.length || lines[lines.length - 1] !== "") {
          lines.push("");
        }
        return;
      }

      let line = "";

      paragraph.split(/\s+/).forEach((word) => {
        const testLine = line ? `${line} ${word}` : word;

        if (getMeasuredTextWidth(context, testLine) <= maxWidth) {
          line = testLine;
          return;
        }

        if (line) {
          lines.push(line);
          line = "";
        }

        if (getMeasuredTextWidth(context, word) <= maxWidth) {
          line = word;
          return;
        }

        const pieces = splitLongWord(word, context, maxWidth);

        if (pieces.length > 1) {
          lines.push(...pieces.slice(0, -1));
        }

        line = pieces[pieces.length - 1] || "";
      });

      if (line) {
        lines.push(line);
      }

      if (paragraphIndex < paragraphs.length - 1 && lines[lines.length - 1] !== "") {
        lines.push("");
      }
    });

    return lines.length ? lines : [text];
  }

  function observeXpifyElement(el) {
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    if (!xpifyResizeObserver) {
      xpifyResizeObserver = new ResizeObserver((entries) => {
        entries.forEach((entry) => {
          renderXpifyElement(entry.target);
        });
      });
    }

    if (el.dataset.xpifyObserved === "true") {
      return;
    }

    xpifyResizeObserver.observe(el);
    el.dataset.xpifyObserved = "true";
  }

  function observeXpifyMutations() {
    if (xpifyMutationObserver || typeof MutationObserver === "undefined" || !document.body) {
      return;
    }

    xpifyMutationObserver = new MutationObserver(() => {
      scheduleXpifyText();
    });

    xpifyMutationObserver.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  function renderXpifyElement(el) {
    const text = getXpifySource(el);
    if (!text) {
      return;
    }

    const computedStyle = window.getComputedStyle(el);
    const scale = getXpifyScale(el, computedStyle);
    const measuredWidth = el.clientWidth || Math.floor(el.getBoundingClientRect().width);

    if (!measuredWidth) {
      return;
    }

    const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
    const paddingRight = parseFloat(computedStyle.paddingRight) || 0;
    const contentWidth = Math.max(1, measuredWidth - paddingLeft - paddingRight);
    const baseCanvasWidth = Math.max(1, Math.ceil(contentWidth / scale));

    const { scaledFontSize, font, fontFamily } = getXpifyFont(computedStyle, scale);
    const measureCanvas = document.createElement("canvas");
    const measureContext = measureCanvas.getContext("2d");

    if (!measureContext) {
      return;
    }

    measureContext.font = font;

    const sampleMetrics = measureContext.measureText("HgjpqyMW");
    const ascent = Math.ceil(
      sampleMetrics.fontBoundingBoxAscent ||
      sampleMetrics.actualBoundingBoxAscent ||
      scaledFontSize + 1
    );
    const descent = Math.ceil(
      sampleMetrics.fontBoundingBoxDescent ||
      sampleMetrics.actualBoundingBoxDescent ||
      Math.max(2, Math.round(scaledFontSize * 0.35))
    );
    const paddingX = Math.max(2, Math.ceil(scale) + 1);
    const paddingTop = Math.max(2, Math.ceil(scale) + 1);
    const paddingBottom = Math.max(2, Math.ceil(scale) + 2);
    const keepSingleLine = shouldKeepSingleLine(el, computedStyle);
    const lineHeight = Math.max(
      getXpifyLineHeight(computedStyle, scaledFontSize, scale),
      ascent + descent + 2
    );
    const singleLineText = text.replace(/\s+/g, " ");
    const singleLineWidth = getMeasuredTextWidth(measureContext, singleLineText) + (paddingX * 2);
    const canvasWidth = keepSingleLine
      ? Math.max(baseCanvasWidth, singleLineWidth)
      : baseCanvasWidth;
    const availableWidth = Math.max(1, canvasWidth - (paddingX * 2));
    const lines = keepSingleLine
      ? [singleLineText]
      : wrapXpifyText(text, measureContext, availableWidth);
    const canvasHeight = Math.max(
      1,
      paddingTop + ascent + descent + paddingBottom + ((lines.length - 1) * lineHeight)
    );
    const renderKey = [
      scale,
      canvasWidth,
      scaledFontSize,
      lineHeight,
      fontFamily,
      computedStyle.fontWeight,
      computedStyle.fontStyle,
      computedStyle.textAlign,
      computedStyle.color,
      text
    ].join("|");
    const existingCanvas = el.querySelector('[data-xpify-canvas="true"]');

    if (el.dataset.xpifyRenderKey === renderKey && existingCanvas) {
      return;
    }

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    context.font = font;
    context.fillStyle = computedStyle.color || "#111";
    context.textBaseline = "alphabetic";
    context.imageSmoothingEnabled = false;

    const textAlign = ["center", "right", "end"].includes(computedStyle.textAlign)
      ? computedStyle.textAlign
      : "left";

    context.textAlign = textAlign === "end" ? "right" : textAlign;

    lines.forEach((line, index) => {
      const metrics = measureContext.measureText(line || " ");
      const leftInset = Math.ceil(metrics.actualBoundingBoxLeft || 0);
      const rightInset = Math.ceil(metrics.actualBoundingBoxRight || 0);
      const x =
        context.textAlign === "center"
          ? Math.floor(canvas.width / 2)
          : context.textAlign === "right"
            ? canvas.width - paddingX - rightInset
            : paddingX + leftInset;
      const baselineY = paddingTop + ascent + (index * lineHeight);
      context.fillText(line, x, baselineY);
    });

    canvas.dataset.xpifyCanvas = "true";
    canvas.style.width = keepSingleLine
      ? `${Math.ceil(canvas.width * scale)}px`
      : `${Math.ceil(contentWidth)}px`;
    canvas.style.height = `${Math.ceil(canvas.height * scale)}px`;
    canvas.style.maxWidth = "100%";
    canvas.style.display = keepSingleLine || computedStyle.display === "inline"
      ? "inline-block"
      : "block";
    canvas.style.imageRendering = "pixelated";
    canvas.style.pointerEvents = "none";
    canvas.style.whiteSpace = keepSingleLine ? "nowrap" : "normal";
    canvas.setAttribute("aria-hidden", "true");

    el.replaceChildren(canvas);
    el.setAttribute("aria-label", text);
    el.dataset.xpifyRenderKey = renderKey;
  }

  function xpifyText(selector = DEFAULT_SELECTOR) {
    document.querySelectorAll(selector).forEach((el) => {
      observeXpifyElement(el);
      renderXpifyElement(el);
    });
  }

  function scheduleXpifyText(selector = DEFAULT_SELECTOR) {
    if (xpifyFrame) {
      cancelAnimationFrame(xpifyFrame);
    }

    xpifyFrame = requestAnimationFrame(() => {
      xpifyText(selector);
      xpifyFrame = 0;
    });
  }

  window.xpifyText = xpifyText;
  window.scheduleXpifyText = scheduleXpifyText;

  const bootXpify = () => scheduleXpifyText(DEFAULT_SELECTOR);

  if (document.readyState === "loading") {
    window.addEventListener("load", () => {
      observeXpifyMutations();
      bootXpify();
    });
  } else {
    observeXpifyMutations();
    bootXpify();
  }

  window.addEventListener("resize", bootXpify);

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(bootXpify);
  }
})();
