// helper so that background can access the images
async function assetToDataUrl(path) {
	const response = await fetch(chrome.runtime.getURL(path));
	const buffer = await response.arrayBuffer();
	const base64String = new Uint8Array(buffer).toBase64();

	const dataUrl = `data:image/png;base64,${base64String}`
	return dataUrl;
}

chrome.runtime.onMessage.addListener((message) => {

	if (message.type === "openMiniDisplay") {
		chrome.windows.getLastFocused(
			{populate: true, windowTypes: ["normal"]}, // gets all the tabs in window, ignore popups/dev
			
			async(win) => {
				const allTabs = win.tabs; 
				const activeTab = allTabs.find(tab => tab.active); // find active tab from array

				const petDataUrl = await assetToDataUrl("assets/Animals - Outline/CubicJaguatirica.png");

				chrome.scripting.executeScript(
					{target: {tabId: activeTab.id}, files: ["js/pip.js"]},
					() => {
						chrome.tabs.sendMessage(activeTab.id, {type: "loadPip", petDataUrl});
					}
				)
			}
		);
	}

	if (message.type === "restoreMainDisplay") {
		chrome.windows.getAll({windowTypes: ["normal"]}, (windows) => {
			const mainWin = windows[0]; // first window in array 

			chrome.windows.update(mainWin.id, {focused: true}, () => {
				chrome.action.openPopup({windowId: mainWin.id});
			})
		})
	}
})

