// pip needs this since it can't access the assets directly
// basic flow is: url > raw binary > base 64
async function assetToDataUrl(path) {
	const response = await fetch(chrome.runtime.getURL(path));
	const buffer = await response.arrayBuffer();
	const base64String = new Uint8Array(buffer).toBase64();

	const dataUrl = `data:image/png;base64,${base64String}`// adds the prefix so it can be accessed later
	return dataUrl;
}

chrome.runtime.onMessage.addListener((message) => { // gets message from pip or home to minimize or restore

	if (message.type === "openPip") {
		chrome.windows.getLastFocused(
			{populate: true, windowTypes: ["normal"]}, // gets all the tabs in window, ignore popups/dev
			
			async(win) => {
				const allTabs = win.tabs; 
				const activeTab = allTabs.find(tab => tab.active); // find active tab from array

				const petDataUrl = await assetToDataUrl("assets/Animals - Outline/CubicJaguatirica2.png");

				chrome.scripting.executeScript(
					{target: {tabId: activeTab.id}, files: ["js/pip.js"]},
					() => {
						chrome.tabs.sendMessage(activeTab.id, {type: "loadPip", petDataUrl});
					}
				)
			}
		);
	}

	if (message.type === "restore") {
		chrome.windows.getAll({windowTypes: ["normal"]}, (windows) => {
			const mainWin = windows[0]; // logic is a bit weird here but it works 

			chrome.windows.update(mainWin.id, {focused: true}, () => {
				chrome.action.openPopup({windowId: mainWin.id});
			})
		})
	}
})

