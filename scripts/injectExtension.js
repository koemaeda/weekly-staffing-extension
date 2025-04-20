/**
 * This file is part of the Chrome extension: Weekly Staffing view for SAP My Assignments
 * https://github.com/koemaeda/weekly-staffing-extension
 * Copyright (c) 2025 Guilherme Maeda
 */
/* globals chrome */

// Inject main extension script
const script = document.createElement('script');
script.src = chrome.runtime.getURL('/scripts/main.js');
script.setAttribute("data-extension-baseurl", chrome.runtime.getURL('/'));
document.body.appendChild(script);