from datetime import datetime, timezone

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="AI Vehicle Tracking API",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

received_frames = 0


@app.get("/")
async def home():
    return {
        "name": "AI Vehicle Tracking",
        "status": "running",
        "ai_detection": "not_configured"
    }


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "received_frames": received_frames
    }


@app.websocket("/ws/video")
async def video_stream(websocket: WebSocket):
    global received_frames

    await websocket.accept()

    await websocket.send_json({
        "type": "status",
        "message": "Соединение установлено. Ожидание видеокадров."
    })

    try:
        while True:
            frame = await websocket.receive_bytes()

            if not frame:
                continue

            received_frames += 1

            # Пока только принимаем кадры.
            # На следующем этапе здесь будет обработка OpenCV,
            # детекция транспорта, трекинг и распознавание номеров.

            if received_frames % 20 == 0:
                await websocket.send_json({
                    "type": "status",
                    "message": (
                        f"Сервер получил {received_frames} кадров. "
                        "AI-модуль ещё не подключён."
                    ),
                    "received_frames": received_frames,
                    "time": datetime.now(timezone.utc).isoformat()
                })

    except WebSocketDisconnect:
        print("Клиент отключился от видеопотока.")

    except Exception as error:
        print(f"Ошибка видеопотока: {error}")

        try:
            await websocket.close(code=1011)
        except Exception:
            pass
