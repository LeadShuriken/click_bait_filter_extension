import { getToken, setToken, getGuid, prettyPrintTime, setAuthRequest } from "./utils";

const SERVER_ADDRESS = `${BE_ADDRESS}/${API}`
const GUID = getGuid();
let isEnabledReg;
let isEnabledTop;
// REQUESTING SEGMENTATION FROM BACKEND
const filterScenes = (tabId, changeInfo, tab) => {
  const xhttp = new XMLHttpRequest();

  const callb = function (token) {
    xhttp.onreadystatechange = function () {
      if (this.readyState == 4 && this.status == 200) {
        setToken(xhttp, function () {
          chrome.tabs.sendMessage(tabId, {
            links: JSON.parse(xhttp.response), type: 'pageSegmentation'
          });
        });
      } else if (this.readyState == 4 && this.status == 400) {
        chrome.storage.sync.remove(GUID)
      }
    };

    if (changeInfo.status === 'complete' && tab.url.indexOf('http') === 0) {
      chrome.tabs.sendMessage(tabId, {
        type: 'pageLinksGather'
      }, function (linksGathered) {
        xhttp.open("POST", `${SERVER_ADDRESS}/${SEGMENTATION}`, true);
        setAuthRequest(xhttp, token);
        xhttp.send(JSON.stringify({
          tabId,
          name: tab.url,
          links: linksGathered
        }));
      });
    } else if (!changeInfo.favIconUrl && changeInfo.status !== 'complete') {
      xhttp.open("POST", `${SERVER_ADDRESS}/${TABS}`, true);
      setAuthRequest(xhttp, token);
      xhttp.send(JSON.stringify({
        tabId
      }));
    }
  }
  getToken(callb);
};

const callback = x => {
  if (x.type === "main_frame" && x.initiator) {
    const xhttp = new XMLHttpRequest();
    xhttp.open("POST", `${SERVER_ADDRESS}/${CLICK}`, true);
    const callb = function (token) {
      setAuthRequest(xhttp, token);
      xhttp.send(JSON.stringify(
        {
          link: x.url,
          domain: x.initiator
        }));
    }
    getToken(callb)
  }
};

const sendRegToFront = isEnabledReg => {
  var views = chrome.extension.getViews({ type: "popup" });
  if (views.length > 0) {
    chrome.runtime.sendMessage({ type: "switch_toggler", value: isEnabledReg }, null);
  } else {
    new Notification(prettyPrintTime(), {
      icon: 'Icon-128.png',
      body: `You just ${isEnabledReg ? 'activated' : 'deactivated'} click registy!`
    });
  }
}

const sendTopToFront = isEnabledTop => {
  var views = chrome.extension.getViews({ type: "popup" });
  if (views.length > 0) {
    chrome.runtime.sendMessage({ type: "switch_topology", value: isEnabledTop }, null);
  } else {
    new Notification(prettyPrintTime(), {
      icon: 'Icon-128.png',
      body: `You just ${isEnabledTop ? 'activated' : 'deactivated'} page topology view!`
    });
  }
}

chrome.commands.onCommand.addListener(function (command) {
  if (command === 'switch_toggler') {
    isEnabledReg = !isEnabledReg;
    setEnabled(isEnabledReg);
    sendRegToFront(isEnabledReg)
  } else if (command === 'switch_topology') {
    isEnabledTop = !isEnabledTop;
    setTopology(isEnabledTop);
    sendTopToFront(isEnabledTop)
  }
});

const setTopology = enabled => {
  chrome.storage.sync.set({ "showTopology": enabled }, function () {
    chrome.tabs.getSelected(null, function (tab) {
      if (tab && tab.id > -1) {
        chrome.tabs.sendMessage(tab.id, {
          value: enabled, type: 'showTopology'
        });
      }
    })
  });
}

const setEnabled = enabled => {
  chrome.storage.sync.set({ "registerChange": enabled }, function () {
    if (enabled) {
      chrome.webRequest.onBeforeRequest.addListener(callback, {
        urls: [
          "http://*/*",
          "https://*/*"
        ]
      });
    } else {
      chrome.webRequest.onBeforeRequest.removeListener(callback, {
        urls: [
          "http://*/*",
          "https://*/*"
        ]
      });
    }
  })
}

chrome.storage.sync.get(["registerChange", "showTopology"], function (result) {
  let tempReg = false;
  let tempTop = false;
  if (result) {
    tempReg = result.registerChange !== undefined ? result.registerChange : true;
    tempTop = result.showTopology !== undefined ? result.showTopology : false;
  }
  setEnabled(tempReg);
  setTopology(tempTop);
});

chrome.tabs.onActiveChanged.addListener(filterScenes);
chrome.tabs.onUpdated.addListener(filterScenes);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.type) {
    case 'registerChange':
      setEnabled(request.value);
      sendResponse(request);
      break;
    case 'showTopology':
      setTopology(request.value);
      sendResponse(request);
      break;
    default:
  }
});