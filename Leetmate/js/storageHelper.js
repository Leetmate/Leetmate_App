function storageGet(keys) {
    return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}
  
function storageSet(data) {
    return new Promise((resolve) => chrome.storage.local.set(data, resolve));
}

function storageRemove(keys) {
    return new Promise((resolve) => chrome.storage.local.remove(keys, resolve));
}

