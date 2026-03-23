// Color picker 
const colors = [
    "#FF6B6B", "#4ECDC4", "#1A535C",
    "#FFD166", "#6A4C93", "#00BBF9"
];
  
const grid = document.getElementById("color-grid");
const preview = document.getElementById("preview-avatar");

let selectedColor = null;

// Create color buttons
colors.forEach(color => {
  const div = document.createElement("div");
  div.classList.add("color-option");
  div.style.backgroundColor = color;

  div.addEventListener("click", () => {
    selectedColor = color;
    preview.style.backgroundColor = color;

    document.querySelectorAll(".color-option")
      .forEach(opt => opt.classList.remove("selected"));

    div.classList.add("selected");
  });

  grid.appendChild(div);
});

document.addEventListener("DOMContentLoaded", () => {
  const backBtn = document.getElementById("back-btn");

  if (backBtn) {
    backBtn.addEventListener("click", () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = "../settings-account/index.html";
      }
    });
  }
});