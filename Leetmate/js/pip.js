chrome.runtime.onMessage.addListener((message) => {
	if (message.type === "loadPip") {
		petDataUrl = message.petDataUrl;
		showLaunchButton();
	}
});

function showLaunchButton() {
	const style = document.createElement("style");
	style.textContent = `
		#pip-launch {
			position: fixed;
			bottom: 24px;
			right: 24px;
			z-index: 2147483647;
			padding: 8px 14px;
			border-radius: 20px;
			border: none;
			background: #4f46e5;
			color: white;
			font-family: sans-serif;
			font-size: 14px;
			cursor: pointer;
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		}
		#pip-launch:hover {
			background: #4338ca;
		}
	`;
	document.head.appendChild(style);

	const btn = document.createElement("button");
	btn.id = "pip-launch";
	btn.textContent = "🐾 Open Mini Display";

	btn.addEventListener("click", () => {
		btn.remove();
		// function to open pip 
	});
	document.body.appendChild(btn);
}
