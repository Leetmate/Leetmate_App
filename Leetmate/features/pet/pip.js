if (!window.pipInitialized) {	// guard against multiple injections
	window.pipInitialized = true;

	let petDataUrl = null;
	let pipWindow = null;
	
	// wait for background to send message
	chrome.runtime.onMessage.addListener((message) => {
		if (message.type === "loadPip") {
			petDataUrl = message.petDataUrl;
			showLaunchButton();
		}
	});

	function showLaunchButton() { 
		const style = document.createElement("style");
		// pip styling needs to be injected here instead of separate files
		style.textContent = `
			.pip-launch {
				position: fixed;
				bottom: 24px;
				right: 24px;
				z-index: 2147483647;
				padding: 12px 16px;
				border-radius: 20px;
				border: none;
				background: #4f46e5;
				color: white;
				font-family: sans-serif;
				font-size: 16px;
				cursor: pointer;
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
				display: flex;
				align-items: center;
				justify-content: center;
				line-height: 1;
				gap: 6px;
			}
			.pip-launch:hover {
				background: #4338ca;
			}
			.pip-launch svg {margin-top: -4px;}
		`;
		document.head.appendChild(style);

		const btn = document.createElement("button");
		btn.className = "pip-launch";
		btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="22px" viewBox="0 -960 960 960" width="22px" fill="#ff7d04" stroke="#000000" stroke-width="60"><path d="M180-475q-42 0-71-29t-29-71q0-42 29-71t71-29q42 0 71 29t29 71q0 42-29 71t-71 29Zm109-189q-29-29-29-71t29-71q29-29 71-29t71 29q29 29 29 71t-29 71q-29 29-71 29t-71-29Zm240 0q-29-29-29-71t29-71q29-29 71-29t71 29q29 29 29 71t-29 71q-29 29-71 29t-71-29Zm251 189q-42 0-71-29t-29-71q0-42 29-71t71-29q42 0 71 29t29 71q0 42-29 71t-71 29ZM266-75q-45 0-75.5-34.5T160-191q0-52 35.5-91t70.5-77q29-31 50-67.5t50-68.5q22-26 51-43t63-17q34 0 63 16t51 42q28 32 49.5 69t50.5 69q35 38 70.5 77t35.5 91q0 47-30.5 81.5T694-75q-54 0-107-9t-107-9q-54 0-107 9t-107 9Z"/></svg> Open Mini Display`;

		btn.addEventListener("click", () => {
			btn.remove();
			style.remove();
			openPip();
		});
		document.body.appendChild(btn);
	}

	async function openPip() {
		let posX = 0;
		let posY = 0;
		let facingDirection = 1;
		let animationsEnabled = true;

		const bgUrl = chrome.runtime.getURL("assets/backgrounds/bg_home.png");

		// build the pip with the html and styling
		pipWindow = await documentPictureInPicture.requestWindow({
			width: 240, 
			height: 210, 
			preferInitialWindowPlacement: true
		});
		
		pipWindow.document.head.innerHTML = buildStyles(bgUrl);
		pipWindow.document.body.innerHTML = buildHTML();
		
		// send restore message  to background when button is clicked
		pipWindow.document.getElementById("restore-btn").addEventListener("click", () => {
			chrome.runtime.sendMessage({type: "restore"});
			pipWindow.close();
			pipWindow = null;
		})

		const sprite = pipWindow.document.querySelector(".mini-pet-sprite");
		const animToggle = pipWindow.document.getElementById("anim-toggle");

		animToggle.addEventListener("click", () => {
			idle();
			animationsEnabled = !animationsEnabled;
			animToggle.classList.toggle("off", !animationsEnabled);
			if (animationsEnabled) {
				nextAction();
			}
		})

		// Pet Behavior Functions

		function placeSprite() {
			sprite.style.translate = `${posX}px ${posY}px`;
			sprite.style.scale = `${facingDirection} 1`;
		}

		function resetSprite() {
			sprite.style.transform = "";
			sprite.style.transition = "";
			placeSprite();			
		}

		function idle() {
			sprite.style.animation = "pet-idle 1.6s steps(1) infinite";
			sprite.style.backgroundPosition = "";
			resetSprite();
		}

		function walk() {
			if (!animationsEnabled) return;
			// random direction and distance for travel (15-35)
			const direction = Math.random() < 0.5 ? 1 : -1;
			const distance = Math.round(Math.random() * 20 + 15);
			const displacement = direction * distance;

			// New x position between -80 and 80
			const newX = Math.max(-80, Math.min(80, posX + displacement));
			if (newX === posX) { nextAction(); return;} // collision check

			// Chance to add in vertical shift (8-20)
			const walkDiagonal = Math.random() < 0.5;
			const verticalDirection = Math.random() < 0.5 ? 1 : -1;
			const verticalDistance = walkDiagonal ? Math.round(verticalDirection * (Math.random() * 12 + 8)) : 0;

			// same as before, but for y
			const newY = Math.max(-25, Math.min(15, posY + verticalDistance));

			// consistent speed calc
			const travelMs = Math.abs(newX - posX) / 18 * 1000;
			facingDirection = newX > posX ? -1 : 1;

			// start animation (cant add the new transition/translate here)
			sprite.style.animation = `pet-walk 1s steps(1) infinite`;
			resetSprite();
			
			setTimeout(() => {
				sprite.style.transition = `translate ${travelMs}ms linear`;
				sprite.style.translate = `${newX}px ${newY}px`;

				// once finished, update position
				setTimeout(() => {
					posX = newX;
					posY = newY;
					sprite.style.transition = "";
					idle();
					nextAction();
				}, travelMs + 100);
			}, 16);
		}

		function jump() {
			if (!animationsEnabled) return;
			placeSprite();
			sprite.style.animation = "pet-jump 1s ease-in-out, pet-jump-frames 1s steps(1) forwards";
			setTimeout(() => {
				sprite.style.animation = "";
				idle();
				nextAction();
			}, 1100);
		}

		function backflip() { // pretty similar to jump, maybe i should somehow just use one function
			if (!animationsEnabled) return;
			placeSprite();
			sprite.style.animation = `pet-backflip 1s ease-in-out, pet-backflip-frames 1s steps(1) forwards`;
			setTimeout(() => {
				sprite.style.animation = "";
				idle();
				nextAction();
			}, 1100);
		}

		function sleep() {
			if (!animationsEnabled) return;

			sprite.style.animation = "none";
			sprite.style.backgroundPosition = "100% 0%";
			resetSprite();

			const sleepDuration = Math.random() * 3000 + 6000;
			const zTexts = ["Z", "Zz", "Zzz"];
			let zIdx = 0;
			let elapsed = 0;

			const zTimer = setInterval(() => { // creates the z text every second
				if (!pipWindow || pipWindow.closed) {clearInterval(zTimer); return;}

				elapsed += 1000;

				const zzz = pipWindow.document.createElement("span");
				zzz.className = "pet-sleep";
				zzz.textContent = zTexts[zIdx % 3];
				zzz.style.setProperty("--flip", `${facingDirection}`); // make sure it's legible regardless of facing direction
				zIdx++;

				sprite.appendChild(zzz);

				setTimeout(() => zzz.remove(), 1600);

				if (elapsed >= sleepDuration) { // go back to idle and nextaction after sleep
					clearInterval(zTimer);
					setTimeout(() => {idle(); nextAction();}, 400);
				}
			}, 1000);
		}

		function nextAction() { // change values here to adjust behavior
			const delay = Math.random() * 3000 + 2000;
			
			setTimeout(() => {
				const roll = Math.random();
				if (roll < 0.45) walk();
				else if (roll < 0.65) jump();
				else if (roll < 0.80) backflip();
				else sleep();
			}, delay);
		}

		idle();
		nextAction();
	}

	function buildHTML() {
		return `
			<div class="pip-card">
				<div class="top-buttons">
					<button class="icon-btn anim-toggle" id="anim-toggle">
						<svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="#fcd00d" stroke="#3d3d3d" stroke-width="40"><path d="M280.11-87.87 420.28-373 126.3-422.43l473.94-449.7h79.65l-141.37 286.8 294.7 48.96-473.46 448.5h-79.65Z"/></svg>
					</button>
					<button class="icon-btn restore-btn" id="restore-btn">
						<svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="#181818"><path d="M135.87-135.87v-299h83v157.11l463.37-463.37H525.13v-83h299v299h-83v-157.11L277.76-218.87h157.11v83h-299Z"/></svg>
							<path d="M21 11V3h-8l3.29 3.29-10 10L3 13v8h8l-3.29-3.29 10-10z"/>
						</svg>
					</button>
				</div>
				<div class="mini-pet-sprite"></div>
			</div>
		`;
	}

	function buildStyles(bgUrl) { // check if the font works in secured pages
		return `
			<meta charset="UTF-8">
			<link href="https://fonts.googleapis.com/css2?family=Lilita+One&display=swap" rel="stylesheet">
			<style>
				* {margin: 0; padding: 0; box-sizing: border-box;}
				html, body {width: 100%; height: 100%; overflow: hidden;}
				
				.pip-card {
					position: relative;
					width: 100%; 
					height: 100%;
					background-image: url("${bgUrl}");
					background-size: 100% 100%;
					display: flex;
					align-items: center;
					justify-content: flex-end;
					padding: 10px 10px 20px;
					flex-direction: column;
				}

				.top-buttons {
					position: absolute;
					top: 10px;
					left: 10px;
					right: 10px;
				}

				.icon-btn {
					position: absolute;
					width: 28px;
					height: 28px;
					display: flex;
					align-items: center;
					justify-content: center;
					border: 1px solid rgba(255,255,255,0.3);
					border-radius: 10px;
					background: rgba(255,255,255,0.9);
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
					position: relative;
				}

				/* base: 0%, walk: 16.67%, down: 33.33%, happy: 66.67%. jump: 83.33%, sleep: 100% (don't need F4)*/
				@keyframes pet-idle {
					0%		{background-position: 0% 0%;}
					50%		{background-position: 33.33% 0%;}
					100%	{background-position: 0% 0%;}
				}

				@keyframes pet-walk {
					0%		{background-position: 0% 0%;}
					50%		{background-position: 16.67% 0%;}
					100%	{background-position: 0% 0%;}
				}

				@keyframes pet-jump {
					0%		{transform: translateY(0);}
					50%		{transform: translateY(-40px);}
					100%	{transform: translateY(0);}
				}

				@keyframes pet-jump-frames {
					0%		{background-position: 66.67% 0%;}
					25%		{background-position: 83.33% 0%;}
					80%		{background-position: 66.67% 0%;}
					100%		{background-position: 66.67% 0%;}}

				@keyframes pet-backflip {
					0%		{transform: translateY(0) rotate(0deg);}
					40%		{transform: translateY(-40px) rotate(180deg);}
					80%		{transform: translateY(0) rotate(360deg);}
					100%	{transform: translateY(0) rotate(360deg);}
				}

				@keyframes pet-backflip-frames {
					0%		{background-position: 66.67% 0%;}
					25%		{background-position: 83.33% 0%;}
					80%		{background-position: 66.67% 0%;}
					100%	{background-position: 66.67% 0%;}}

				.pet-sleep {
					position: absolute;
					right: 14px;
					bottom: 65%;
					font-family: "Lilita One", sans-serif;
					font-size: 24px;
					color: #c8deff;
					-webkit-text-stroke: 0.5px #3355aa;
					text-shadow: 0 0 8px rgba(180, 210, 255, 0.9);
					animation: zzz-float 1.5s ease-out forwards;
				}

				@keyframes zzz-float {
					0%		{opacity: 1; transform: scaleX(var(--flip, 1)) translateY(0) scale(1.1);}
					40%		{opacity: 1;}
					100%	{opacity: 0; transform: scaleX(var(--flip, 1)) translateY(-20px) scale(0.65);}
				}
			</style>
		`;
	}

}
