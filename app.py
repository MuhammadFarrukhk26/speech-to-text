import tempfile
from pathlib import Path
from threading import Lock

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from faster_whisper import WhisperModel


BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
MAX_UPLOAD_BYTES = 25 * 1024 * 1024
ALLOWED_EXTENSIONS = {".flac", ".m4a", ".mp3", ".mp4", ".mpeg", ".ogg", ".wav", ".webm"}

app = FastAPI(title="Urdu Voice Transcriber")
model: WhisperModel | None = None
model_lock = Lock()
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


def get_model() -> WhisperModel:
    global model
    if model is None:
        with model_lock:
            if model is None:
                model = WhisperModel("small", device="cpu", compute_type="int8")
    return model


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.post("/api/transcribe")
def transcribe(file: UploadFile = File(...)) -> dict[str, str]:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail="Unsupported audio format. Upload MP3, WAV, M4A, OGG, FLAC, MP4, MPEG, or WebM.",
        )

    with tempfile.TemporaryDirectory(prefix="urdu-transcription-") as temp_dir:
        audio_path = Path(temp_dir) / f"audio{suffix}"
        size = 0
        with audio_path.open("wb") as output:
            while chunk := file.file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=413, detail="Audio file exceeds the 25 MB limit.")
                output.write(chunk)

        if size == 0:
            raise HTTPException(status_code=400, detail="The uploaded audio file is empty.")

        segments, _ = get_model().transcribe(
            str(audio_path),
            language="ur",
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 500},
            beam_size=5,
            temperature=0.0,
        )
        text = " ".join(segment.text for segment in segments).strip()

    return {"text": text, "language": "ur"}
