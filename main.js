const rootNode = document.documentElement;
const yearNode = document.querySelector("#year");
const revealNodes = document.querySelectorAll(".reveal");
const headerNode = document.querySelector(".site-header");
const parallaxNodes = [...document.querySelectorAll("[data-parallax]")];

if (yearNode) {
  yearNode.textContent = new Date().getFullYear();
}

let rafId = 0;

const updateHeaderState = () => {
  if (headerNode) {
    headerNode.classList.toggle("is-scrolled", window.scrollY > 12);
  }
};

const updateParallax = () => {
  parallaxNodes.forEach((node) => {
    const rect = node.getBoundingClientRect();
    const offset = (window.innerHeight / 2 - (rect.top + rect.height / 2)) * 0.12;
    node.style.setProperty("--parallax-offset", `${offset.toFixed(2)}px`);
  });
};

const onFrame = () => {
  rafId = 0;
  updateHeaderState();
  updateParallax();
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
