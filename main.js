const rootNode = document.documentElement;
const yearNode = document.querySelector("#year");
const headerNode = document.querySelector(".site-header");
const menuToggleNode = document.querySelector(".menu-toggle");
const navNode = document.querySelector(".site-nav");
const revealNodes = document.querySelectorAll(".reveal");
const parallaxNodes = [...document.querySelectorAll("[data-parallax]")];

if (yearNode) {
  yearNode.textContent = new Date().getFullYear();
}

const closeMenu = () => {
  if (!menuToggleNode || !navNode) {
    return;
  }

  menuToggleNode.setAttribute("aria-expanded", "false");
  navNode.classList.remove("is-open");
};

if (menuToggleNode && navNode) {
  menuToggleNode.addEventListener("click", () => {
    const isOpen = navNode.classList.toggle("is-open");
    menuToggleNode.setAttribute("aria-expanded", String(isOpen));
  });

  navNode.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });
}

let rafId = 0;

const updateHeaderState = () => {
  if (headerNode) {
    headerNode.classList.toggle("is-scrolled", window.scrollY > 18);
  }
};

const updateParallax = () => {
  const viewportHeight = window.innerHeight || 1;

  parallaxNodes.forEach((node) => {
    const rect = node.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const offset = ((viewportHeight / 2 - midpoint) / viewportHeight) * 42;
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
      rootMargin: "0px 0px -10% 0px",
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

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMenu();
  }
});

window.addEventListener("click", (event) => {
  if (
    navNode &&
    menuToggleNode &&
    navNode.classList.contains("is-open") &&
    !navNode.contains(event.target) &&
    !menuToggleNode.contains(event.target)
  ) {
    closeMenu();
  }
});

rootNode.style.setProperty("--app-ready", "1");
