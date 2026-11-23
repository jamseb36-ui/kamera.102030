const video = document.getElementById("camera");
const canvas = document.getElementById("frameCanvas");
const context = canvas.getContext("2d");

const startButton = document.getElementById("startCamera");
const stopButton = document.getElementById("stopCamera");
const connectButton = document.getElementById("connectServer");

const cameraMessage = document.getElementById("cameraMessage");
const serverMessage = document.getElementById("serverMessage");
const connectionStatus = document.getElementById("connectionStatus");

let cameraStream = null;
let socket = null;
let sendingFrames = false;
let frameTimer = null;

let stats = {
  entries: 0,
  exits: 0,
  trips: 0,
  vehicles: 0
};

function updateStats() {
  document.getElementById("entries").textContent = stats.entries;
  document.getElementById("exits").textContent = stats.exits;
  document.getElementById("trips").textContent = stats.trips;
  document.getElementById("vehicles").textContent = stats.vehicles;
}

function setConnectionStatus(connected) {
  connectionStatus.textContent = connected
    ? "Сервер подключён"
    : "Сервер не подключён";

  connectionStatus.className = connected
    ? "status online"
    : "status offline";
}

async function startCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    video.srcObject = cameraStream;

    await video.play();

    startButton.disabled = true;
    stopButton.disabled = false;

    cameraMessage.textContent = "Камера работает.";
    startSendingFrames();
  } catch (error) {
    cameraMessage.textContent =
      "Не удалось открыть камеру: " + error.message;
  }
}

function stopCamera() {
  stopSendingFrames();

  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }

  video.srcObject = null;
  startButton.disabled = false;
  stopButton.disabled = true;

  cameraMessage.textContent = "Камера остановлена.";
}

function connectServer() {
  const url = document.getElementById("serverUrl").value.trim();

  if (!url) {
    serverMessage.textContent = "Укажи адрес сервера.";
    return;
  }

  if (socket) {
    socket.close();
  }

  try {
    socket = new WebSocket(url);
  } catch (error) {
    serverMessage.textContent = "Некорректный адрес сервера.";
    return;
  }

  socket.onopen = () => {
    setConnectionStatus(true);
    serverMessage.textContent = "Соединение с сервером установлено.";
    startSendingFrames();
  };

  socket.onmessage = event => {
    try {
      const data = JSON.parse(event.data);
      handleServerMessage(data);
    } catch {
      console.warn("Получено сообщение в неизвестном формате.");
    }
  };

  socket.onerror = () => {
    serverMessage.textContent = "Ошибка соединения с сервером.";
  };

  socket.onclose = () => {
    setConnectionStatus(false);
    serverMessage.textContent = "Соединение закрыто.";
    stopSendingFrames();
  };
}

function startSendingFrames() {
  if (sendingFrames) return;

  sendingFrames = true;

  frameTimer = setInterval(() => {
    if (
      !cameraStream ||
      !socket ||
      socket.readyState !== WebSocket.OPEN ||
      video.readyState < 2
    ) {
      return;
    }

    canvas.width = 640;
    canvas.height = Math.round(
      640 * (video.videoHeight / video.videoWidth)
    );

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(blob => {
      if (
        blob &&
        socket &&
        socket.readyState === WebSocket.OPEN &&
        socket.bufferedAmount < 1000000
      ) {
        socket.send(blob);
      }
    }, "image/jpeg", 0.75);
  }, 250);
}

function stopSendingFrames() {
  sendingFrames = false;

  if (frameTimer) {
    clearInterval(frameTimer);
    frameTimer = null;
  }
}

function handleServerMessage(data) {
  if (data.type === "status") {
    serverMessage.textContent = data.message;
  }

  if (data.type === "stats" && data.stats) {
    stats = { ...stats, ...data.stats };
    updateStats();
  }

  if (data.type === "vehicle_event") {
    addEvent(data);
  }
}

function addEvent(event) {
  const table = document.getElementById("eventList");

  if (table.children.length === 1 &&
      table.textContent.includes("Событий пока нет")) {
    table.innerHTML = "";
  }

  const row = document.createElement("tr");

  const values = [
    event.time || new Date().toLocaleTimeString(),
    event.event || "Обнаружение",
    event.plate || "Не распознан",
    event.direction || "Не определено"
  ];

  values.forEach(value => {
    const cell = document.createElement("td");
    cell.textContent = value;
    row.appendChild(cell);
  });

  table.prepend(row);
}

startButton.addEventListener("click", startCamera);
stopButton.addEventListener("click", stopCamera);
connectButton.addEventListener("click", connectServer);

window.addEventListener("beforeunload", () => {
  stopCamera();

  if (socket) {
    socket.close();
  }
});

updateStats();
