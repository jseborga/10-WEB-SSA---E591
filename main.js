const rootNode = document.documentElement;
const yearNode = document.querySelector("#year");
const revealNodes = document.querySelectorAll(".reveal");
const headerNode = document.querySelector(".site-header");
const heroNode = document.querySelector(".hero");
const capabilitySteps = [...document.querySelectorAll(".capability-step")];
const capabilitySlides = [...document.querySelectorAll(".capability-slide")];
const storySteps = [...document.querySelectorAll(".story-step")];
const storyPanels = [...document.querySelectorAll(".story-panel")];

if (yearNode) {
  yearNode.textContent = new Date().getFullYear();
}

let rafId = 0;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const updateHeroProgress = () => {
  if (!heroNode) {
    return;
  }

  const rect = heroNode.getBoundingClientRect();
  const scrollDistance = Math.max(rect.height - window.innerHeight, 1);
  const progress = clamp((window.innerHeight - rect.bottom) / scrollDistance, 0, 1);
  rootNode.style.setProperty("--hero-progress", progress.toFixed(4));
};

const updateHeaderState = () => {
  if (headerNode) {
    headerNode.classList.toggle("is-scrolled", window.scrollY > 12);
  }
};

const updateCapabilities = () => {
  if (!capabilitySteps.length || !capabilitySlides.length) {
    return;
  }

  const anchor = window.innerHeight * 0.46;
  let activeStep = capabilitySteps[0];
  let smallestDistance = Number.POSITIVE_INFINITY;

  capabilitySteps.forEach((step) => {
    const rect = step.getBoundingClientRect();
    const center = rect.top + rect.height / 2;
    const distance = Math.abs(center - anchor);

    if (distance < smallestDistance) {
      smallestDistance = distance;
      activeStep = step;
    }
  });

  const activeMedia = activeStep.dataset.media;

  capabilitySteps.forEach((step) => {
    step.classList.toggle("is-active", step.dataset.media === activeMedia);
  });

  capabilitySlides.forEach((slide) => {
    slide.classList.toggle("is-active", slide.dataset.media === activeMedia);
  });
};

const updateStories = () => {
  if (!storySteps.length || !storyPanels.length) {
    return;
  }

  const anchor = window.innerHeight * 0.46;
  let activeStep = storySteps[0];
  let smallestDistance = Number.POSITIVE_INFINITY;

  storySteps.forEach((step) => {
    const rect = step.getBoundingClientRect();
    const center = rect.top + rect.height / 2;
    const distance = Math.abs(center - anchor);

    if (distance < smallestDistance) {
      smallestDistance = distance;
      activeStep = step;
    }
  });

  const activeStory = activeStep.dataset.story;

  storySteps.forEach((step) => {
    step.classList.toggle("is-active", step.dataset.story === activeStory);
  });

  storyPanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.story === activeStory);
  });
};

const onFrame = () => {
  rafId = 0;
  updateHeaderState();
  updateHeroProgress();
  updateCapabilities();
  updateStories();
};

const requestFrame = () => {
  if (!rafId) {
    rafId = window.requestAnimationFrame(onFrame);
  }
};

requestFrame();
window.addEventListener("scroll", requestFrame, { passive: true });
window.addEventListener("resize", requestFrame);

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.16,
    },
  );

  revealNodes.forEach((node) => {
    if (!node.classList.contains("is-visible")) {
      observer.observe(node);
    }
  });
} else {
  revealNodes.forEach((node) => node.classList.add("is-visible"));
}
