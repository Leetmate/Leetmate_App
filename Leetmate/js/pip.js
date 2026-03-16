let petDataUrl = null;
let sprite = null;
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
		openPip();
	});
	document.body.appendChild(btn);
}

async function openPip() {
	const bgUrl = chrome.runtime.getURL("assets/bg_home.png");
	const pipWindow = await documentPictureInPicture.requestWindow({width: 220, height: 200});
	
	pipWindow.document.head.innerHTML = buildStyles(bgUrl);
	pipWindow.document.body.innerHTML = buildHTML();
	sprite = pipWindow.document.querySelector(".mini-pet-sprite");
}

function buildHTML() {
	return `
		<div class="pip-card">
			<div class="top-buttons">
				<button class="icon-btn anim-toggle" id="anim-toggle">⚡</button>
				<button class="icon-btn restore-btn" id="restore-btn">🎁</button>
			</div>
			<div class="mini-pet-sprite"></div>
		</div>`
		

}

function buildStyles(bgUrl) {
	return `
		<meta charset="UTF-8">
		<style>
			* {margin: 0; padding: 0; box-sizing: border-box;}
			html, body {width: 100%; height: 100%; overflow: hidden;}
			
			.pip-card {
				width: 100%; 
				height: 100%;
				background-image: url("${bgUrl}");
				background-size: 100% 100%;
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: space-between;
				padding: 10px;
			}

			.top-buttons {
				position: relative;
				width: 100%;
			}

			.icon-btn {
				position: absolute;
				border: 1px solid rgba(255,255,255,0.3);
				border-radius: 10px;
				background: rgba(255,255,255,0.9);
				padding: 5px;
				box-shadow: 0 2px 4px rgba(0,0,0,0.15);
				cursor: pointer;
				transition: transform 0.1s ease;
				font-size: 16px;
			}

			.icon-btn:hover {transform: scale(1.1);}
			.icon-btn:active{transform: scale(0.9);}
			.icon-btn.off {opacity: 0.4;}

			.restore-btn {right: 0;}
			.anim-toggle {left: 0;}
			
			.mini-pet-sprite{
				width: clamp(60px, 50%, 180px);
				aspect-ratio: 21 / 16;
				background-image: url("${petDataUrl}");
				background-size: 700%;
				image-rendering: pixelated;
				}
				`
}
