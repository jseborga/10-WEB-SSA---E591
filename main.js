const yearNode = document.querySelector("#year");
const revealNodes = document.querySelectorAll(".reveal");
const headerNode = document.querySelector(".site-header");
const staggerNodes = document.querySelectorAll(".stagger-item");

if (yearNode) {
  yearNode.textContent = new Date().getFullYear();
}

staggerNodes.forEach((node, index) => {
  node.style.setProperty("--stagger-delay", `${index * 70}ms`);
});

const updateScrollEffects = () => {
  const offset = Math.min(window.scrollY, 240);
  document.documentElement.style.setProperty("--hero-offset", `${offset}px`);

  if (headerNode) {
    headerNode.classList.toggle("is-scrolled", window.scrollY > 18);
  }
};

updateScrollEffects();
window.addEventListener("scroll", updateScrollEffects, { passive: true });

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
