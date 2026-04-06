const yearNode = document.querySelector("#year");
const revealNodes = document.querySelectorAll(".reveal");

if (yearNode) {
  yearNode.textContent = new Date().getFullYear();
}

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
