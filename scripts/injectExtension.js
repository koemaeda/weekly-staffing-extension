// Inject main extension script
const script = document.createElement('script');
script.src = chrome.runtime.getURL('/scripts/main.js');
script.setAttribute("data-extension-baseurl", chrome.runtime.getURL('/'));
document.body.appendChild(script);